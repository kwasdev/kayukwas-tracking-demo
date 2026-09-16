package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/kayukwas/tracking-backend/config"
	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/repository"
	"github.com/kayukwas/tracking-backend/internal/utils"
)

// DTOs
type LoginRequest struct {
	Identifier string `json:"identifier"` // Email or Phone
	Password   string `json:"password"`
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

type CreateUserDTO struct {
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	PhoneNumber string   `json:"phone_number"`
	RoleIDs     []uint64 `json:"role_ids"`
}

type UpdateUserDTO struct {
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	PhoneNumber string   `json:"phone_number"`
	RoleIDs     []uint64 `json:"role_ids"`
	IsActive    *bool    `json:"is_active"`
}

type CreateRoleDTO struct {
	Name          string   `json:"name"`
	PermissionIDs []uint64 `json:"permission_ids"`
}

type SyncRolePermissionsDTO struct {
	PermissionIDs []uint64 `json:"permission_ids"`
}

type RequestActivationDTO struct {
	PhoneNumber string `json:"phone_number"`
}

type RequestActivationResponse struct {
	Message        string    `json:"message"`
	MagicLinkURL   string    `json:"magic_link_url"`
	MagicLinkToken string    `json:"magic_link_token"`
	ExpiresAt      time.Time `json:"expires_at"`
}

type VerifyMagicLinkResponse struct {
	Token     string    `json:"token"`
	PhoneMask string    `json:"phone_mask"`
	UserName  string    `json:"user_name"`
	ExpiresAt time.Time `json:"expires_at"`
}

type SetPasswordDTO struct {
	Token       string `json:"token"`
	OTP         string `json:"otp"`
	NewPassword string `json:"new_password"`
}

// Interfaces
type AuthService interface {
	Login(req LoginRequest) (*LoginResponse, error)
	GetProfile(userID uint64) (*models.User, error)
}

type UserService interface {
	CreateUser(actorID uint64, dto CreateUserDTO) (*models.User, error)
	UpdateUser(actorID, userID uint64, dto UpdateUserDTO) (*models.User, error)
	ToggleActive(actorID, userID uint64, isActive bool) (*models.User, error)
	GetUserByID(id uint64) (*models.User, error)
	ListUsers(search string, page, limit int) ([]models.User, int64, error)
}

type RoleService interface {
	ListRoles() ([]models.Role, error)
	GetRoleByID(id uint64) (*models.Role, error)
	CreateRole(actorID uint64, dto CreateRoleDTO) (*models.Role, error)
	UpdateRolePermissions(actorID, roleID uint64, dto SyncRolePermissionsDTO) (*models.Role, error)
	DeleteRole(actorID, roleID uint64) error
	ListPermissions() ([]models.Permission, error)
}

type AuditLogService interface {
	RecordLog(userID *uint64, actionType, description string)
	ListLogs(page, limit int) ([]models.AuditLog, int64, error)
	ListLogsByUser(userID uint64, page, limit int) ([]models.AuditLog, int64, error)
}

type WhatsAppActivationService interface {
	RequestActivation(dto RequestActivationDTO) (*RequestActivationResponse, error)
	VerifyMagicLink(magicToken string) (*VerifyMagicLinkResponse, error)
	VerifyOtpAndSetPassword(dto SetPasswordDTO) (*models.User, error)
}

type WANotifier interface {
	SendTextMessage(ctx context.Context, toPhone, messageText string) error
}

// Service Implementation
type AppServices struct {
	cfg        *config.Config
	userRepo   repository.UserRepository
	roleRepo   repository.RoleRepository
	auditRepo  repository.AuditLogRepository
	waRepo     repository.WaResetRepository
	auditServ  AuditLogService
	waNotifier WANotifier
}

func NewAppServices(
	cfg *config.Config,
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	auditRepo repository.AuditLogRepository,
	waRepo repository.WaResetRepository,
) *AppServices {
	s := &AppServices{
		cfg:       cfg,
		userRepo:  userRepo,
		roleRepo:  roleRepo,
		auditRepo: auditRepo,
		waRepo:    waRepo,
	}
	s.auditServ = s
	return s
}

func (s *AppServices) SetWANotifier(notifier WANotifier) {
	s.waNotifier = notifier
}

// ----------------- AuditLogService -----------------
func (s *AppServices) RecordLog(userID *uint64, actionType, description string) {
	logEntry := &models.AuditLog{
		UserID:      userID,
		ActionType:  actionType,
		Description: description,
	}
	if err := s.auditRepo.Create(logEntry); err != nil {
		log.Printf("[AuditLog] Failed to record log: %v\n", err)
	}
}

func (s *AppServices) ListLogs(page, limit int) ([]models.AuditLog, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.auditRepo.FindAll(limit, offset)
}

func (s *AppServices) ListLogsByUser(userID uint64, page, limit int) ([]models.AuditLog, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.auditRepo.FindByUserID(userID, limit, offset)
}

// ----------------- AuthService -----------------
func (s *AppServices) Login(req LoginRequest) (*LoginResponse, error) {
	identifier := req.Identifier
	var user *models.User
	var err error

	normalizedPhone := utils.NormalizePhoneNumber(identifier)
	user, err = s.userRepo.FindByPhone(normalizedPhone)
	if err != nil || user == nil {
		user, err = s.userRepo.FindByEmail(identifier)
	}

	if err != nil || user == nil {
		return nil, errors.New("nomor WhatsApp atau email tidak terdaftar")
	}

	if !user.IsActive {
		return nil, errors.New("akun Anda sedang dinonaktifkan. Silakan hubungi Superuser/Administrator")
	}

	if user.Status == models.UserStatusPendingActivation {
		return nil, errors.New("akun Anda belum aktif. Silakan lakukan aktivasi mandiri via WhatsApp terlebih dahulu di menu /aktivasi")
	}

	if user.Password == nil || *user.Password == "" {
		return nil, errors.New("kata sandi belum ditentukan. Silakan aktivasi akun Anda terlebih dahulu")
	}

	if !utils.CheckPasswordHash(req.Password, *user.Password) {
		s.RecordLog(&user.ID, "auth_failed", fmt.Sprintf("Gagal login: kata sandi salah untuk user %s", user.Email))
		return nil, errors.New("kata sandi yang Anda masukkan salah")
	}

	// Generate JWT
	roles := make([]string, 0, len(user.Roles))
	for _, r := range user.Roles {
		if r.IsActive {
			roles = append(roles, r.Name)
		}
	}
	permissions := user.GetAllPermissions()
	user.Permissions = permissions

	token, err := utils.GenerateJWT(s.cfg.JWTSecret, user.ID, user.Email, user.Name, roles, permissions, 24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat token autentikasi: %w", err)
	}

	s.RecordLog(&user.ID, "auth_login", fmt.Sprintf("User %s berhasil login ke dalam sistem", user.Email))

	return &LoginResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *AppServices) GetProfile(userID uint64) (*models.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	if user != nil {
		user.Permissions = user.GetAllPermissions()
	}
	return user, nil
}

// ----------------- UserService -----------------
func (s *AppServices) CreateUser(actorID uint64, dto CreateUserDTO) (*models.User, error) {
	if dto.Name == "" || dto.Email == "" {
		return nil, errors.New("nama dan email wajib diisi")
	}

	var phonePtr *string
	if dto.PhoneNumber != "" {
		normalized := utils.NormalizePhoneNumber(dto.PhoneNumber)
		phonePtr = &normalized

		// Check if phone already registered
		existing, _ := s.userRepo.FindByPhone(normalized)
		if existing != nil {
			return nil, errors.New("nomor WhatsApp sudah terdaftar pada akun lain")
		}
	}

	// Check if email already registered
	existingEmail, _ := s.userRepo.FindByEmail(dto.Email)
	if existingEmail != nil {
		return nil, errors.New("email sudah terdaftar pada akun lain")
	}

	user := &models.User{
		Name:        dto.Name,
		Email:       dto.Email,
		PhoneNumber: phonePtr,
		Status:      models.UserStatusPendingActivation,
		IsActive:    true,
		Password:    nil, // Sesuai aturan: password dikosongkan saat pendaftaran oleh Superuser
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("gagal mendaftarkan pengguna: %w", err)
	}

	// Assign Roles
	if len(dto.RoleIDs) > 0 {
		if err := s.userRepo.AssignRoles(user, dto.RoleIDs); err != nil {
			log.Printf("[UserService] Error assigning roles: %v\n", err)
		}
	}

	// Fetch updated user
	createdUser, _ := s.userRepo.FindByID(user.ID)

	s.RecordLog(&actorID, "create_user", fmt.Sprintf("Mendaftarkan calon pengguna baru: %s (%s) dengan status PENDING_ACTIVATION", user.Name, user.Email))

	return createdUser, nil
}

func (s *AppServices) UpdateUser(actorID, userID uint64, dto UpdateUserDTO) (*models.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("pengguna tidak ditemukan")
	}

	if dto.Name != "" {
		user.Name = dto.Name
	}
	if dto.Email != "" && dto.Email != user.Email {
		existing, _ := s.userRepo.FindByEmail(dto.Email)
		if existing != nil && existing.ID != userID {
			return nil, errors.New("email sudah digunakan pengguna lain")
		}
		user.Email = dto.Email
	}
	if dto.PhoneNumber != "" {
		normalized := utils.NormalizePhoneNumber(dto.PhoneNumber)
		existing, _ := s.userRepo.FindByPhone(normalized)
		if existing != nil && existing.ID != userID {
			return nil, errors.New("nomor WhatsApp sudah digunakan pengguna lain")
		}
		user.PhoneNumber = &normalized
	}
	if dto.IsActive != nil {
		user.IsActive = *dto.IsActive
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, fmt.Errorf("gagal memperbarui data pengguna: %w", err)
	}

	if dto.RoleIDs != nil {
		if err := s.userRepo.AssignRoles(user, dto.RoleIDs); err != nil {
			return nil, fmt.Errorf("gagal memperbarui peran pengguna: %w", err)
		}
	}

	updatedUser, _ := s.userRepo.FindByID(userID)
	s.RecordLog(&actorID, "update_user", fmt.Sprintf("Memperbarui data dan penugasan peran pengguna ID %d (%s)", userID, updatedUser.Name))

	return updatedUser, nil
}

