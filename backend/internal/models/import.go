package models

import (
	"encoding/json"
	"time"
)

// ImportHistory tracks every import operation
type ImportHistory struct {
	ID           int             `json:"id" db:"id"`
	Source       string          `json:"source" db:"source"`
	Filename     *string         `json:"filename" db:"filename"`
	Status       string          `json:"status" db:"status"`
	Total        int             `json:"total" db:"total"`
	Successful   int             `json:"successful" db:"successful"`
	Failed       int             `json:"failed" db:"failed"`
	Skipped      int             `json:"skipped" db:"skipped"`
	ListIDs      json.RawMessage `json:"list_ids" db:"list_ids"`
	FieldMapping json.RawMessage `json:"field_mapping" db:"field_mapping"`
	ErrorLog     json.RawMessage `json:"error_log" db:"error_log"`
	Summary      json.RawMessage `json:"summary" db:"summary"`
	StartedAt    *time.Time      `json:"started_at" db:"started_at"`
	CompletedAt  *time.Time      `json:"completed_at" db:"completed_at"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

// ImportWebhook stores webhook configurations for automated import
type ImportWebhook struct {
	ID           int             `json:"id" db:"id"`
	Name         string          `json:"name" db:"name"`
	SecretKey    string          `json:"secret_key" db:"secret_key"`
	ListIDs      json.RawMessage `json:"list_ids" db:"list_ids"`
	IsActive     bool            `json:"is_active" db:"is_active"`
	TriggerCount int             `json:"trigger_count" db:"trigger_count"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

// SuppressionEntry is an email in the suppression/blocklist
type SuppressionEntry struct {
	ID        int       `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Reason    string    `json:"reason" db:"reason"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CSV Import parameters sent to Listmonk
type CSVImportParams struct {
	Mode        string `json:"mode"`         // subscribe or blocklist
	Delimiter   string `json:"delim"`        // comma, tab, semicolon
	ListIDs     []int  `json:"lists"`        // list IDs to subscribe to
	Overwrite   bool   `json:"overwrite"`    // overwrite existing subscribers
}

// API Import request types
type APIImportRequest struct {
	Subscribers []APIImportSubscriber `json:"subscribers"`
	ListIDs     []int                 `json:"list_ids"`
	Overwrite   bool                  `json:"overwrite"`
}

type APIImportSubscriber struct {
	Email   string                 `json:"email"`
	Name    string                 `json:"name"`
	Status  string                 `json:"status"`
	Attribs map[string]interface{} `json:"attribs"`
}

// Webhook import payload
type WebhookImportPayload struct {
	Email   string                 `json:"email"`
	Name    string                 `json:"name"`
	Attribs map[string]interface{} `json:"attribs"`
}

// Create webhook request
type CreateWebhookRequest struct {
	Name    string `json:"name"`
	ListIDs []int  `json:"list_ids"`
}

// Update webhook request
type UpdateWebhookRequest struct {
	Name     string `json:"name"`
	ListIDs  []int  `json:"list_ids"`
	IsActive *bool  `json:"is_active"`
}

// Suppression add request
type SuppressionAddRequest struct {
	Emails []string `json:"emails"`
	Reason string   `json:"reason"`
}

// Import analytics response
type ImportAnalytics struct {
	TotalImports     int `json:"total_imports"`
	TotalRecords     int `json:"total_records"`
	TotalSuccessful  int `json:"total_successful"`
	TotalFailed      int `json:"total_failed"`
	TotalSkipped     int `json:"total_skipped"`
	ActiveWebhooks   int `json:"active_webhooks"`
	SuppressedEmails int `json:"suppressed_emails"`
}
