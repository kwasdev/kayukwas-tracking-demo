package handler

import (
	"context"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/kayukwas/tracking-backend/internal/agent"
	"github.com/kayukwas/tracking-backend/internal/utils"
)

type OpenWAWebhookHandler struct {
	agentEngine  *agent.AgentEngine
	openwaClient *agent.OpenWAClient
}

func NewOpenWAWebhookHandler(agentEngine *agent.AgentEngine, openwaClient *agent.OpenWAClient) *OpenWAWebhookHandler {
	return &OpenWAWebhookHandler{
		agentEngine:  agentEngine,
		openwaClient: openwaClient,
	}
}

// OpenWAMessageData represents the inner message data in OpenWA/WAHA
type OpenWAMessageData struct {
	ID        string `json:"id"`
	From      string `json:"from"` // e.g. "6281234567890@c.us"
	To        string `json:"to"`
	Body      string `json:"body"`
	Type      string `json:"type"` // chat, ptt, audio, image
	Mimetype  string `json:"mimetype"`
	Caption   string `json:"caption"`
	FromMe    bool   `json:"fromMe"`
	IsGroup   bool   `json:"isGroupMsg"`
	Sender    struct {
		ID       string `json:"id"`
		Pushname string `json:"pushname"`
	} `json:"sender"`
}

// OpenWAMessagePayload represents standard OpenWA incoming webhook structure
type OpenWAMessagePayload struct {
	Event   string            `json:"event"` // onMessage, message, message.received
	Session string            `json:"session"`
	Payload OpenWAMessageData `json:"payload"`
	Data    OpenWAMessageData `json:"data"`
	// Direct root-level fields fallback
	OpenWAMessageData
}

// HandleWebhook receives and processes real WhatsApp messages from OpenWA Gateway
func (h *OpenWAWebhookHandler) HandleWebhook(c *fiber.Ctx) error {
	var payload OpenWAMessagePayload
	if err := c.BodyParser(&payload); err != nil {
		return utils.JSONError(c, fiber.StatusBadRequest, "Invalid OpenWA payload", err.Error())
	}

	// Pick whichever data container is populated
	msgData := payload.Payload
	if msgData.From == "" && msgData.Body == "" && msgData.Caption == "" {
		if payload.Data.From != "" || payload.Data.Body != "" || payload.Data.Caption != "" {
			msgData = payload.Data
		} else {
			msgData = payload.OpenWAMessageData
		}
	}

	// Ignore messages sent by bot itself
	if msgData.FromMe {
		return c.SendStatus(fiber.StatusOK)
	}

	rawSender := msgData.From
	if rawSender == "" {
		rawSender = msgData.Sender.ID
	}
	cleanPhone := rawSender
	if idx := strings.Index(cleanPhone, "@"); idx != -1 {
		cleanPhone = cleanPhone[:idx]
	}
	cleanPhone = strings.TrimPrefix(cleanPhone, "+")
	cleanPhone = strings.ReplaceAll(cleanPhone, " ", "")
	cleanPhone = strings.ReplaceAll(cleanPhone, "-", "")
	cleanPhone = strings.ReplaceAll(cleanPhone, "'", "")
	cleanPhone = strings.ReplaceAll(cleanPhone, "\"", "")

	messageText := msgData.Body
	if messageText == "" {
		messageText = msgData.Caption
	}

	if messageText == "" {
		return utils.JSONSuccess(c, fiber.StatusOK, "No text content in payload or non-message event", nil)
	}

	inputType := "text"
	if msgData.Type == "ptt" || msgData.Type == "audio" {
		inputType = "voice"
		messageText = "[Voice Note Transcribed]: " + messageText
	} else if msgData.Type == "image" {
		inputType = "vision"
		messageText = "[Vision OCR Image Caption]: " + messageText
	}

	log.Printf("[OpenWA Webhook] Incoming message from %s (%s): %s\n", cleanPhone, inputType, messageText)

	// Process via Agentic Engine
	agentResp, err := h.agentEngine.ProcessMessage(agent.AgentParseRequest{
		PhoneNumber: cleanPhone,
		RawMessage:  messageText,
		InputType:   inputType,
	})

	if err != nil {
		log.Printf("[OpenWA Webhook] Agent processing error: %v\n", err)
		return utils.JSONError(c, fiber.StatusInternalServerError, "Agent processing failed", err.Error())
	}

	// Send outbound reply back via OpenWA Gateway
	if h.openwaClient != nil && agentResp.WhatsAppReply != "" {
		ctx := context.Background()
		go func() {
			if err := h.openwaClient.SendTextMessage(ctx, cleanPhone, agentResp.WhatsAppReply); err != nil {
				log.Printf("[OpenWA Webhook] Outbound send to %s failed (Check OPENWA_URL): %v\n", cleanPhone, err)
			} else {
				log.Printf("[OpenWA Webhook] Replied successfully to WhatsApp %s\n", cleanPhone)
			}
		}()
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "OpenWA message processed and queued", fiber.Map{
		"sender":   cleanPhone,
		"reply":    agentResp.WhatsAppReply,
		"intent":   agentResp.Intent,
		"decision": agentResp.Event,
	})
}

// GetOpenWAStatus returns gateway health & connectivity details
func (h *OpenWAWebhookHandler) GetOpenWAStatus(c *fiber.Ctx) error {
	if h.openwaClient == nil {
		return utils.JSONSuccess(c, fiber.StatusOK, "OpenWA client not initialized", fiber.Map{
			"connected": false,
		})
	}

	status, err := h.openwaClient.CheckHealth(c.Context())
	if err != nil {
		return utils.JSONError(c, fiber.StatusInternalServerError, "Failed to check OpenWA status", err.Error())
	}

	return utils.JSONSuccess(c, fiber.StatusOK, "OpenWA Gateway Status", status)
}
