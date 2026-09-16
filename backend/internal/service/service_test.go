package service_test

import (
	"os"
	"testing"

	"github.com/kayukwas/tracking-backend/config"
	"github.com/kayukwas/tracking-backend/internal/database"
	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/repository"
	"github.com/kayukwas/tracking-backend/internal/service"
)

func setupTestDB(t *testing.T) (*service.AppServices, repository.WaResetRepository, func()) {
	testDBName := "test_kayukwas.db"
	_ = os.Remove(testDBName)

	cfg := &config.Config{
		DBDriver:  "sqlite",
		DBName:    testDBName,
		JWTSecret: "test-secret-key-123",
		AppURL:    "http://localhost:3000",
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		t.Fatalf("Failed to init test db: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	waResetRepo := repository.NewWaResetRepository(db)

	services := service.NewAppServices(cfg, userRepo, roleRepo, auditRepo, waResetRepo)

	cleanup := func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
		_ = os.Remove(testDBName)
	}

	return services, waResetRepo, cleanup
}

func TestSuperuserBootstrapAndLogin(t *testing.T) {
	services, _, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Test Superuser Login
	res, err := services.Login(service.LoginRequest{
		Identifier: "admin@kayukwas.co.id",
		Password:   "AdminKWAS2026!",
	})
	if err != nil {
		t.Fatalf("Expected superuser login to succeed, got error: %v", err)
	}

	if res.Token == "" {
		t.Errorf("Expected JWT token to be generated")
	}

	if !res.User.IsSuperuser() {
		t.Errorf("Expected user to have superuser role")
	}

	if !res.User.HasPermission(models.PermManageUsers) {
		t.Errorf("Expected superuser bypass to grant PermManageUsers")
	}
}

func TestWhatsAppActivationFlow(t *testing.T) {
	services, waRepo, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Superuser creates a new user (PENDING_ACTIVATION, no password)
	phone := "081298765432"
	createdUser, err := services.CreateUser(1, service.CreateUserDTO{
		Name:        "Budi Pengrajin",
		Email:       "budi@example.com",
		PhoneNumber: phone,
		RoleIDs:     []uint64{2}, // PPIC / Mitra
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if createdUser.Status != models.UserStatusPendingActivation {
		t.Errorf("Expected status %s, got %s", models.UserStatusPendingActivation, createdUser.Status)
	}

	if createdUser.Password != nil {
		t.Errorf("Expected password to be nil for new user before activation")
	}

	// 2. Candidate initiates WhatsApp Activation (Cold Bonding)
	reqResp, err := services.RequestActivation(service.RequestActivationDTO{
		PhoneNumber: phone,
	})
	if err != nil {
		t.Fatalf("Failed to request activation: %v", err)
	}

	if reqResp.MagicLinkToken == "" {
		t.Fatalf("Expected magic link token to be issued")
	}

	// 3. User clicks Magic Link in browser -> System issues OTP
	verifyLinkResp, err := services.VerifyMagicLink(reqResp.MagicLinkToken)
	if err != nil {
		t.Fatalf("Failed to verify magic link: %v", err)
	}

	waSession, err := waRepo.FindByToken(verifyLinkResp.Token)
	if err != nil || waSession.VerificationCode == nil || *waSession.VerificationCode == "" {
		t.Fatalf("Expected OTP to be generated and stored in session")
	}

	// 4. User receives OTP on WhatsApp, inputs OTP and sets new password
	newPass := "BudiRahasia123!"
	activatedUser, err := services.VerifyOtpAndSetPassword(service.SetPasswordDTO{
		Token:       verifyLinkResp.Token,
		OTP:         *waSession.VerificationCode,
		NewPassword: newPass,
	})
	if err != nil {
		t.Fatalf("Failed to verify OTP and set password: %v", err)
	}

	if activatedUser.Status != models.UserStatusActive {
		t.Errorf("Expected user status to be %s, got %s", models.UserStatusActive, activatedUser.Status)
	}

	if activatedUser.WhatsAppVerifiedAt == nil {
		t.Errorf("Expected WhatsAppVerifiedAt to be timestamped")
	}

	// 5. User can now login using new password
	loginResp, err := services.Login(service.LoginRequest{
		Identifier: phone,
		Password:   newPass,
	})
	if err != nil {
		t.Fatalf("Failed to login with newly activated user: %v", err)
	}

	if loginResp.User.Name != "Budi Pengrajin" {
		t.Errorf("Expected logged in user to be Budi Pengrajin, got %s", loginResp.User.Name)
	}
}

func TestAuditLogRecording(t *testing.T) {
	services, _, cleanup := setupTestDB(t)
	defer cleanup()

	// List audit logs
	logs, total, err := services.ListLogs(1, 20)
	if err != nil {
		t.Fatalf("Failed to list audit logs: %v", err)
	}

	if total == 0 || len(logs) == 0 {
		t.Errorf("Expected initial seed audit log to exist")
	}
}
