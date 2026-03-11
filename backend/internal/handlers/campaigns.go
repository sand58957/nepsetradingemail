package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

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

// validateCampaignID validates that the path param is a numeric ID
func validateCampaignID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid campaign ID")
	}
	return id, nil
}

func (h *CampaignHandler) List(c echo.Context) error {
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
	// Whitelist order_by to prevent SQL injection via downstream Listmonk
	allowedOrderBy := map[string]bool{
		"created_at": true, "updated_at": true, "name": true, "status": true,
	}
	if v := c.QueryParam("order_by"); v != "" && allowedOrderBy[v] {
		params["order_by"] = v
	}
	// Whitelist order direction
	if v := c.QueryParam("order"); v == "asc" || v == "desc" || v == "ASC" || v == "DESC" {
		params["order"] = v
	}
	// Whitelist campaign status
	allowedStatus := map[string]bool{
		"draft": true, "running": true, "scheduled": true, "paused": true, "cancelled": true, "finished": true,
	}
	if v := c.QueryParam("status"); v != "" && allowedStatus[v] {
		params["status"] = v
	}
	if v := c.QueryParam("tag"); v != "" {
		params["tag"] = v
	}

	data, statusCode, err := h.lm.Get("/campaigns", params)
	if err != nil {
		log.Printf("[campaigns] Failed to fetch campaigns: %v", err)
		return response.InternalError(c, "Failed to fetch campaigns from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Get(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		log.Printf("[campaigns] Failed to fetch campaign %s: %v", id, err)
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
		log.Printf("[campaigns] Failed to create campaign: %v", err)
		return response.InternalError(c, "Failed to create campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Update(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/campaigns/%s", id), payload)
	if err != nil {
		log.Printf("[campaigns] Failed to update campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to update campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Delete(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/campaigns/%s", id))
	if err != nil {
		log.Printf("[campaigns] Failed to delete campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to delete campaign from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) UpdateStatus(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	var payload struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate status value
	validStatuses := map[string]bool{"running": true, "paused": true, "cancelled": true, "scheduled": true}
	if !validStatuses[payload.Status] {
		return response.BadRequest(c, "Invalid status. Must be one of: running, paused, cancelled, scheduled")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/campaigns/%s/status", id), payload)
	if err != nil {
		log.Printf("[campaigns] Failed to update status for campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to update campaign status in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Test(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	// Decode body directly to avoid Echo's c.Bind() merging path params into the map
	var payload map[string]interface{}
	if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Listmonk v6 requires full campaign fields for the test endpoint.
	// Fetch the campaign details and merge them into the test payload.
	campaignData, campaignStatus, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil || campaignStatus >= 400 {
		log.Printf("[campaigns] Failed to fetch campaign %s for test: %v", id, err)
		return response.InternalError(c, "Failed to fetch campaign for test")
	}

	var campaignResult struct {
		Data struct {
			Name      string        `json:"name"`
			Subject   string        `json:"subject"`
			FromEmail string        `json:"from_email"`
			Messenger string        `json:"messenger"`
			Lists     []struct {
				ID int `json:"id"`
			} `json:"lists"`
		} `json:"data"`
	}
	if err := json.Unmarshal(campaignData, &campaignResult); err != nil {
		log.Printf("[campaigns] Failed to parse campaign %s for test: %v", id, err)
		return response.InternalError(c, "Failed to parse campaign for test")
	}

	// Build list IDs array
	listIDs := make([]int, len(campaignResult.Data.Lists))
	for i, l := range campaignResult.Data.Lists {
		listIDs[i] = l.ID
	}

	// Set required fields from campaign data if not already in payload
	if _, ok := payload["name"]; !ok {
		payload["name"] = campaignResult.Data.Name
	}
	if _, ok := payload["subject"]; !ok {
		payload["subject"] = campaignResult.Data.Subject
	}
	if _, ok := payload["from_email"]; !ok {
		payload["from_email"] = campaignResult.Data.FromEmail
	}
	if _, ok := payload["lists"]; !ok {
		payload["lists"] = listIDs
	}
	if _, ok := payload["messenger"]; !ok {
		messenger := campaignResult.Data.Messenger
		if messenger == "" {
			messenger = "email"
		}
		payload["messenger"] = messenger
	}

	data, statusCode, err := h.lm.Post(fmt.Sprintf("/campaigns/%s/test", id), payload)
	if err != nil {
		log.Printf("[campaigns] Failed to send test for campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to send test campaign in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) Preview(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s/preview", id), nil)
	if err != nil {
		log.Printf("[campaigns] Failed to preview campaign %s: %v", id, err)
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
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		log.Printf("[campaigns] Failed to fetch stats for campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch campaign stats from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *CampaignHandler) GetRunning(c echo.Context) error {
	// Non-admin users get a fresh/clean view
	if !isAdmin(c) {
		return emptyListmonkList(c)
	}

	// Fetch campaigns with status=running filter (Listmonk doesn't have a /running/stats endpoint)
	data, statusCode, err := h.lm.Get("/campaigns", map[string]string{"status": "running"})
	if err != nil {
		log.Printf("[campaigns] Failed to fetch running campaigns: %v", err)
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
		log.Printf("[campaigns] Failed to fetch campaign archive: %v", err)
		return response.InternalError(c, "Failed to fetch campaign archive")
	}

	if statusCode >= 400 {
		return response.InternalError(c, "Failed to fetch campaign archive")
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
		return response.InternalError(c, "Failed to parse campaign data")
	}

	// Sanitize each campaign — only expose public-safe fields
	sanitized := make([]map[string]interface{}, 0, len(result.Data.Results))
	for _, raw := range result.Data.Results {
		var campaign map[string]interface{}
		if err := json.Unmarshal(raw, &campaign); err != nil {
			continue
		}
		sanitized = append(sanitized, map[string]interface{}{
			"id":         campaign["id"],
			"name":       campaign["name"],
			"subject":    campaign["subject"],
			"status":     campaign["status"],
			"tags":       campaign["tags"],
			"created_at": campaign["created_at"],
			"started_at": campaign["started_at"],
			"sent":       campaign["sent"],
			"views":      campaign["views"],
			"clicks":     campaign["clicks"],
		})
	}

	return response.Success(c, map[string]interface{}{
		"results":  sanitized,
		"total":    result.Data.Total,
		"page":     result.Data.Page,
		"per_page": result.Data.PerPage,
	})
}

// GetArchive returns a single finished campaign's rendered HTML for public viewing
func (h *CampaignHandler) GetArchive(c echo.Context) error {
	id, err := validateCampaignID(c)
	if err != nil {
		return err
	}

	// Get campaign details to verify it's finished
	campaignData, statusCode, err := h.lm.Get(fmt.Sprintf("/campaigns/%s", id), nil)
	if err != nil {
		log.Printf("[campaigns] Failed to fetch archive campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch campaign")
	}

	if statusCode >= 400 {
		return response.NotFound(c, "Campaign not found")
	}

	// Parse campaign for status check and public-safe fields
	var campaignFull struct {
		Data struct {
			ID        interface{} `json:"id"`
			Name      string      `json:"name"`
			Subject   string      `json:"subject"`
			Status    string      `json:"status"`
			Tags      interface{} `json:"tags"`
			CreatedAt string      `json:"created_at"`
			StartedAt string      `json:"started_at"`
			Sent      int         `json:"sent"`
			Views     int         `json:"views"`
			Clicks    int         `json:"clicks"`
		} `json:"data"`
	}
	if err := json.Unmarshal(campaignData, &campaignFull); err != nil {
		return response.InternalError(c, "Failed to parse campaign data")
	}

	if campaignFull.Data.Status != "finished" {
		return response.NotFound(c, "Campaign not found in archive")
	}

	// Get the campaign preview (rendered HTML)
	previewData, previewStatus, err := h.lm.Get(fmt.Sprintf("/campaigns/%s/preview", id), nil)
	if err != nil {
		log.Printf("[campaigns] Failed to fetch preview for archive campaign %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch campaign preview")
	}

	if previewStatus >= 200 && previewStatus < 300 {
		var previewResult struct {
			Data struct {
				Body string `json:"body"`
			} `json:"data"`
		}
		if err := json.Unmarshal(previewData, &previewResult); err == nil && previewResult.Data.Body != "" {
			// Return only public-safe campaign metadata (no body, from_email, internal IDs, etc.)
			return response.Success(c, map[string]interface{}{
				"html": previewResult.Data.Body,
				"campaign": map[string]interface{}{
					"id":         campaignFull.Data.ID,
					"name":       campaignFull.Data.Name,
					"subject":    campaignFull.Data.Subject,
					"status":     campaignFull.Data.Status,
					"tags":       campaignFull.Data.Tags,
					"created_at": campaignFull.Data.CreatedAt,
					"started_at": campaignFull.Data.StartedAt,
					"sent":       campaignFull.Data.Sent,
					"views":      campaignFull.Data.Views,
					"clicks":     campaignFull.Data.Clicks,
				},
			})
		}
	}

	return response.InternalError(c, "Failed to render campaign preview")
}
