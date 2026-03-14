package middleware

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// APIKeyInfo holds the validated API key details set in context.
type APIKeyInfo struct {
	KeyID      int
	AccountID  int
	Channel    string
	IsTest     bool
	RateLimit  int
	WebhookURL string
}

// APIKeyAuth validates API keys from the Authorization header and sets account context.
// The channel parameter restricts which channel this middleware accepts (e.g., "sms", "whatsapp", "email").
func APIKeyAuth(db *sqlx.DB, channel string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return response.Error(c, http.StatusUnauthorized, "Missing Authorization header. Use: Bearer nf_<channel>_<key>")
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return response.Error(c, http.StatusUnauthorized, "Invalid authorization format. Use: Bearer <api_key>")
			}

			apiKey := parts[1]

			// Extract prefix for lookup (first segment up to 20 chars before the random part)
			prefix := extractPrefix(apiKey)
			if prefix == "" {
				return response.Error(c, http.StatusUnauthorized, "Invalid API key format")
			}

			// Look up key by prefix
			var keyRecord struct {
				ID         int    `db:"id"`
				AccountID  int    `db:"account_id"`
				Channel    string `db:"channel"`
				KeyHash    string `db:"key_hash"`
				IsTest     bool   `db:"is_test"`
				IsActive   bool   `db:"is_active"`
				RateLimit  int    `db:"rate_limit"`
				WebhookURL *string `db:"webhook_url"`
			}

			err := db.Get(&keyRecord, `
				SELECT id, account_id, channel, key_hash, is_test, is_active, rate_limit, webhook_url
				FROM api_keys WHERE key_prefix = $1 AND is_active = true
			`, prefix)

			if err != nil {
				return response.Error(c, http.StatusUnauthorized, "Invalid or inactive API key")
			}

			// Verify hash
			hash := sha256.Sum256([]byte(apiKey))
			hashStr := fmt.Sprintf("%x", hash)
			if hashStr != keyRecord.KeyHash {
				return response.Error(c, http.StatusUnauthorized, "Invalid API key")
			}

			// Check channel matches
			if keyRecord.Channel != channel {
				return response.Error(c, http.StatusForbidden,
					fmt.Sprintf("This API key is for %s, not %s", keyRecord.Channel, channel))
			}

			// Check account has API enabled
			var apiEnabled bool
			db.Get(&apiEnabled, "SELECT api_enabled FROM app_accounts WHERE id = $1", keyRecord.AccountID)
			if !apiEnabled {
				return response.Error(c, http.StatusForbidden, "API access is not enabled for this account. Contact admin.")
			}

			// Update last_used_at (async, non-blocking)
			go func() {
				db.Exec("UPDATE api_keys SET last_used_at = $1 WHERE id = $2", time.Now(), keyRecord.ID)
			}()

			// Set context values (same keys as JWT middleware for compatibility)
			c.Set("account_id", keyRecord.AccountID)

			webhookURL := ""
			if keyRecord.WebhookURL != nil {
				webhookURL = *keyRecord.WebhookURL
			}

			c.Set("api_key_info", &APIKeyInfo{
				KeyID:      keyRecord.ID,
				AccountID:  keyRecord.AccountID,
				Channel:    keyRecord.Channel,
				IsTest:     keyRecord.IsTest,
				RateLimit:  keyRecord.RateLimit,
				WebhookURL: webhookURL,
			})

			return next(c)
		}
	}
}

// GetAPIKeyInfo retrieves the API key info from context.
func GetAPIKeyInfo(c echo.Context) *APIKeyInfo {
	info, ok := c.Get("api_key_info").(*APIKeyInfo)
	if !ok {
		return nil
	}
	return info
}

// extractPrefix extracts the key prefix for database lookup.
// Key format: nf_sms_<random>, nf_wa_<random>, nf_email_<random>
// Also: nf_test_sms_<random>, nf_test_wa_<random>, nf_test_email_<random>
func extractPrefix(key string) string {
	// Prefix is everything up to and including the channel identifier + first 8 chars of random part
	// e.g., "nf_sms_a8f3Kx9m" or "nf_test_sms_a8f3Kx9m"
	parts := strings.SplitN(key, "_", -1)
	if len(parts) < 3 {
		return ""
	}

	// Determine the random part index based on format
	// nf_sms_<random> → parts[0]="nf", parts[1]="sms", parts[2]=random...
	// nf_test_sms_<random> → parts[0]="nf", parts[1]="test", parts[2]="sms", parts[3]=random...
	var channelEnd int
	if parts[1] == "test" {
		if len(parts) < 4 {
			return ""
		}
		channelEnd = len(parts[0]) + 1 + len(parts[1]) + 1 + len(parts[2]) + 1 // "nf_test_sms_"
	} else {
		channelEnd = len(parts[0]) + 1 + len(parts[1]) + 1 // "nf_sms_"
	}

	if channelEnd >= len(key) {
		return ""
	}

	// Take prefix + first 8 chars of random part
	remaining := key[channelEnd:]
	suffixLen := 8
	if len(remaining) < suffixLen {
		suffixLen = len(remaining)
	}

	return key[:channelEnd+suffixLen]
}
