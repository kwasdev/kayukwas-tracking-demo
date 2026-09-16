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

type LLMConfig struct {
	Provider string // "gemini", "openai", "local"
	APIKey   string
	Model    string
}

type LLMClient struct {
	config     LLMConfig
	httpClient *http.Client
}

func NewLLMClient(cfg LLMConfig) *LLMClient {
	if cfg.Model == "" {
		if cfg.Provider == "openai" {
			cfg.Model = "gpt-4o-mini"
		} else {
			cfg.Model = "gemini-1.5-flash"
		}
	}
	return &LLMClient{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *LLMClient) GetProvider() string {
	if c == nil || c.config.Provider == "" {
		return "gemini"
	}
	return c.config.Provider
}

func (c *LLMClient) GetModel() string {
	if c == nil || c.config.Model == "" {
		return "gemini-1.5-flash"
	}
	return c.config.Model
}

func (c *LLMClient) HasKey() bool {
	return c != nil && c.config.APIKey != ""
}

func (c *LLMClient) UpdateConfig(cfg LLMConfig) {
	if c != nil {
		if cfg.Provider != "" {
			c.config.Provider = cfg.Provider
		}
		if cfg.APIKey != "" {
			c.config.APIKey = cfg.APIKey
		}
		if cfg.Model != "" {
			c.config.Model = cfg.Model
		}
	}
}

const SystemPrompt = `You are the Kayu KWAS Agentic Production & Logistics AI Assistant for a wooden kitchenware manufacturing factory.
Your role is to extract, validate, and structure informal production reports, on-site QC inspection reports, and logistics manifests from WhatsApp messages.

KEY PRODUCTION RULES:
1. NOMENCLATURE:
   - To human users (operators, artisans/mitra, mandor, drivers, QC), ALWAYS use "SPK" or "No. SPK" (e.g. SPK-2026-09-0012). NEVER use "Work Order" or "WO" in WhatsApp text.
2. WOODWORKING OPERATIONS & STATIONS:
   - Station 1: Wood Working (pasah/serut/ketam, graji/belah/potong, bubut mangkok/piring, tatah/router)
   - Station 2: Pasca Wood Working (amplas kasar/halus grit 80-240, dempul pori/wood filler)
   - Station 3: Finishing (celup mineral oil, nyirami, beeswax food-grade)
   - Station 4: Pasca Finishing (laser grafir logo, buffing lap residu, final QC in-house) -> STRICT 100% IN-HOUSE
   - Station 5: Packing & Barcode Pelabelan -> STRICT 100% IN-HOUSE
3. DEFECT TAXONOMY:
   - DEF_CRACK_GRAIN: tugel, pecah serat, retak rambut, patah (Reject Scrap / Down-size)
   - DEF_WARPING: muntir, nglinting, bengkok, melengkung, baling (Rework Oven / Planer)
   - DEF_KNOT_HOLE: mata mati, bolong, growong (Reject food-contact / Dempul)
   - DEF_CHIPPED: gompal, cuil, somplak, gowang (Rework Amplas / Chamfer)
   - DEF_UNEVEN_FINISH: mlocot, belang, minyak ora rata (Rework Lap & Re-coat)
   - DEF_MOLD: jamuren, jamur, lembab, bulukan, blue stain (Reject Kritis Oven Pabrik)
4. LOGISTICS 2-DIMENSIONS:
   - Dimension 1: Vehicle Gate (keluar / masuk)
   - Dimension 2: Product Action (kirim bahan / ambil jemput hasil)
   - Separate normal physical items (REVISI TOTAL) and mold defect items (REVISI JAMUR).
5. 3-TIER REJECT CLASSIFICATION:
   - Minor: bisa diperbaiki tidak berubah banyak / amplas tipis
   - Major: harus bongkar lem / press ulang
   - Scrap: harus ganti bahan / retak tembus
6. GUARDRAILS & ESCALATION:
   - If reject rate > 10%, trigger mandor escalation warning.
   - Always formulate a polite Indonesian WhatsApp confirmation summary and ask user to reply "YA" to confirm.

Respond strictly in JSON format with the following keys:
{
  "intent": "production_report" | "onsite_qc_report" | "logistics_manifest",
  "confidence_score": 0.95,
  "reasoning_summary": "Explanation of entity extraction and quantity resolution",
  "extracted_data": { ... },
  "escalation_alert": "string or null if reject > 10%",
  "whatsapp_reply": "Formatted Indonesian WhatsApp text with bold highlights asking for 'YA' confirmation"
}`

// CallLLM invokes either Google Gemini or OpenAI with structured prompt
func (c *LLMClient) CallLLM(ctx context.Context, userContextStr, rawMessage string) (*AgentParseResponse, error) {
	if c.config.APIKey == "" {
		return nil, fmt.Errorf("API key is not configured")
	}

	if c.config.Provider == "openai" {
		return c.callOpenAI(ctx, userContextStr, rawMessage)
	}
	return c.callGemini(ctx, userContextStr, rawMessage)
}

func (c *LLMClient) callGemini(ctx context.Context, userContextStr, rawMessage string) (*AgentParseResponse, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", c.config.Model, c.config.APIKey)

	fullPrompt := fmt.Sprintf("%s\n\nUSER CONTEXT:\n%s\n\nINCOMING WHATSAPP MESSAGE:\n\"%s\"", SystemPrompt, userContextStr, rawMessage)

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": fullPrompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":        0.1,
			"response_mime_type": "application/json",
		},
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error (Status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini API")
	}

	responseText := geminiResp.Candidates[0].Content.Parts[0].Text

	// Clean code fence blocks if any
	cleanJson := strings.TrimPrefix(strings.TrimSpace(responseText), "```json")
	cleanJson = strings.TrimPrefix(cleanJson, "```")
	cleanJson = strings.TrimSuffix(cleanJson, "```")
	cleanJson = strings.TrimSpace(cleanJson)

	var parsedOutput struct {
		Intent           string                 `json:"intent"`
		ConfidenceScore  float64                `json:"confidence_score"`
		ReasoningSummary string                 `json:"reasoning_summary"`
		ExtractedData    map[string]interface{} `json:"extracted_data"`
		EscalationAlert  *string                `json:"escalation_alert"`
		WhatsAppReply    string                 `json:"whatsapp_reply"`
	}

	if err := json.Unmarshal([]byte(cleanJson), &parsedOutput); err != nil {
		return nil, fmt.Errorf("failed to parse structured JSON from Gemini: %v (raw: %s)", err, cleanJson)
	}

	return &AgentParseResponse{
		Event:           parsedOutput.Intent + "_parsed",
		Intent:          parsedOutput.Intent,
		ConfidenceScore: parsedOutput.ConfidenceScore,
		ExtractedData:   parsedOutput.ExtractedData,
		ReasoningSteps: []ReasoningStep{
			{StepNumber: 1, Phase: "INGESTION & PERCEPTION", Detail: fmt.Sprintf("Menerima masukan teks: \"%s\"", rawMessage)},
			{StepNumber: 2, Phase: "GEMINI LLM REASONING", Detail: parsedOutput.ReasoningSummary},
			{StepNumber: 3, Phase: "GUARDRAIL & HUMAN-IN-THE-LOOP", Detail: "Menyiapkan format balasan WhatsApp dan meminta konfirmasi 'YA' sebelum commit."},
		},
		ToolCalls: []ToolCallRecord{
			{ToolName: "gemini_generate_content", InputArgs: fmt.Sprintf("model: %s", c.config.Model), OutputData: "Structured JSON schema output extracted successfully"},
		},
		WhatsAppReply:        parsedOutput.WhatsAppReply,
		RequiresConfirmation: true,
		ReadyToCommit:        false,
		EscalationAlert:      parsedOutput.EscalationAlert,
		DraftPayload:         parsedOutput.ExtractedData,
	}, nil
}

