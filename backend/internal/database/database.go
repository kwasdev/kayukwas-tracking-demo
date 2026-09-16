package database

import (
	"log"
	"os"
	"path/filepath"

	"github.com/kayukwas/tracking-backend/config"
	"github.com/kayukwas/tracking-backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.DBDriver {
	case "sqlite":
		if dir := filepath.Dir(cfg.DBName); dir != "" && dir != "." {
			_ = os.MkdirAll(dir, 0755)
		}
		dialector = sqlite.Open(cfg.DBName)
	default:
		dialector = sqlite.Open(cfg.DBName)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	log.Println("[DB] Running AutoMigrations...")
	err = db.AutoMigrate(
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.AuditLog{},
		&models.WaPasswordReset{},
		&models.WorkStation{},
		&models.Product{},
		&models.WorkOrder{},
		&models.WorkOrderStation{},
		&models.ProductionLog{},
		&models.QCLog{},
		&models.MitraProductStationAssignment{},
		&models.MitraShipment{},
		&models.MitraShipmentItem{},
	)
	if err != nil {
		return nil, err
	}

	log.Println("[DB] Seeding default RBAC & Superuser data...")
	if err := SeedRBAC(db); err != nil {
		log.Printf("[DB] Warning: RBAC seeding failed: %v\n", err)
	}

	log.Println("[DB] Seeding production data (Stations, Products, SPK)...")
	if err := SeedProductionData(db); err != nil {
		log.Printf("[DB] Warning: Production seeding failed: %v\n", err)
	}

	return db, nil
}