func (s *AppServices) ToggleActive(actorID, userID uint64, isActive bool) (*models.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("pengguna tidak ditemukan")
	}

	if user.IsSuperuser() && !isActive {
		return nil, errors.New("akun Superuser utama tidak dapat dinonaktifkan")
	}

	user.IsActive = isActive
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	statusStr := "diaktifkan"
	if !isActive {
		statusStr = "dinonaktifkan"
	}
	s.RecordLog(&actorID, "toggle_user_status", fmt.Sprintf("Akun pengguna %s (%s) %s", user.Name, user.Email, statusStr))

	return user, nil
}

func (s *AppServices) GetUserByID(id uint64) (*models.User, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if user != nil {
		user.Permissions = user.GetAllPermissions()
	}
	return user, nil
}

func (s *AppServices) ListUsers(search string, page, limit int) ([]models.User, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	users, total, err := s.userRepo.FindAll(search, limit, offset)
	if err == nil {
		for i := range users {
			users[i].Permissions = users[i].GetAllPermissions()
		}
	}
	return users, total, err
}

// ----------------- RoleService -----------------
func (s *AppServices) ListRoles() ([]models.Role, error) {
	return s.roleRepo.FindAll()
}

func (s *AppServices) GetRoleByID(id uint64) (*models.Role, error) {
	return s.roleRepo.FindByID(id)
}

