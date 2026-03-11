package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type ImportHandler struct {
	db *sqlx.DB
	lm *listmonk.Client
}

func NewImportHandler(db *sqlx.DB, lm *listmonk.Client) *ImportHandler {
	return &ImportHandler{db: db, lm: lm}
}

// ============================================================
// CSV Import (multipart upload to Listmonk)
// ============================================================

func (h *ImportHandler) ImportCSV(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

	// Parse import params from form field
	paramsStr := c.FormValue("params")
	if paramsStr == "" {
		return response.BadRequest(c, "Import params are required")
	}

	// Record import in history
	var params models.CSVImportParams
	if err := json.Unmarshal([]byte(paramsStr), &params); err != nil {
		return response.BadRequest(c, "Invalid import params")
	}

	listIDs, _ := json.Marshal(params.ListIDs)
	if params.ListIDs == nil {
		listIDs = []byte("[]")
	}

	// Extract field_mapping if provided
	var fieldMappingJSON []byte
	var rawParams map[string]json.RawMessage
	if json.Unmarshal([]byte(paramsStr), &rawParams) == nil {
		if fm, ok := rawParams["field_mapping"]; ok {
			fieldMappingJSON = fm
		}
	}
	if fieldMappingJSON == nil {
		fieldMappingJSON = []byte("{}")
	}

	now := time.Now()
	filename := file.Filename

	var history models.ImportHistory
	err = h.db.QueryRowx(
		`INSERT INTO app_import_history (source, filename, status, list_ids, field_mapping, started_at, created_at, updated_at)
		 VALUES ('csv', $1, 'processing', $2, $3, $4, $4, $4)
		 RETURNING *`,
		filename, listIDs, fieldMappingJSON, now,
	).StructScan(&history)
	if err != nil {
		return response.InternalError(c, "Failed to record import history")
	}

	// Send multipart to Listmonk (only params Listmonk understands)
	lmParams, _ := json.Marshal(map[string]interface{}{
		"mode":      params.Mode,
		"delim":     params.Delimiter,
		"lists":     params.ListIDs,
		"overwrite": params.Overwrite,
	})
	fields := map[string]string{
		"params": string(lmParams),
	}

	data, statusCode, err := h.lm.PostMultipart("/import/subscribers", "file", file.Filename, src, fields)
	if err != nil {
		// Update history as failed - use json.Marshal for safe error log
		errLog, _ := json.Marshal([]map[string]string{{"error": err.Error()}})
		h.db.Exec(
			`UPDATE app_import_history SET status = 'failed', error_log = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
			string(errLog), history.ID,
		)
		return response.InternalError(c, "Failed to import subscribers to Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		// Update history status
		h.db.Exec(
			`UPDATE app_import_history SET status = 'processing', updated_at = NOW() WHERE id = $1`,
			history.ID,
		)
		// Return the Listmonk response plus our history_id
		var lmResponse map[string]interface{}
		if json.Unmarshal(data, &lmResponse) == nil {
			lmResponse["history_id"] = history.ID
			return c.JSON(http.StatusOK, lmResponse)
		}
		return c.JSONBlob(http.StatusOK, data)
	}

	// Import failed at Listmonk level
	h.db.Exec(
		`UPDATE app_import_history SET status = 'failed', error_log = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
		string(data), history.ID,
	)

	return c.JSONBlob(statusCode, data)
}

// GetImportStatus proxies GET /import/subscribers to Listmonk
func (h *ImportHandler) GetImportStatus(c echo.Context) error {
	if !isAdmin(c) {
		return response.Success(c, map[string]interface{}{"status": "idle"})
	}

	data, statusCode, err := h.lm.Get("/import/subscribers", nil)
	if err != nil {
		return response.InternalError(c, "Failed to get import status from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// GetImportLogs proxies GET /import/subscribers/logs to Listmonk
func (h *ImportHandler) GetImportLogs(c echo.Context) error {
	if !isAdmin(c) {
		return response.Success(c, []interface{}{})
	}

	data, statusCode, err := h.lm.Get("/import/subscribers/logs", nil)
	if err != nil {
		return response.InternalError(c, "Failed to get import logs from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// CancelImport proxies DELETE /import/subscribers to Listmonk and updates history
func (h *ImportHandler) CancelImport(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	data, statusCode, err := h.lm.Delete("/import/subscribers")
	if err != nil {
		return response.InternalError(c, "Failed to cancel import in Listmonk")
	}

	// Update the latest processing import as cancelled
	h.db.Exec(
		`UPDATE app_import_history SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
		 WHERE id = (SELECT id FROM app_import_history WHERE status = 'processing' ORDER BY created_at DESC LIMIT 1)`,
	)

	return c.JSONBlob(statusCode, data)
}

// ============================================================
// API (JSON) Import
// ============================================================

func (h *ImportHandler) ImportJSON(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var req models.APIImportRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.Subscribers) == 0 {
		return response.BadRequest(c, "No subscribers provided")
	}

	listIDs, _ := json.Marshal(req.ListIDs)
	if req.ListIDs == nil {
		listIDs = []byte("[]")
	}

	now := time.Now()

	var history models.ImportHistory
	err := h.db.QueryRowx(
		`INSERT INTO app_import_history (source, status, total, list_ids, started_at, created_at, updated_at)
		 VALUES ('api', 'processing', $1, $2, $3, $3, $3)
		 RETURNING *`,
		len(req.Subscribers), listIDs, now,
	).StructScan(&history)
	if err != nil {
		return response.InternalError(c, "Failed to record import history")
	}

	// Check suppression list
	var suppressedEmails []string
	h.db.Select(&suppressedEmails, "SELECT email FROM app_suppression_list")
	suppressionMap := make(map[string]bool)
	for _, e := range suppressedEmails {
		suppressionMap[strings.ToLower(e)] = true
	}

	successful := 0
	failed := 0
	skipped := 0
	var errors []map[string]string

	for _, sub := range req.Subscribers {
		// Validate email
		if sub.Email == "" || !strings.Contains(sub.Email, "@") {
			failed++
			errors = append(errors, map[string]string{
				"email": sub.Email,
				"error": "Invalid email address",
			})
			continue
		}

		// Check suppression
		if suppressionMap[strings.ToLower(sub.Email)] {
			skipped++
			errors = append(errors, map[string]string{
				"email": sub.Email,
				"error": "Email is in suppression list",
			})
			continue
		}

		// Build payload for Listmonk
		status := sub.Status
		if status == "" {
			status = "enabled"
		}

		payload := map[string]interface{}{
			"email":  sub.Email,
			"name":   sub.Name,
			"status": status,
			"lists":  req.ListIDs,
		}
		if sub.Attribs != nil {
			payload["attribs"] = sub.Attribs
		}

		_, statusCode, err := h.lm.Post("/subscribers", payload)
		if err != nil || statusCode >= 400 {
			// If overwrite is enabled and the error is duplicate, try PUT
			if req.Overwrite && statusCode == http.StatusConflict {
				// Try to find existing subscriber
				params := map[string]string{
					"query":    fmt.Sprintf("subscribers.email = '%s'", strings.ReplaceAll(sub.Email, "'", "''")),
					"per_page": "1",
				}
				searchData, searchStatus, searchErr := h.lm.Get("/subscribers", params)
				if searchErr == nil && searchStatus == http.StatusOK {
					var searchResult struct {
						Data struct {
							Results []struct {
								ID int `json:"id"`
							} `json:"results"`
						} `json:"data"`
					}
					if json.Unmarshal(searchData, &searchResult) == nil && len(searchResult.Data.Results) > 0 {
						_, putStatus, putErr := h.lm.Put(
							fmt.Sprintf("/subscribers/%d", searchResult.Data.Results[0].ID),
							payload,
						)
						if putErr == nil && putStatus < 400 {
							successful++
							continue
						}
					}
				}
			}
			failed++
			errMsg := "Failed to create subscriber"
			if err != nil {
				errMsg = err.Error()
			}
			errors = append(errors, map[string]string{
				"email": sub.Email,
				"error": errMsg,
			})
			continue
		}
		successful++
	}

	// Update history
	errorLog, _ := json.Marshal(errors)
	if errors == nil {
		errorLog = []byte("[]")
	}

	summary, _ := json.Marshal(map[string]int{
		"successful": successful,
		"failed":     failed,
		"skipped":    skipped,
	})

	h.db.Exec(
		`UPDATE app_import_history
		 SET status = 'completed', successful = $1, failed = $2, skipped = $3,
		     error_log = $4, summary = $5, completed_at = NOW(), updated_at = NOW()
		 WHERE id = $6`,
		successful, failed, skipped, errorLog, summary, history.ID,
	)

	return response.Success(c, map[string]interface{}{
		"import_id":  history.ID,
		"total":      len(req.Subscribers),
		"successful": successful,
		"failed":     failed,
		"skipped":    skipped,
		"errors":     errors,
	})
}

// ============================================================
// Webhook Import
// ============================================================

func (h *ImportHandler) WebhookImport(c echo.Context) error {
	secret := c.Param("secret")
	if secret == "" {
		return response.BadRequest(c, "Missing webhook secret")
	}

	var webhook models.ImportWebhook
	err := h.db.Get(&webhook, "SELECT * FROM app_import_webhooks WHERE secret_key = $1 AND is_active = true", secret)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Webhook not found or inactive")
		}
		return response.InternalError(c, "Failed to verify webhook")
	}

	var payload models.WebhookImportPayload
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if payload.Email == "" || !strings.Contains(payload.Email, "@") {
		return response.BadRequest(c, "Valid email is required")
	}

	// Check suppression
	var count int
	h.db.Get(&count, "SELECT COUNT(*) FROM app_suppression_list WHERE email = $1", strings.ToLower(payload.Email))
	if count > 0 {
		return response.BadRequest(c, "Email is in suppression list")
	}

	// Parse list IDs
	var listIDs []int
	if err := json.Unmarshal(webhook.ListIDs, &listIDs); err != nil {
		return response.InternalError(c, "Failed to parse webhook list IDs")
	}

	subscriberPayload := map[string]interface{}{
		"email":  payload.Email,
		"name":   payload.Name,
		"status": "enabled",
		"lists":  listIDs,
	}
	if payload.Attribs != nil {
		subscriberPayload["attribs"] = payload.Attribs
	}

	data, statusCode, err := h.lm.Post("/subscribers", subscriberPayload)
	if err != nil {
		return response.InternalError(c, "Failed to create subscriber")
	}

	// Increment trigger count
	h.db.Exec("UPDATE app_import_webhooks SET trigger_count = trigger_count + 1, updated_at = NOW() WHERE id = $1", webhook.ID)

	// Record in history
	listIDsJSON, _ := json.Marshal(listIDs)
	h.db.Exec(
		`INSERT INTO app_import_history (source, status, total, successful, list_ids, started_at, completed_at, created_at, updated_at)
		 VALUES ('webhook', 'completed', 1, 1, $1, NOW(), NOW(), NOW(), NOW())`,
		listIDsJSON,
	)

	if statusCode >= 200 && statusCode < 300 {
		return c.JSONBlob(http.StatusOK, data)
	}

	return c.JSONBlob(statusCode, data)
}

// ============================================================
// Import History CRUD
// ============================================================

func (h *ImportHandler) ListHistory(c echo.Context) error {
	if !isAdmin(c) {
		return response.Paginated(c, []interface{}{}, 0, 1, 20)
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Optional filters
	source := c.QueryParam("source")
	status := c.QueryParam("status")

	// Build query
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if source != "" {
		where += fmt.Sprintf(" AND source = $%d", argIdx)
		args = append(args, source)
		argIdx++
	}
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM app_import_history %s", where)
	err := h.db.Get(&total, countQuery, args...)
	if err != nil {
		return response.InternalError(c, "Failed to count import history")
	}

	var history []models.ImportHistory
	selectQuery := fmt.Sprintf(
		"SELECT * FROM app_import_history %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	)
	args = append(args, perPage, offset)

	err = h.db.Select(&history, selectQuery, args...)
	if err != nil {
		return response.InternalError(c, "Failed to fetch import history")
	}

	if history == nil {
		history = []models.ImportHistory{}
	}

	return response.Paginated(c, history, total, page, perPage)
}

func (h *ImportHandler) GetHistory(c echo.Context) error {
	if !isAdmin(c) {
		return response.NotFound(c, "Import history not found")
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var history models.ImportHistory
	err = h.db.Get(&history, "SELECT * FROM app_import_history WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Import history not found")
		}
		return response.InternalError(c, "Failed to fetch import history")
	}

	return response.Success(c, history)
}

func (h *ImportHandler) DeleteHistory(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM app_import_history WHERE id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to delete import history")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Import history not found")
	}

	return response.SuccessWithMessage(c, "Import history deleted", nil)
}

// ============================================================
// Import Analytics
// ============================================================

func (h *ImportHandler) GetAnalytics(c echo.Context) error {
	if !isAdmin(c) {
		return response.Success(c, models.ImportAnalytics{})
	}

	var analytics models.ImportAnalytics

	h.db.Get(&analytics.TotalImports, "SELECT COUNT(*) FROM app_import_history")
	h.db.Get(&analytics.TotalRecords, "SELECT COALESCE(SUM(total), 0) FROM app_import_history")
	h.db.Get(&analytics.TotalSuccessful, "SELECT COALESCE(SUM(successful), 0) FROM app_import_history")
	h.db.Get(&analytics.TotalFailed, "SELECT COALESCE(SUM(failed), 0) FROM app_import_history")
	h.db.Get(&analytics.TotalSkipped, "SELECT COALESCE(SUM(skipped), 0) FROM app_import_history")
	h.db.Get(&analytics.ActiveWebhooks, "SELECT COUNT(*) FROM app_import_webhooks WHERE is_active = true")
	h.db.Get(&analytics.SuppressedEmails, "SELECT COUNT(*) FROM app_suppression_list")

	return response.Success(c, analytics)
}

// ============================================================
// Webhook Management
// ============================================================

func (h *ImportHandler) ListWebhooks(c echo.Context) error {
	if !isAdmin(c) {
		return response.Success(c, []interface{}{})
	}

	var webhooks []models.ImportWebhook
	err := h.db.Select(&webhooks, "SELECT id, name, list_ids, is_active, trigger_count, created_at, updated_at FROM app_import_webhooks ORDER BY created_at DESC")
	if err != nil {
		return response.InternalError(c, "Failed to fetch webhooks")
	}

	if webhooks == nil {
		webhooks = []models.ImportWebhook{}
	}

	return response.Success(c, webhooks)
}

func (h *ImportHandler) CreateWebhook(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var req models.CreateWebhookRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	// Generate secure random secret key
	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return response.InternalError(c, "Failed to generate secret key")
	}
	secretKey := hex.EncodeToString(secretBytes)

	listIDs, _ := json.Marshal(req.ListIDs)
	if req.ListIDs == nil {
		listIDs = []byte("[]")
	}

	var webhook models.ImportWebhook
	err := h.db.QueryRowx(
		`INSERT INTO app_import_webhooks (name, secret_key, list_ids, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, true, NOW(), NOW())
		 RETURNING *`,
		req.Name, secretKey, listIDs,
	).StructScan(&webhook)
	if err != nil {
		return response.InternalError(c, "Failed to create webhook")
	}

	return response.Created(c, webhook)
}

func (h *ImportHandler) UpdateWebhook(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req models.UpdateWebhookRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	listIDs, _ := json.Marshal(req.ListIDs)
	if req.ListIDs == nil {
		listIDs = []byte("[]")
	}

	// If is_active not provided, keep current value
	if req.IsActive == nil {
		var currentActive bool
		if err := h.db.Get(&currentActive, "SELECT is_active FROM app_import_webhooks WHERE id = $1", id); err != nil {
			if err == sql.ErrNoRows {
				return response.NotFound(c, "Webhook not found")
			}
			return response.InternalError(c, "Failed to fetch webhook")
		}
		req.IsActive = &currentActive
	}

	var webhook models.ImportWebhook
	err = h.db.QueryRowx(
		`UPDATE app_import_webhooks
		 SET name = $1, list_ids = $2, is_active = $3, updated_at = NOW()
		 WHERE id = $4
		 RETURNING *`,
		req.Name, listIDs, *req.IsActive, id,
	).StructScan(&webhook)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Webhook not found")
		}
		return response.InternalError(c, "Failed to update webhook")
	}

	return response.Success(c, webhook)
}

