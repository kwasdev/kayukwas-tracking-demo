package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OpenWAConfig struct {
	BaseURL       string
	SessionID     string
	APIKey        string
	WebhookSecret string
}

type OpenWAClient struct {
	config     OpenWAConfig
	httpClient *http.Client
}

func NewOpenWAClient(cfg OpenWAConfig) *OpenWAClient {
	baseURL := strings.TrimSuffix(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://openwaha.kayukwas.co.id/api"
	}
	sessionID := cfg.SessionID
	if sessionID == "" {
		sessionID = "5ab1774b-97a5-4656-96b7-52ca8a3a96bf"
	}
	return &OpenWAClient{
		config: OpenWAConfig{
			BaseURL:       baseURL,
			SessionID:     sessionID,
			APIKey:        cfg.APIKey,
			WebhookSecret: cfg.WebhookSecret,
		},
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *OpenWAClient) GetBaseURL() string {
	if c == nil || c.config.BaseURL == "" {
		return "https://openwaha.kayukwas.co.id/api"
	}
	return c.config.BaseURL
}

func (c *OpenWAClient) UpdateConfig(cfg OpenWAConfig) {
	if c != nil {
		if cfg.BaseURL != "" {
			c.config.BaseURL = strings.TrimSuffix(cfg.BaseURL, "/")
		}
		if cfg.SessionID != "" {
			c.config.SessionID = cfg.SessionID
		}
		if cfg.APIKey != "" {
			c.config.APIKey = cfg.APIKey
		}
		if cfg.WebhookSecret != "" {
			c.config.WebhookSecret = cfg.WebhookSecret
		}
	}
}

// SendTextMessage sends WhatsApp text message via OpenWA REST API
func (c *OpenWAClient) SendTextMessage(ctx context.Context, toPhone, messageText string) error {
	if c.config.BaseURL == "" {
		return fmt.Errorf("openwa base url not configured")
	}

	formattedPhone := formatToOpenWAID(toPhone)
	sessionID := c.config.SessionID
	if sessionID == "" {
		sessionID = "5ab1774b-97a5-4656-96b7-52ca8a3a96bf"
	}

	// Primary OpenWAHA REST endpoint
	primaryURL := fmt.Sprintf("%s/sessions/%s/messages/send-text", c.config.BaseURL, sessionID)

	payload := map[string]interface{}{
		"chatId": formattedPhone,
		"text":   messageText,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", primaryURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if c.config.APIKey != "" {
		req.Header.Set("X-API-Key", c.config.APIKey)
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
		req.Header.Set("api_key", c.config.APIKey)
	}

	resp, err := c.httpClient.Do(req)
	if err == nil && resp.StatusCode < 400 {
		_ = resp.Body.Close()
		return nil
	}

	if resp != nil {
		resp.Body.Close()
	}

	// Fallback to legacy /api/sendText or /sendText if session-based endpoint failed
	fallbackURL := fmt.Sprintf("%s/sendText", c.config.BaseURL)
	if !strings.HasSuffix(c.config.BaseURL, "/api") {
		fallbackURL = fmt.Sprintf("%s/api/sendText", c.config.BaseURL)
	}

	reqFb, errFb := http.NewRequestWithContext(ctx, "POST", fallbackURL, bytes.NewBuffer(jsonBytes))
	if errFb != nil {
		return fmt.Errorf("failed to create fallback request: %w", errFb)
	}

	reqFb.Header.Set("Content-Type", "application/json")
	if c.config.APIKey != "" {
		reqFb.Header.Set("X-API-Key", c.config.APIKey)
		reqFb.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	respFb, errFb := c.httpClient.Do(reqFb)
	if errFb != nil {
		return fmt.Errorf("failed to send OpenWA message: %w", errFb)
	}
	defer respFb.Body.Close()

	if respFb.StatusCode >= 400 {
		body, _ := io.ReadAll(respFb.Body)
		return fmt.Errorf("openwa returned error code %d: %s", respFb.StatusCode, string(body))
	}

	return nil
}

// CheckHealth verifies connection to OpenWA Gateway
func (c *OpenWAClient) CheckHealth(ctx context.Context) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/health", c.config.BaseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if c.config.APIKey != "" {
		req.Header.Set("X-API-Key", c.config.APIKey)
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return map[string]interface{}{
			"connected": false,
			"error":     err.Error(),
			"url":       c.config.BaseURL,
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	_ = json.Unmarshal(body, &data)

	return map[string]interface{}{
		"connected": resp.StatusCode == 200,
		"status":    resp.Status,
		"url":       c.config.BaseURL,
		"session":   c.config.SessionID,
		"details":   data,
	}, nil
}

func formatToOpenWAID(phone string) string {
	cleaned := strings.TrimPrefix(phone, "+")
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	if !strings.HasSuffix(cleaned, "@c.us") {
		cleaned += "@c.us"
	}
	return cleaned
}