func (s *AppServices) CreateRole(actorID uint64, dto CreateRoleDTO) (*models.Role, error) {
	if dto.Name == "" {
		return nil, errors.New("nama peran/jabatan wajib diisi")
	}

	existing, _ := s.roleRepo.FindByName(dto.Name)
	if existing != nil {
		return nil, errors.New("nama peran sudah terdaftar")
	}

	role := &models.Role{
		Name:     dto.Name,
		IsActive: true,
	}

	if err := s.roleRepo.Create(role); err != nil {
		return nil, err
	}

	if len(dto.PermissionIDs) > 0 {
		_ = s.roleRepo.SyncPermissions(role, dto.PermissionIDs)
	}

	createdRole, _ := s.roleRepo.FindByID(role.ID)
	s.RecordLog(&actorID, "create_role", fmt.Sprintf("Membuat peran baru: %s", role.Name))

	return createdRole, nil
}

func (s *AppServices) UpdateRolePermissions(actorID, roleID uint64, dto SyncRolePermissionsDTO) (*models.Role, error) {
	role, err := s.roleRepo.FindByID(roleID)
	if err != nil {
		return nil, errors.New("peran tidak ditemukan")
	}

	if err := s.roleRepo.SyncPermissions(role, dto.PermissionIDs); err != nil {
		return nil, fmt.Errorf("gagal memperbarui izin peran: %w", err)
	}

	updatedRole, _ := s.roleRepo.FindByID(roleID)
	s.RecordLog(&actorID, "sync_role_permissions", fmt.Sprintf("Memperbarui paket izin untuk peran %s", role.Name))

	return updatedRole, nil
}

func (s *AppServices) DeleteRole(actorID, roleID uint64) error {
	role, err := s.roleRepo.FindByID(roleID)
	if err != nil {
		return errors.New("peran tidak ditemukan")
	}

	if role.Name == models.RoleSuperuser {
		return errors.New("peran Superuser adalah peran inti sistem dan tidak boleh dihapus")
	}

	if err := s.roleRepo.Delete(roleID); err != nil {
		return err
	}

	s.RecordLog(&actorID, "delete_role", fmt.Sprintf("Menghapus peran: %s (ID %d)", role.Name, roleID))
	return nil
}

