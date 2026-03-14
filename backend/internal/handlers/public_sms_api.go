package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/aakashsms"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PublicSMSHandler handles the public SMS API endpoints.
type PublicSMSHandler struct {
	db *sqlx.DB
}

func NewPublicSMSHandler(db *sqlx.DB) *PublicSMSHandler {
	return &PublicSMSHandler{db: db}
}

var phoneRegex = regexp.MustCompile(`^9\d{9}$`)

// Send sends a single SMS via the public API.
func (h *PublicSMSHandler) Send(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		To         string  `json:"to"`
		Message    string  `json:"message"`
		SenderID   string  `json:"sender_id"`
		WebhookURL *string `json:"webhook_url"`
		Reference  *string `json:"reference"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if req.To == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Phone number is required", "to")
	}

	if !phoneRegex.MatchString(req.To) {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid phone number. Must be 10 digits starting with 9", "to")
	}

	if req.Message == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message text is required", "message")
	}

	if len(req.Message) > 1600 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message too long. Maximum 1600 characters", "message")
	}

	accountID := keyInfo.AccountID

	// Check SMS is configured
	if err := CheckSMSConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Test mode — log but don't send
	if keyInfo.IsTest {
		return h.handleTestMode(c, accountID, keyInfo.KeyID, req.To, req.Message, req.Reference)
	}

	// Reserve 1 credit
	creditCost := 1.0
	_, err := ReserveCredit(h.db, accountID, "sms", creditCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "sms")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("SMS credit balance too low. Need %.0f, have %.0f", creditCost, balance), "")
	}

	// Get SMS settings
	var settings struct {
		AuthToken string `db:"auth_token"`
		SenderID  string `db:"sender_id"`
	}
	if err := h.db.Get(&settings, "SELECT auth_token, sender_id FROM sms_settings WHERE account_id = $1", accountID); err != nil {
		RefundCredit(h.db, accountID, "sms", creditCost)
		return apiError(c, http.StatusInternalServerError, "PROVIDER_ERROR", "Failed to load SMS settings", "")
	}

	// Create message record
	webhookURL := keyInfo.WebhookURL
	if req.WebhookURL != nil {
		webhookURL = *req.WebhookURL
	}

	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", content_preview, status, credits_charged, webhook_url, reference)
		VALUES ($1, $2, 'sms', $3, $4, $5, 'sending', $6, $7, $8) RETURNING id
	`, accountID, keyInfo.KeyID, req.To, settings.SenderID, truncate(req.Message, 200), creditCost, webhookURL, req.Reference).Scan(&msgID)

	// Send via Aakash SMS
	client := aakashsms.NewClient(settings.AuthToken)
	result, sendErr := client.SendSMS(req.To, req.Message)

	if sendErr != nil {
		RefundCredit(h.db, accountID, "sms", creditCost)
		h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
		return apiError(c, http.StatusBadGateway, "PROVIDER_ERROR", fmt.Sprintf("SMS send failed: %v", sendErr), "")
	}

	// Update message with provider ID
	providerMsgID := ""
	if len(result.Data.Valid) > 0 {
		providerMsgID = result.Data.Valid[0].ID
	}
	now := time.Now()
	h.db.Exec(`UPDATE api_messages SET status = 'sent', provider_message_id = $2, sent_at = $3, updated_at = $3 WHERE id = $1`, msgID, providerMsgID, now)

	// Confirm credit deduction
	ConfirmCredit(h.db, accountID, "sms", creditCost, msgID)

	remaining := GetCreditBalance(h.db, accountID, "sms")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("sms_msg_%d", msgID),
			"to":                req.To,
			"status":            "sent",
			"credits_used":      creditCost,
			"credits_remaining": remaining,
		},
	})
}

