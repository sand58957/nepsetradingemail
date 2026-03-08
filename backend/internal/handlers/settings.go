package handlers

import (
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type SettingsHandler struct {
	lm *listmonk.Client
}

func NewSettingsHandler(lm *listmonk.Client) *SettingsHandler {
	return &SettingsHandler{lm: lm}
}

func (h *SettingsHandler) Get(c echo.Context) error {
	data, statusCode, err := h.lm.Get("/settings", nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch settings from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SettingsHandler) Update(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put("/settings", payload)
	if err != nil {
		return response.InternalError(c, "Failed to update settings in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SettingsHandler) TestSMTP(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/settings/smtp/test", payload)
	if err != nil {
		return response.InternalError(c, "Failed to test SMTP settings in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SettingsHandler) GetLogs(c echo.Context) error {
	data, statusCode, err := h.lm.Get("/logs", nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch logs from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
