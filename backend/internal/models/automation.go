package models

import (
	"encoding/json"
	"time"
)

type Automation struct {
	ID          int              `json:"id" db:"id"`
	Name        string           `json:"name" db:"name"`
	Description string           `json:"description" db:"description"`
	TriggerType string           `json:"trigger_type" db:"trigger_type"`
	TriggerConfig json.RawMessage `json:"trigger_config" db:"trigger_config"`
	IsActive    bool             `json:"is_active" db:"is_active"`
	CreatedAt   time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at" db:"updated_at"`
	Steps       []AutomationStep `json:"steps,omitempty"`
}

type AutomationStep struct {
	ID           int             `json:"id" db:"id"`
	AutomationID int            `json:"automation_id" db:"automation_id"`
	StepOrder    int            `json:"step_order" db:"step_order"`
	StepType     string         `json:"step_type" db:"step_type"`
	Config       json.RawMessage `json:"config" db:"config"`
	DelayMinutes int            `json:"delay_minutes" db:"delay_minutes"`
	CreatedAt    time.Time      `json:"created_at" db:"created_at"`
}

type AutomationLog struct {
	ID           int             `json:"id" db:"id"`
	AutomationID int            `json:"automation_id" db:"automation_id"`
	StepID       *int64          `json:"step_id" db:"step_id"`
	SubscriberID *int64          `json:"subscriber_id" db:"subscriber_id"`
	Status       string          `json:"status" db:"status"`
	Details      json.RawMessage `json:"details" db:"details"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
}

type CreateAutomationRequest struct {
	Name          string                    `json:"name"`
	Description   string                    `json:"description"`
	TriggerType   string                    `json:"trigger_type"`
	TriggerConfig json.RawMessage           `json:"trigger_config"`
	Steps         []CreateAutomationStepReq `json:"steps"`
}

type CreateAutomationStepReq struct {
	StepOrder    int             `json:"step_order"`
	StepType     string          `json:"step_type"`
	Config       json.RawMessage `json:"config"`
	DelayMinutes int             `json:"delay_minutes"`
}

type UpdateAutomationRequest struct {
	Name          string                    `json:"name"`
	Description   string                    `json:"description"`
	TriggerType   string                    `json:"trigger_type"`
	TriggerConfig json.RawMessage           `json:"trigger_config"`
	IsActive      *bool                     `json:"is_active"`
	Steps         []CreateAutomationStepReq `json:"steps"`
}
