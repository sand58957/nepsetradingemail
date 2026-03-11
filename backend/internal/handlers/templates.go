package handlers

import (
	"fmt"
	"log"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type TemplateHandler struct {
	lm *listmonk.Client
}

func NewTemplateHandler(lm *listmonk.Client) *TemplateHandler {
	return &TemplateHandler{lm: lm}
}

// validateTemplateID validates that the path param is a numeric ID
func validateTemplateID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid template ID")
	}
	return id, nil
}

func (h *TemplateHandler) List(c echo.Context) error {
	// Non-admin users get a fresh/clean view (no shared Listmonk data)
	if !isAdmin(c) {
		return emptyListmonkList(c)
	}

	params := map[string]string{}
	if v := c.QueryParam("page"); v != "" {
		params["page"] = v
	}
	if v := c.QueryParam("per_page"); v != "" {
		params["per_page"] = v
	}

	data, statusCode, err := h.lm.Get("/templates", params)
	if err != nil {
		log.Printf("[templates] Failed to fetch templates: %v", err)
		return response.InternalError(c, "Failed to fetch templates from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Get(c echo.Context) error {
	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/templates/%s", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to fetch template %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Create(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/templates", payload)
	if err != nil {
		log.Printf("[templates] Failed to create template: %v", err)
		return response.InternalError(c, "Failed to create template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Update(c echo.Context) error {
	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/templates/%s", id), payload)
	if err != nil {
		log.Printf("[templates] Failed to update template %s: %v", id, err)
		return response.InternalError(c, "Failed to update template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Delete(c echo.Context) error {
	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/templates/%s", id))
	if err != nil {
		log.Printf("[templates] Failed to delete template %s: %v", id, err)
		return response.InternalError(c, "Failed to delete template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Preview(c echo.Context) error {
	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/templates/%s/preview", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to preview template %s: %v", id, err)
		return response.InternalError(c, "Failed to preview template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) SetDefault(c echo.Context) error {
	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/templates/%s/default", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to set default template %s: %v", id, err)
		return response.InternalError(c, "Failed to set default template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
