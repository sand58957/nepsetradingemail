package models

import (
	"encoding/json"
	"time"
)

type AccountSetting struct {
	ID        int             `json:"id" db:"id"`
	Key       string          `json:"key" db:"key"`
	Value     json.RawMessage `json:"value" db:"value"`
	UpdatedAt time.Time       `json:"updated_at" db:"updated_at"`
}

type UpdateAccountSettingRequest struct {
	Value json.RawMessage `json:"value"`
}
