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

// ============================================================
// Campaign Archive (Public — no auth required)
// ============================================================

// ListArchive returns a list of finished campaigns for public viewing
func (h *CampaignHandler) ListArchive(c echo.Context) error {
	params := map[string]string{
		"status":   "finished",
		"order_by": "created_at",
		"order":    "DESC",
	}
	if v := c.QueryParam("page"); v != "" {
		params["page"] = v
	}
	if v := c.QueryParam("per_page"); v != "" {
		params["per_page"] = v
	}

	data, statusCode, err := h.lm.Get("/campaigns", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign archive")
	}

	if statusCode >= 400 {
		return c.JSONBlob(statusCode, data)
	}

	// Parse and strip sensitive data — only return public-safe fields
	var result struct {
		Data struct {
			Results []json.RawMessage `json:"results"`
			Total   int               `json:"total"`
			Page    int               `json:"page"`
			PerPage int               `json:"per_page"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return c.JSONBlob(statusCode, data)
	}

	return response.Success(c, map[string]interface{}{
		"results":  result.Data.Results,
		"total":    result.Data.Total,
		"page":     result.Data.Page,
		"per_page": result.Data.PerPage,
	})
}

// GetArchive returns a single finished campaign's rendered HTML for public viewing
func (h *CampaignHandler) GetArchive(c echo.Context) error {
	id := c.Param("id")

	// Get campaign details to verify it's finished
	campaignData, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign")
	}

	if statusCode >= 400 {
		return c.JSONBlob(statusCode, campaignData)
	}

	// Verify campaign is finished (public access only for finished campaigns)
	var campaign struct {
		Data struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(campaignData, &campaign); err != nil {
		return response.InternalError(c, "Failed to parse campaign data")
	}

	if campaign.Data.Status != "finished" {
		return response.NotFound(c, "Campaign not found in archive")
	}

	// Get the campaign preview (rendered HTML)
	previewData, previewStatus, err := h.lm.Get(fmt.Sprintf("/campaigns/%s/preview", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign preview")
	}

	if previewStatus >= 200 && previewStatus < 300 {
		var previewResult struct {
			Data struct {
				Body string `json:"body"`
			} `json:"data"`
		}
		if err := json.Unmarshal(previewData, &previewResult); err == nil && previewResult.Data.Body != "" {
			return response.Success(c, map[string]interface{}{
				"html":     previewResult.Data.Body,
				"campaign": json.RawMessage(campaignData),
			})
		}
	}

	return c.JSONBlob(previewStatus, previewData)
}
