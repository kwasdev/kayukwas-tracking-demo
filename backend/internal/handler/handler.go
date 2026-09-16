package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/kayukwas/tracking-backend/internal/service"
	"github.com/kayukwas/tracking-backend/internal/utils"
)

type Handlers struct {
	authServ service.AuthService
	userServ service.UserService
	roleServ service.RoleService
	audtServ service.AuditLogService
	actvServ service.WhatsAppActivationService
}

func NewHandlers(
	authServ service.AuthService,
	userServ service.UserService,
	roleServ service.RoleService,
	audtServ service.AuditLogService,
	actvServ service.WhatsAppActivationService,
) *Handlers {
	return &Handlers{
		authServ: authServ,
		userServ: userServ,
		roleServ: roleServ,
		audtServ: audtServ,
		actvServ: actvServ,
	}
}

// ----------------- Auth Handlers -----------------
func (h *Handlers) Login(c *fiber.Ctx) error {
	var req service.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format input login tidak valid", err.Error())
	}

	if req.Identifier == "" || req.Password == "" {
		return utils.JSONError(c, fiber.StatusBadRequest, "Nomor WhatsApp/Email dan kata sandi wajib diisi", nil)
	}

	res, err := h.authServ.Login(req)
	if err != nil {
		return utils.JSONError(c, fiber.StatusUnauthorized, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Login berhasil", res)
}

func (h *Handlers) GetProfile(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uint64)
	if !ok {
		return utils.JSONError(c, fiber.StatusUnauthorized, "Sesi tidak valid", nil)
	}

	user, err := h.authServ.GetProfile(userID)
	if err != nil {
		return utils.JSONError(c, fiber.StatusNotFound, "Pengguna tidak ditemukan", err.Error())
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Data profil pengguna", user)
}

// ----------------- User Handlers -----------------
func (h *Handlers) ListUsers(c *fiber.Ctx) error {
	search := c.Query("search", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	users, total, err := h.userServ.ListUsers(search, page, limit)
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Gagal mengambil daftar pengguna", err.Error())
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Daftar pengguna", fiber.Map{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *Handlers) GetUserByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID pengguna tidak valid", nil)
	}

	user, err := h.userServ.GetUserByID(id)
	if err != nil {
		return utils.JSONError(c, fiber.StatusNotFound, "Pengguna tidak ditemukan", nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Detail pengguna", user)
}

func (h *Handlers) CreateUser(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)

	var dto service.CreateUserDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	user, err := h.userServ.CreateUser(actorID, dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusCreated, "Calon pengguna baru berhasil didaftarkan dengan status PENDING_ACTIVATION", user)
}

func (h *Handlers) UpdateUser(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID pengguna tidak valid", nil)
	}

	var dto service.UpdateUserDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	user, err := h.userServ.UpdateUser(actorID, id, dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Data pengguna berhasil diperbarui", user)
}

func (h *Handlers) ToggleUserActive(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID pengguna tidak valid", nil)
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	user, err := h.userServ.ToggleActive(actorID, id, req.IsActive)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Status keaktifan pengguna berhasil diubah", user)
}

// ----------------- Role Handlers -----------------
func (h *Handlers) ListRoles(c *fiber.Ctx) error {
	roles, err := h.roleServ.ListRoles()
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Gagal mengambil daftar peran", err.Error())
	}
	return utils.JSONSuccess(c, fiber.StatusOK, "Daftar peran", roles)
}

func (h *Handlers) GetRoleByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID peran tidak valid", nil)
	}

	role, err := h.roleServ.GetRoleByID(id)
	if err != nil {
		return utils.JSONError(c, fiber.StatusNotFound, "Peran tidak ditemukan", nil)
	}
	return utils.JSONSuccess(c, fiber.StatusOK, "Detail peran", role)
}

func (h *Handlers) CreateRole(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)

	var dto service.CreateRoleDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	role, err := h.roleServ.CreateRole(actorID, dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusCreated, "Peran baru berhasil dibuat", role)
}

func (h *Handlers) UpdateRolePermissions(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID peran tidak valid", nil)
	}

	var dto service.SyncRolePermissionsDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	role, err := h.roleServ.UpdateRolePermissions(actorID, id, dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Izin peran berhasil disinkronkan", role)
}

func (h *Handlers) DeleteRole(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "ID peran tidak valid", nil)
	}

	if err := h.roleServ.DeleteRole(actorID, id); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Peran berhasil dihapus", nil)
}

func (h *Handlers) ListPermissions(c *fiber.Ctx) error {
	perms, err := h.roleServ.ListPermissions()
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Gagal mengambil daftar izin", err.Error())
	}
	return utils.JSONSuccess(c, fiber.StatusOK, "Daftar hak akses", perms)
}

// ----------------- Audit Log Handlers -----------------
func (h *Handlers) ListAuditLogs(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	logs, total, err := h.audtServ.ListLogs(page, limit)
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Gagal mengambil riwayat audit log", err.Error())
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Daftar catatan aktivitas audit", fiber.Map{
		"audit_logs": logs,
		"total":      total,
		"page":       page,
		"limit":      limit,
	})
}

// ----------------- Activation Handlers (WhatsApp Cold Bonding) -----------------
func (h *Handlers) RequestActivation(c *fiber.Ctx) error {
	var dto service.RequestActivationDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format nomor telepon tidak valid", err.Error())
	}

	res, err := h.actvServ.RequestActivation(dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Tautan Magic Link berhasil diterbitkan", res)
}

func (h *Handlers) VerifyMagicLink(c *fiber.Ctx) error {
	magicToken := c.Query("token")
	if magicToken == "" {
		return utils.JSONError(c, fiber.StatusBadRequest, "Parameter token Magic Link wajib disertakan", nil)
	}

	res, err := h.actvServ.VerifyMagicLink(magicToken)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Magic Link valid, kode OTP 6-digit telah dikirimkan ke WhatsApp", res)
}

func (h *Handlers) VerifyOtpAndSetPassword(c *fiber.Ctx) error {
	var dto service.SetPasswordDTO
	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	user, err := h.actvServ.VerifyOtpAndSetPassword(dto)
	if err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Selamat! Akun Anda telah berhasil diaktifkan. Silakan login ke dalam sistem.", fiber.Map{
		"user_id": user.ID,
		"email":   user.Email,
		"name":    user.Name,
		"status":  user.Status,
	})
}
