package repository

import (
	"github.com/kayukwas/tracking-backend/internal/models"
	"gorm.io/gorm"
)

type ProductRepository interface {
	FindAll(search string, limit, offset int) ([]models.Product, int64, error)
	FindByID(id uint64) (*models.Product, error)
	FindByCode(code string) (*models.Product, error)
	Create(product *models.Product) error
	Update(product *models.Product) error
	Delete(id uint64) error
}

type WorkStationRepository interface {
	FindAll() ([]models.WorkStation, error)
	FindByID(id uint64) (*models.WorkStation, error)
	FindByCode(code string) (*models.WorkStation, error)
}

type WorkOrderRepository interface {
	FindAll(status, priority, search string, limit, offset int) ([]models.WorkOrder, int64, error)
	FindByID(id uint64) (*models.WorkOrder, error)
	FindBySPKNumber(spkNumber string) (*models.WorkOrder, error)
	Create(wo *models.WorkOrder) error
	Update(wo *models.WorkOrder) error
	FindStationByID(wosID uint64) (*models.WorkOrderStation, error)
	UpdateStation(wos *models.WorkOrderStation) error
	CreateProductionLog(log *models.ProductionLog) error
}

type MitraAssignmentRepository interface {
	FindAll(mitraID uint64) ([]models.MitraProductStationAssignment, error)
	FindByID(id uint64) (*models.MitraProductStationAssignment, error)
	FindByMitraProductStation(mitraID, productID, stationID uint64) (*models.MitraProductStationAssignment, error)
	Create(assign *models.MitraProductStationAssignment) error
	Update(assign *models.MitraProductStationAssignment) error
	Delete(id uint64) error
}

type QCRepository interface {
	CreateQCLog(log *models.QCLog) error
	FindLogsByStationID(wosID uint64) ([]models.QCLog, error)
	FindRecentLogs(limit int) ([]models.QCLog, error)
}

type LogisticsRepository interface {
	FindAll(limit, offset int) ([]models.MitraShipment, int64, error)
	FindByID(id uint64) (*models.MitraShipment, error)
	Create(shipment *models.MitraShipment) error
}

// ---------------- Implementation ----------------

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) FindAll(search string, limit, offset int) ([]models.Product, int64, error) {
	var products []models.Product
	var total int64
	q := r.db.Model(&models.Product{})
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("product_name LIKE ? OR product_code LIKE ?", like, like)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Order("id ASC").Limit(limit).Offset(offset).Find(&products).Error
	return products, total, err
}

func (r *productRepository) FindByID(id uint64) (*models.Product, error) {
	var p models.Product
	err := r.db.First(&p, id).Error
	return &p, err
}

func (r *productRepository) FindByCode(code string) (*models.Product, error) {
	var p models.Product
	err := r.db.Where("product_code = ?", code).First(&p).Error
	return &p, err
}

func (r *productRepository) Create(product *models.Product) error {
	return r.db.Create(product).Error
}

func (r *productRepository) Update(product *models.Product) error {
	return r.db.Save(product).Error
}

func (r *productRepository) Delete(id uint64) error {
	return r.db.Delete(&models.Product{}, id).Error
}

// WorkStation Repo
type workStationRepository struct {
	db *gorm.DB
}

func NewWorkStationRepository(db *gorm.DB) WorkStationRepository {
	return &workStationRepository{db: db}
}

func (r *workStationRepository) FindAll() ([]models.WorkStation, error) {
	var list []models.WorkStation
	err := r.db.Order("sequence_order ASC").Find(&list).Error
	return list, err
}

func (r *workStationRepository) FindByID(id uint64) (*models.WorkStation, error) {
	var s models.WorkStation
	err := r.db.First(&s, id).Error
	return &s, err
}

func (r *workStationRepository) FindByCode(code string) (*models.WorkStation, error) {
	var s models.WorkStation
	err := r.db.Where("station_code = ?", code).First(&s).Error
	return &s, err
}

// WorkOrder Repo
type workOrderRepository struct {
	db *gorm.DB
}

func NewWorkOrderRepository(db *gorm.DB) WorkOrderRepository {
	return &workOrderRepository{db: db}
}

