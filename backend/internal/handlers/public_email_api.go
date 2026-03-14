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
	"github.com/sandeep/nepsetradingemail/backend/internal/services/sendgrid"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PublicEmailHandler handles the public Email API endpoints.
type PublicEmailHandler struct {
	db            *sqlx.DB
	sendgridKey   string
}

func NewPublicEmailHandler(db *sqlx.DB, sendgridKey string) *PublicEmailHandler {
	return &PublicEmailHandler{db: db, sendgridKey: sendgridKey}
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Send sends a single email via the public API.
func (h *PublicEmailHandler) Send(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		To         string  `json:"to"`
		From       string  `json:"from"`
		FromName   string  `json:"from_name"`
		Subject    string  `json:"subject"`
		HTML       string  `json:"html"`
		Text       string  `json:"text"`
		ReplyTo    string  `json:"reply_to"`
		WebhookURL *string `json:"webhook_url"`
		Reference  *string `json:"reference"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if req.To == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Recipient email is required", "to")
	}

	if !emailRegex.MatchString(req.To) {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid recipient email address", "to")
	}

	if req.From == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Sender email is required", "from")
	}

	if !emailRegex.MatchString(req.From) {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid sender email address", "from")
	}

	if req.Subject == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Subject is required", "subject")
	}

	if req.HTML == "" && req.Text == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Either html or text content is required", "html")
	}

	accountID := keyInfo.AccountID

	// Check email is configured (verified sending domain)
	if err := CheckEmailConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Verify the from address domain belongs to this account
	if err := h.verifyFromDomain(accountID, req.From); err != nil {
		return apiError(c, http.StatusForbidden, "DOMAIN_NOT_VERIFIED", err.Error(), "from")
	}

	// Test mode
	if keyInfo.IsTest {
		return h.handleTestMode(c, accountID, keyInfo.KeyID, req.To, req.From, req.Subject, req.Reference)
	}

	// Reserve 1 credit
	creditCost := 1.0
	_, err := ReserveCredit(h.db, accountID, "email", creditCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "email")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Email credit balance too low. Need %.0f, have %.0f", creditCost, balance), "")
	}

	// Create message record
	webhookURL := keyInfo.WebhookURL
	if req.WebhookURL != nil {
		webhookURL = *req.WebhookURL
	}

	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", subject, content_preview, status, credits_charged, webhook_url, reference)
		VALUES ($1, $2, 'email', $3, $4, $5, $6, 'sending', $7, $8, $9) RETURNING id
	`, accountID, keyInfo.KeyID, req.To, req.From, req.Subject, truncate(req.Subject, 200), creditCost, webhookURL, req.Reference).Scan(&msgID)

	// Send via SendGrid
	client := sendgrid.NewClient(h.sendgridKey)
	result, sendErr := client.SendMail(sendgrid.MailRequest{
		To:       req.To,
		From:     req.From,
		FromName: req.FromName,
		Subject:  req.Subject,
		HTML:     req.HTML,
		Text:     req.Text,
		ReplyTo:  req.ReplyTo,
	})

	if sendErr != nil {
		RefundCredit(h.db, accountID, "email", creditCost)
		h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
		return apiError(c, http.StatusBadGateway, "PROVIDER_ERROR", fmt.Sprintf("Email send failed: %v", sendErr), "")
	}

	// Update message with provider ID
	providerMsgID := ""
	if result != nil {
		providerMsgID = result.MessageID
	}
	now := time.Now()
	h.db.Exec(`UPDATE api_messages SET status = 'sent', provider_message_id = $2, sent_at = $3, updated_at = $3 WHERE id = $1`, msgID, providerMsgID, now)

	// Confirm credit deduction
	ConfirmCredit(h.db, accountID, "email", creditCost, msgID)

	remaining := GetCreditBalance(h.db, accountID, "email")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("email_msg_%d", msgID),
			"to":                req.To,
			"from":              req.From,
			"subject":           req.Subject,
			"status":            "sent",
			"credits_used":      creditCost,
			"credits_remaining": remaining,
		},
	})
}

