package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/gupshup"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PublicWhatsAppHandler handles the public WhatsApp API endpoints.
type PublicWhatsAppHandler struct {
	db *sqlx.DB
}

func NewPublicWhatsAppHandler(db *sqlx.DB) *PublicWhatsAppHandler {
	return &PublicWhatsAppHandler{db: db}
}

var waPhoneRegex = regexp.MustCompile(`^\d{10,15}$`)

// Send sends a single WhatsApp message via the public API.
func (h *PublicWhatsAppHandler) Send(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		To           string          `json:"to"`
		Type         string          `json:"type"`          // "template" or "text"
		TemplateName string          `json:"template_name"` // for template messages
		TemplateData json.RawMessage `json:"template_data"` // template params as JSON
		Message      string          `json:"message"`       // for text messages
		WebhookURL   *string         `json:"webhook_url"`
		Reference    *string         `json:"reference"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if req.To == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Phone number is required", "to")
	}

	if !waPhoneRegex.MatchString(req.To) {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid phone number. Must be 10-15 digits", "to")
	}

	if req.Type == "" {
		req.Type = "template"
	}

	if req.Type != "template" && req.Type != "text" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Type must be 'template' or 'text'", "type")
	}

	if req.Type == "template" && req.TemplateName == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Template name is required for template messages", "template_name")
	}

	if req.Type == "text" && req.Message == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message is required for text messages", "message")
	}

	accountID := keyInfo.AccountID

	// Check WhatsApp is configured
	if err := CheckWhatsAppConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Test mode
	if keyInfo.IsTest {
		return h.handleTestMode(c, accountID, keyInfo.KeyID, req.To, req.Type, req.Message, req.TemplateName, req.Reference)
	}

	// Reserve 1 credit
	creditCost := 1.0
	_, err := ReserveCredit(h.db, accountID, "whatsapp", creditCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "whatsapp")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("WhatsApp credit balance too low. Need %.0f, have %.0f", creditCost, balance), "")
	}

	// Get WhatsApp settings
	var settings struct {
		GupshupAPIKey string `db:"gupshup_api_key"`
		GupshupAppID  string `db:"gupshup_app_id"`
		AppName       string `db:"app_name"`
		SourcePhone   string `db:"source_phone"`
	}
	if err := h.db.Get(&settings, "SELECT gupshup_api_key, gupshup_app_id, app_name, source_phone FROM wa_settings WHERE account_id = $1", accountID); err != nil {
		RefundCredit(h.db, accountID, "whatsapp", creditCost)
		return apiError(c, http.StatusInternalServerError, "PROVIDER_ERROR", "Failed to load WhatsApp settings", "")
	}

	// Create message record
	webhookURL := keyInfo.WebhookURL
	if req.WebhookURL != nil {
		webhookURL = *req.WebhookURL
	}

	contentPreview := req.Message
	if req.Type == "template" {
		contentPreview = fmt.Sprintf("[Template: %s]", req.TemplateName)
	}

	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", content_preview, status, credits_charged, webhook_url, reference)
		VALUES ($1, $2, 'whatsapp', $3, $4, $5, 'sending', $6, $7, $8) RETURNING id
	`, accountID, keyInfo.KeyID, req.To, settings.SourcePhone, truncate(contentPreview, 200), creditCost, webhookURL, req.Reference).Scan(&msgID)

	// Send via Gupshup
	client := gupshup.NewClient(settings.GupshupAPIKey, settings.AppName, settings.SourcePhone)

	var result *gupshup.SendResponse
	var sendErr error

	if req.Type == "template" {
		// Build template JSON for Gupshup
		templateJSON := fmt.Sprintf(`{"id":"%s"}`, req.TemplateName)
		if req.TemplateData != nil {
			templateJSON = string(req.TemplateData)
		}
		result, sendErr = client.SendTemplateMessage(req.To, templateJSON)
	} else {
		result, sendErr = client.SendTextMessage(req.To, req.Message)
	}

	if sendErr != nil {
		RefundCredit(h.db, accountID, "whatsapp", creditCost)
		h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
		return apiError(c, http.StatusBadGateway, "PROVIDER_ERROR", fmt.Sprintf("WhatsApp send failed: %v", sendErr), "")
	}

	// Update message with provider ID
	providerMsgID := ""
	if result != nil {
		providerMsgID = result.MessageID
	}
	now := time.Now()
	h.db.Exec(`UPDATE api_messages SET status = 'sent', provider_message_id = $2, sent_at = $3, updated_at = $3 WHERE id = $1`, msgID, providerMsgID, now)

	// Confirm credit deduction
	ConfirmCredit(h.db, accountID, "whatsapp", creditCost, msgID)

	remaining := GetCreditBalance(h.db, accountID, "whatsapp")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("wa_msg_%d", msgID),
			"to":                req.To,
			"type":              req.Type,
			"status":            "sent",
			"credits_used":      creditCost,
			"credits_remaining": remaining,
		},
	})
}

