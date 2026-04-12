package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type AccountSettingsHandler struct {
	db *sqlx.DB
	lm *listmonk.Client
}

func NewAccountSettingsHandler(db *sqlx.DB, lm *listmonk.Client) *AccountSettingsHandler {
	return &AccountSettingsHandler{db: db, lm: lm}
}

var validSettingsKeys = map[string]bool{
	"company_profile":  true,
	"brand_defaults":   true,
	"domains":          true,
	"ecommerce":        true,
	"link_tracking":    true,
	"whatsapp_widget":  true,
}

// GetAll returns all account settings as a map keyed by setting key.
func (h *AccountSettingsHandler) GetAll(c echo.Context) error {
	var settings []models.AccountSetting
	err := h.db.Select(&settings, "SELECT * FROM app_account_settings ORDER BY key")
	if err != nil {
		return response.InternalError(c, "Failed to fetch account settings")
	}

	result := make(map[string]json.RawMessage)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	return response.Success(c, result)
}

// GetByKey returns a single settings section by key.
func (h *AccountSettingsHandler) GetByKey(c echo.Context) error {
	key := c.Param("key")
	if !validSettingsKeys[key] {
		return response.BadRequest(c, "Invalid settings key")
	}

	var setting models.AccountSetting
	err := h.db.Get(&setting, "SELECT * FROM app_account_settings WHERE key = $1", key)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Setting not found")
		}
		return response.InternalError(c, "Failed to fetch setting")
	}

	return response.Success(c, setting)
}

// UpdateByKey updates a single settings section.
func (h *AccountSettingsHandler) UpdateByKey(c echo.Context) error {
	key := c.Param("key")
	if !validSettingsKeys[key] {
		return response.BadRequest(c, "Invalid settings key")
	}

	var req models.UpdateAccountSettingRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate that value is valid JSON
	if !json.Valid(req.Value) {
		return response.BadRequest(c, "Invalid JSON value")
	}

	var setting models.AccountSetting
	err := h.db.QueryRowx(
		`UPDATE app_account_settings SET value = $1, updated_at = NOW()
		 WHERE key = $2 RETURNING *`,
		req.Value, key,
	).StructScan(&setting)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Setting not found")
		}
		return response.InternalError(c, "Failed to update setting")
	}

	return response.Success(c, setting)
}

// GetWidgetSettings returns whatsapp_widget settings publicly (no auth required).
func (h *AccountSettingsHandler) GetWidgetSettings(c echo.Context) error {
	var setting models.AccountSetting
	err := h.db.Get(&setting, "SELECT * FROM app_account_settings WHERE key = 'whatsapp_widget'")
	if err != nil {
		if err == sql.ErrNoRows {
			return response.Success(c, map[string]interface{}{"enabled": false})
		}
		return response.InternalError(c, "Failed to fetch widget settings")
	}

	return response.Success(c, json.RawMessage(setting.Value))
}

// UploadLogo handles logo file upload, proxies to Listmonk media, and updates brand_defaults.logo_url.
func (h *AccountSettingsHandler) UploadLogo(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

	// Upload to Listmonk media
	data, statusCode, err := h.lm.PostMultipart("/media", "file", file.Filename, src, nil)
	if err != nil {
		return response.InternalError(c, "Failed to upload logo to media storage")
	}

	if statusCode >= 300 {
		return c.JSONBlob(statusCode, data)
	}

	// Parse the Listmonk response to get the media URL
	var mediaResp struct {
		Data struct {
			URL string `json:"url"`
			URI string `json:"uri"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &mediaResp); err != nil {
		// Still return the media response even if we can't parse it
		return c.JSONBlob(http.StatusCreated, data)
	}

	logoURL := mediaResp.Data.URL
	if logoURL == "" {
		logoURL = mediaResp.Data.URI
	}

	// Update brand_defaults.logo_url in the database
	if logoURL != "" {
		_, err = h.db.Exec(
			`UPDATE app_account_settings
			 SET value = jsonb_set(value, '{logo_url}', to_jsonb($1::text)), updated_at = NOW()
			 WHERE key = 'brand_defaults'`,
			logoURL,
		)
		// Best effort — don't fail the whole request
	}

	return response.Success(c, map[string]string{"url": logoURL})
}
