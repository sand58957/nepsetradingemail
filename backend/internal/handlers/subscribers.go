package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type SubscriberHandler struct {
	lm *listmonk.Client
}

func NewSubscriberHandler(lm *listmonk.Client) *SubscriberHandler {
	return &SubscriberHandler{lm: lm}
}

func (h *SubscriberHandler) List(c echo.Context) error {
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
	if v := c.QueryParam("list_id"); v != "" {
		params["list_id"] = v
	}

	data, statusCode, err := h.lm.Get("/subscribers", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch subscribers from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Get(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/subscribers/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch subscriber from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Create(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/subscribers", payload)
	if err != nil {
		return response.InternalError(c, "Failed to create subscriber in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/subscribers/%s", id), payload)
	if err != nil {
		return response.InternalError(c, "Failed to update subscriber in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/subscribers/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete subscriber from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) DeleteBulk(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Delete("/subscribers")
	if err != nil {
		return response.InternalError(c, "Failed to delete subscribers from Listmonk")
	}

	if statusCode >= 400 {
		// Try PUT method for bulk delete as some Listmonk versions use it
		data, statusCode, err = h.lm.Put("/subscribers/query/delete", payload)
		if err != nil {
			return response.InternalError(c, "Failed to delete subscribers from Listmonk")
		}
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Blocklist(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put("/subscribers/blocklist", payload)
	if err != nil {
		return response.InternalError(c, "Failed to blocklist subscribers in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) ManageLists(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put("/subscribers/lists", payload)
	if err != nil {
		return response.InternalError(c, "Failed to manage subscriber lists in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Export(c echo.Context) error {
	params := map[string]string{}
	if v := c.QueryParam("list_id"); v != "" {
		params["list_id"] = v
	}

	data, statusCode, err := h.lm.Get("/subscribers/export", params)
	if err != nil {
		return response.InternalError(c, "Failed to export subscribers from Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		c.Response().Header().Set("Content-Type", "text/csv")
		c.Response().Header().Set("Content-Disposition", "attachment; filename=subscribers.csv")
		return c.Blob(http.StatusOK, "text/csv", data)
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Import(c echo.Context) error {
	var payload json.RawMessage
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/import/subscribers", payload)
	if err != nil {
		return response.InternalError(c, "Failed to import subscribers in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
