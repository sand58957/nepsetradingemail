package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PublicWhatsAppHandler handles the public WhatsApp API endpoints.
type PublicWhatsAppHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewPublicWhatsAppHandler(db *sqlx.DB, cfg *config.Config) *PublicWhatsAppHandler {
	return &PublicWhatsAppHandler{db: db, cfg: cfg}
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
		SessionID   string `db:"openwa_session_id"`
		AppName     string `db:"app_name"`
		SourcePhone string `db:"linked_phone"`
	}
	if err := h.db.Get(&settings, "SELECT openwa_session_id, app_name, linked_phone FROM wa_settings WHERE account_id = $1", accountID); err != nil {
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

	// This row is the only record that the send happened, so a failure to write it
	// has to stop the send. Discarding the error left msgID at 0: the message went
	// out, the credit was spent, every later UPDATE matched no row, and the caller
	// got a 200 quoting message_id "wa_msg_0", which then 404s on lookup and never
	// appears in GET /messages. An over-long `reference` (the column is 255) is
	// enough to trigger it.
	var msgID int
	if err := h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", content_preview, status, credits_charged, webhook_url, reference)
		VALUES ($1, $2, 'whatsapp', $3, $4, $5, 'sending', $6, $7, $8) RETURNING id
	`, accountID, keyInfo.KeyID, req.To, settings.SourcePhone, truncate(contentPreview, 200), creditCost, webhookURL, req.Reference).Scan(&msgID); err != nil {
		RefundCredit(h.db, accountID, "whatsapp", creditCost)

		return apiError(c, http.StatusInternalServerError, "PROVIDER_ERROR",
			"Could not record the message, so it was not sent. No credit was charged.", "")
	}

	// Send via the self-hosted gateway. A "template" request no longer references
	// an approved Meta template by name — that concept went with Gupshup — so the
	// stored body is rendered to text and sent like any other message.
	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	var result *openwa.SendResult
	var sendErr error

	if settings.SessionID == "" {
		sendErr = openwa.ErrNoConnectedSession
	} else {
		text := req.Message

		if req.Type == "template" {
			var tmpl struct {
				HeaderText string `db:"header_text"`
				BodyText   string `db:"body_text"`
				FooterText string `db:"footer_text"`
			}
			if err := h.db.Get(&tmpl,
				`SELECT header_text, body_text, footer_text FROM wa_templates
				 WHERE account_id = $1 AND name = $2 LIMIT 1`, accountID, req.TemplateName); err != nil {
				RefundCredit(h.db, accountID, "whatsapp", creditCost)

				// The api_messages row was inserted before this lookup, so it has
				// to be closed out here as well. Under Gupshup the template name
				// went straight to Meta and there was nothing to look up locally;
				// rendering templates ourselves added a failure point between the
				// insert and the send, and rows that took it sat at 'sending' for
				// ever, still claiming a credit that had just been handed back.
				h.db.Exec(`UPDATE api_messages SET status = 'failed', credits_charged = 0,
					error_message = $2, updated_at = NOW() WHERE id = $1`,
					msgID, fmt.Sprintf("no template named %q", req.TemplateName))

				return apiError(c, http.StatusBadRequest, "TEMPLATE_NOT_FOUND",
					fmt.Sprintf("No template named %q", req.TemplateName), "")
			}

			var params []string
			if req.TemplateData != nil {
				_ = json.Unmarshal(req.TemplateData, &params)
			}

			text = openwa.RenderTemplate(tmpl.HeaderText, tmpl.BodyText, tmpl.FooterText, params)
		}

		result, sendErr = client.SendText(c.Request().Context(), settings.SessionID, req.To, text)
	}

	// The send governor holding the number back is a rate limit, not a provider
	// fault, and the caller can usefully retry it later — so say 429 and how long
	// to wait, rather than 502.
	if paced := (*openwa.PacingLimitedError)(nil); errors.As(sendErr, &paced) {
		RefundCredit(h.db, accountID, "whatsapp", creditCost)
		h.db.Exec(`UPDATE api_messages SET status = 'failed', credits_charged = 0, error_message = $2, updated_at = NOW() WHERE id = $1`,
			msgID, paced.Error())

		if seconds := int(paced.RetryAfter.Seconds()); seconds > 0 {
			c.Response().Header().Set("Retry-After", strconv.Itoa(seconds))
		}

		return apiError(c, http.StatusTooManyRequests, "RATE_LIMITED",
			"WhatsApp sending is paced to protect the linked number: "+paced.Reason, "")
	}

	if sendErr != nil {
		RefundCredit(h.db, accountID, "whatsapp", creditCost)
		h.db.Exec(`UPDATE api_messages SET status = 'failed', credits_charged = 0, error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
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
		SessionID   string `db:"openwa_session_id"`
		AppName     string `db:"app_name"`
		SourcePhone string `db:"linked_phone"`
	}
	h.db.Get(&settings, "SELECT openwa_session_id, app_name, linked_phone FROM wa_settings WHERE account_id = $1", accountID)
	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	sent := 0
	failed := 0

	// Pace the batch the way the campaign sender is paced. This is an unofficial
	// gateway driving a real WhatsApp account, and a burst of back-to-back sends is
	// the behaviour that gets a number restricted; the campaign path was clamped to
	// this rate after a run at roughly 5,000/min burned through 15,783 contacts
	// against a logged-out session. A bulk call of 100 previously went out as fast
	// as the loop could turn, which is the same risk through a different door.
	const bulkSendRate = 2 // messages per second
	throttle := time.NewTicker(time.Second / bulkSendRate)
	defer throttle.Stop()

	// Give up rather than hammer a gateway that is clearly not accepting anything —
	// the failure mode that made the earlier incident expensive was continuing to
	// send into a dead session and marking every contact failed on the way.
	const maxConsecutiveFailures = 10
	consecutiveFailures := 0
	aborted := false

	for i, r := range req.Recipients {
		if consecutiveFailures >= maxConsecutiveFailures {
			aborted = true

			break
		}

		// Pace between sends, not before the first one.
		if i > 0 {
			select {
			case <-throttle.C:
			case <-c.Request().Context().Done():
				aborted = true
			}

			if aborted {
				break
			}
		}

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

		if settings.SessionID == "" {
			sendErr = openwa.ErrNoConnectedSession
		} else {
			text := msg

			// As above: a template is a locally stored body now, rendered here
			// rather than referenced by an approved name upstream.
			if req.Type == "template" {
				var tmpl struct {
					HeaderText string `db:"header_text"`
					BodyText   string `db:"body_text"`
					FooterText string `db:"footer_text"`
				}
				if err := h.db.Get(&tmpl,
					`SELECT header_text, body_text, footer_text FROM wa_templates
					 WHERE account_id = $1 AND name = $2 LIMIT 1`, accountID, templateName); err != nil {
					sendErr = fmt.Errorf("no template named %q", templateName)
				} else {
					var params []string
					if templateData != nil {
						_ = json.Unmarshal(templateData, &params)
					}

					text = openwa.RenderTemplate(tmpl.HeaderText, tmpl.BodyText, tmpl.FooterText, params)
				}
			}

			if sendErr == nil {
				_, sendErr = client.SendText(c.Request().Context(), settings.SessionID, r.To, text)
			}
		}

		if sendErr != nil {
			h.db.Exec(`UPDATE api_messages SET status = 'failed', credits_charged = 0, error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
			RefundCredit(h.db, accountID, "whatsapp", 1)
			failed++
			consecutiveFailures++
		} else {
			h.db.Exec(`UPDATE api_messages SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, msgID)
			ConfirmCredit(h.db, accountID, "whatsapp", 1, msgID)
			sent++
			consecutiveFailures = 0
		}
	}

	remaining := GetCreditBalance(h.db, accountID, "whatsapp")

	// Say plainly when the batch stopped early. Reporting total as the requested
	// count while sent+failed is lower would read as though the rest succeeded.
	skipped := len(req.Recipients) - (sent + failed)

	data := map[string]interface{}{
		"total":             len(req.Recipients),
		"sent":              sent,
		"failed":            failed,
		"credits_used":      float64(sent),
		"credits_remaining": remaining,
	}

	if aborted && skipped > 0 {
		data["skipped"] = skipped
		data["message"] = fmt.Sprintf(
			"Stopped after %d consecutive failures; %d recipients were not attempted. Check the WhatsApp connection and resend those.",
			consecutiveFailures, skipped)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
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
	configured := CheckWhatsAppConfigured(h.db, keyInfo.AccountID) == nil

	data := map[string]interface{}{
		"channel":    "whatsapp",
		"configured": configured,
		"provider":   "openwa",
	}

	// "configured" only means a session id is stored against the account. Whether
	// a message can actually be sent depends on the gateway still holding that
	// session in the ready state, and a linked handset can drop out at any time —
	// someone unlinks the device, the phone goes offline, WhatsApp restricts the
	// account. Reporting configured alone told callers the channel was fine while
	// every send came back 502, so ask the gateway and report what it says.
	if configured {
		var settings struct {
			SessionID   string `db:"openwa_session_id"`
			LinkedPhone string `db:"linked_phone"`
		}

		if err := h.db.Get(&settings,
			"SELECT openwa_session_id, linked_phone FROM wa_settings WHERE account_id = $1",
			keyInfo.AccountID); err == nil {
			data["linked_phone"] = settings.LinkedPhone

			client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

			session, err := client.GetSession(c.Request().Context(), settings.SessionID)
			switch {
			case err != nil:
				data["connected"] = false
				data["session_status"] = "unreachable"
				data["detail"] = "The WhatsApp gateway could not be reached, so sends will fail."
			case session.Connected():
				data["connected"] = true
				data["session_status"] = session.Status
			default:
				data["connected"] = false
				data["session_status"] = session.Status
				data["detail"] = "The linked number is not ready to send. Re-link it in WhatsApp settings."
			}
		}
	} else {
		data["connected"] = false
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

// ListTemplates returns the available WhatsApp templates for the account.
func (h *PublicWhatsAppHandler) ListTemplates(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID

	// The columns here are name and body_text. Selecting template_name and body —
	// neither of which this table has ever had — made Postgres reject the query
	// outright, and because the error was discarded the endpoint answered 200 with
	// an empty list. An account with ten approved templates was told it had none.
	//
	// Status is stored lowercase ("approved"); the old filter compared against
	// Meta's uppercase 'APPROVED', so fixing only the column names would still have
	// returned nothing. Compare case-insensitively so either spelling matches.
	type apiTemplate struct {
		ID           int    `json:"id" db:"id"`
		TemplateName string `json:"template_name" db:"name"`
		Category     string `json:"category" db:"category"`
		Language     string `json:"language" db:"language"`
		Status       string `json:"status" db:"status"`
		HeaderType   string `json:"header_type" db:"header_type"`
		Body         string `json:"body" db:"body_text"`
	}

	templates := []apiTemplate{}

	if err := h.db.Select(&templates, `
		SELECT id, name, category, language, status, header_type, body_text
		FROM wa_templates WHERE account_id = $1 AND lower(status) = 'approved'
		ORDER BY name
	`, accountID); err != nil {
		return apiError(c, http.StatusInternalServerError, "PROVIDER_ERROR", "Could not load templates", "")
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
