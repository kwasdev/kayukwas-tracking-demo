package database

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/kayukwas/tracking-backend/internal/models"
	"gorm.io/gorm"
)

func SeedProductionData(db *gorm.DB) error {
	// 1. Seed 5 Work Stations
	stations := []models.WorkStation{
		{
			StationCode:       models.StationCodeWoodWorking,
			Name:              models.StationNameWoodWorking,
			SequenceOrder:     1,
			IsExternalAllowed: true,
		},
		{
			StationCode:       models.StationCodePascaWoodWorking,
			Name:              models.StationNamePascaWoodWorking,
			SequenceOrder:     2,
			IsExternalAllowed: true,
		},
		{
			StationCode:       models.StationCodeFinishing,
			Name:              models.StationNameFinishing,
			SequenceOrder:     3,
			IsExternalAllowed: true,
		},
		{
			StationCode:       models.StationCodePascaFinishing,
			Name:              models.StationNamePascaFinishing,
			SequenceOrder:     4,
			IsExternalAllowed: false, // Wajib In-house Pabrik
		},
		{
			StationCode:       models.StationCodePacking,
			Name:              models.StationNamePacking,
			SequenceOrder:     5,
			IsExternalAllowed: false, // Wajib In-house Pabrik
		},
	}

	for _, s := range stations {
		var existing models.WorkStation
		err := db.Where(models.WorkStation{StationCode: s.StationCode}).FirstOrCreate(&existing, s).Error
		if err != nil {
			log.Printf("[Seeder] Error seeding station %s: %v\n", s.StationCode, err)
		}
	}

	// 2. Seed 47 Products from CSV
	csvPaths := []string{
		"../database/seeders/data/product_masters.csv",
		"database/seeders/data/product_masters.csv",
		"../../database/seeders/data/product_masters.csv",
	}

	var file *os.File
	var err error
	for _, path := range csvPaths {
		file, err = os.Open(path)
		if err == nil {
			break
		}
	}

	if file != nil {
		defer file.Close()
		reader := csv.NewReader(file)
		// Skip header
		_, _ = reader.Read()

		count := 0
		for {
			record, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil || len(record) < 2 {
				continue
			}

			productName := record[0]
			productCode := record[1]

			var p models.Product
			err = db.Where(models.Product{ProductCode: productCode}).FirstOrCreate(&p, models.Product{
				ProductName: productName,
				ProductCode: productCode,
				IsActive:    true,
			}).Error
			if err == nil {
				count++
			}
		}
		log.Printf("[Seeder] Successfully seeded/verified %d master products from CSV\n", count)
	} else {
		log.Println("[Seeder] Warning: product_masters.csv file not found, creating core sample products")
		fallbackProducts := []models.Product{
			{ProductName: "Telenan Gagang", ProductCode: "TLN-GGNG", IsActive: true},
			{ProductName: "Mangkok Kayu D15/8,5", ProductCode: "MGK-D1585", IsActive: true},
			{ProductName: "Board - Short + Logo Grafir", ProductCode: "BRD-SHT-GRF", IsActive: true},
			{ProductName: "Talenan Besar 45x28", ProductCode: "TLN-BSR-4528", IsActive: true},
			{ProductName: "Talenan Lubang Oval", ProductCode: "TLN-LBG-OVL", IsActive: true},
			{ProductName: "Telenan Jepang Versi MR DIY", ProductCode: "TLN-JPN-DIY", IsActive: true},
		}
		for _, fp := range fallbackProducts {
			db.Where(models.Product{ProductCode: fp.ProductCode}).FirstOrCreate(&models.Product{}, fp)
		}
	}

	// 3. Seed Sample Mitra Assignment (Pak Baryadi)
	var baryadi models.User
	if err := db.Where("email = ? OR phone_number LIKE ?", "baryadi@kayukwas.co.id", "%81399887766%").First(&baryadi).Error; err == nil {
		var tlnGagang models.Product
		var st1 models.WorkStation
		if err := db.Where("product_code = ?", "TLN-GGNG").First(&tlnGagang).Error; err == nil {
			if err := db.Where("station_code = ?", models.StationCodeWoodWorking).First(&st1).Error; err == nil {
				var assign models.MitraProductStationAssignment
				db.Where("mitra_user_id = ? AND product_id = ? AND station_id = ?", baryadi.ID, tlnGagang.ID, st1.ID).
					FirstOrCreate(&assign, models.MitraProductStationAssignment{
						MitraUserID:           baryadi.ID,
						ProductID:             tlnGagang.ID,
						StationID:             st1.ID,
						PieceRateFee:          3500.00,
						DailyCapacityEstimate: 200,
						IsPrimary:             true,
						Notes:                 "Spesialis belah, serut, dan pembentukan profil gagang",
					})
			}
		}
	}

	// 4. Seed Sample Active SPK (SPK-2026-09-0012)
	var spk models.WorkOrder
	err = db.Where("spk_number = ?", "SPK-2026-09-0012").First(&spk).Error
	if err == gorm.ErrRecordNotFound {
		var prod models.Product
		if err := db.Where("product_code = ?", "TLN-GGNG").First(&prod).Error; err == nil {
			now := time.Now()
			deadline := now.Add(5 * 24 * time.Hour)

			spk = models.WorkOrder{
				SPKNumber:      "SPK-2026-09-0012",
				ProductID:      prod.ID,
				TotalTargetQty: 200,
				Priority:       "normal",
				Status:         models.WOStatusInProgress,
				StartDate:      &now,
				DeadlineDate:   &deadline,
			}

			if err := db.Create(&spk).Error; err == nil {
				// Create 5 WorkOrderStation steps
				var allStations []models.WorkStation
				db.Order("sequence_order ASC").Find(&allStations)

				for i, st := range allStations {
					assignedType := models.AssignedTypeInternal
					var assignedUID *uint64
					status := models.StationStatusPending

					if st.StationCode == models.StationCodeWoodWorking {
						assignedType = models.AssignedTypeMitra
						if baryadi.ID > 0 {
							assignedUID = &baryadi.ID
						}
						status = models.StationStatusInProgress
					}

					wos := models.WorkOrderStation{
						WorkOrderID:    spk.ID,
						StationID:      st.ID,
						SequenceOrder:  i + 1,
						AssignedType:   assignedType,
						AssignedUserID: assignedUID,
						Status:         status,
						InputQty:       200,
						CompletedQty:   0,
						RejectQty:      0,
						ReworkQty:      0,
						Notes:          fmt.Sprintf("Routing %s untuk %s", st.Name, prod.ProductName),
					}
					db.Create(&wos)
				}
				log.Println("[Seeder] Created sample active SPK-2026-09-0012 with 5 routing stations")
			}
		}
	}

	return nil
}