func (r *workOrderRepository) FindAll(status, priority, search string, limit, offset int) ([]models.WorkOrder, int64, error) {
	var list []models.WorkOrder
	var total int64

	q := r.db.Model(&models.WorkOrder{}).
		Preload("Product").
		Preload("Stations.Station").
		Preload("Stations.AssignedUser")

	if status != "" {
		q = q.Where("status = ?", status)
	}
	if priority != "" {
		q = q.Where("priority = ?", priority)
	}
	if search != "" {
		like := "%" + search + "%"
		q = q.Joins("JOIN products ON products.id = work_orders.product_id").
			Where("work_orders.spk_number LIKE ? OR products.product_name LIKE ? OR products.product_code LIKE ?", like, like, like)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := q.Order("work_orders.id DESC").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *workOrderRepository) FindByID(id uint64) (*models.WorkOrder, error) {
	var wo models.WorkOrder
	err := r.db.Preload("Product").
		Preload("Stations.Station").
		Preload("Stations.AssignedUser").
		Preload("Stations.Logs.User").
		Preload("Stations.QCLogs.InspectorUser").
		First(&wo, id).Error
	return &wo, err
}

func (r *workOrderRepository) FindBySPKNumber(spkNumber string) (*models.WorkOrder, error) {
	var wo models.WorkOrder
	err := r.db.Preload("Product").
		Preload("Stations.Station").
		Preload("Stations.AssignedUser").
		Where("spk_number = ?", spkNumber).First(&wo).Error
	return &wo, err
}

func (r *workOrderRepository) Create(wo *models.WorkOrder) error {
	return r.db.Create(wo).Error
}

func (r *workOrderRepository) Update(wo *models.WorkOrder) error {
	return r.db.Save(wo).Error
}

func (r *workOrderRepository) FindStationByID(wosID uint64) (*models.WorkOrderStation, error) {
	var wos models.WorkOrderStation
	err := r.db.Preload("Station").Preload("AssignedUser").First(&wos, wosID).Error
	return &wos, err
}

func (r *workOrderRepository) UpdateStation(wos *models.WorkOrderStation) error {
	return r.db.Save(wos).Error
}

func (r *workOrderRepository) CreateProductionLog(log *models.ProductionLog) error {
	return r.db.Create(log).Error
}

// MitraAssignment Repo
type mitraAssignmentRepository struct {
	db *gorm.DB
}

func NewMitraAssignmentRepository(db *gorm.DB) MitraAssignmentRepository {
	return &mitraAssignmentRepository{db: db}
}

func (r *mitraAssignmentRepository) FindAll(mitraID uint64) ([]models.MitraProductStationAssignment, error) {
	var list []models.MitraProductStationAssignment
	q := r.db.Preload("MitraUser").Preload("Product").Preload("Station")
	if mitraID > 0 {
		q = q.Where("mitra_user_id = ?", mitraID)
	}
	err := q.Order("id DESC").Find(&list).Error
	return list, err
}

func (r *mitraAssignmentRepository) FindByID(id uint64) (*models.MitraProductStationAssignment, error) {
	var a models.MitraProductStationAssignment
	err := r.db.Preload("MitraUser").Preload("Product").Preload("Station").First(&a, id).Error
	return &a, err
}

func (r *mitraAssignmentRepository) FindByMitraProductStation(mitraID, productID, stationID uint64) (*models.MitraProductStationAssignment, error) {
	var a models.MitraProductStationAssignment
	err := r.db.Where("mitra_user_id = ? AND product_id = ? AND station_id = ?", mitraID, productID, stationID).First(&a).Error
	return &a, err
}

func (r *mitraAssignmentRepository) Create(assign *models.MitraProductStationAssignment) error {
	return r.db.Create(assign).Error
}

func (r *mitraAssignmentRepository) Update(assign *models.MitraProductStationAssignment) error {
	return r.db.Save(assign).Error
}

func (r *mitraAssignmentRepository) Delete(id uint64) error {
	return r.db.Delete(&models.MitraProductStationAssignment{}, id).Error
}

// QC Repo
type qcRepository struct {
	db *gorm.DB
}

func NewQCRepository(db *gorm.DB) QCRepository {
	return &qcRepository{db: db}
}

func (r *qcRepository) CreateQCLog(log *models.QCLog) error {
	return r.db.Create(log).Error
}

func (r *qcRepository) FindLogsByStationID(wosID uint64) ([]models.QCLog, error) {
	var logs []models.QCLog
	err := r.db.Preload("InspectorUser").Where("work_order_station_id = ?", wosID).Order("id DESC").Find(&logs).Error
	return logs, err
}

func (r *qcRepository) FindRecentLogs(limit int) ([]models.QCLog, error) {
	var logs []models.QCLog
	err := r.db.Preload("InspectorUser").Order("id DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

// Logistics Repo
type logisticsRepository struct {
	db *gorm.DB
}

func NewLogisticsRepository(db *gorm.DB) LogisticsRepository {
	return &logisticsRepository{db: db}
}

func (r *logisticsRepository) FindAll(limit, offset int) ([]models.MitraShipment, int64, error) {
	var list []models.MitraShipment
	var total int64

	if err := r.db.Model(&models.MitraShipment{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.Preload("Mitra").Preload("Items.Product").Order("id DESC").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *logisticsRepository) FindByID(id uint64) (*models.MitraShipment, error) {
	var s models.MitraShipment
	err := r.db.Preload("Mitra").Preload("Items.Product").First(&s, id).Error
	return &s, err
}

func (r *logisticsRepository) Create(shipment *models.MitraShipment) error {
	return r.db.Create(shipment).Error
}
