package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/repository"
)

// DTOs
type CreateProductDTO struct {
	ProductName string `json:"product_name"`
	ProductCode string `json:"product_code"`
}

type CreateSPKDTO struct {
	ProductID      uint64     `json:"product_id"`
	TotalTargetQty int        `json:"total_target_qty"`
	Priority       string     `json:"priority"` // normal, urgent
	DeadlineDate   *time.Time `json:"deadline_date,omitempty"`
}

type UpdateStationWorkerDTO struct {
	AssignedType   string  `json:"assigned_type"` // internal, mitra
	AssignedUserID *uint64 `json:"assigned_user_id"`
}

type ReportProgressDTO struct {
	LogType         string `json:"log_type"` // start, progress_report, finish, issue
	ReportedQtyPass int    `json:"reported_qty_pass"`
	ReportedQtyRej  int    `json:"reported_qty_reject"`
	Notes           string `json:"notes"`
	Channel         string `json:"channel"` // web, whatsapp
}

type SaveMitraAssignmentDTO struct {
	MitraUserID           uint64  `json:"mitra_user_id"`
	ProductID             uint64  `json:"product_id"`
	StationID             uint64  `json:"station_id"`
	PieceRateFee          float64 `json:"piece_rate_fee"`
	DailyCapacityEstimate int     `json:"daily_capacity_estimate"`
	Notes                 string  `json:"notes"`
}

type SubmitQCInspectionDTO struct {
	WorkOrderStationID uint64 `json:"work_order_station_id"`
	InspectionModel    string `json:"inspection_model"` // in_house, pickup_joint_model_a, onsite_autonomous_model_b
	SampleQty          int    `json:"sample_qty"`
	PassQty            int    `json:"pass_qty"`
	RejectMinorQty     int    `json:"reject_minor_qty"` // Bisa diperbaiki tidak berubah banyak
	RejectMajorQty     int    `json:"reject_major_qty"` // Harus bongkar
	RejectScrapQty     int    `json:"reject_scrap_qty"` // Harus ganti
	DefectCategories   string `json:"defect_categories"`
	Notes              string `json:"notes"`
}

type CreateShipmentItemDTO struct {
	ProductID      *uint64 `json:"product_id"`
	RawItemName    string  `json:"raw_item_name"`
	Qty            int     `json:"qty"`
	StatusCategory string  `json:"status_category"` // revisi_total, revisi_jamur, revisi_cacat_lain
	Notes          string  `json:"notes"`
}

type CreateShipmentDTO struct {
	VehicleGateStatus string                  `json:"vehicle_gate_status"` // keluar, masuk
	ProductAction     string                  `json:"product_action"`     // kirim, ambil
	MovementDate      string                  `json:"movement_date"`
	MovementTime      string                  `json:"movement_time"`
	DriverName        string                  `json:"driver_name"`
	HelperName        string                  `json:"helper_name"`
	QCInspectorName   *string                 `json:"qc_inspector_name"`
	VehicleType       string                  `json:"vehicle_type"`
	LicensePlate      string                  `json:"license_plate"`
	MitraID           *uint64                 `json:"mitra_id"`
	Notes             string                  `json:"notes"`
	Items             []CreateShipmentItemDTO `json:"items"`
}

