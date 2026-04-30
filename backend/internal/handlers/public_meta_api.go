package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PublicMetaHandler exposes cross-channel public endpoints (/me, /health)
// authenticated with any API key, regardless of channel.
type PublicMetaHandler struct {
	db *sqlx.DB
}

func NewPublicMetaHandler(db *sqlx.DB) *PublicMetaHandler {
	return &PublicMetaHandler{db: db}
}

// Health returns service status without requiring auth.
func (h *PublicMetaHandler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"status":  "ok",
			"service": "nepse-trading-email-backend",
			"version": "v1",
		},
	})
}

// Me returns the authenticated API key's identity and account info.
// Lets clients verify their credentials without consuming credits.
func (h *PublicMetaHandler) Me(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var account struct {
		ID         int    `db:"id"`
		Name       string `db:"name"`
		APIEnabled bool   `db:"api_enabled"`
	}
	if err := h.db.Get(&account, "SELECT id, name, api_enabled FROM app_accounts WHERE id = $1", keyInfo.AccountID); err != nil {
		return response.InternalError(c, "Failed to load account")
	}

	var key struct {
		ID        int    `db:"id"`
		Name      string `db:"name"`
		KeyPrefix string `db:"key_prefix"`
	}
	h.db.Get(&key, "SELECT id, name, key_prefix FROM api_keys WHERE id = $1", keyInfo.KeyID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"account": map[string]interface{}{
				"id":          account.ID,
				"name":        account.Name,
				"api_enabled": account.APIEnabled,
			},
			"api_key": map[string]interface{}{
				"id":         key.ID,
				"name":       key.Name,
				"prefix":     key.KeyPrefix,
				"channel":    keyInfo.Channel,
				"is_test":    keyInfo.IsTest,
				"rate_limit": keyInfo.RateLimit,
			},
		},
	})
}
