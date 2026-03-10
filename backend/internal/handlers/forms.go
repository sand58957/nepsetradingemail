package handlers

import (
	"database/sql"
	"encoding/json"
	"strconv"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type FormHandler struct {
	db *sqlx.DB
	lm *listmonk.Client
}

func NewFormHandler(db *sqlx.DB, lm *listmonk.Client) *FormHandler {
	return &FormHandler{db: db, lm: lm}
}

func (h *FormHandler) List(c echo.Context) error {
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
	err := h.db.Get(&total, "SELECT COUNT(*) FROM app_forms")
	if err != nil {
		return response.InternalError(c, "Failed to count forms")
	}

	var forms []models.Form
	err = h.db.Select(&forms,
		"SELECT * FROM app_forms ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		perPage, offset,
	)
	if err != nil {
		return response.InternalError(c, "Failed to fetch forms")
	}

	if forms == nil {
		forms = []models.Form{}
	}

	return response.Paginated(c, forms, total, page, perPage)
}

func (h *FormHandler) Get(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var form models.Form
	err = h.db.Get(&form, "SELECT * FROM app_forms WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Form not found")
		}
		return response.InternalError(c, "Failed to fetch form")
	}

	return response.Success(c, form)
}

func (h *FormHandler) Create(c echo.Context) error {
	var req models.CreateFormRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	listIDs, _ := json.Marshal(req.ListIDs)
	if req.ListIDs == nil {
		listIDs = []byte("[]")
	}
	fields, _ := json.Marshal(req.Fields)
	if req.Fields == nil {
		fields = []byte("[]")
	}
	settings, _ := json.Marshal(req.Settings)
	if req.Settings == nil {
		settings = []byte("{}")
	}

	var form models.Form
	err := h.db.QueryRowx(
		`INSERT INTO app_forms (name, description, list_ids, fields, settings, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
		 RETURNING *`,
		req.Name, req.Description, listIDs, fields, settings,
	).StructScan(&form)
	if err != nil {
		return response.InternalError(c, "Failed to create form")
	}

	return response.Created(c, form)
}

func (h *FormHandler) Update(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req models.UpdateFormRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	listIDs, _ := json.Marshal(req.ListIDs)
	if req.ListIDs == nil {
		listIDs = []byte("[]")
	}
	fields, _ := json.Marshal(req.Fields)
	if req.Fields == nil {
		fields = []byte("[]")
	}
	settings, _ := json.Marshal(req.Settings)
	if req.Settings == nil {
		settings = []byte("{}")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var form models.Form
	err = h.db.QueryRowx(
		`UPDATE app_forms
		 SET name = $1, description = $2, list_ids = $3, fields = $4, settings = $5, is_active = $6, updated_at = NOW()
		 WHERE id = $7
		 RETURNING *`,
		req.Name, req.Description, listIDs, fields, settings, isActive, id,
	).StructScan(&form)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Form not found")
		}
		return response.InternalError(c, "Failed to update form")
	}

	return response.Success(c, form)
}

func (h *FormHandler) Delete(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM app_forms WHERE id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to delete form")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Form not found")
	}

	return response.SuccessWithMessage(c, "Form deleted", nil)
}

func (h *FormHandler) Submit(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var form models.Form
	err = h.db.Get(&form, "SELECT * FROM app_forms WHERE id = $1 AND is_active = true", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Form not found or inactive")
		}
		return response.InternalError(c, "Failed to fetch form")
	}

	var submission map[string]interface{}
	if err := c.Bind(&submission); err != nil {
		return response.BadRequest(c, "Invalid submission data")
	}

	email, ok := submission["email"].(string)
	if !ok || email == "" {
		return response.BadRequest(c, "Email is required")
	}

	var listIDs []int
	if err := json.Unmarshal(form.ListIDs, &listIDs); err != nil {
		return response.InternalError(c, "Failed to parse form list IDs")
	}

	subscriberPayload := map[string]interface{}{
		"email":  email,
		"name":   submission["name"],
		"status": "enabled",
		"lists":  listIDs,
	}

	if attribs, ok := submission["attribs"]; ok {
		subscriberPayload["attribs"] = attribs
	}

	data, statusCode, err := h.lm.Post("/subscribers", subscriberPayload)
	if err != nil {
		return response.InternalError(c, "Failed to create subscriber in Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		return response.SuccessWithMessage(c, "Subscription successful", json.RawMessage(data))
	}

	return c.JSONBlob(statusCode, data)
}
