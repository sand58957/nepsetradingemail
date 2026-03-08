package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type CampaignHandler struct {
	lm *listmonk.Client
}

func NewCampaignHandler(lm *listmonk.Client) *CampaignHandler {
	return &CampaignHandler{lm: lm}
}

func (h *CampaignHandler) List(c echo.Context) error {
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
	if v := c.QueryParam("status"); v != "" {
		params["status"] = v
	}
	if v := c.QueryParam("tag"); v != "" {
		params["tag"] = v
	}

	data, statusCode, err := h.lm.Get("/campaigns", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaigns from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Get(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Create(c echo.Context) error {
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/campaigns", payload)
	if err != nil {
		return response.InternalError(c, "Failed to create campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/campaigns/%s", id), payload)
	if err != nil {
		return response.InternalError(c, "Failed to update campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/campaigns/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete campaign from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) UpdateStatus(c echo.Context) error {
	id := c.Param("id")
	var payload struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/campaigns/%s/status", id), payload)
	if err != nil {
		return response.InternalError(c, "Failed to update campaign status in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Test(c echo.Context) error {
	id := c.Param("id")
	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post(fmt.Sprintf("/campaigns/%s/test", id), payload)
	if err != nil {
		return response.InternalError(c, "Failed to send test campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Preview(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s/preview", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to preview campaign from Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		var previewData struct {
			Data struct {
				Body string `json:"body"`
			} `json:"data"`
		}
		if err := json.Unmarshal(data, &previewData); err == nil && previewData.Data.Body != "" {
			return c.HTML(statusCode, previewData.Data.Body)
		}
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) GetStats(c echo.Context) error {
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign stats from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) GetRunning(c echo.Context) error {
	data, statusCode, err := h.lm.Get("/campaigns/running/stats", nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch running campaigns from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
