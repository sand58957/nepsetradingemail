package models

import (
	"encoding/json"
	"time"
)

type Form struct {
	ID          int             `json:"id" db:"id"`
	Name        string          `json:"name" db:"name"`
	Description string          `json:"description" db:"description"`
	ListIDs     json.RawMessage `json:"list_ids" db:"list_ids"`
	Fields      json.RawMessage `json:"fields" db:"fields"`
	Settings    json.RawMessage `json:"settings" db:"settings"`
	IsActive    bool            `json:"is_active" db:"is_active"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type CreateFormRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	ListIDs     json.RawMessage `json:"list_ids"`
	Fields      json.RawMessage `json:"fields"`
	Settings    json.RawMessage `json:"settings"`
}

type UpdateFormRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	ListIDs     json.RawMessage `json:"list_ids"`
	Fields      json.RawMessage `json:"fields"`
	Settings    json.RawMessage `json:"settings"`
	IsActive    *bool           `json:"is_active"`
}
