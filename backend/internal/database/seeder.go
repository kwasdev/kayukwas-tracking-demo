package database

import (
	"log"
	"time"

	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/utils"
	"gorm.io/gorm"
)

func SeedRBAC(db *gorm.DB) error {
	// 1. Seed Permissions
	permissions := []string{
		models.PermManageUsers,
		models.PermManageRoles,
		models.PermManagePermissions,
		models.PermViewAuditLog,
		models.PermManageWorkOrders,
		models.PermManageStations,
		models.PermVerifyProductionLogs,
		models.PermInputQCInspection,
		models.PermManageLogistics,
	}

	permMap := make(map[string]models.Permission)
	for _, permName := range permissions {
		var perm models.Permission
		err := db.Where(models.Permission{Name: permName}).FirstOrCreate(&perm, models.Permission{Name: permName}).Error
		if err != nil {
			return err
		}
		permMap[permName] = perm
	}

	// 2. Seed Roles & Mappings
	roleDefinitions := map[string][]string{
		models.RoleSuperuser: permissions,
		models.RolePPIC: {
			models.PermManageWorkOrders,
			models.PermManageStations,
			models.PermManageLogistics,
		},
		models.RoleMandor: {
			models.PermVerifyProductionLogs,
			models.PermManageWorkOrders,
		},
		models.RoleQC: {
			models.PermInputQCInspection,
			models.PermVerifyProductionLogs,
		},
		models.RoleOperator: {
			models.PermManageWorkOrders,
		},
		models.RoleMitra: {
			models.PermManageWorkOrders,
		},
		models.RoleLogistik: {
			models.PermManageLogistics,
		},
	}

	roleMap := make(map[string]models.Role)
	for roleName, allowedPerms := range roleDefinitions {
		var role models.Role
		err := db.Where(models.Role{Name: roleName}).FirstOrCreate(&role, models.Role{
			Name:     roleName,
			IsActive: true,
		}).Error
		if err != nil {
			return err
		}

		// Attach permissions if not already attached
		var permsToAttach []models.Permission
		for _, pName := range allowedPerms {
			if p, ok := permMap[pName]; ok {
				permsToAttach = append(permsToAttach, p)
			}
		}

		if len(permsToAttach) > 0 {
			if err := db.Model(&role).Association("Permissions").Replace(permsToAttach); err != nil {
				log.Printf("[Seeder] Error replacing permissions for role %s: %v\n", roleName, err)
			}
		}

		roleMap[roleName] = role
	}

	// 3. Seed Default Superuser
	var superuser models.User
	err := db.Where(models.User{Email: "admin@kayukwas.co.id"}).First(&superuser).Error
	if err == gorm.ErrRecordNotFound {
		hashedPassword, _ := utils.HashPassword("AdminKWAS2026!")
		phone := "6281234567890"
		now := time.Now()

		superuser = models.User{
			Name:               "Superuser KWAS",
			Email:              "admin@kayukwas.co.id",
			PhoneNumber:        &phone,
			Status:             models.UserStatusActive,
			IsActive:           true,
			Password:           &hashedPassword,
			WhatsAppVerifiedAt: &now,
			EmailVerifiedAt:    &now,
		}

		if err := db.Create(&superuser).Error; err != nil {
			return err
		}

		// Attach Superuser role
		if superuserRole, ok := roleMap[models.RoleSuperuser]; ok {
			if err := db.Model(&superuser).Association("Roles").Append(&superuserRole); err != nil {
				log.Printf("[Seeder] Error attaching superuser role: %v\n", err)
			}
		}

		// Log audit
		db.Create(&models.AuditLog{
			UserID:      &superuser.ID,
			ActionType:  "system_initialized",
			Description: "Default Superuser bootstrap initialized by system seeder",
		})

		log.Println("[Seeder] Default Superuser created (Email: admin@kayukwas.co.id | Pass: AdminKWAS2026!)")
	}

	return nil
}