func (s *AppServices) ListPermissions() ([]models.Permission, error) {
	return s.roleRepo.GetAllPermissions()
}

// ----------------- WhatsAppActivationService -----------------
func (s *AppServices) RequestActivation(dto RequestActivationDTO) (*RequestActivationResponse, error) {
	if dto.PhoneNumber == "" {
		return nil, errors.New("nomor WhatsApp wajib diisi")
	}

	normalized := utils.NormalizePhoneNumber(dto.PhoneNumber)
	user, err := s.userRepo.FindByPhone(normalized)
	if err != nil || user == nil {
		return nil, errors.New("nomor WhatsApp tidak terdaftar di sistem. Hubungi Superuser/Admin untuk didaftarkan.")
	}

	if !user.IsActive {
		return nil, errors.New("akun Anda sedang dinonaktifkan. Hubungi Superuser.")
	}

	// Buat token magic link & token sesi reset
	token, _ := utils.GenerateSecureToken(32)
	magicToken, _ := utils.GenerateSecureToken(24)
	now := time.Now()
	expiresAt := now.Add(15 * time.Minute) // Berlaku 15 menit

	reset := &models.WaPasswordReset{
		UserID:         user.ID,
		Token:          token,
		MagicLinkToken: &magicToken,
		ExpiresAt:      expiresAt,
		Status:         models.WaResetStatusRequested,
		CreatedAt:      now,
	}

	if err := s.waRepo.Create(reset); err != nil {
		return nil, fmt.Errorf("gagal membuat sesi aktivasi: %w", err)
	}

	magicLinkURL := fmt.Sprintf("%s/aktivasi/verifikasi?token=%s", s.cfg.AppURL, magicToken)

	// Send real WhatsApp message via OpenWA if configured
	if s.waNotifier != nil && user.PhoneNumber != nil && *user.PhoneNumber != "" {
		waMsg := fmt.Sprintf("Halo %s,\n\nBerikut adalah tautan aktivasi mandiri akun Sistem Tracking Kayu KWAS Anda:\n%s\n\nTautan ini berlaku selama 15 menit. Jangan bagikan tautan ini kepada siapapun.", user.Name, magicLinkURL)
		go func(phone, text string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := s.waNotifier.SendTextMessage(ctx, phone, text); err != nil {
				log.Printf("[WhatsApp Gateway Error] Gagal mengirim Magic Link ke %s: %v\n", phone, err)
			}
		}(*user.PhoneNumber, waMsg)
	}

	// Log audit & dispatch event
	s.RecordLog(&user.ID, "wa_activation_requested", fmt.Sprintf("Permintaan aktivasi mandiri via WhatsApp untuk %s (%s)", user.Name, normalized))
	log.Printf("[WhatsApp Cold Bonding] Dispatched Magic Link to %s: %s\n", normalized, magicLinkURL)

	return &RequestActivationResponse{
		Message:        "Tautan aktivasi mandiri (Magic Link) telah dikirimkan ke WhatsApp Anda. Silakan buka tautan tersebut dalam 15 menit.",
		MagicLinkURL:   magicLinkURL,
		MagicLinkToken: magicToken,
		ExpiresAt:      expiresAt,
	}, nil
}

