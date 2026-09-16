package models

import (
	"time"
)

// Status constants
const (
	UserStatusActive            = "ACTIVE"
	UserStatusPendingActivation = "PENDING_ACTIVATION"

	WaResetStatusRequested           = "requested"
	WaResetStatusVerificationSent    = "verification_sent"
	WaResetStatusVerificationChecked = "verification_checked"
	WaResetStatusCompleted           = "completed"

	RoleSuperuser = "Superuser"
	RolePPIC      = "PPIC"
	RoleMandor    = "Mandor"
	RoleQC        = "QC"
	RoleOperator  = "Operator"
	RoleMitra     = "Mitra"
	RoleLogistik  = "Logistik"

	PermManageUsers       = "kelola pengguna"
	PermManageRoles       = "kelola peran"
	PermManagePermissions = "kelola akses"
	PermViewAuditLog      = "lihat catatan aktivitas"

	// Operational permissions
	PermManageWorkOrders     = "kelola spk"
	PermManageStations       = "kelola stasiun & routing"
	PermVerifyProductionLogs = "verifikasi laporan produksi"
	PermInputQCInspection    = "input inspeksi qc"
	PermManageLogistics      = "kelola mutasi logistik"
)

type User struct {
	ID                 uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name               string     `gorm:"type:varchar(255);not null" json:"name"`
	Email              string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PhoneNumber        *string    `gorm:"type:varchar(50);uniqueIndex" json:"phone_number"`
	Status             string     `gorm:"type:varchar(50);not null;default:'PENDING_ACTIVATION'" json:"status"`
	IsActive           bool       `gorm:"default:true;not null" json:"is_active"`
	EmailVerifiedAt    *time.Time `json:"email_verified_at,omitempty"`
	WhatsAppVerifiedAt *time.Time `json:"whatsapp_verified_at,omitempty"`
	Password           *string    `gorm:"type:varchar(255)" json:"-"`
	Roles              []Role     `gorm:"many2many:user_roles;joinForeignKey:UserID;joinReferences:RoleID" json:"roles,omitempty"`
	Permissions        []string   `gorm:"-" json:"permissions,omitempty"`
	AuditLogs          []AuditLog `gorm:"foreignKey:UserID" json:"audit_logs,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type Role struct {
	ID          uint64       `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string       `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	IsActive    bool         `gorm:"default:true;not null" json:"is_active"`
	Permissions []Permission `gorm:"many2many:role_has_permissions;joinForeignKey:RoleID;joinReferences:PermissionID" json:"permissions,omitempty"`
	Users       []User       `gorm:"many2many:user_roles;joinForeignKey:RoleID;joinReferences:UserID" json:"users,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type Permission struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Roles     []Role    `gorm:"many2many:role_has_permissions;joinForeignKey:PermissionID;joinReferences:RoleID" json:"roles,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UserRole struct {
	UserID uint64 `gorm:"primaryKey" json:"user_id"`
	RoleID uint64 `gorm:"primaryKey" json:"role_id"`
}

func (UserRole) TableName() string {
	return "user_roles"
}

type RoleHasPermission struct {
	RoleID       uint64 `gorm:"primaryKey" json:"role_id"`
	PermissionID uint64 `gorm:"primaryKey" json:"permission_id"`
}

func (RoleHasPermission) TableName() string {
	return "role_has_permissions"
}

type AuditLog struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      *uint64   `gorm:"index" json:"user_id"`
	User        *User     `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"user,omitempty"`
	ActionType  string    `gorm:"type:varchar(100);not null" json:"action_type"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WaPasswordReset struct {
	ID                        uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                    uint64     `gorm:"index;not null" json:"user_id"`
	User                      User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Token                     string     `gorm:"type:varchar(255);index;not null" json:"token"`
	MagicLinkToken            *string    `gorm:"type:varchar(255);index" json:"magic_link_token,omitempty"`
	VerificationCode          *string    `gorm:"type:varchar(10)" json:"verification_code,omitempty"`
	VerificationCodeExpiresAt *time.Time `json:"verification_code_expires_at,omitempty"`
	ExpiresAt                 time.Time  `gorm:"not null" json:"expires_at"`
	Status                    string     `gorm:"type:varchar(50);not null;default:'requested'" json:"status"`
	CreatedAt                 time.Time  `json:"created_at"`
}

// Helper methods on User for Authorization
func (u *User) IsSuperuser() bool {
	for _, r := range u.Roles {
		if r.Name == RoleSuperuser && r.IsActive {
			return true
		}
	}
	return false
}

func (u *User) HasRole(roleName string) bool {
	for _, r := range u.Roles {
		if r.Name == roleName && r.IsActive {
			return true
		}
	}
	return false
}

func (u *User) HasPermission(permissionName string) bool {
	if u.IsSuperuser() {
		return true // Superuser Bypass
	}

	for _, role := range u.Roles {
		if !role.IsActive {
			continue
		}
		for _, perm := range role.Permissions {
			if perm.Name == permissionName {
				return true
			}
		}
	}
	return false
}

// GetAllPermissions returns the union of all permissions from active roles
func (u *User) GetAllPermissions() []string {
	if u.IsSuperuser() {
		return []string{
			PermManageUsers, PermManageRoles, PermManagePermissions, PermViewAuditLog,
			PermManageWorkOrders, PermManageStations, PermVerifyProductionLogs,
			PermInputQCInspection, PermManageLogistics,
		}
	}

	permMap := make(map[string]bool)
	for _, role := range u.Roles {
		if !role.IsActive {
			continue
		}
		for _, perm := range role.Permissions {
			permMap[perm.Name] = true
		}
	}

	result := make([]string, 0, len(permMap))
	for p := range permMap {
		result = append(result, p)
	}
	return result
}
