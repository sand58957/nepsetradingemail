package handlers

import (
	"fmt"

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

func (h *ListHandler) List(c echo.Context) error {
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
		return response.InternalError(c, "Failed to fetch lists from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Get(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/lists/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch list from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Create(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/lists", payload)
	if err != nil {
		return response.InternalError(c, "Failed to create list in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/lists/%s", id), payload)
	if err != nil {
		return response.InternalError(c, "Failed to update list in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *ListHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/lists/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete list from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