// SendBulk sends SMS to multiple numbers.
func (h *PublicSMSHandler) SendBulk(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		Recipients []struct {
			To      string `json:"to"`
			Message string `json:"message"`
		} `json:"recipients"`
		Message  string  `json:"message"`  // shared message if recipients don't have individual ones
		SenderID string  `json:"sender_id"`
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

	accountID := keyInfo.AccountID

	if err := CheckSMSConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Validate all recipients
	for i, r := range req.Recipients {
		if !phoneRegex.MatchString(r.To) {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("Invalid phone number at index %d: %s", i, r.To), "recipients")
		}
		msg := r.Message
		if msg == "" {
			msg = req.Message
		}
		if msg == "" {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("No message for recipient at index %d", i), "recipients")
		}
	}

	totalCost := float64(len(req.Recipients))

	if keyInfo.IsTest {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"batch_id":          "sms_test_batch",
				"total":             len(req.Recipients),
				"queued":            len(req.Recipients),
				"credits_used":      totalCost,
				"credits_remaining": 0,
				"test_mode":         true,
			},
		})
	}

	// Reserve credits
	_, err := ReserveCredit(h.db, accountID, "sms", totalCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "sms")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Need %.0f SMS credits, have %.0f", totalCost, balance), "")
	}

	// Get SMS settings
	var settings struct {
		AuthToken string `db:"auth_token"`
		SenderID  string `db:"sender_id"`
	}
	h.db.Get(&settings, "SELECT auth_token, sender_id FROM sms_settings WHERE account_id = $1", accountID)
	client := aakashsms.NewClient(settings.AuthToken)

	sent := 0
	failed := 0

	for _, r := range req.Recipients {
		msg := r.Message
		if msg == "" {
			msg = req.Message
		}

		var msgID int
		h.db.QueryRow(`
			INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", content_preview, status, credits_charged)
			VALUES ($1, $2, 'sms', $3, $4, $5, 'sending', 1) RETURNING id
		`, accountID, keyInfo.KeyID, r.To, settings.SenderID, truncate(msg, 200)).Scan(&msgID)

		_, sendErr := client.SendSMS(r.To, msg)
		if sendErr != nil {
			h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
			RefundCredit(h.db, accountID, "sms", 1)
			failed++
		} else {
			h.db.Exec(`UPDATE api_messages SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, msgID)
			ConfirmCredit(h.db, accountID, "sms", 1, msgID)
			sent++
		}
	}

	remaining := GetCreditBalance(h.db, accountID, "sms")

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

// GetMessage returns the status of a specific API message.
func (h *PublicSMSHandler) GetMessage(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	id, _ := strconv.Atoi(c.Param("id"))

	var msg struct {
		ID              int        `json:"id" db:"id"`
		To              string     `json:"to" db:"to"`
		From            *string    `json:"from" db:"from"`
		Status          string     `json:"status" db:"status"`
		ProviderMsgID   *string    `json:"provider_message_id" db:"provider_message_id"`
		CreditsCharged  float64    `json:"credits_charged" db:"credits_charged"`
		ErrorMessage    *string    `json:"error_message" db:"error_message"`
		Reference       *string    `json:"reference" db:"reference"`
		CreatedAt       time.Time  `json:"created_at" db:"created_at"`
		SentAt          *time.Time `json:"sent_at" db:"sent_at"`
		DeliveredAt     *time.Time `json:"delivered_at" db:"delivered_at"`
	}

	err := h.db.Get(&msg, `SELECT id, "to", "from", status, provider_message_id, credits_charged, error_message, reference, created_at, sent_at, delivered_at FROM api_messages WHERE id = $1 AND account_id = $2 AND channel = 'sms'`, id, accountID)
	if err != nil {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    msg,
	})
}

// ListMessages returns paginated API messages.
func (h *PublicSMSHandler) ListMessages(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage

	var total int
	h.db.Get(&total, "SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'sms'", accountID)

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
		FROM api_messages WHERE account_id = $1 AND channel = 'sms'
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

// GetBalance returns the SMS credit balance.
func (h *PublicSMSHandler) GetBalance(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	balance := GetCreditBalance(h.db, keyInfo.AccountID, "sms")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":          "sms",
			"balance":          balance,
			"credit_per_sms":   1,
		},
	})
}

// GetStatus checks if SMS is configured and working.
func (h *PublicSMSHandler) GetStatus(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	err := CheckSMSConfigured(h.db, keyInfo.AccountID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":    "sms",
			"configured": err == nil,
			"provider":   "aakash_sms",
		},
	})
}

func (h *PublicSMSHandler) handleTestMode(c echo.Context, accountID, keyID int, to, message string, reference *string) error {
	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", content_preview, status, credits_charged, reference)
		VALUES ($1, $2, 'sms', $3, $4, 'test', 0, $5) RETURNING id
	`, accountID, keyID, to, truncate(message, 200), reference).Scan(&msgID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("sms_msg_%d", msgID),
			"to":                to,
			"status":            "test",
			"credits_used":      0,
			"credits_remaining": GetCreditBalance(h.db, accountID, "sms"),
			"test_mode":         true,
		},
	})
}

// apiError returns a standardized API error response.
func apiError(c echo.Context, status int, code, message, field string) error {
	errObj := map[string]interface{}{
		"code":    code,
		"message": message,
	}
	if field != "" {
		errObj["field"] = field
	}
	return c.JSON(status, map[string]interface{}{
		"success": false,
		"error":   errObj,
	})
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