// SendBulk sends emails to multiple recipients.
func (h *PublicEmailHandler) SendBulk(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		Recipients []struct {
			To      string `json:"to"`
			Subject string `json:"subject"`
			HTML    string `json:"html"`
			Text    string `json:"text"`
		} `json:"recipients"`
		From     string `json:"from"`
		FromName string `json:"from_name"`
		Subject  string `json:"subject"` // shared subject
		HTML     string `json:"html"`    // shared HTML
		Text     string `json:"text"`    // shared text
		ReplyTo  string `json:"reply_to"`
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

	if req.From == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Sender email is required", "from")
	}

	accountID := keyInfo.AccountID

	if err := CheckEmailConfigured(h.db, accountID); err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	if err := h.verifyFromDomain(accountID, req.From); err != nil {
		return apiError(c, http.StatusForbidden, "DOMAIN_NOT_VERIFIED", err.Error(), "from")
	}

	// Validate all recipients
	for i, r := range req.Recipients {
		if !emailRegex.MatchString(r.To) {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("Invalid email at index %d: %s", i, r.To), "recipients")
		}
		subject := r.Subject
		if subject == "" {
			subject = req.Subject
		}
		if subject == "" {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("No subject for recipient at index %d", i), "recipients")
		}
	}

	totalCost := float64(len(req.Recipients))

	if keyInfo.IsTest {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"batch_id":          "email_test_batch",
				"total":             len(req.Recipients),
				"queued":            len(req.Recipients),
				"credits_used":      totalCost,
				"credits_remaining": 0,
				"test_mode":         true,
			},
		})
	}

	// Reserve credits
	_, err := ReserveCredit(h.db, accountID, "email", totalCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "email")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Need %.0f email credits, have %.0f", totalCost, balance), "")
	}

	client := sendgrid.NewClient(h.sendgridKey)

	sent := 0
	failed := 0

	for _, r := range req.Recipients {
		subject := r.Subject
		if subject == "" {
			subject = req.Subject
		}
		html := r.HTML
		if html == "" {
			html = req.HTML
		}
		text := r.Text
		if text == "" {
			text = req.Text
		}

		var msgID int
		h.db.QueryRow(`
			INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", subject, content_preview, status, credits_charged)
			VALUES ($1, $2, 'email', $3, $4, $5, $6, 'sending', 1) RETURNING id
		`, accountID, keyInfo.KeyID, r.To, req.From, subject, truncate(subject, 200)).Scan(&msgID)

		_, sendErr := client.SendMail(sendgrid.MailRequest{
			To:       r.To,
			From:     req.From,
			FromName: req.FromName,
			Subject:  subject,
			HTML:     html,
			Text:     text,
			ReplyTo:  req.ReplyTo,
		})

		if sendErr != nil {
			h.db.Exec(`UPDATE api_messages SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`, msgID, sendErr.Error())
			RefundCredit(h.db, accountID, "email", 1)
			failed++
		} else {
			h.db.Exec(`UPDATE api_messages SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, msgID)
			ConfirmCredit(h.db, accountID, "email", 1, msgID)
			sent++
		}
	}

	remaining := GetCreditBalance(h.db, accountID, "email")

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

// GetMessage returns the status of a specific Email API message.
func (h *PublicEmailHandler) GetMessage(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	id, _ := strconv.Atoi(c.Param("id"))

	var msg struct {
		ID             int        `json:"id" db:"id"`
		To             string     `json:"to" db:"to"`
		From           *string    `json:"from" db:"from"`
		Subject        *string    `json:"subject" db:"subject"`
		Status         string     `json:"status" db:"status"`
		ProviderMsgID  *string    `json:"provider_message_id" db:"provider_message_id"`
		CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
		ErrorMessage   *string    `json:"error_message" db:"error_message"`
		Reference      *string    `json:"reference" db:"reference"`
		CreatedAt      time.Time  `json:"created_at" db:"created_at"`
		SentAt         *time.Time `json:"sent_at" db:"sent_at"`
		DeliveredAt    *time.Time `json:"delivered_at" db:"delivered_at"`
	}

	err := h.db.Get(&msg, `SELECT id, "to", "from", subject, status, provider_message_id, credits_charged, error_message, reference, created_at, sent_at, delivered_at FROM api_messages WHERE id = $1 AND account_id = $2 AND channel = 'email'`, id, accountID)
	if err != nil {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    msg,
	})
}

// ListMessages returns paginated Email API messages.
func (h *PublicEmailHandler) ListMessages(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage

	var total int
	h.db.Get(&total, "SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'email'", accountID)

	var messages []struct {
		ID             int        `json:"id" db:"id"`
		To             string     `json:"to" db:"to"`
		Subject        *string    `json:"subject" db:"subject"`
		Status         string     `json:"status" db:"status"`
		CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
		Reference      *string    `json:"reference" db:"reference"`
		CreatedAt      time.Time  `json:"created_at" db:"created_at"`
		SentAt         *time.Time `json:"sent_at" db:"sent_at"`
	}

	h.db.Select(&messages, `
		SELECT id, "to", subject, status, credits_charged, reference, created_at, sent_at
		FROM api_messages WHERE account_id = $1 AND channel = 'email'
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`, accountID, perPage, offset)

	if messages == nil {
		messages = make([]struct {
			ID             int        `json:"id" db:"id"`
			To             string     `json:"to" db:"to"`
			Subject        *string    `json:"subject" db:"subject"`
			Status         string     `json:"status" db:"status"`
			CreditsCharged float64    `json:"credits_charged" db:"credits_charged"`
			Reference      *string    `json:"reference" db:"reference"`
			CreatedAt      time.Time  `json:"created_at" db:"created_at"`
			SentAt         *time.Time `json:"sent_at" db:"sent_at"`
		}, 0)
	}

	return response.Paginated(c, messages, total, page, perPage)
}

// GetBalance returns the Email credit balance.
func (h *PublicEmailHandler) GetBalance(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	balance := GetCreditBalance(h.db, keyInfo.AccountID, "email")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":          "email",
			"balance":          balance,
			"credit_per_email": 1,
		},
	})
}

// GetStatus checks if Email is configured and working.
func (h *PublicEmailHandler) GetStatus(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	err := CheckEmailConfigured(h.db, keyInfo.AccountID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":    "email",
			"configured": err == nil,
			"provider":   "sendgrid",
		},
	})
}

// ListDomains returns verified sending domains for the account.
func (h *PublicEmailHandler) ListDomains(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	accountID := keyInfo.AccountID

	var domains []struct {
		ID     int    `json:"id" db:"id"`
		Domain string `json:"domain" db:"domain"`
		Status string `json:"status" db:"status"`
		From   string `json:"from_email" db:"from_email"`
	}

	h.db.Select(&domains, `
		SELECT id, domain, status, COALESCE(from_email, '') as from_email
		FROM app_domains WHERE account_id = $1 AND type = 'sending'
		ORDER BY domain
	`, accountID)

	if domains == nil {
		domains = make([]struct {
			ID     int    `json:"id" db:"id"`
			Domain string `json:"domain" db:"domain"`
			Status string `json:"status" db:"status"`
			From   string `json:"from_email" db:"from_email"`
		}, 0)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    domains,
	})
}

func (h *PublicEmailHandler) handleTestMode(c echo.Context, accountID, keyID int, to, from, subject string, reference *string) error {
	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, "to", "from", subject, content_preview, status, credits_charged, reference)
		VALUES ($1, $2, 'email', $3, $4, $5, $6, 'test', 0, $7) RETURNING id
	`, accountID, keyID, to, from, subject, truncate(subject, 200), reference).Scan(&msgID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":        fmt.Sprintf("email_msg_%d", msgID),
			"to":                to,
			"from":              from,
			"subject":           subject,
			"status":            "test",
			"credits_used":      0,
			"credits_remaining": GetCreditBalance(h.db, accountID, "email"),
			"test_mode":         true,
		},
	})
}

// verifyFromDomain checks that the sender email's domain is verified for this account.
func (h *PublicEmailHandler) verifyFromDomain(accountID int, fromEmail string) error {
	// Extract domain from email
	parts := splitEmailDomain(fromEmail)
	if parts == "" {
		return fmt.Errorf("Invalid sender email address")
	}

	var count int
	h.db.Get(&count, `
		SELECT COUNT(*) FROM app_domains
		WHERE account_id = $1 AND domain = $2 AND type = 'sending' AND status = 'verified'
	`, accountID, parts)

	if count == 0 {
		return fmt.Errorf("Domain '%s' is not verified for your account. Verify it in your dashboard first.", parts)
	}

	return nil
}

// splitEmailDomain extracts the domain from an email address.
func splitEmailDomain(email string) string {
	for i := len(email) - 1; i >= 0; i-- {
		if email[i] == '@' {
			return email[i+1:]
		}
	}
	return ""
}