// SendBulk sends WhatsApp messages to multiple numbers.
func (h *PublicWhatsAppHandler) SendBulk(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		Recipients []struct {
			To           string          `json:"to"`
			TemplateName string          `json:"template_name"`
			TemplateData json.RawMessage `json:"template_data"`
			Message      string          `json:"message"`
		} `json:"recipients"`
		Type         string          `json:"type"`          // shared type
		TemplateName string          `json:"template_name"` // shared template
		TemplateData json.RawMessage `json:"template_data"` // shared template data
		Message      string          `json:"message"`       // shared message
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if len(req.Recipients) == 0 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "At least one recipient is required", "recipients")
	}

	if len(req.Recipients) > 100 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Maximum 100 recipients per bulk request", "recipients")
	}

	if req.Type == "" {
		req.Type = "template"
	}

	accountID := keyInfo.AccountID

	if err := CheckWhatsAppConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Validate all recipients
	for i, r := range req.Recipients {
		if !waPhoneRegex.MatchString(r.To) {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("Invalid phone number at index %d: %s", i, r.To), "recipients")
		}
	}

	totalCost := float64(len(req.Recipients))

	if keyInfo.IsTest {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"batch_id":          "wa_test_batch",
				"total":             len(req.Recipients),
				"queued":            len(req.Recipients),
				"credits_used":      totalCost,
				"credits_remaining": 0,
				"test_mode":         true,
			},
		})
	}

	// Reserve credits
	_, err := ReserveCredit(h.db, accountID, "whatsapp", totalCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "whatsapp")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Need %.0f WhatsApp credits, have %.0f", totalCost, balance), "")
	}

	// Get WhatsApp settings
	var settings struct {
		GupshupAPIKey string `db:"gupshup_api_key"`
		GupshupAppID  string `db:"gupshup_app_id"`
		AppName       string `db:"app_name"`
		SourcePhone   string `db:"source_phone"`
	}
	h.db.Get(&settings, "SELECT gupshup_api_key, gupshup_app_id, app_name, source_phone FROM wa_settings WHERE account_id = $1", accountID)
	client := gupshup.NewClient(settings.GupshupAPIKey, settings.AppName, settings.SourcePhone)

	sent := 0
	failed := 0

	for _, r := range req.Recipients {
		// Determine template/message per recipient (fallback to shared)
		templateName := r.TemplateName
		if templateName == "" {
			templateName = req.TemplateName
		}
		templateData := r.TemplateData
		if templateData == nil {
			templateData = req.TemplateData
		}
		msg := r.Message
		if msg == "" {
			msg = req.Message
		}

		contentPreview := msg
		if req.Type == "template" {
			contentPreview = fmt.Sprintf("[Template: %s]", templateName)
		}

		var msgID int
		h.db.QueryRow(`
			INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", content_preview, status, credits_charged)
			VALUES ($1, $2, 'whatsapp', $3, $4, $5, 'sending', 1) RETURNING id
		`, accountID, keyInfo.KeyID, r.To, settings.SourcePhone, truncate(contentPreview, 200)).Scan(&msgID)

		var sendErr error
		if req.Type == "template" {
			templateJSON := fmt.Sprintf(`{"id":"%s"}`, templateName)
			if templateData != nil {
				templateJSON = string(templateData)
			}
			_, sendErr = client.SendTemplateMessage(r.To, templateJSON)
		} else {
			_, sendErr = client.SendTextMessage(r.To, msg)
		}

		if sendErr != nil {
			h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
			RefundCredit(h.db, accountID, "whatsapp", 1)
			failed++
		} else {
			h.db.Exec(`UPDATE api_messages SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, msgID)
			ConfirmCredit(h.db, accountID, "whatsapp", 1, msgID)
			sent++
		}
	}

	remaining := GetCreditBalance(h.db, accountID, "whatsapp")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"total":             len(req.Recipients),
			"sent":              sent,
			"failed":            failed,
			"credits_used":      float64(sent),
			"credits_remaining": remaining,
		},
	})
}

// GetMessage returns the status of a specific WhatsApp API message.
func (h *PublicWhatsAppHandler) GetMessage(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	id, _ := strconv.Atoi(c.Param("id"))

	var msg struct {
		ID             int        `json:"id" db:"id"`
		To             string     `json:"to" db:"to"`
		From           *string    `json:"from" db:"from"`
		Status         string     `json:"status" db:"status"`
		ProviderMsgID  *string    `json:"provider_message_id" db:"provider_message_id"`
		CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
		ErrorMessage   *string    `json:"error_message" db:"error_message"`
		Reference      *string    `json:"reference" db:"reference"`
		CreatedAt      time.Time  `json:"created_at" db:"created_at"`
		SentAt         *time.Time `json:"sent_at" db:"sent_at"`
		DeliveredAt    *time.Time `json:"delivered_at" db:"delivered_at"`
	}

	err := h.db.Get(&msg, `SELECT id, "to", "from", status, provider_message_id, credits_charged, error_message, reference, created_at, sent_at, delivered_at FROM api_messages WHERE id = $1 AND account_id = $2 AND channel = 'whatsapp'`, id, accountID)
	if err != nil {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    msg,
	})
}

// ListMessages returns paginated WhatsApp API messages.
func (h *PublicWhatsAppHandler) ListMessages(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage

	var total int
	h.db.Get(&total, "SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'whatsapp'", accountID)

	var messages []struct {
		ID             int        `json:"id" db:"id"`
		To             string     `json:"to" db:"to"`
		Status         string     `json:"status" db:"status"`
		CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
		Reference      *string    `json:"reference" db:"reference"`
		CreatedAt      time.Time  `json:"created_at" db:"created_at"`
		SentAt         *time.Time `json:"sent_at" db:"sent_at"`
	}

	h.db.Select(&messages, `
		SELECT id, "to", status, credits_charged, reference, created_at, sent_at
		FROM api_messages WHERE account_id = $1 AND channel = 'whatsapp'
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`, accountID, perPage, offset)

	if messages == nil {
		messages = make([]struct {
			ID             int        `json:"id" db:"id"`
			To             string     `json:"to" db:"to"`
			Status         string     `json:"status" db:"status"`
			CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
			Reference      *string    `json:"reference" db:"reference"`
			CreatedAt      time.Time  `json:"created_at" db:"created_at"`
			SentAt         *time.Time `json:"sent_at" db:"sent_at"`
		}, 0)
	}

	return response.Paginated(c, messages, total, page, perPage)
}

// GetBalance returns the WhatsApp credit balance.
func (h *PublicWhatsAppHandler) GetBalance(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	balance := GetCreditBalance(h.db, keyInfo.AccountID, "whatsapp")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":            "whatsapp",
			"balance":            balance,
			"credit_per_message": 1,
		},
	})
}

// GetStatus checks if WhatsApp is configured and working.
func (h *PublicWhatsAppHandler) GetStatus(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	err := CheckWhatsAppConfigured(h.db, keyInfo.AccountID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":    "whatsapp",
			"configured": err == nil,
			"provider":   "gupshup",
		},
	})
}

// ListTemplates returns the available WhatsApp templates for the account.
func (h *PublicWhatsAppHandler) ListTemplates(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID

	var templates []struct {
		ID           int    `json:"id" db:"id"`
		TemplateName string `json:"template_name" db:"template_name"`
		Category     string `json:"category" db:"category"`
		Language     string `json:"language" db:"language"`
		Status       string `json:"status" db:"status"`
		HeaderType   string `json:"header_type" db:"header_type"`
		Body         string `json:"body" db:"body"`
	}

	h.db.Select(&templates, `
		SELECT id, template_name, category, language, status, header_type, body
		FROM wa_templates WHERE account_id = $1 AND status = 'APPROVED'
		ORDER BY template_name
	`, accountID)

	if templates == nil {
		templates = make([]struct {
			ID           int    `json:"id" db:"id"`
			TemplateName string `json:"template_name" db:"template_name"`
			Category     string `json:"category" db:"category"`
			Language     string `json:"language" db:"language"`
			Status       string `json:"status" db:"status"`
			HeaderType   string `json:"header_type" db:"header_type"`
			Body         string `json:"body" db:"body"`
		}, 0)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    templates,
	})
}

func (h *PublicWhatsAppHandler) handleTestMode(c echo.Context, accountID, keyID int, to, msgType, message, templateName string, reference *string) error {
	contentPreview := message
	if msgType == "template" {
		contentPreview = fmt.Sprintf("[Template: %s]", templateName)
	}

	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", content_preview, status, credits_charged, reference)
		VALUES ($1, $2, 'whatsapp', $3, $4, 'test', 0, $5) RETURNING id
	`, accountID, keyID, to, truncate(contentPreview, 200), reference).Scan(&msgID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("wa_msg_%d", msgID),
			"to":                to,
			"type":              msgType,
			"status":            "test",
			"credits_used":      0,
			"credits_remaining": GetCreditBalance(h.db, accountID, "whatsapp"),
			"test_mode":         true,
		},
	})
}