func (c *LLMClient) callOpenAI(ctx context.Context, userContextStr, rawMessage string) (*AgentParseResponse, error) {
	url := "https://api.openai.com/v1/chat/completions"

	fullPrompt := fmt.Sprintf("USER CONTEXT:\n%s\n\nINCOMING WHATSAPP MESSAGE:\n\"%s\"", userContextStr, rawMessage)

	payload := map[string]interface{}{
		"model": c.config.Model,
		"messages": []map[string]string{
			{"role": "system", "content": SystemPrompt},
			{"role": "user", "content": fullPrompt},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.1,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API error (Status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(bodyBytes, &openAIResp); err != nil {
		return nil, err
	}

	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from OpenAI API")
	}

	content := openAIResp.Choices[0].Message.Content

	var parsedOutput struct {
		Intent           string                 `json:"intent"`
		ConfidenceScore  float64                `json:"confidence_score"`
		ReasoningSummary string                 `json:"reasoning_summary"`
		ExtractedData    map[string]interface{} `json:"extracted_data"`
		EscalationAlert  *string                `json:"escalation_alert"`
		WhatsAppReply    string                 `json:"whatsapp_reply"`
	}

	if err := json.Unmarshal([]byte(content), &parsedOutput); err != nil {
		return nil, fmt.Errorf("failed to parse structured JSON from OpenAI: %v", err)
	}

	return &AgentParseResponse{
		Event:           parsedOutput.Intent + "_parsed",
		Intent:          parsedOutput.Intent,
		ConfidenceScore: parsedOutput.ConfidenceScore,
		ExtractedData:   parsedOutput.ExtractedData,
		ReasoningSteps: []ReasoningStep{
			{StepNumber: 1, Phase: "INGESTION & PERCEPTION", Detail: fmt.Sprintf("Menerima masukan teks: \"%s\"", rawMessage)},
			{StepNumber: 2, Phase: "OPENAI LLM REASONING", Detail: parsedOutput.ReasoningSummary},
			{StepNumber: 3, Phase: "GUARDRAIL & HUMAN-IN-THE-LOOP", Detail: "Menyiapkan format balasan WhatsApp dan meminta konfirmasi 'YA' sebelum commit."},
		},
		ToolCalls: []ToolCallRecord{
			{ToolName: "openai_chat_completions", InputArgs: fmt.Sprintf("model: %s", c.config.Model), OutputData: "Structured JSON schema output extracted successfully"},
		},
		WhatsAppReply:        parsedOutput.WhatsAppReply,
		RequiresConfirmation: true,
		ReadyToCommit:        false,
		EscalationAlert:      parsedOutput.EscalationAlert,
		DraftPayload:         parsedOutput.ExtractedData,
	}, nil
}