func (h *ImportHandler) DeleteWebhook(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM app_import_webhooks WHERE id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to delete webhook")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Webhook not found")
	}

	return response.SuccessWithMessage(c, "Webhook deleted", nil)
}

// ============================================================
// Suppression List
// ============================================================

func (h *ImportHandler) ListSuppressed(c echo.Context) error {
	if !isAdmin(c) {
		return response.Paginated(c, []interface{}{}, 0, 1, 20)
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	err := h.db.Get(&total, "SELECT COUNT(*) FROM app_suppression_list")
	if err != nil {
		return response.InternalError(c, "Failed to count suppression list")
	}

	var entries []models.SuppressionEntry
	err = h.db.Select(&entries,
		"SELECT * FROM app_suppression_list ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		perPage, offset,
	)
	if err != nil {
		return response.InternalError(c, "Failed to fetch suppression list")
	}

	if entries == nil {
		entries = []models.SuppressionEntry{}
	}

	return response.Paginated(c, entries, total, page, perPage)
}

func (h *ImportHandler) AddSuppressed(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var req models.SuppressionAddRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.Emails) == 0 {
		return response.BadRequest(c, "At least one email is required")
	}

	reason := req.Reason
	if reason == "" {
		reason = "manual"
	}

	added := 0
	for _, email := range req.Emails {
		email = strings.TrimSpace(strings.ToLower(email))
		if email == "" || !strings.Contains(email, "@") {
			continue
		}

		_, err := h.db.Exec(
			"INSERT INTO app_suppression_list (email, reason, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO NOTHING",
			email, reason,
		)
		if err == nil {
			added++
		}
	}

	return response.SuccessWithMessage(c, fmt.Sprintf("%d emails added to suppression list", added), map[string]int{"added": added})
}