// Service Interface
type ProductionService interface {
	// Products & Stations
	ListProducts(search string, page, limit int) ([]models.Product, int64, error)
	GetProductByID(id uint64) (*models.Product, error)
	CreateProduct(actorID uint64, dto CreateProductDTO) (*models.Product, error)
	ListStations() ([]models.WorkStation, error)

	// SPK / Work Order
	CreateSPK(actorID uint64, dto CreateSPKDTO) (*models.WorkOrder, error)
	ListSPK(status, priority, search string, page, limit int) ([]models.WorkOrder, int64, error)
	GetSPKByID(id uint64) (*models.WorkOrder, error)
	AssignStationWorker(actorID, wosID uint64, dto UpdateStationWorkerDTO) (*models.WorkOrderStation, error)
	ReportStationProgress(actorID, wosID uint64, dto ReportProgressDTO) (*models.WorkOrderStation, error)

	// Mitra Assignments
	ListMitraAssignments(mitraID uint64) ([]models.MitraProductStationAssignment, error)
	SaveMitraAssignment(actorID uint64, dto SaveMitraAssignmentDTO) (*models.MitraProductStationAssignment, error)
	DeleteMitraAssignment(actorID, id uint64) error

	// QC
	SubmitQCInspection(inspectorID uint64, dto SubmitQCInspectionDTO) (*models.QCLog, error)
	ListRecentQCLogs(limit int) ([]models.QCLog, error)

	// Logistics
	CreateShipment(actorID uint64, dto CreateShipmentDTO) (*models.MitraShipment, error)
	ListShipments(page, limit int) ([]models.MitraShipment, int64, error)
}

// Service Implementation
type productionService struct {
	prodRepo    repository.ProductRepository
	stationRepo repository.WorkStationRepository
	woRepo      repository.WorkOrderRepository
	mitraRepo   repository.MitraAssignmentRepository
	qcRepo      repository.QCRepository
	logistRepo  repository.LogisticsRepository
	auditServ   AuditLogService
}

func NewProductionService(
	prodRepo repository.ProductRepository,
	stationRepo repository.WorkStationRepository,
	woRepo repository.WorkOrderRepository,
	mitraRepo repository.MitraAssignmentRepository,
	qcRepo repository.QCRepository,
	logistRepo repository.LogisticsRepository,
	auditServ AuditLogService,
) ProductionService {
	return &productionService{
		prodRepo:    prodRepo,
		stationRepo: stationRepo,
		woRepo:      woRepo,
		mitraRepo:   mitraRepo,
		qcRepo:      qcRepo,
		logistRepo:  logistRepo,
		auditServ:   auditServ,
	}
}

// ---------------- Products & Stations ----------------
func (s *productionService) ListProducts(search string, page, limit int) ([]models.Product, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.prodRepo.FindAll(search, limit, offset)
}

func (s *productionService) GetProductByID(id uint64) (*models.Product, error) {
	return s.prodRepo.FindByID(id)
}

func (s *productionService) CreateProduct(actorID uint64, dto CreateProductDTO) (*models.Product, error) {
	if dto.ProductName == "" || dto.ProductCode == "" {
		return nil, errors.New("nama produk dan kode produk wajib diisi")
	}

	p := &models.Product{
		ProductName: dto.ProductName,
		ProductCode: dto.ProductCode,
		IsActive:    true,
	}

	if err := s.prodRepo.Create(p); err != nil {
		return nil, err
	}

	s.auditServ.RecordLog(&actorID, "create_product", fmt.Sprintf("Menambahkan master produk baru: %s (%s)", p.ProductName, p.ProductCode))
	return p, nil
}

func (s *productionService) ListStations() ([]models.WorkStation, error) {
	return s.stationRepo.FindAll()
}

