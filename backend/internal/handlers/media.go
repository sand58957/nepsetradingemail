package handlers

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type MediaHandler struct {
	lm *listmonk.Client
}

func NewMediaHandler(lm *listmonk.Client) *MediaHandler {
	return &MediaHandler{lm: lm}
}

func (h *MediaHandler) List(c echo.Context) error {
	params := map[string]string{}
	if v := c.QueryParam("page"); v != "" {
		params["page"] = v
	}
	if v := c.QueryParam("per_page"); v != "" {
		params["per_page"] = v
	}

	data, statusCode, err := h.lm.Get("/media", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Get(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/media/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Upload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

	data, statusCode, err := h.lm.PostMultipart("/media", "file", file.Filename, src, nil)
	if err != nil {
		return response.InternalError(c, "Failed to upload media to Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		return c.JSONBlob(http.StatusCreated, data)
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/media/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
