package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DBDriver     string
	DBName       string
	JWTSecret    string
	AppURL       string
	OpenWAURL       string
	OpenWASessionID string
	OpenWASecret    string
	OpenWAAPIKey    string
	GeminiAPIKey    string
	OpenAIAPIKey    string
	AIProvider      string // gemini, openai, local
	AIModel         string
}

func LoadConfig() *Config {
	_ = godotenv.Load(".env", "../.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbDriver := os.Getenv("DB_DRIVER")
	if dbDriver == "" {
		dbDriver = "sqlite"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "kayukwas.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super-secret-jwt-key-for-kayukwas-production-2026"
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	aiProvider := os.Getenv("AI_PROVIDER")
	if aiProvider == "" {
		if os.Getenv("GEMINI_API_KEY") != "" {
			aiProvider = "gemini"
		} else if os.Getenv("OPENAI_API_KEY") != "" {
			aiProvider = "openai"
		} else {
			aiProvider = "gemini"
		}
	}

	aiModel := os.Getenv("AI_MODEL")
	if aiModel == "" {
		if aiProvider == "openai" {
			aiModel = "gpt-4o-mini"
		} else {
			aiModel = "gemini-1.5-flash"
		}
	}

	openWAURL := os.Getenv("OPENWA_URL")
	if openWAURL == "" {
		openWAURL = "https://openwaha.kayukwas.co.id/api"
	}

	openWASessionID := os.Getenv("OPENWA_SESSION_ID")
	if openWASessionID == "" {
		openWASessionID = "5ab1774b-97a5-4656-96b7-52ca8a3a96bf"
	}

	openWAAPIKey := os.Getenv("OPENWA_API_KEY")
	if openWAAPIKey == "" {
		openWAAPIKey = "owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0"
	}

	openWASecret := os.Getenv("OPENWA_WEBHOOK_SECRET")
	if openWASecret == "" {
		openWASecret = "kayukwas-openwa-webhook-secret-2026"
	}

	return &Config{
		Port:            port,
		DBDriver:        dbDriver,
		DBName:          dbName,
		JWTSecret:       jwtSecret,
		AppURL:          appURL,
		OpenWAURL:       openWAURL,
		OpenWASessionID: openWASessionID,
		OpenWASecret:    openWASecret,
		OpenWAAPIKey:    openWAAPIKey,
		GeminiAPIKey:    os.Getenv("GEMINI_API_KEY"),
		OpenAIAPIKey:    os.Getenv("OPENAI_API_KEY"),
		AIProvider:      aiProvider,
		AIModel:         aiModel,
	}
}
