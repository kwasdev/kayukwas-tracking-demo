package repository

import (
	"errors"
	"time"

	"github.com/kayukwas/tracking-backend/internal/models"
	"gorm.io/gorm"
)

type UserRepository interface {
	Create(user *models.User) error
	Update(user *models.User) error
	FindByID(id uint64) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	FindByPhone(phone string) (*models.User, error)
	FindAll(search string, limit, offset int) ([]models.User, int64, error)
	AssignRoles(user *models.User, roleIDs []uint64) error
	Delete(id uint64) error
}

type RoleRepository interface {
	FindAll() ([]models.Role, error)
	FindByID(id uint64) (*models.Role, error)
	FindByName(name string) (*models.Role, error)
	Create(role *models.Role) error
	Update(role *models.Role) error
	Delete(id uint64) error
	SyncPermissions(role *models.Role, permissionIDs []uint64) error
	CountActiveUsersWithRole(roleID uint64) (int64, error)
	GetAllPermissions() ([]models.Permission, error)
}

type AuditLogRepository interface {
	Create(log *models.AuditLog) error
	FindAll(limit, offset int) ([]models.AuditLog, int64, error)
	FindByUserID(userID uint64, limit, offset int) ([]models.AuditLog, int64, error)
}

type WaResetRepository interface {
	Create(reset *models.WaPasswordReset) error
	FindByToken(token string) (*models.WaPasswordReset, error)
	FindByMagicLinkToken(magicToken string) (*models.WaPasswordReset, error)
	FindByUserIDActive(userID uint64) (*models.WaPasswordReset, error)
	Update(reset *models.WaPasswordReset) error
}

// Implementations
type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *userRepository) FindByID(id uint64) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Roles.Permissions").First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Roles.Permissions").Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByPhone(phone string) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Roles.Permissions").Where("phone_number = ?", phone).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindAll(search string, limit, offset int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := r.db.Model(&models.User{}).Preload("Roles.Permissions")
	if search != "" {
		likePattern := "%" + search + "%"
		query = query.Where("name LIKE ? OR email LIKE ? OR phone_number LIKE ?", likePattern, likePattern, likePattern)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Order("id DESC").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *userRepository) AssignRoles(user *models.User, roleIDs []uint64) error {
	var roles []models.Role
	if len(roleIDs) > 0 {
		if err := r.db.Where("id IN ?", roleIDs).Find(&roles).Error; err != nil {
			return err
		}
	}
	return r.db.Model(user).Association("Roles").Replace(roles)
}

func (r *userRepository) Delete(id uint64) error {
	return r.db.Delete(&models.User{}, id).Error
}

// Role Repository Implementation
type roleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) RoleRepository {
	return &roleRepository{db: db}
}

func (r *roleRepository) FindAll() ([]models.Role, error) {
	var roles []models.Role
	err := r.db.Preload("Permissions").Order("id ASC").Find(&roles).Error
	return roles, err
}

func (r *roleRepository) FindByID(id uint64) (*models.Role, error) {
	var role models.Role
	err := r.db.Preload("Permissions").First(&role, id).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) FindByName(name string) (*models.Role, error) {
	var role models.Role
	err := r.db.Preload("Permissions").Where("name = ?", name).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) Create(role *models.Role) error {
	return r.db.Create(role).Error
}

func (r *roleRepository) Update(role *models.Role) error {
	return r.db.Save(role).Error
}

func (r *roleRepository) Delete(id uint64) error {
	count, err := r.CountActiveUsersWithRole(id)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("cannot delete role: role is currently assigned to active users")
	}
	return r.db.Delete(&models.Role{}, id).Error
}

func (r *roleRepository) SyncPermissions(role *models.Role, permissionIDs []uint64) error {
	var perms []models.Permission
	if len(permissionIDs) > 0 {
		if err := r.db.Where("id IN ?", permissionIDs).Find(&perms).Error; err != nil {
			return err
		}
	}
	return r.db.Model(role).Association("Permissions").Replace(perms)
}

func (r *roleRepository) CountActiveUsersWithRole(roleID uint64) (int64, error) {
	var count int64
	err := r.db.Table("user_roles").
		Joins("JOIN users ON users.id = user_roles.user_id").
		Where("user_roles.role_id = ? AND users.is_active = ?", roleID, true).
		Count(&count).Error
	return count, err
}

func (r *roleRepository) GetAllPermissions() ([]models.Permission, error) {
	var perms []models.Permission
	err := r.db.Order("id ASC").Find(&perms).Error
	return perms, err
}

// AuditLog Repository Implementation
type auditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(log *models.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *auditLogRepository) FindAll(limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	if err := r.db.Model(&models.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.Preload("User").Order("id DESC").Limit(limit).Offset(offset).Find(&logs).Error
	return logs, total, err
}

func (r *auditLogRepository) FindByUserID(userID uint64, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := r.db.Model(&models.AuditLog{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Preload("User").Order("id DESC").Limit(limit).Offset(offset).Find(&logs).Error
	return logs, total, err
}

// WaReset Repository Implementation
type waResetRepository struct {
	db *gorm.DB
}

func NewWaResetRepository(db *gorm.DB) WaResetRepository {
	return &waResetRepository{db: db}
}

func (r *waResetRepository) Create(reset *models.WaPasswordReset) error {
	return r.db.Create(reset).Error
}

func (r *waResetRepository) FindByToken(token string) (*models.WaPasswordReset, error) {
	var reset models.WaPasswordReset
	err := r.db.Preload("User.Roles.Permissions").Where("token = ?", token).First(&reset).Error
	if err != nil {
		return nil, err
	}
	return &reset, nil
}

func (r *waResetRepository) FindByMagicLinkToken(magicToken string) (*models.WaPasswordReset, error) {
	var reset models.WaPasswordReset
	err := r.db.Preload("User.Roles.Permissions").Where("magic_link_token = ?", magicToken).First(&reset).Error
	if err != nil {
		return nil, err
	}
	return &reset, nil
}

func (r *waResetRepository) FindByUserIDActive(userID uint64) (*models.WaPasswordReset, error) {
	var reset models.WaPasswordReset
	now := time.Now()
	err := r.db.Where("user_id = ? AND expires_at > ? AND status != ?", userID, now, models.WaResetStatusCompleted).
		Order("id DESC").First(&reset).Error
	if err != nil {
		return nil, err
	}
	return &reset, nil
}

func (r *waResetRepository) Update(reset *models.WaPasswordReset) error {
	return r.db.Save(reset).Error
}
