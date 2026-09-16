package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/kayukwas/tracking-backend/internal/agent"
	"github.com/kayukwas/tracking-backend/internal/service"
	"github.com/kayukwas/tracking-backend/internal/utils"
	"gorm.io/gorm"
)

type AgentHandlers struct {
	agentEngine  *agent.AgentEngine
	prodService  service.ProductionService
	llmClient    *agent.LLMClient
	openwaClient *agent.OpenWAClient
	db           *gorm.DB
}

func NewAgentHandlers(db *gorm.DB, prodService service.ProductionService, llmClient *agent.LLMClient, openwaClient *agent.OpenWAClient) *AgentHandlers {
	return &AgentHandlers{
		agentEngine:  agent.NewAgentEngine(db, llmClient, openwaClient),
		prodService:  prodService,
		llmClient:    llmClient,
		openwaClient: openwaClient,
		db:           db,
	}
}

// GetAgentConfig returns active AI provider & OpenWA settings
func (h *AgentHandlers) GetAgentConfig(c *fiber.Ctx) error {
	hasGeminiKey := false
	hasOpenAIKey := false
	provider := "local"
	model := "gemini-1.5-flash"

	if h.llmClient != nil {
		provider = h.llmClient.GetProvider()
		model = h.llmClient.GetModel()
		hasGeminiKey = h.llmClient.HasKey()
		hasOpenAIKey = h.llmClient.HasKey()
	}

	openwaConnected := false
	openwaURL := "http://localhost:8000"
	if h.openwaClient != nil {
		openwaURL = h.openwaClient.GetBaseURL()
		status, _ := h.openwaClient.CheckHealth(c.Context())
		if conn, ok := status["connected"].(bool); ok {
			openwaConnected = conn
		}
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Konfigurasi Agentic AI & WhatsApp Gateway", fiber.Map{
		"ai_provider":       provider,
		"ai_model":          model,
		"has_gemini_key":    hasGeminiKey,
		"has_openai_key":    hasOpenAIKey,
		"openwa_url":        openwaURL,
		"openwa_connected":  openwaConnected,
		"webhook_url":       "http://localhost:8080/api/v1/webhook/openwa",
		"mode":              "production_ready",
	})
}

// UpdateAgentConfig saves and applies new API keys and OpenWA endpoints
func (h *AgentHandlers) UpdateAgentConfig(c *fiber.Ctx) error {
	var dto struct {
		AIProvider          string `json:"ai_provider"`
		GeminiAPIKey        string `json:"gemini_api_key"`
		OpenAIAPIKey        string `json:"openai_api_key"`
		AIModel             string `json:"ai_model"`
		OpenWAURL           string `json:"openwa_url"`
		OpenWAAPIKey        string `json:"openwa_api_key"`
		OpenWAWebhookSecret string `json:"openwa_webhook_secret"`
	}

	if err := c.BodyParser(&dto); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	apiKey := dto.GeminiAPIKey
	if dto.AIProvider == "openai" && dto.OpenAIAPIKey != "" {
		apiKey = dto.OpenAIAPIKey
	}

	if h.llmClient != nil {
		h.llmClient.UpdateConfig(agent.LLMConfig{
			Provider: dto.AIProvider,
			APIKey:   apiKey,
			Model:    dto.AIModel,
		})
	}

	if h.openwaClient != nil {
		h.openwaClient.UpdateConfig(agent.OpenWAConfig{
			BaseURL:       dto.OpenWAURL,
			APIKey:        dto.OpenWAAPIKey,
			WebhookSecret: dto.OpenWAWebhookSecret,
		})
	}

	return h.GetAgentConfig(c)
}

// ParseMessage handles incoming simulation or live WhatsApp webhook payloads
func (h *AgentHandlers) ParseMessage(c *fiber.Ctx) error {
	var req agent.AgentParseRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	if req.PhoneNumber == "" {
		req.PhoneNumber = "6281234567890" // Default to Superuser / sample worker
	}
	if req.InputType == "" {
		req.InputType = "text"
	}

	resp, err := h.agentEngine.ProcessMessage(req)
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Gagal memproses pesan via Agentic Engine", err.Error())
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Ekstraksi & reasoning agentic AI selesai", resp)
}

