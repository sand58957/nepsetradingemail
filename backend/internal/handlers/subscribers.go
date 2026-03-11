package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type SubscriberHandler struct {
	lm *listmonk.Client
	db *sqlx.DB
}

func NewSubscriberHandler(lm *listmonk.Client, db ...*sqlx.DB) *SubscriberHandler {
	h := &SubscriberHandler{lm: lm}
	if len(db) > 0 {
		h.db = db[0]
	}
	return h
}

// sanitizeEmail escapes single quotes in email addresses for safe Listmonk query interpolation
func sanitizeEmail(email string) string {
	return strings.ReplaceAll(email, "'", "''")
}

// validateSubscriberID validates that the path param is a numeric ID
func validateSubscriberID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid subscriber ID")
	}
	return id, nil
}

func (h *SubscriberHandler) List(c echo.Context) error {
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
	if !isAdmin(c) {
		return response.NotFound(c, "Subscriber not found")
	}

	id, err := validateSubscriberID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/subscribers/%s", id), nil)
	if err != nil {
		log.Printf("[subscribers] Failed to fetch subscriber %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch subscriber from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Create(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

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
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateSubscriberID(c)
	if err != nil {
		return err
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/subscribers/%s", id), payload)
	if err != nil {
		log.Printf("[subscribers] Failed to update subscriber %s: %v", id, err)
		return response.InternalError(c, "Failed to update subscriber in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Delete(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateSubscriberID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/subscribers/%s", id))
	if err != nil {
		log.Printf("[subscribers] Failed to delete subscriber %s: %v", id, err)
		return response.InternalError(c, "Failed to delete subscriber from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *SubscriberHandler) Blocklist(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

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
	if !isAdmin(c) {
		return adminOnly(c)
	}

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
	// Non-admin users get an empty CSV
	if !isAdmin(c) {
		c.Response().Header().Set("Content-Type", "text/csv")
		c.Response().Header().Set("Content-Disposition", "attachment; filename=subscribers.csv")
		return c.Blob(http.StatusOK, "text/csv", []byte("email,name,status\n"))
	}

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
	if !isAdmin(c) {
		return adminOnly(c)
	}

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

// ============================================================
// Subscriber Self-Service (authenticated users managing their own subscriptions)
// ============================================================

// MySubscriptions returns the lists the current user is subscribed to
func (h *SubscriberHandler) MySubscriptions(c echo.Context) error {
	email := mw.GetUserEmail(c)
	if email == "" {
		return response.Unauthorized(c, "Unable to determine user email")
	}

	// Query Listmonk for subscriber by email
	params := map[string]string{
		"query":    fmt.Sprintf("subscribers.email = '%s'", sanitizeEmail(email)),
		"per_page": "1",
	}

	data, statusCode, err := h.lm.Get("/subscribers", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch subscription data")
	}

	if statusCode >= 400 {
		return c.JSONBlob(statusCode, data)
	}

	// Parse the response to extract subscriber with lists
	var result struct {
		Data struct {
			Results []json.RawMessage `json:"results"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &result); err != nil || len(result.Data.Results) == 0 {
		// No subscriber found — return empty subscriptions
		return response.Success(c, map[string]interface{}{
			"subscriptions": []interface{}{},
			"subscriber_id": nil,
		})
	}

	// Return the first matching subscriber (includes their lists)
	return c.JSONBlob(http.StatusOK, result.Data.Results[0])
}

// UpdateSubscriptions allows the user to update their own list subscriptions
func (h *SubscriberHandler) UpdateSubscriptions(c echo.Context) error {
	email := mw.GetUserEmail(c)
	if email == "" {
		return response.Unauthorized(c, "Unable to determine user email")
	}

	// First find the subscriber by email in Listmonk
	params := map[string]string{
		"query":    fmt.Sprintf("subscribers.email = '%s'", sanitizeEmail(email)),
		"per_page": "1",
	}

	data, statusCode, err := h.lm.Get("/subscribers", params)
	if err != nil || statusCode >= 400 {
		return response.InternalError(c, "Failed to find subscriber record")
	}

	var searchResult struct {
		Data struct {
			Results []struct {
				ID int `json:"id"`
			} `json:"results"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &searchResult); err != nil || len(searchResult.Data.Results) == 0 {
		return response.NotFound(c, "No subscriber record found for your email")
	}

	subscriberID := searchResult.Data.Results[0].ID

	// Parse the request body — expects { "lists": [1, 2, 3] }
	var req struct {
		Lists []int `json:"lists"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Build the list subscription payload for Listmonk
	listPayload := make([]map[string]interface{}, len(req.Lists))
	for i, listID := range req.Lists {
		listPayload[i] = map[string]interface{}{
			"id":     listID,
			"status": "confirmed",
		}
	}

	updateData, updateStatus, err := h.lm.Put(fmt.Sprintf("/subscribers/%d", subscriberID), map[string]interface{}{
		"lists": listPayload,
	})
	if err != nil {
		return response.InternalError(c, "Failed to update subscriptions")
	}

	return c.JSONBlob(updateStatus, updateData)
}

// MyPreferences returns the current user's notification/email preferences
func (h *SubscriberHandler) MyPreferences(c echo.Context) error {
	userID := mw.GetUserID(c)
	if h.db == nil {
		return response.InternalError(c, "Database not available")
	}

	var prefs json.RawMessage
	err := h.db.Get(&prefs, "SELECT preferences FROM app_users WHERE id = $1", userID)
	if err != nil {
		return response.InternalError(c, "Failed to fetch preferences")
	}

	return response.Success(c, json.RawMessage(prefs))
}

// UpdatePreferences updates the current user's notification/email preferences
func (h *SubscriberHandler) UpdatePreferences(c echo.Context) error {
	userID := mw.GetUserID(c)
	if h.db == nil {
		return response.InternalError(c, "Database not available")
	}

	var prefs json.RawMessage
	if err := c.Bind(&prefs); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	_, err := h.db.Exec("UPDATE app_users SET preferences = $1, updated_at = NOW() WHERE id = $2", prefs, userID)
	if err != nil {
		return response.InternalError(c, "Failed to update preferences")
	}

	return response.SuccessWithMessage(c, "Preferences updated", prefs)
}