// ---------------- SPK / Work Orders ----------------
func (s *productionService) CreateSPK(actorID uint64, dto CreateSPKDTO) (*models.WorkOrder, error) {
	if dto.ProductID == 0 || dto.TotalTargetQty <= 0 {
		return nil, errors.New("produk dan target kuantitas (lebih dari 0) wajib diisi")
	}

	product, err := s.prodRepo.FindByID(dto.ProductID)
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	// Generate SPK Number: SPK-YYYY-MM-XXXX
	now := time.Now()
	spkNumber := fmt.Sprintf("SPK-%04d-%02d-%04d", now.Year(), int(now.Month()), (now.Unix()%9000)+1000)

	priority := dto.Priority
	if priority == "" {
		priority = "normal"
	}

	wo := &models.WorkOrder{
		SPKNumber:      spkNumber,
		ProductID:      dto.ProductID,
		TotalTargetQty: dto.TotalTargetQty,
		Priority:       priority,
		Status:         models.WOStatusInProgress,
		StartDate:      &now,
		DeadlineDate:   dto.DeadlineDate,
	}

	if err := s.woRepo.Create(wo); err != nil {
		return nil, fmt.Errorf("gagal membuat SPK: %w", err)
	}

	// Auto-create 5 WorkStation Routing steps
	stations, err := s.stationRepo.FindAll()
	if err == nil {
		for i, st := range stations {
			status := models.StationStatusPending
			if i == 0 {
				status = models.StationStatusInProgress
			}

			wos := models.WorkOrderStation{
				WorkOrderID:   wo.ID,
				StationID:     st.ID,
				SequenceOrder: st.SequenceOrder,
				AssignedType:  models.AssignedTypeInternal,
				Status:        status,
				InputQty:      dto.TotalTargetQty,
				CompletedQty:  0,
				RejectQty:     0,
				ReworkQty:     0,
				Notes:         fmt.Sprintf("Routing %s untuk %s", st.Name, product.ProductName),
			}
			_ = s.woRepo.UpdateStation(&wos)
		}
	}

	createdWO, _ := s.woRepo.FindByID(wo.ID)
	s.auditServ.RecordLog(&actorID, "create_spk", fmt.Sprintf("Menerbitkan SPK Baru: %s untuk %s (Target: %d pcs)", spkNumber, product.ProductName, dto.TotalTargetQty))

	return createdWO, nil
}

func (s *productionService) ListSPK(status, priority, search string, page, limit int) ([]models.WorkOrder, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.woRepo.FindAll(status, priority, search, limit, offset)
}

func (s *productionService) GetSPKByID(id uint64) (*models.WorkOrder, error) {
	return s.woRepo.FindByID(id)
}

func (s *productionService) AssignStationWorker(actorID, wosID uint64, dto UpdateStationWorkerDTO) (*models.WorkOrderStation, error) {
	wos, err := s.woRepo.FindStationByID(wosID)
	if err != nil {
		return nil, errors.New("stasiun kerja SPK tidak ditemukan")
	}

	// Validate external restriction on Stasiun 4 & 5
	if dto.AssignedType == models.AssignedTypeMitra && !wos.Station.IsExternalAllowed {
		return nil, errors.New("stasiun 4 (Pasca Finishing) dan Stasiun 5 (Packing) WAJIB dikerjakan In-House di pabrik utama")
	}

	wos.AssignedType = dto.AssignedType
	wos.AssignedUserID = dto.AssignedUserID

	if err := s.woRepo.UpdateStation(wos); err != nil {
		return nil, err
	}

	s.auditServ.RecordLog(&actorID, "assign_spk_station", fmt.Sprintf("Mengubah penugasan stasiun %s (SPK Station ID %d)", wos.Station.Name, wos.ID))
	return wos, nil
}

func (s *productionService) ReportStationProgress(actorID, wosID uint64, dto ReportProgressDTO) (*models.WorkOrderStation, error) {
	wos, err := s.woRepo.FindStationByID(wosID)
	if err != nil {
		return nil, errors.New("stasiun kerja SPK tidak ditemukan")
	}

	wos.CompletedQty += dto.ReportedQtyPass
	wos.RejectQty += dto.ReportedQtyRej

	if wos.CompletedQty+wos.RejectQty >= wos.InputQty && wos.InputQty > 0 {
		wos.Status = models.StationStatusCompleted
	} else if dto.LogType == "start" {
		wos.Status = models.StationStatusInProgress
	}

	if err := s.woRepo.UpdateStation(wos); err != nil {
		return nil, err
	}

	// Create Production Log
	channel := dto.Channel
	if channel == "" {
		channel = "web"
	}
	pLog := &models.ProductionLog{
		WorkOrderStationID: wos.ID,
		UserID:             actorID,
		Channel:            channel,
		LogType:            dto.LogType,
		ReportedQtyPass:    dto.ReportedQtyPass,
		ReportedQtyReject:  dto.ReportedQtyRej,
		Notes:              dto.Notes,
	}
	_ = s.woRepo.CreateProductionLog(pLog)

	s.auditServ.RecordLog(&actorID, "report_spk_progress", fmt.Sprintf("Laporan progres stasiun %s: Selesai +%d, Cacat +%d", wos.Station.Name, dto.ReportedQtyPass, dto.ReportedQtyRej))
	return wos, nil
}

