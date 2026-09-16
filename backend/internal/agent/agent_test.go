package agent

import (
	"testing"

	"github.com/kayukwas/tracking-backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test in-memory DB: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.WorkStation{},
		&models.Product{},
		&models.WorkOrder{},
		&models.WorkOrderStation{},
	)
	if err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	phone1 := "6281234567890"
	activeUser := models.User{
		Name:        "Pak Joko (Tukang Bubut)",
		Email:       "joko@kayukwas.co.id",
		PhoneNumber: &phone1,
		Status:      "ACTIVE",
		IsActive:    true,
	}
	db.Create(&activeUser)

	phone2 := "6289990001112"
	pendingUser := models.User{
		Name:        "Kandidat Baru",
		Email:       "kandidat@kayukwas.co.id",
		PhoneNumber: &phone2,
		Status:      "PENDING_ACTIVATION",
		IsActive:    false,
	}
	db.Create(&pendingUser)

	// Seed product & active SPK
	prod := models.Product{
		ProductName: "Telenan Gagang",
		ProductCode: "TLN-GGNG",
		IsActive:    true,
	}
	db.Create(&prod)

	st1 := models.WorkStation{StationCode: "ST-1", Name: "Wood Working", SequenceOrder: 1, IsExternalAllowed: true}
	db.Create(&st1)

	wo := models.WorkOrder{
		SPKNumber:      "SPK-2026-09-0012",
		ProductID:      prod.ID,
		TotalTargetQty: 200,
		Status:         "in_progress",
	}
	db.Create(&wo)

	wos := models.WorkOrderStation{
		WorkOrderID:    wo.ID,
		StationID:      st1.ID,
		SequenceOrder:  1,
		AssignedType:   "internal",
		AssignedUserID: &activeUser.ID,
		Status:         "in_progress",
		InputQty:       200,
	}
	db.Create(&wos)

	return db
}

func TestAgentScenario1_StandardReport(t *testing.T) {
	db := setupTestDB(t)
	engine := NewAgentEngine(db, nil, nil)

	resp, err := engine.ProcessMessage(AgentParseRequest{
		PhoneNumber: "6281234567890",
		RawMessage:  "Pak mandor, SPK 0012 talenan jati sampun rampung 190 iji. Sing 10 pecah serat pas diserut.",
		InputType:   "text",
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Intent != "production_report" {
		t.Errorf("Expected intent production_report, got %s", resp.Intent)
	}
	if resp.ExtractedData["pass_qty"] != 190 || resp.ExtractedData["reject_qty"] != 10 {
		t.Errorf("Expected pass 190 and reject 10, got pass=%v, reject=%v", resp.ExtractedData["pass_qty"], resp.ExtractedData["reject_qty"])
	}
	if resp.ExtractedData["defect_code"] != "DEF_CRACK_GRAIN" {
		t.Errorf("Expected defect DEF_CRACK_GRAIN, got %v", resp.ExtractedData["defect_code"])
	}
	if !resp.RequiresConfirmation {
		t.Errorf("Expected requires_confirmation to be true")
	}
}

func TestAgentScenario4_EscalationAlertTrigger(t *testing.T) {
	db := setupTestDB(t)
	engine := NewAgentEngine(db, nil, nil)

	resp, err := engine.ProcessMessage(AgentParseRequest{
		PhoneNumber: "6281234567890",
		RawMessage:  "Lapor SPK 0012 talenan selesai 150 pcs mas, tapi 35 pcs muntir melengkung baling semua kena panas.",
		InputType:   "text",
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.EscalationAlert == nil {
		t.Errorf("Expected escalation alert triggered for reject rate > 10%%")
	}
}

func TestAgentScenario7_ActivationBarrierGuardrail(t *testing.T) {
	db := setupTestDB(t)
	engine := NewAgentEngine(db, nil, nil)

	resp, err := engine.ProcessMessage(AgentParseRequest{
		PhoneNumber: "6289990001112",
		RawMessage:  "Halo saya mau lapor kerjaan hari ini 50 pcs",
		InputType:   "text",
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Intent != "activation_request" && resp.Intent != "activation_blocked" {
		t.Errorf("Expected intent activation_request or activation_blocked, got %s", resp.Intent)
	}
}
