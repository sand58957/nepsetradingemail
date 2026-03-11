package handlers

import (
	"fmt"
	"log"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type ListHandler struct {
	lm *listmonk.Client
}

func NewListHandler(lm *listmonk.Client) *ListHandler {
	return &ListHandler{lm: lm}
}

// validateListID validates that the path param is a numeric ID
func validateListID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid list ID")
	}
	return id, nil
}

func (h *ListHandler) List(c echo.Context) error {
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
	if v := c.QueryParam("query"); v != "" {
		params["query"] = v
	}
	if v := c.QueryParam("order_by"); v != "" {
		params["order_by"] = v
	}
	if v := c.QueryParam("order"); v != "" {
		params["order"] = v
	}
	if v := c.QueryParam("tag"); v != "" {
		params["tag"] = v
	}

	data, statusCode, err := h.lm.Get("/lists", params)
	if err != nil {
		log.Printf("[lists] Failed to fetch lists: %v", err)
		return response.InternalError(c, "Failed to fetch lists from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Get(c echo.Context) error {
	if !isAdmin(c) {
		return response.NotFound(c, "List not found")
	}

	id, err := validateListID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/lists/%s", id), nil)
	if err != nil {
		log.Printf("[lists] Failed to fetch list %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch list from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Create(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/lists", payload)
	if err != nil {
		log.Printf("[lists] Failed to create list: %v", err)
		return response.InternalError(c, "Failed to create list in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Update(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateListID(c)
	if err != nil {
		return err
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/lists/%s", id), payload)
	if err != nil {
		log.Printf("[lists] Failed to update list %s: %v", id, err)
		return response.InternalError(c, "Failed to update list in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Delete(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateListID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/lists/%s", id))
	if err != nil {
		log.Printf("[lists] Failed to delete list %s: %v", id, err)
		return response.InternalError(c, "Failed to delete list from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
