package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// APIKeyHandler manages API keys for external API access.
type APIKeyHandler struct {
	db *sqlx.DB
}

func NewAPIKeyHandler(db *sqlx.DB) *APIKeyHandler {
	return &APIKeyHandler{db: db}
}

type APIKey struct {
	ID         int        `json:"id" db:"id"`
	AccountID  int        `json:"account_id" db:"account_id"`
	Channel    string     `json:"channel" db:"channel"`
	KeyPrefix  string     `json:"key_prefix" db:"key_prefix"`
	Name       string     `json:"name" db:"name"`
	IsTest     bool       `json:"is_test" db:"is_test"`
	IsActive   bool       `json:"is_active" db:"is_active"`
	RateLimit  int        `json:"rate_limit" db:"rate_limit"`
	WebhookURL *string    `json:"webhook_url" db:"webhook_url"`
	LastUsedAt *time.Time `json:"last_used_at" db:"last_used_at"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

// ListKeys returns all API keys for the current account.
func (h *APIKeyHandler) ListKeys(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	channel := c.QueryParam("channel")

	var keys []APIKey
	if channel != "" {
		h.db.Select(&keys, "SELECT id, account_id, channel, key_prefix, name, is_test, is_active, rate_limit, webhook_url, last_used_at, created_at FROM api_keys WHERE account_id = $1 AND channel = $2 ORDER BY created_at DESC", accountID, channel)
	} else {
		h.db.Select(&keys, "SELECT id, account_id, channel, key_prefix, name, is_test, is_active, rate_limit, webhook_url, last_used_at, created_at FROM api_keys WHERE account_id = $1 ORDER BY created_at DESC", accountID)
	}

	if keys == nil {
		keys = []APIKey{}
	}

	return response.Success(c, keys)
}

// CreateKey generates a new API key for a specific channel.
func (h *APIKeyHandler) CreateKey(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Channel    string  `json:"channel"`
		Name       string  `json:"name"`
		IsTest     bool    `json:"is_test"`
		RateLimit  int     `json:"rate_limit"`
		WebhookURL *string `json:"webhook_url"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Channel != "sms" && req.Channel != "whatsapp" && req.Channel != "email" && req.Channel != "telegram" && req.Channel != "messenger" {
		return response.BadRequest(c, "Channel must be one of: sms, whatsapp, email, telegram, messenger")
	}

	if req.Name == "" {
		req.Name = "Default"
	}

	if req.RateLimit <= 0 {
		req.RateLimit = 60
	}

	// Check key count limit (max 5 per channel)
	var count int
	h.db.Get(&count, "SELECT COUNT(*) FROM api_keys WHERE account_id = $1 AND channel = $2", accountID, req.Channel)
	if count >= 5 {
		return response.BadRequest(c, fmt.Sprintf("Maximum 5 API keys per channel. You have %d for %s.", count, req.Channel))
	}

	// Generate the key
	rawKey, prefix, hash := generateAPIKey(req.Channel, req.IsTest)

	// Generate webhook secret
	secretBytes := make([]byte, 32)
	rand.Read(secretBytes)
	webhookSecret := fmt.Sprintf("%x", secretBytes)

	var keyID int
	err := h.db.QueryRow(`
		INSERT INTO api_keys (account_id, channel, key_hash, key_prefix, name, is_test, is_active, rate_limit, webhook_url, webhook_secret)
		VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)
		RETURNING id
	`, accountID, req.Channel, hash, prefix, req.Name, req.IsTest, req.RateLimit, req.WebhookURL, webhookSecret).Scan(&keyID)

	if err != nil {
		return response.InternalError(c, "Failed to create API key")
	}

	// Ensure credit row exists for this channel
	h.db.Exec(`
		INSERT INTO api_credits (account_id, channel, balance, reserved)
		VALUES ($1, $2, 0, 0)
		ON CONFLICT (account_id, channel) DO NOTHING
	`, accountID, req.Channel)

	return response.Created(c, map[string]interface{}{
		"id":             keyID,
		"key":            rawKey, // shown ONCE, never again
		"prefix":         prefix,
		"channel":        req.Channel,
		"name":           req.Name,
		"is_test":        req.IsTest,
		"webhook_secret": webhookSecret,
		"message":        "Save this API key now. It will not be shown again.",
	})
}

// UpdateKey updates an API key's name, rate limit, or webhook URL.
func (h *APIKeyHandler) UpdateKey(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Name       *string `json:"name"`
		RateLimit  *int    `json:"rate_limit"`
		WebhookURL *string `json:"webhook_url"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	result, err := h.db.Exec(`
		UPDATE api_keys SET
			name = COALESCE($3, name),
			rate_limit = COALESCE($4, rate_limit),
			webhook_url = COALESCE($5, webhook_url)
		WHERE id = $1 AND account_id = $2
	`, id, accountID, req.Name, req.RateLimit, req.WebhookURL)

	if err != nil {
		return response.InternalError(c, "Failed to update API key")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "API key not found")
	}

	return response.SuccessWithMessage(c, "API key updated", nil)
}

// ToggleKey enables or disables an API key.
func (h *APIKeyHandler) ToggleKey(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec(`
		UPDATE api_keys SET is_active = NOT is_active
		WHERE id = $1 AND account_id = $2
	`, id, accountID)

	if err != nil {
		return response.InternalError(c, "Failed to toggle API key")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "API key not found")
	}

	return response.SuccessWithMessage(c, "API key toggled", nil)
}

// DeleteKey permanently deletes an API key.
func (h *APIKeyHandler) DeleteKey(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec("DELETE FROM api_keys WHERE id = $1 AND account_id = $2", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete API key")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "API key not found")
	}

	return response.SuccessWithMessage(c, "API key deleted", nil)
}

// generateAPIKey creates a new API key, returning (raw_key, prefix, sha256_hash).
func generateAPIKey(channel string, isTest bool) (string, string, string) {
	// Generate 32 random bytes
	randomBytes := make([]byte, 32)
	rand.Read(randomBytes)
	randomPart := base64.RawURLEncoding.EncodeToString(randomBytes)

	// Build key: nf_<channel>_<random> or nf_test_<channel>_<random>
	var rawKey string
	if isTest {
		rawKey = fmt.Sprintf("nf_test_%s_%s", channel, randomPart)
	} else {
		rawKey = fmt.Sprintf("nf_%s_%s", channel, randomPart)
	}

	// Prefix: first part + first 8 chars of random
	var prefix string
	if isTest {
		prefix = fmt.Sprintf("nf_test_%s_%s", channel, randomPart[:8])
	} else {
		prefix = fmt.Sprintf("nf_%s_%s", channel, randomPart[:8])
	}

	// SHA-256 hash for storage
	hash := sha256.Sum256([]byte(rawKey))
	hashStr := fmt.Sprintf("%x", hash)

	return rawKey, prefix, hashStr
}
