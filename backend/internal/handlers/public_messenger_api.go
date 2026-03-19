package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
)

// PublicMessengerHandler handles the public Messenger API endpoints.
type PublicMessengerHandler struct {
	db *sqlx.DB
}

func NewPublicMessengerHandler(db *sqlx.DB) *PublicMessengerHandler {
	return &PublicMessengerHandler{db: db}
}

// messengerSettings holds the Messenger configuration for an account.
type messengerAPISettings struct {
	PageAccessToken string `db:"page_access_token"`
	PageID          string `db:"page_id"`
}

func getMessengerSettings(db *sqlx.DB, accountID int) (*messengerAPISettings, error) {
	var s messengerAPISettings
	err := db.Get(&s, "SELECT page_access_token, page_id FROM messenger_settings WHERE account_id = $1", accountID)
	if err != nil {
		return nil, fmt.Errorf("Messenger is not configured for this account")
	}
	if s.PageAccessToken == "" {
		return nil, fmt.Errorf("Messenger page access token is not set")
	}
	return &s, nil
}

// Send sends a single message via Facebook Messenger Graph API.
func (h *PublicMessengerHandler) Send(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	var req struct {
		To        string  `json:"to"`
		Message   string  `json:"message"`
		Reference *string `json:"reference"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if req.To == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Recipient PSID is required", "to")
	}

	if req.Message == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message text is required", "message")
	}

	if len(req.Message) > 2000 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message too long. Maximum 2000 characters", "message")
	}

	accountID := keyInfo.AccountID

	settings, err := getMessengerSettings(h.db, accountID)
	if err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	// Test mode
	if keyInfo.IsTest {
		return h.handleTestMode(c, accountID, keyInfo.KeyID, req.To, req.Message, req.Reference)
	}

	// Reserve 1 credit
	creditCost := 1.0
	_, err = ReserveCredit(h.db, accountID, "messenger", creditCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "messenger")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Not enough credits. Available: %.0f, Required: %.0f", balance, creditCost), "")
	}

	// Send via Facebook Graph API
	fbPayload := map[string]interface{}{
		"recipient": map[string]string{"id": req.To},
		"message":   map[string]string{"text": req.Message},
	}
	payloadBytes, _ := json.Marshal(fbPayload)

	fbURL := fmt.Sprintf("https://graph.facebook.com/v19.0/me/messages?access_token=%s", settings.PageAccessToken)
	resp, err := http.Post(fbURL, "application/json", bytes.NewReader(payloadBytes))
	if err != nil {
		RefundCredit(h.db, accountID, "messenger", creditCost)
		return apiError(c, http.StatusBadGateway, "DELIVERY_FAILED", "Failed to connect to Facebook API", "")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		RefundCredit(h.db, accountID, "messenger", creditCost)
		return apiError(c, http.StatusBadGateway, "DELIVERY_FAILED",
			fmt.Sprintf("Facebook API error: %s", string(body)), "")
	}

	// Parse message ID from FB response
	var fbResp struct {
		MessageID   string `json:"message_id"`
		RecipientID string `json:"recipient_id"`
	}
	json.Unmarshal(body, &fbResp)

	// Log the message
	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, recipient, content, status, external_id, created_at)
		VALUES ($1, $2, 'messenger', $3, $4, 'sent', $5, NOW())
		RETURNING id
	`, accountID, keyInfo.KeyID, req.To, req.Message, fbResp.MessageID).Scan(&msgID)

	// Confirm credit usage
	ConfirmCredit(h.db, accountID, "messenger", creditCost, msgID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id":  msgID,
			"external_id": fbResp.MessageID,
			"recipient":   req.To,
			"status":      "sent",
			"credits_used": creditCost,
		},
	})
}