// ---------------- Mitra Assignments ----------------
func (s *productionService) ListMitraAssignments(mitraID uint64) ([]models.MitraProductStationAssignment, error) {
	return s.mitraRepo.FindAll(mitraID)
}

func (s *productionService) SaveMitraAssignment(actorID uint64, dto SaveMitraAssignmentDTO) (*models.MitraProductStationAssignment, error) {
	if dto.MitraUserID == 0 || dto.ProductID == 0 || dto.StationID == 0 {
		return nil, errors.New("mitra, produk, dan stasiun wajib diisi")
	}

	st, err := s.stationRepo.FindByID(dto.StationID)
	if err != nil || !st.IsExternalAllowed {
		return nil, errors.New("mitra hanya dapat ditugaskan pada Stasiun 1 s.d. 3")
	}

	existing, _ := s.mitraRepo.FindByMitraProductStation(dto.MitraUserID, dto.ProductID, dto.StationID)
	if existing != nil && existing.ID > 0 {
		existing.PieceRateFee = dto.PieceRateFee
		existing.DailyCapacityEstimate = dto.DailyCapacityEstimate
		existing.Notes = dto.Notes
		if err := s.mitraRepo.Update(existing); err != nil {
			return nil, err
		}
		s.auditServ.RecordLog(&actorID, "update_mitra_assignment", fmt.Sprintf("Memperbarui spesialisasi penugasan mitra ID %d untuk produk ID %d di stasiun %s", dto.MitraUserID, dto.ProductID, st.Name))
		return existing, nil
	}

	assign := &models.MitraProductStationAssignment{
		MitraUserID:           dto.MitraUserID,
		ProductID:             dto.ProductID,
		StationID:             dto.StationID,
		PieceRateFee:          dto.PieceRateFee,
		DailyCapacityEstimate: dto.DailyCapacityEstimate,
		IsPrimary:             true,
		Notes:                 dto.Notes,
	}

	if err := s.mitraRepo.Create(assign); err != nil {
		return nil, err
	}

	created, _ := s.mitraRepo.FindByID(assign.ID)
	s.auditServ.RecordLog(&actorID, "create_mitra_assignment", fmt.Sprintf("Mendaftarkan penugasan spesialisasi mitra: %s untuk produk %s di %s (Tarif: Rp %.2f)", created.MitraUser.Name, created.Product.ProductName, st.Name, dto.PieceRateFee))
	return created, nil
}

func (s *productionService) DeleteMitraAssignment(actorID, id uint64) error {
	s.auditServ.RecordLog(&actorID, "delete_mitra_assignment", fmt.Sprintf("Menghapus penugasan spesialisasi mitra assignment ID %d", id))
	return s.mitraRepo.Delete(id)
}

