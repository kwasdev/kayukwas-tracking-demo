package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/kayukwas/tracking-backend/config"
	"github.com/kayukwas/tracking-backend/internal/agent"
	"github.com/kayukwas/tracking-backend/internal/database"
	"github.com/kayukwas/tracking-backend/internal/handler"
	"github.com/kayukwas/tracking-backend/internal/middleware"
	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/repository"
	"github.com/kayukwas/tracking-backend/internal/service"
)

func main() {
	// 1. Load Config
	cfg := config.LoadConfig()

	// 2. Init Database
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 3. Init Repositories
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	waResetRepo := repository.NewWaResetRepository(db)

	prodRepo := repository.NewProductRepository(db)
	stationRepo := repository.NewWorkStationRepository(db)
	woRepo := repository.NewWorkOrderRepository(db)
	mitraRepo := repository.NewMitraAssignmentRepository(db)
	qcRepo := repository.NewQCRepository(db)
	logistRepo := repository.NewLogisticsRepository(db)

	// 4. Init Services
	services := service.NewAppServices(cfg, userRepo, roleRepo, auditRepo, waResetRepo)
	prodService := service.NewProductionService(prodRepo, stationRepo, woRepo, mitraRepo, qcRepo, logistRepo, services)

	// 5. Init LLM & OpenWA Clients
	llmKey := cfg.GeminiAPIKey
	if cfg.AIProvider == "openai" {
		llmKey = cfg.OpenAIAPIKey
	}
	llmClient := agent.NewLLMClient(agent.LLMConfig{
		Provider: cfg.AIProvider,
		APIKey:   llmKey,
		Model:    cfg.AIModel,
	})
	openwaClient := agent.NewOpenWAClient(agent.OpenWAConfig{
		BaseURL:       cfg.OpenWAURL,
		SessionID:     cfg.OpenWASessionID,
		APIKey:        cfg.OpenWAAPIKey,
		WebhookSecret: cfg.OpenWASecret,
	})

	// Inject Real WhatsApp Notifier for cold bonding OTP
	services.SetWANotifier(openwaClient)

	// 6. Init Handlers
	handlers := handler.NewHandlers(services, services, services, services, services)
	prodHandlers := handler.NewProductionHandlers(prodService)
	agentHandlers := handler.NewAgentHandlers(db, prodService, llmClient, openwaClient)
	openwaHandler := handler.NewOpenWAWebhookHandler(agent.NewAgentEngine(db, llmClient, openwaClient), openwaClient)

	// 7. Setup Fiber App
	app := fiber.New(fiber.Config{
		AppName: "Kayu KWAS Tracking System v2",
	})

	// Global Middlewares
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-OpenWA-Signature, X-OpenWA-Event, X-OpenWA-Idempotency-Key",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: false,
	}))

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"system":  "Kayu KWAS Tracking API",
			"version": "2.0.0",
		})
	})

	// API v1 Router
	api := app.Group("/api/v1")

	// Public Auth & Activation Endpoints
	authGroup := api.Group("/auth")
	authGroup.Post("/login", handlers.Login)

	activationGroup := api.Group("/activation")
	activationGroup.Post("/request", handlers.RequestActivation)
	activationGroup.Get("/verify", handlers.VerifyMagicLink)
	activationGroup.Post("/set-password", handlers.VerifyOtpAndSetPassword)

	// Protected Endpoints
	authMiddleware := middleware.AuthMiddleware(cfg.JWTSecret)

	// User Profile
	authGroup.Get("/me", authMiddleware, handlers.GetProfile)

	// User Management (Requires 'kelola pengguna')
	userGroup := api.Group("/users", authMiddleware)
	userGroup.Get("/", middleware.RequirePermission(models.PermManageUsers), handlers.ListUsers)
	userGroup.Post("/", middleware.RequirePermission(models.PermManageUsers), handlers.CreateUser)
	userGroup.Get("/:id", middleware.RequirePermission(models.PermManageUsers), handlers.GetUserByID)
	userGroup.Put("/:id", middleware.RequirePermission(models.PermManageUsers), handlers.UpdateUser)
	userGroup.Patch("/:id/toggle-active", middleware.RequirePermission(models.PermManageUsers), handlers.ToggleUserActive)

	// Role & Permission Management
	roleGroup := api.Group("/roles", authMiddleware)
	roleGroup.Get("/", handlers.ListRoles)
	roleGroup.Post("/", middleware.RequirePermission(models.PermManageRoles), handlers.CreateRole)
	roleGroup.Get("/:id", handlers.GetRoleByID)
	roleGroup.Put("/:id/permissions", middleware.RequirePermission(models.PermManagePermissions), handlers.UpdateRolePermissions)
	roleGroup.Delete("/:id", middleware.RequirePermission(models.PermManageRoles), handlers.DeleteRole)

	// Permissions List
	api.Get("/permissions", authMiddleware, handlers.ListPermissions)

	// Audit Logs (Requires 'lihat catatan aktivitas')
	api.Get("/audit-logs", authMiddleware, middleware.RequirePermission(models.PermViewAuditLog), handlers.ListAuditLogs)

	// ----------------- Production Endpoints -----------------
	// Products
	productGroup := api.Group("/products", authMiddleware)
	productGroup.Get("/", prodHandlers.ListProducts)
	productGroup.Post("/", middleware.RequirePermission(models.PermManageWorkOrders), prodHandlers.CreateProduct)

	// Work Stations
	api.Get("/stations", authMiddleware, prodHandlers.ListStations)

	// SPK / Work Orders
	spkGroup := api.Group("/spk", authMiddleware)
	spkGroup.Get("/", prodHandlers.ListSPK)
	spkGroup.Post("/", middleware.RequirePermission(models.PermManageWorkOrders), prodHandlers.CreateSPK)
	spkGroup.Get("/:id", prodHandlers.GetSPKByID)
	spkGroup.Put("/stations/:wos_id/assign", middleware.RequirePermission(models.PermManageWorkOrders), prodHandlers.AssignStationWorker)
	spkGroup.Post("/stations/:wos_id/progress", prodHandlers.ReportStationProgress)

	// Mitra Specialization Assignments
	mitraGroup := api.Group("/mitra-assignments", authMiddleware)
	mitraGroup.Get("/", prodHandlers.ListMitraAssignments)
	mitraGroup.Post("/", middleware.RequirePermission(models.PermManageWorkOrders), prodHandlers.SaveMitraAssignment)
	mitraGroup.Delete("/:id", middleware.RequirePermission(models.PermManageWorkOrders), prodHandlers.DeleteMitraAssignment)

	// QC Inspection
	qcGroup := api.Group("/qc", authMiddleware)
	qcGroup.Post("/inspect", middleware.RequirePermission(models.PermInputQCInspection), prodHandlers.SubmitQCInspection)
	qcGroup.Get("/recent", prodHandlers.ListRecentQCLogs)
	qcGroup.Get("/logs", prodHandlers.ListRecentQCLogs)

	// Logistics Manifests
	logisticsGroup := api.Group("/logistics", authMiddleware)
	logisticsGroup.Get("/", prodHandlers.ListShipments)
	logisticsGroup.Get("/shipments", prodHandlers.ListShipments)
	logisticsGroup.Post("/", middleware.RequirePermission(models.PermManageLogistics), prodHandlers.CreateShipment)
	logisticsGroup.Post("/shipments", middleware.RequirePermission(models.PermManageLogistics), prodHandlers.CreateShipment)

	// ----------------- Agentic AI Endpoints -----------------
	agentGroup := api.Group("/agent")
	agentGroup.Get("/config", agentHandlers.GetAgentConfig)
	agentGroup.Post("/config", authMiddleware, agentHandlers.UpdateAgentConfig)
	agentGroup.Post("/parse", agentHandlers.ParseMessage)
	agentGroup.Post("/commit", authMiddleware, agentHandlers.CommitAction)
	agentGroup.Get("/presets", agentHandlers.GetPresets)

	// ----------------- OpenWA Real WhatsApp Webhook -----------------
	webhookGroup := api.Group("/webhook")
	webhookGroup.Post("/openwa", middleware.OpenWASignatureMiddleware(cfg.OpenWASecret), openwaHandler.HandleWebhook)
	webhookGroup.Get("/openwa/status", openwaHandler.GetOpenWAStatus)

	// Start Server
	log.Printf("[Server] Starting Kayu KWAS Tracking API on port %s...\n", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