// SendBulk sends messages to multiple Messenger recipients.
func (h *PublicMessengerHandler) SendBulk(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	var req struct {
		Recipients []string `json:"recipients"`
		Message    string   `json:"message"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if len(req.Recipients) == 0 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "At least one recipient PSID is required", "recipients")
	}

	if len(req.Recipients) > 100 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Maximum 100 recipients per request", "recipients")
	}

	if req.Message == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message text is required", "message")
	}

	accountID := keyInfo.AccountID

	settings, err := getMessengerSettings(h.db, accountID)
	if err != nil {
		return apiError(c, http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", err.Error(), "")
	}

	if keyInfo.IsTest {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"total":     len(req.Recipients),
				"sent":      len(req.Recipients),
				"failed":    0,
				"test_mode": true,
			},
		})
	}

	totalCost := float64(len(req.Recipients))
	_, err = ReserveCredit(h.db, accountID, "messenger", totalCost)
	if err != nil {
		balance := GetCreditBalance(h.db, accountID, "messenger")
		return apiError(c, http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
			fmt.Sprintf("Not enough credits. Available: %.0f, Required: %.0f", balance, totalCost), "")
	}

	sent := 0
	failed := 0
	results := make([]map[string]interface{}, 0, len(req.Recipients))

	for _, psid := range req.Recipients {
		fbPayload := map[string]interface{}{
			"recipient": map[string]string{"id": psid},
			"message":   map[string]string{"text": req.Message},
		}
		payloadBytes, _ := json.Marshal(fbPayload)

		fbURL := fmt.Sprintf("https://graph.facebook.com/v19.0/me/messages?access_token=%s", settings.PageAccessToken)
		resp, err := http.Post(fbURL, "application/json", bytes.NewReader(payloadBytes))
		if err != nil {
			failed++
			results = append(results, map[string]interface{}{"psid": psid, "status": "failed", "error": err.Error()})
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != 200 {
			failed++
			results = append(results, map[string]interface{}{"psid": psid, "status": "failed", "error": string(body)})
			continue
		}

		sent++
		results = append(results, map[string]interface{}{"psid": psid, "status": "sent"})
	}

	// Adjust credits
	actualCost := float64(sent)
	if failed > 0 {
		RefundCredit(h.db, accountID, "messenger", float64(failed))
	}
	if sent > 0 {
		ConfirmCredit(h.db, accountID, "messenger", actualCost, 0)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"total":        len(req.Recipients),
			"sent":         sent,
			"failed":       failed,
			"credits_used": actualCost,
			"results":      results,
		},
	})
}

// ListMessages returns recent API messages for the messenger channel.
func (h *PublicMessengerHandler) ListMessages(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var messages []struct {
		ID         int        `json:"id" db:"id"`
		Recipient  string     `json:"recipient" db:"recipient"`
		Content    string     `json:"content" db:"content"`
		Status     string     `json:"status" db:"status"`
		ExternalID *string    `json:"external_id" db:"external_id"`
		CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	}

	h.db.Select(&messages, `
		SELECT id, recipient, content, status, external_id, created_at
		FROM api_messages
		WHERE account_id = $1 AND channel = 'messenger'
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, keyInfo.AccountID, perPage, offset)

	if messages == nil {
		messages = make([]struct {
			ID         int        `json:"id" db:"id"`
			Recipient  string     `json:"recipient" db:"recipient"`
			Content    string     `json:"content" db:"content"`
			Status     string     `json:"status" db:"status"`
			ExternalID *string    `json:"external_id" db:"external_id"`
			CreatedAt  time.Time  `json:"created_at" db:"created_at"`
		}, 0)
	}

	var total int
	h.db.Get(&total, "SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'messenger'", keyInfo.AccountID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    messages,
		"meta": map[string]interface{}{
			"page":     page,
			"per_page": perPage,
			"total":    total,
		},
	})
}

// GetMessage returns a single API message by ID.
func (h *PublicMessengerHandler) GetMessage(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	msgID, _ := strconv.Atoi(c.Param("id"))

	var msg struct {
		ID         int        `json:"id" db:"id"`
		Recipient  string     `json:"recipient" db:"recipient"`
		Content    string     `json:"content" db:"content"`
		Status     string     `json:"status" db:"status"`
		ExternalID *string    `json:"external_id" db:"external_id"`
		CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	}

	err := h.db.Get(&msg, `
		SELECT id, recipient, content, status, external_id, created_at
		FROM api_messages
		WHERE id = $1 AND account_id = $2 AND channel = 'messenger'
	`, msgID, keyInfo.AccountID)

	if err != nil {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    msg,
	})
}

// GetBalance returns the messenger credit balance.
func (h *PublicMessengerHandler) GetBalance(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	balance := GetCreditBalance(h.db, keyInfo.AccountID, "messenger")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel": "messenger",
			"balance": balance,
		},
	})
}

// GetStatus returns the Messenger configuration status.
func (h *PublicMessengerHandler) GetStatus(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return apiError(c, http.StatusUnauthorized, "AUTH_ERROR", "Invalid API key", "")
	}

	settings, err := getMessengerSettings(h.db, keyInfo.AccountID)
	configured := err == nil && settings.PageAccessToken != ""

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"channel":    "messenger",
			"configured": configured,
			"page_id":    func() string { if settings != nil { return settings.PageID }; return "" }(),
		},
	})
}

// handleTestMode logs the message without actually sending it.
func (h *PublicMessengerHandler) handleTestMode(c echo.Context, accountID, keyID int, to, message string, ref *string) error {
	var msgID int
	h.db.QueryRow(`
		INSERT INTO api_messages (account_id, api_key_id, channel, recipient, content, status, created_at)
		VALUES ($1, $2, 'messenger', $3, $4, 'test', NOW())
		RETURNING id
	`, accountID, keyID, to, message).Scan(&msgID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message_id": msgID,
			"recipient":  to,
			"status":     "test",
			"test_mode":  true,
		},
	})
}