// ---------------- QC Inspection ----------------
func (s *productionService) SubmitQCInspection(inspectorID uint64, dto SubmitQCInspectionDTO) (*models.QCLog, error) {
	if dto.WorkOrderStationID == 0 {
		return nil, errors.New("work order station wajib disertakan")
	}

	totalReject := dto.RejectMinorQty + dto.RejectMajorQty + dto.RejectScrapQty

	actionTaken := models.QCActionAccept
	if dto.RejectScrapQty > 0 || dto.RejectMajorQty > 0 {
		actionTaken = models.QCActionReworkMitra
	}

	qcLog := &models.QCLog{
		WorkOrderStationID: dto.WorkOrderStationID,
		InspectorUserID:    inspectorID,
		InspectionModel:    dto.InspectionModel,
		SampleQty:          dto.SampleQty,
		PassQty:            dto.PassQty,
		RejectQty:          totalReject,
		RejectMinorQty:     dto.RejectMinorQty,
		RejectMajorQty:     dto.RejectMajorQty,
		RejectScrapQty:     dto.RejectScrapQty,
		DefectCategories:   dto.DefectCategories,
		ActionTaken:        actionTaken,
		Notes:              dto.Notes,
	}

	if err := s.qcRepo.CreateQCLog(qcLog); err != nil {
		return nil, err
	}

	// Update station numbers
	wos, err := s.woRepo.FindStationByID(dto.WorkOrderStationID)
	if err == nil {
		wos.CompletedQty += dto.PassQty
		wos.RejectQty += totalReject
		wos.ReworkQty += dto.RejectMinorQty + dto.RejectMajorQty
		_ = s.woRepo.UpdateStation(wos)
	}

	s.auditServ.RecordLog(&inspectorID, "qc_inspection_submitted", fmt.Sprintf("Inspeksi QC Stasiun %d: Lolos %d, Cacat %d (Minor: %d, Major: %d, Scrap: %d)", dto.WorkOrderStationID, dto.PassQty, totalReject, dto.RejectMinorQty, dto.RejectMajorQty, dto.RejectScrapQty))
	return qcLog, nil
}

func (s *productionService) ListRecentQCLogs(limit int) ([]models.QCLog, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.qcRepo.FindRecentLogs(limit)
}

// ---------------- Logistics ----------------
func (s *productionService) CreateShipment(actorID uint64, dto CreateShipmentDTO) (*models.MitraShipment, error) {
	if dto.VehicleGateStatus == "" || dto.ProductAction == "" || dto.DriverName == "" {
		return nil, errors.New("status gerbang, aksi produk, dan nama supir wajib diisi")
	}

	now := time.Now()
	sjNumber := fmt.Sprintf("SJ-%s-%04d-%02d-%04d", dto.ProductAction, now.Year(), int(now.Month()), (now.Unix()%9000)+1000)

	movementDate := dto.MovementDate
	if movementDate == "" {
		movementDate = now.Format("2006-01-02")
	}
	movementTime := dto.MovementTime
	if movementTime == "" {
		movementTime = now.Format("15:04")
	}

	shipment := &models.MitraShipment{
		SJNumber:          sjNumber,
		VehicleGateStatus: dto.VehicleGateStatus,
		ProductAction:     dto.ProductAction,
		MovementDate:      movementDate,
		MovementTime:      movementTime,
		DriverName:        dto.DriverName,
		HelperName:        dto.HelperName,
		QCInspectorName:   dto.QCInspectorName,
		VehicleType:       dto.VehicleType,
		LicensePlate:      dto.LicensePlate,
		MitraID:           dto.MitraID,
		Notes:             dto.Notes,
	}

	items := make([]models.MitraShipmentItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, models.MitraShipmentItem{
			ProductID:      it.ProductID,
			RawItemName:    it.RawItemName,
			Qty:            it.Qty,
			StatusCategory: it.StatusCategory,
			Notes:          it.Notes,
		})
	}
	shipment.Items = items

	if err := s.logistRepo.Create(shipment); err != nil {
		return nil, err
	}

	created, _ := s.logistRepo.FindByID(shipment.ID)
	s.auditServ.RecordLog(&actorID, "create_shipment", fmt.Sprintf("Menerbitkan Manifest Logistik: %s (Kendaraan: %s, Aksi Produk: %s, Supir: %s)", sjNumber, dto.VehicleGateStatus, dto.ProductAction, dto.DriverName))
	return created, nil
}

func (s *productionService) ListShipments(page, limit int) ([]models.MitraShipment, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.logistRepo.FindAll(limit, offset)
}