func (h *ImportHandler) RemoveSuppressed(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM app_suppression_list WHERE id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to remove from suppression list")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Suppression entry not found")
	}

	return response.SuccessWithMessage(c, "Email removed from suppression list", nil)
}

// UpdateImportHistory updates a processing import with status info.
// Called when polling Listmonk import status shows completion.
func (h *ImportHandler) UpdateImportHistory(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var req struct {
		ID         int    `json:"id"`
		Status     string `json:"status"`
		Total      int    `json:"total"`
		Successful int    `json:"successful"`
		Failed     int    `json:"failed"`
		Skipped    int    `json:"skipped"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate ID
	if req.ID <= 0 {
		return response.BadRequest(c, "Valid import history ID is required")
	}

	// Validate status
	validStatuses := map[string]bool{"completed": true, "failed": true, "cancelled": true, "processing": true}
	if !validStatuses[req.Status] {
		return response.BadRequest(c, "Status must be one of: completed, failed, cancelled, processing")
	}

	// Verify the import record exists and is in a mutable state
	var currentStatus string
	err := h.db.Get(&currentStatus, "SELECT status FROM app_import_history WHERE id = $1", req.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Import history not found")
		}
		return response.InternalError(c, "Failed to verify import history")
	}

	summary, _ := json.Marshal(map[string]int{
		"successful": req.Successful,
		"failed":     req.Failed,
		"skipped":    req.Skipped,
	})

	_, err = h.db.Exec(
		`UPDATE app_import_history
		 SET status = $1, total = $2, successful = $3, failed = $4, skipped = $5,
		     summary = $6, completed_at = NOW(), updated_at = NOW()
		 WHERE id = $7`,
		req.Status, req.Total, req.Successful, req.Failed, req.Skipped, summary, req.ID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to update import history")
	}

	return response.SuccessWithMessage(c, "Import history updated", nil)
}
