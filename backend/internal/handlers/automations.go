package handlers

import (
	"database/sql"
	"encoding/json"
	"strconv"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type AutomationHandler struct {
	db *sqlx.DB
}

func NewAutomationHandler(db *sqlx.DB) *AutomationHandler {
	return &AutomationHandler{db: db}
}

func (h *AutomationHandler) List(c echo.Context) error {
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
	err := h.db.Get(&total, "SELECT COUNT(*) FROM app_automations")
	if err != nil {
		return response.InternalError(c, "Failed to count automations")
	}

	var automations []models.Automation
	err = h.db.Select(&automations,
		"SELECT * FROM app_automations ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		perPage, offset,
	)
	if err != nil {
		return response.InternalError(c, "Failed to fetch automations")
	}

	if automations == nil {
		automations = []models.Automation{}
	}

	return response.Paginated(c, automations, total, page, perPage)
}

func (h *AutomationHandler) Get(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var automation models.Automation
	err = h.db.Get(&automation, "SELECT * FROM app_automations WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Automation not found")
		}
		return response.InternalError(c, "Failed to fetch automation")
	}

	var steps []models.AutomationStep
	err = h.db.Select(&steps,
		"SELECT * FROM app_automation_steps WHERE automation_id = $1 ORDER BY step_order ASC",
		id,
	)
	if err != nil {
		return response.InternalError(c, "Failed to fetch automation steps")
	}

	if steps == nil {
		steps = []models.AutomationStep{}
	}
	automation.Steps = steps

	return response.Success(c, automation)
}

func (h *AutomationHandler) Create(c echo.Context) error {
	var req models.CreateAutomationRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	triggerConfig, _ := json.Marshal(req.TriggerConfig)
	if req.TriggerConfig == nil {
		triggerConfig = []byte("{}")
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return response.InternalError(c, "Failed to start transaction")
	}
	defer tx.Rollback()

	var automation models.Automation
	err = tx.QueryRowx(
		`INSERT INTO app_automations (name, description, trigger_type, trigger_config, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, false, NOW(), NOW())
		 RETURNING *`,
		req.Name, req.Description, req.TriggerType, triggerConfig,
	).StructScan(&automation)
	if err != nil {
		return response.InternalError(c, "Failed to create automation")
	}

	var steps []models.AutomationStep
	for _, stepReq := range req.Steps {
		stepConfig, _ := json.Marshal(stepReq.Config)
		if stepReq.Config == nil {
			stepConfig = []byte("{}")
		}

		var step models.AutomationStep
		err = tx.QueryRowx(
			`INSERT INTO app_automation_steps (automation_id, step_order, step_type, config, delay_minutes, created_at)
			 VALUES ($1, $2, $3, $4, $5, NOW())
			 RETURNING *`,
			automation.ID, stepReq.StepOrder, stepReq.StepType, stepConfig, stepReq.DelayMinutes,
		).StructScan(&step)
		if err != nil {
			return response.InternalError(c, "Failed to create automation step")
		}
		steps = append(steps, step)
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Failed to commit transaction")
	}

	automation.Steps = steps
	return response.Created(c, automation)
}

func (h *AutomationHandler) Update(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req models.UpdateAutomationRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	triggerConfig, _ := json.Marshal(req.TriggerConfig)
	if req.TriggerConfig == nil {
		triggerConfig = []byte("{}")
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return response.InternalError(c, "Failed to start transaction")
	}
	defer tx.Rollback()

	// If is_active not provided, keep current value
	if req.IsActive == nil {
		var currentActive bool
		if err := h.db.Get(&currentActive, "SELECT is_active FROM app_automations WHERE id = $1", id); err != nil {
			if err == sql.ErrNoRows {
				return response.NotFound(c, "Automation not found")
			}
			return response.InternalError(c, "Failed to fetch automation")
		}
		req.IsActive = &currentActive
	}

	var automation models.Automation
	err = tx.QueryRowx(
		`UPDATE app_automations
		 SET name = $1, description = $2, trigger_type = $3, trigger_config = $4, is_active = $5, updated_at = NOW()
		 WHERE id = $6
		 RETURNING *`,
		req.Name, req.Description, req.TriggerType, triggerConfig, *req.IsActive, id,
	).StructScan(&automation)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Automation not found")
		}
		return response.InternalError(c, "Failed to update automation")
	}

	if req.Steps != nil {
		_, err = tx.Exec("DELETE FROM app_automation_steps WHERE automation_id = $1", id)
		if err != nil {
			return response.InternalError(c, "Failed to delete old automation steps")
		}

		var steps []models.AutomationStep
		for _, stepReq := range req.Steps {
			stepConfig, _ := json.Marshal(stepReq.Config)
			if stepReq.Config == nil {
				stepConfig = []byte("{}")
			}

			var step models.AutomationStep
			err = tx.QueryRowx(
				`INSERT INTO app_automation_steps (automation_id, step_order, step_type, config, delay_minutes, created_at)
				 VALUES ($1, $2, $3, $4, $5, NOW())
				 RETURNING *`,
				automation.ID, stepReq.StepOrder, stepReq.StepType, stepConfig, stepReq.DelayMinutes,
			).StructScan(&step)
			if err != nil {
				return response.InternalError(c, "Failed to create automation step")
			}
			steps = append(steps, step)
		}
		automation.Steps = steps
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Failed to commit transaction")
	}

	return response.Success(c, automation)
}

func (h *AutomationHandler) Delete(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM app_automations WHERE id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to delete automation")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Automation not found")
	}

	return response.SuccessWithMessage(c, "Automation deleted", nil)
}

func (h *AutomationHandler) ToggleStatus(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var automation models.Automation
	err = h.db.Get(&automation, "SELECT * FROM app_automations WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Automation not found")
		}
		return response.InternalError(c, "Failed to fetch automation")
	}

	newStatus := !automation.IsActive
	_, err = h.db.Exec(
		"UPDATE app_automations SET is_active = $1, updated_at = NOW() WHERE id = $2",
		newStatus, id,
	)
	if err != nil {
		return response.InternalError(c, "Failed to toggle automation status")
	}

	automation.IsActive = newStatus
	return response.Success(c, automation)
}

func (h *AutomationHandler) GetLogs(c echo.Context) error {
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	var total int
	err = h.db.Get(&total, "SELECT COUNT(*) FROM app_automation_logs WHERE automation_id = $1", id)
	if err != nil {
		return response.InternalError(c, "Failed to count automation logs")
	}

	var logs []models.AutomationLog
	err = h.db.Select(&logs,
		"SELECT * FROM app_automation_logs WHERE automation_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
		id, perPage, offset,
	)
	if err != nil {
		return response.InternalError(c, "Failed to fetch automation logs")
	}

	if logs == nil {
		logs = []models.AutomationLog{}
	}

	return response.Paginated(c, logs, total, page, perPage)
}