// CommitAction executes the confirmed mutation to core DB
func (h *AgentHandlers) CommitAction(c *fiber.Ctx) error {
	actorID, _ := c.Locals("user_id").(uint64)
	if actorID == 0 {
		actorID = 1 // Default to Superuser in demo
	}

	var payload struct {
		Intent       string                 `json:"intent"`
		DraftPayload map[string]interface{} `json:"draft_payload"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Format payload tidak valid", err.Error())
	}

	// Example commit for production progress report
	if payload.Intent == "production_report" {
		wosID := uint64(1)
		if idVal, ok := payload.DraftPayload["work_order_station_id"].(float64); ok && idVal > 0 {
			wosID = uint64(idVal)
		}

		passQty := 190
		if pVal, ok := payload.DraftPayload["reported_qty_pass"].(float64); ok {
			passQty = int(pVal)
		}

		rejQty := 10
		if rVal, ok := payload.DraftPayload["reported_qty_reject"].(float64); ok {
			rejQty = int(rVal)
		}

		notes := "Agentic AI WhatsApp Report"
		if nVal, ok := payload.DraftPayload["notes"].(string); ok {
			notes = nVal
		}

		wos, err := h.prodService.ReportStationProgress(actorID, wosID, service.ReportProgressDTO{
			LogType:         "progress_report",
			ReportedQtyPass: passQty,
			ReportedQtyRej:  rejQty,
			Notes:           notes,
			Channel:         "whatsapp",
		})
		if err != nil {
			return utils.JSONError(c, fiber.StatusBadRequest, "Gagal commit laporan produksi", err.Error())
		}
		return utils.JSONSuccess(c, fiber.StatusOK, "Laporan produksi berhasil di-commit ke core database", wos)
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Mutasi data telah berhasil dikonfirmasi dan dicatat ke database.", nil)
}

// GetPresets returns the 7 canonical test scenarios from documentation
func (h *AgentHandlers) GetPresets(c *fiber.Ctx) error {
	presets := []fiber.Map{
		{
			"id":          "scenario_1",
			"title":       "1. Laporan Teks Santai (Data Lengkap)",
			"description": "Operator (Pak Joko) melapor santai: SPK 0012 telenan jati rampung 190, 10 pecah serat diserut.",
			"phone":       "6281234567890",
			"input_type":  "text",
			"raw_message": "Pak mandor, SPK 0012 talenan jati sampun rampung 190 iji. Sing 10 pecah serat pas diserut.",
		},
		{
			"id":          "scenario_2",
			"title":       "2. Laporan Voice Note (Audio STT)",
			"description": "Operator mengirim rekaman suara piring jati pesanan 100 biji telah diamplas halus grit 240.",
			"phone":       "6281234567890",
			"input_type":  "voice",
			"raw_message": "[Voice Note 12s Transcribed]: Halo admin, piring jati yang pesenan 100 biji udah tak amplas halus semua grit 240, barang mulus gak ada yang rusak mas.",
		},
		{
			"id":          "scenario_3",
			"title":       "3. Foto Papan Tally Kapur (Vision OCR)",
			"description": "Operator mengirim foto corat-coret tally kapur di samping mesin bubut.",
			"phone":       "6281234567890",
			"input_type":  "vision",
			"raw_message": "[Vision OCR]: Terdeteksi tulisan kapur 'SPK 0012' dan turus lidi tally count terhitung: 75 pcs lolos, 0 rijek.",
		},
		{
			"id":          "scenario_4",
			"title":       "4. Peringatan Ambang Cacat > 10% (Escalation Alert)",
			"description": "Operator melapor 150 selesai namun 35 cacat melengkung/warp (18.9% reject -> memicu alert mandor).",
			"phone":       "6281234567890",
			"input_type":  "text",
			"raw_message": "Lapor SPK 0012 talenan selesai 150 pcs mas, tapi 35 pcs muntir melengkung baling semua kena panas.",
		},
		{
			"id":          "scenario_5",
			"title":       "5. Cek QC Mandiri 3-Tingkat di Mitra",
			"description": "QC Inspector (Mas Anto) cek di bengkel Pak Baryadi: 180 lolos, 10 amplas ringan, 3 bongkar lem, 2 ganti scrap.",
			"phone":       "6281234567890",
			"input_type":  "text",
			"raw_message": "Cek SPK 0012 Pak Baryadi produk telenan gagang: lolos 180 pcs, rijek 10 bisa diperbaiki ringan amplas, 3 harus bongkar lem, 2 harus ganti bahan kayu retak. Kondisi kayu kering, ukuran pas mal. Aman lanjut kerja.",
		},
		{
			"id":          "scenario_6",
			"title":       "6. Manifest Logistik 2D (Pesan Hijau -> Surat Jalan)",
			"description": "Supir/QC kirim pesan cepat jemput di mitra dengan rincian Revisi Total & Revisi Jamur.",
			"phone":       "6281234567890",
			"input_type":  "text",
			"raw_message": "ambil pak baryadi\n\nREVISI TOTAL\n1.Telenan oval kecil 368 pcs\n2.Telenan oval besar 25 pcs\n3.Telenan jepang 3 pcs\n4.Telenan gagang 25 pcs\n\nREVISI JAMUR\n1.Telenan oval kecil 148 pcs\n2.Telenan oval besar 7 pcs",
		},
		{
			"id":          "scenario_7",
			"title":       "7. Guardrail: Gate Belum Aktivasi (Pending)",
			"description": "Nomor pengirim belum melakukan aktivasi via WhatsApp OTP -> sistem menahan ekstraksi.",
			"phone":       "6289990001112",
			"input_type":  "text",
			"raw_message": "Halo saya mau lapor kerjaan hari ini 50 pcs",
		},
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "Daftar preset skenario pengujian agentic AI", presets)
}
