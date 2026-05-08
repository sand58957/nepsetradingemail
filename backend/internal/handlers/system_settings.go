package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// SystemSettingsHandler manages superadmin-only platform secrets that live in
// app_account_settings under the sendgrid_config key.
type SystemSettingsHandler struct {
	db          *sqlx.DB
	envFallback string
}

func NewSystemSettingsHandler(db *sqlx.DB, envFallback string) *SystemSettingsHandler {
	return &SystemSettingsHandler{db: db, envFallback: envFallback}
}

type sendGridConfigPayload struct {
	APIKey    string `json:"api_key"`
	UpdatedBy string `json:"updated_by"`
	UpdatedAt string `json:"updated_at"`
}

// GetCurrentSendGridKey returns the active SendGrid key — DB value takes
// precedence, falling back to the env var when the DB value is empty. Used by
// every handler that talks to SendGrid so changes apply without a restart.
func GetCurrentSendGridKey(db *sqlx.DB, envFallback string) string {
	var raw json.RawMessage
	err := db.Get(&raw, "SELECT value FROM app_account_settings WHERE key = 'sendgrid_config'")
	if err == nil {
		var cfg sendGridConfigPayload
		if json.Unmarshal(raw, &cfg) == nil && strings.TrimSpace(cfg.APIKey) != "" {
			return cfg.APIKey
		}
	}
	return envFallback
}

func maskKey(k string) string {
	if k == "" {
		return ""
	}
	if len(k) <= 12 {
		return strings.Repeat("•", len(k))
	}
	return k[:7] + strings.Repeat("•", 8) + k[len(k)-4:]
}

// GetSendGrid returns a masked view of the current SendGrid API key plus
// metadata about which source supplied it.
func (h *SystemSettingsHandler) GetSendGrid(c echo.Context) error {
	var raw json.RawMessage
	var cfg sendGridConfigPayload
	err := h.db.Get(&raw, "SELECT value FROM app_account_settings WHERE key = 'sendgrid_config'")
	if err == nil {
		_ = json.Unmarshal(raw, &cfg)
	}

	source := "unset"
	active := ""
	if strings.TrimSpace(cfg.APIKey) != "" {
		source = "database"
		active = cfg.APIKey
	} else if h.envFallback != "" {
		source = "env"
		active = h.envFallback
	}

	return response.Success(c, map[string]interface{}{
		"masked_key": maskKey(active),
		"has_key":    active != "",
		"source":     source,
		"updated_by": cfg.UpdatedBy,
		"updated_at": cfg.UpdatedAt,
	})
}

// TestSendGrid verifies a candidate key against SendGrid's /v3/user/account
// endpoint without persisting anything.
func (h *SystemSettingsHandler) TestSendGrid(c echo.Context) error {
	var req struct {
		APIKey string `json:"api_key"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.APIKey) == "" {
		return response.BadRequest(c, "api_key is required")
	}

	ok, msg := verifySendGridKey(req.APIKey)
	return response.Success(c, map[string]interface{}{
		"valid":   ok,
		"message": msg,
	})
}

// UpdateSendGrid validates the new key against SendGrid before persisting.
func (h *SystemSettingsHandler) UpdateSendGrid(c echo.Context) error {
	var req struct {
		APIKey string `json:"api_key"`
		Skip   bool   `json:"skip_validation"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" {
		return response.BadRequest(c, "api_key cannot be empty")
	}

	if !req.Skip {
		ok, msg := verifySendGridKey(apiKey)
		if !ok {
			return response.BadRequest(c, fmt.Sprintf("Key validation failed: %s", msg))
		}
	}

	updatedBy := middleware.GetUserEmail(c)
	updatedAt := time.Now().UTC().Format(time.RFC3339)

	payload, _ := json.Marshal(sendGridConfigPayload{
		APIKey:    apiKey,
		UpdatedBy: updatedBy,
		UpdatedAt: updatedAt,
	})

	_, err := h.db.Exec(`
		INSERT INTO app_account_settings (key, value, updated_at)
		VALUES ('sendgrid_config', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(payload))
	if err != nil {
		return response.InternalError(c, "Failed to save SendGrid configuration")
	}

	return response.Success(c, map[string]interface{}{
		"masked_key": maskKey(apiKey),
		"source":     "database",
		"updated_by": updatedBy,
		"updated_at": updatedAt,
	})
}

// verifySendGridKey calls /v3/user/account with the candidate key.
func verifySendGridKey(apiKey string) (bool, string) {
	req, err := http.NewRequest("GET", "https://api.sendgrid.com/v3/user/account", nil)
	if err != nil {
		return false, err.Error()
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "could not reach SendGrid: " + err.Error()
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	switch resp.StatusCode {
	case http.StatusOK:
		return true, "Key is valid"
	case http.StatusUnauthorized, http.StatusForbidden:
		return false, "SendGrid rejected the key (unauthorized)"
	default:
		return false, fmt.Sprintf("SendGrid returned %d: %s", resp.StatusCode, string(body))
	}
}