func (s *AppServices) VerifyMagicLink(magicToken string) (*VerifyMagicLinkResponse, error) {
	if magicToken == "" {
		return nil, errors.New("token Magic Link tidak valid")
	}

	reset, err := s.waRepo.FindByMagicLinkToken(magicToken)
	if err != nil || reset == nil {
		return nil, errors.New("tautan aktivasi tidak ditemukan atau sudah kadaluarsa")
	}

	if time.Now().After(reset.ExpiresAt) {
		return nil, errors.New("tautan aktivasi telah kadaluarsa (melebihi 15 menit). Silakan minta tautan baru.")
	}

	if reset.Status == models.WaResetStatusCompleted {
		return nil, errors.New("sesi aktivasi ini sudah selesai digunakan")
	}

	// Reuse existing OTP if still valid (e.g. duplicate component mount / page refresh)
	var otp string
	var otpExpiresAt time.Time
	shouldSendWA := true

	if reset.VerificationCode != nil && reset.VerificationCodeExpiresAt != nil && time.Now().Before(*reset.VerificationCodeExpiresAt) {
		otp = *reset.VerificationCode
		otpExpiresAt = *reset.VerificationCodeExpiresAt
		shouldSendWA = false
	} else {
		otp = utils.Generate6DigitOTP()
		otpExpiresAt = time.Now().Add(5 * time.Minute)
		reset.VerificationCode = &otp
		reset.VerificationCodeExpiresAt = &otpExpiresAt
		reset.Status = models.WaResetStatusVerificationSent

		if err := s.waRepo.Update(reset); err != nil {
			return nil, fmt.Errorf("gagal menerbitkan kode OTP: %w", err)
		}
	}

	// Mask phone number (e.g. 62812****7890)
	phone := ""
	if reset.User.PhoneNumber != nil {
		phone = *reset.User.PhoneNumber
	}
	phoneMask := phone
	if len(phone) >= 8 {
		phoneMask = phone[:4] + "****" + phone[len(phone)-4:]
	}

	// Send real WhatsApp OTP message via OpenWA if configured and not already sent
	if s.waNotifier != nil && phone != "" && shouldSendWA {
		otpMsg := fmt.Sprintf("Halo %s,\n\nKode verifikasi OTP akun Sistem Tracking Kayu KWAS Anda: *%s*\n\nKode berlaku selama 5 menit. Masukkan kode ini pada layar aktivasi untuk menyetel kata sandi baru Anda.", reset.User.Name, otp)
		go func(targetPhone, text string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := s.waNotifier.SendTextMessage(ctx, targetPhone, text); err != nil {
				log.Printf("[WhatsApp Gateway Error] Gagal mengirim OTP ke %s: %v\n", targetPhone, err)
			}
		}(phone, otpMsg)
	}

	log.Printf("[WhatsApp OTP Dispatch] Sent 6-digit OTP [%s] to user %s (%s) valid until %s\n",
		otp, reset.User.Name, phone, otpExpiresAt.Format(time.RFC3339))

	s.RecordLog(&reset.UserID, "wa_otp_dispatched", fmt.Sprintf("Kode OTP 6-digit dikirimkan ke nomor WhatsApp %s", phoneMask))

	return &VerifyMagicLinkResponse{
		Token:     reset.Token,
		PhoneMask: phoneMask,
		UserName:  reset.User.Name,
		ExpiresAt: otpExpiresAt,
	}, nil
}

func (s *AppServices) VerifyOtpAndSetPassword(dto SetPasswordDTO) (*models.User, error) {
	if dto.Token == "" || dto.OTP == "" || dto.NewPassword == "" {
		return nil, errors.New("token, kode OTP, dan kata sandi baru wajib diisi")
	}

	if len(dto.NewPassword) < 6 {
		return nil, errors.New("kata sandi minimal 6 karakter")
	}

	reset, err := s.waRepo.FindByToken(dto.Token)
	if err != nil || reset == nil {
		return nil, errors.New("sesi aktivasi tidak ditemukan")
	}

	if reset.Status == models.WaResetStatusCompleted {
		return nil, errors.New("sesi aktivasi ini sudah selesai digunakan")
	}

	if reset.VerificationCodeExpiresAt == nil || time.Now().After(*reset.VerificationCodeExpiresAt) {
		return nil, errors.New("kode OTP 6-digit telah kadaluarsa (melebihi 5 menit). Silakan minta aktivasi ulang.")
	}

	if reset.VerificationCode == nil || *reset.VerificationCode != dto.OTP {
		s.RecordLog(&reset.UserID, "wa_otp_failed", "Percobaan kode OTP salah pada sesi aktivasi")
		return nil, errors.New("kode OTP 6-digit yang Anda masukkan salah")
	}

	// Update User Password & Status
	user, err := s.userRepo.FindByID(reset.UserID)
	if err != nil {
		return nil, errors.New("pengguna tidak ditemukan")
	}

	hashedPassword, err := utils.HashPassword(dto.NewPassword)
	if err != nil {
		return nil, fmt.Errorf("gagal memproses kata sandi: %w", err)
	}

	now := time.Now()
	user.Password = &hashedPassword
	user.Status = models.UserStatusActive
	user.WhatsAppVerifiedAt = &now
	user.IsActive = true

	if err := s.userRepo.Update(user); err != nil {
		return nil, fmt.Errorf("gagal mengaktifkan akun pengguna: %w", err)
	}

	// Mark Reset Completed
	reset.Status = models.WaResetStatusCompleted
	_ = s.waRepo.Update(reset)

	s.RecordLog(&user.ID, "account_activated", fmt.Sprintf("Akun %s (%s) BERHASIL DIAKTIFKAN mandiri melalui verifikasi WhatsApp", user.Name, user.Email))

	return user, nil
}
