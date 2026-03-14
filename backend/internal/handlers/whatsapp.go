package handlers

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/gupshup"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// WhatsAppHandler manages all WhatsApp marketing endpoints.
type WhatsAppHandler struct {
	db *sqlx.DB
}

// NewWhatsAppHandler creates a new WhatsApp handler.
func NewWhatsAppHandler(db *sqlx.DB) *WhatsAppHandler {
	return &WhatsAppHandler{db: db}
}

// ============================================================
// Models
// ============================================================

type WASettings struct {
	ID            int        `json:"id" db:"id"`
	AccountID     int        `json:"account_id" db:"account_id"`
	GupshupAppID  string     `json:"gupshup_app_id" db:"gupshup_app_id"`
	GupshupAPIKey string     `json:"gupshup_api_key" db:"gupshup_api_key"`
	SourcePhone   string     `json:"source_phone" db:"source_phone"`
	AppName       string     `json:"app_name" db:"app_name"`
	WabaID        string     `json:"waba_id" db:"waba_id"`
	WebhookSecret string     `json:"webhook_secret" db:"webhook_secret"`
	SendRate      int        `json:"send_rate" db:"send_rate"`
	IsActive      bool       `json:"is_active" db:"is_active"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

type WAContact struct {
	ID         int             `json:"id" db:"id"`
	AccountID  int             `json:"account_id" db:"account_id"`
	Phone      string          `json:"phone" db:"phone"`
	Name       string          `json:"name" db:"name"`
	Email      string          `json:"email" db:"email"`
	OptedIn    bool            `json:"opted_in" db:"opted_in"`
	OptedInAt  *time.Time      `json:"opted_in_at" db:"opted_in_at"`
	OptedOutAt *time.Time      `json:"opted_out_at" db:"opted_out_at"`
	Tags       json.RawMessage `json:"tags" db:"tags"`
	Attributes json.RawMessage `json:"attributes" db:"attributes"`
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at" db:"updated_at"`
}

type WATemplate struct {
	ID           int             `json:"id" db:"id"`
	AccountID    int             `json:"account_id" db:"account_id"`
	GupshupID    string          `json:"gupshup_id" db:"gupshup_id"`
	Name         string          `json:"name" db:"name"`
	Category     string          `json:"category" db:"category"`
	Language     string          `json:"language" db:"language"`
	Status       string          `json:"status" db:"status"`
	HeaderType   string          `json:"header_type" db:"header_type"`
	HeaderText   string          `json:"header_text" db:"header_text"`
	BodyText     string          `json:"body_text" db:"body_text"`
	FooterText   string          `json:"footer_text" db:"footer_text"`
	ButtonType   string          `json:"button_type" db:"button_type"`
	Buttons      json.RawMessage `json:"buttons" db:"buttons"`
	SampleValues json.RawMessage `json:"sample_values" db:"sample_values"`
	SyncedAt     *time.Time      `json:"synced_at" db:"synced_at"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

type WACampaign struct {
	ID             int             `json:"id" db:"id"`
	AccountID      int             `json:"account_id" db:"account_id"`
	Name           string          `json:"name" db:"name"`
	TemplateID     *int            `json:"template_id" db:"template_id"`
	Status         string          `json:"status" db:"status"`
	TargetFilter   json.RawMessage `json:"target_filter" db:"target_filter"`
	TemplateParams json.RawMessage `json:"template_params" db:"template_params"`
	TotalTargets   int             `json:"total_targets" db:"total_targets"`
	SentCount      int             `json:"sent_count" db:"sent_count"`
	DeliveredCount int             `json:"delivered_count" db:"delivered_count"`
	ReadCount      int             `json:"read_count" db:"read_count"`
	FailedCount    int             `json:"failed_count" db:"failed_count"`
	ScheduledAt    *time.Time      `json:"scheduled_at" db:"scheduled_at"`
	StartedAt      *time.Time      `json:"started_at" db:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at" db:"completed_at"`
	CreatedBy      *int            `json:"created_by" db:"created_by"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type WACampaignMessage struct {
	ID            int        `json:"id" db:"id"`
	CampaignID    int        `json:"campaign_id" db:"campaign_id"`
	ContactID     int        `json:"contact_id" db:"contact_id"`
	GupshupMsgID  string     `json:"gupshup_msg_id" db:"gupshup_msg_id"`
	WAMsgID       string     `json:"wa_msg_id" db:"wa_msg_id"`
	Status        string     `json:"status" db:"status"`
	ErrorReason   string     `json:"error_reason" db:"error_reason"`
	SubmittedAt   *time.Time `json:"submitted_at" db:"submitted_at"`
	EnqueuedAt    *time.Time `json:"enqueued_at" db:"enqueued_at"`
	SentAt        *time.Time `json:"sent_at" db:"sent_at"`
	DeliveredAt   *time.Time `json:"delivered_at" db:"delivered_at"`
	ReadAt        *time.Time `json:"read_at" db:"read_at"`
	FailedAt      *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

// helper to build a Gupshup client from account settings
func (h *WhatsAppHandler) getClient(accountID int) (*gupshup.Client, *WASettings, error) {
	var settings WASettings
	err := h.db.Get(&settings, "SELECT * FROM wa_settings WHERE account_id = $1", accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("WhatsApp settings not configured")
	}
	if settings.GupshupAPIKey == "" {
		return nil, nil, fmt.Errorf("Gupshup API key not set")
	}

	client := gupshup.NewClient(settings.GupshupAPIKey, settings.AppName, settings.SourcePhone)
	return client, &settings, nil
}

func generateSecret() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ============================================================
// Settings Handlers
// ============================================================

func (h *WhatsAppHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	var settings WASettings
	err := h.db.Get(&settings, "SELECT * FROM wa_settings WHERE account_id = $1", accountID)
	if err != nil {
		// Return empty settings if none exist
		return response.Success(c, map[string]interface{}{
			"configured": false,
		})
	}
	// Mask the API key for security
	masked := settings
	if len(masked.GupshupAPIKey) > 8 {
		masked.GupshupAPIKey = masked.GupshupAPIKey[:4] + "****" + masked.GupshupAPIKey[len(masked.GupshupAPIKey)-4:]
	}
	return response.Success(c, map[string]interface{}{
		"configured": true,
		"settings":   masked,
	})
}

func (h *WhatsAppHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		GupshupAppID  string `json:"gupshup_app_id"`
		GupshupAPIKey string `json:"gupshup_api_key"`
		SourcePhone   string `json:"source_phone"`
		AppName       string `json:"app_name"`
		WabaID        string `json:"waba_id"`
		SendRate      int    `json:"send_rate"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.SendRate <= 0 {
		req.SendRate = 10
	}

	// Upsert settings
	_, err := h.db.Exec(`
		INSERT INTO wa_settings (account_id, gupshup_app_id, gupshup_api_key, source_phone, app_name, waba_id, webhook_secret, send_rate, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			gupshup_app_id = EXCLUDED.gupshup_app_id,
			gupshup_api_key = CASE WHEN EXCLUDED.gupshup_api_key = '' THEN wa_settings.gupshup_api_key ELSE EXCLUDED.gupshup_api_key END,
			source_phone = EXCLUDED.source_phone,
			app_name = EXCLUDED.app_name,
			waba_id = EXCLUDED.waba_id,
			send_rate = EXCLUDED.send_rate,
			updated_at = NOW()
	`, accountID, req.GupshupAppID, req.GupshupAPIKey, req.SourcePhone, req.AppName, req.WabaID, generateSecret(), req.SendRate)
	if err != nil {
		log.Printf("[whatsapp] Failed to save settings: %v", err)
		return response.InternalError(c, "Failed to save settings")
	}

	return response.SuccessWithMessage(c, "WhatsApp settings saved", nil)
}

func (h *WhatsAppHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, settings, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	if err := client.TestConnection(settings.GupshupAppID); err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Connection failed: %v", err))
	}

	// Try to get wallet balance too
	balance, _ := client.GetWalletBalance()

	return response.Success(c, map[string]interface{}{
		"connected": true,
		"balance":   balance,
	})
}

// ============================================================
// Contact Handlers
// ============================================================

func (h *WhatsAppHandler) ListContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	query := c.QueryParam("query")
	tag := c.QueryParam("tag")
	optedIn := c.QueryParam("opted_in")

	// Build dynamic WHERE clause
	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if query != "" {
		where += fmt.Sprintf(" AND (phone ILIKE $%d OR name ILIKE $%d OR email ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}
	if tag != "" {
		where += fmt.Sprintf(" AND tags @> $%d::jsonb", argIdx)
		tagJSON, _ := json.Marshal([]string{tag})
		args = append(args, string(tagJSON))
		argIdx++
	}
	if optedIn == "true" {
		where += " AND opted_in = true"
	} else if optedIn == "false" {
		where += " AND opted_in = false"
	}

	// Count total
	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM wa_contacts WHERE %s", where)
	if err := h.db.Get(&total, countSQL, args...); err != nil {
		log.Printf("[whatsapp] Failed to count contacts: %v", err)
		return response.InternalError(c, "Failed to count contacts")
	}

	// Fetch page
	args = append(args, perPage, offset)
	dataSQL := fmt.Sprintf("SELECT * FROM wa_contacts WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argIdx, argIdx+1)

	var contacts []WAContact
	if err := h.db.Select(&contacts, dataSQL, args...); err != nil {
		log.Printf("[whatsapp] Failed to fetch contacts: %v", err)
		return response.InternalError(c, "Failed to fetch contacts")
	}

	if contacts == nil {
		contacts = []WAContact{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"results":  contacts,
			"total":    total,
			"page":     page,
			"per_page": perPage,
		},
	})
}

func (h *WhatsAppHandler) GetContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var contact WAContact
	if err := h.db.Get(&contact, "SELECT * FROM wa_contacts WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Contact not found")
	}

	return response.Success(c, contact)
}

func (h *WhatsAppHandler) CreateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Phone      string          `json:"phone"`
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
		GroupIDs   []int           `json:"group_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Phone == "" {
		return response.BadRequest(c, "Phone number is required")
	}

	// Clean phone: remove spaces, dashes, plus
	phone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, " ", ""), "-", ""), "+", "")

	tags := req.Tags
	if tags == nil {
		tags = json.RawMessage("[]")
	}
	attrs := req.Attributes
	if attrs == nil {
		attrs = json.RawMessage("{}")
	}

	now := time.Now()
	var contact WAContact
	err := h.db.Get(&contact, `
		INSERT INTO wa_contacts (account_id, phone, name, email, opted_in, opted_in_at, tags, attributes)
		VALUES ($1, $2, $3, $4, true, $5, $6, $7)
		ON CONFLICT (account_id, phone) DO UPDATE SET
			name = EXCLUDED.name,
			email = EXCLUDED.email,
			tags = EXCLUDED.tags,
			attributes = EXCLUDED.attributes,
			updated_at = NOW()
		RETURNING *
	`, accountID, phone, req.Name, req.Email, now, tags, attrs)
	if err != nil {
		log.Printf("[whatsapp] Failed to create contact: %v", err)
		return response.InternalError(c, "Failed to create contact")
	}

	// Add contact to specified groups
	for _, gid := range req.GroupIDs {
		h.db.Exec(`
			INSERT INTO wa_contact_group_members (group_id, contact_id)
			SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $3)
			ON CONFLICT DO NOTHING
		`, gid, contact.ID, accountID)
	}

	return response.Created(c, contact)
}

func (h *WhatsAppHandler) UpdateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		OptedIn    *bool           `json:"opted_in"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Check contact exists for this account
	var exists bool
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM wa_contacts WHERE id = $1 AND account_id = $2)", id, accountID)
	if !exists {
		return response.NotFound(c, "Contact not found")
	}

	tags := req.Tags
	if tags == nil {
		tags = json.RawMessage("[]")
	}
	attrs := req.Attributes
	if attrs == nil {
		attrs = json.RawMessage("{}")
	}

	optedIn := true
	if req.OptedIn != nil {
		optedIn = *req.OptedIn
	}

	_, err2 := h.db.Exec(`
		UPDATE wa_contacts SET name = $1, email = $2, opted_in = $3, tags = $4, attributes = $5, updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.Email, optedIn, tags, attrs, id, accountID)
	if err2 != nil {
		log.Printf("[whatsapp] Failed to update contact: %v", err2)
		return response.InternalError(c, "Failed to update contact")
	}

	return response.SuccessWithMessage(c, "Contact updated", nil)
}

func (h *WhatsAppHandler) DeleteContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM wa_contacts WHERE id = $1 AND account_id = $2", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete contact")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Contact not found")
	}

	return response.SuccessWithMessage(c, "Contact deleted", nil)
}

func (h *WhatsAppHandler) ImportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "CSV file is required")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to open file")
	}
	defer src.Close()

	reader := csv.NewReader(src)
	reader.TrimLeadingSpace = true

	// Read header
	header, err := reader.Read()
	if err != nil {
		return response.BadRequest(c, "Failed to read CSV header")
	}

	// Map header columns
	colMap := map[string]int{}
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	phoneIdx, hasPhone := colMap["phone"]
	if !hasPhone {
		return response.BadRequest(c, "CSV must have a 'phone' column")
	}
	nameIdx, hasName := colMap["name"]
	emailIdx, hasEmail := colMap["email"]
	tagsIdx, hasTags := colMap["tags"]

	// Parse group_ids from form data
	var groupIDs []int
	if gids := c.FormValue("group_ids"); gids != "" {
		json.Unmarshal([]byte(gids), &groupIDs)
	}

	imported := 0
	skipped := 0
	now := time.Now()
	var importedContactIDs []int

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			skipped++
			continue
		}

		phone := strings.TrimSpace(record[phoneIdx])
		phone = strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(phone, " ", ""), "-", ""), "+", "")
		if phone == "" {
			skipped++
			continue
		}

		name := ""
		if hasName && nameIdx < len(record) {
			name = strings.TrimSpace(record[nameIdx])
		}
		email := ""
		if hasEmail && emailIdx < len(record) {
			email = strings.TrimSpace(record[emailIdx])
		}
		tags := "[]"
		if hasTags && tagsIdx < len(record) {
			tagStr := strings.TrimSpace(record[tagsIdx])
			if tagStr != "" {
				// Split comma-separated tags into JSON array
				parts := strings.Split(tagStr, ",")
				for i := range parts {
					parts[i] = strings.TrimSpace(parts[i])
				}
				tagJSON, _ := json.Marshal(parts)
				tags = string(tagJSON)
			}
		}

		var contactID int
		err2 := h.db.Get(&contactID, `
			INSERT INTO wa_contacts (account_id, phone, name, email, opted_in, opted_in_at, tags)
			VALUES ($1, $2, $3, $4, true, $5, $6::jsonb)
			ON CONFLICT (account_id, phone) DO UPDATE SET
				name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE wa_contacts.name END,
				email = CASE WHEN EXCLUDED.email != '' THEN EXCLUDED.email ELSE wa_contacts.email END,
				updated_at = NOW()
			RETURNING id
		`, accountID, phone, name, email, now, tags)
		if err2 != nil {
			log.Printf("[whatsapp] Import row error: %v", err2)
			skipped++
			continue
		}
		imported++
		if len(groupIDs) > 0 {
			importedContactIDs = append(importedContactIDs, contactID)
		}
	}

	// Add imported contacts to specified groups
	for _, gid := range groupIDs {
		for _, cid := range importedContactIDs {
			h.db.Exec(`
				INSERT INTO wa_contact_group_members (group_id, contact_id)
				SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $3)
				ON CONFLICT DO NOTHING
			`, gid, cid, accountID)
		}
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
	})
}

func (h *WhatsAppHandler) ExportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var contacts []WAContact
	if err := h.db.Select(&contacts, "SELECT * FROM wa_contacts WHERE account_id = $1 ORDER BY created_at DESC", accountID); err != nil {
		return response.InternalError(c, "Failed to fetch contacts")
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=wa_contacts.csv")

	writer := csv.NewWriter(c.Response().Writer)
	writer.Write([]string{"phone", "name", "email", "opted_in", "tags", "created_at"})

	for _, ct := range contacts {
		optedIn := "true"
		if !ct.OptedIn {
			optedIn = "false"
		}
		writer.Write([]string{
			ct.Phone,
			ct.Name,
			ct.Email,
			optedIn,
			string(ct.Tags),
			ct.CreatedAt.Format(time.RFC3339),
		})
	}

	writer.Flush()
	return nil
}

// ============================================================
// Contact Tags & Stats
// ============================================================

// ListContactTags returns all unique tags across contacts with their counts.
func (h *WhatsAppHandler) ListContactTags(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type TagRow struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tags []TagRow
	err := h.db.Select(&tags, `
		SELECT tag, COUNT(*) as count
		FROM wa_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`, accountID)
	if err != nil {
		log.Printf("[whatsapp] Failed to fetch tags: %v", err)
	}

	if tags == nil {
		tags = []TagRow{}
	}

	return response.Success(c, tags)
}

// CreateContactTag adds a tag to multiple contacts.
func (h *WhatsAppHandler) CreateContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Tag        string `json:"tag"`
		ContactIDs []int  `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Tag == "" {
		return response.BadRequest(c, "Tag name is required")
	}

	tag := strings.TrimSpace(strings.ToLower(req.Tag))
	updated := 0

	if len(req.ContactIDs) > 0 {
		// Add tag to specific contacts
		for _, cid := range req.ContactIDs {
			result, err := h.db.Exec(`
				UPDATE wa_contacts
				SET tags = CASE
					WHEN NOT tags @> to_jsonb($1::text) THEN tags || to_jsonb($1::text)
					ELSE tags
				END,
				updated_at = NOW()
				WHERE id = $2 AND account_id = $3
			`, tag, cid, accountID)
			if err == nil {
				if n, _ := result.RowsAffected(); n > 0 {
					updated++
				}
			}
		}
	}

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"updated": updated,
	})
}

// DeleteContactTag removes a tag from all contacts.
func (h *WhatsAppHandler) DeleteContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	tag := c.Param("tag")

	if tag == "" {
		return response.BadRequest(c, "Tag is required")
	}

	result, err := h.db.Exec(`
		UPDATE wa_contacts
		SET tags = tags - $1, updated_at = NOW()
		WHERE account_id = $2 AND tags @> to_jsonb($1::text)
	`, tag, accountID)
	if err != nil {
		log.Printf("[whatsapp] Failed to delete tag: %v", err)
		return response.InternalError(c, "Failed to delete tag")
	}

	removed, _ := result.RowsAffected()

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"removed": removed,
	})
}

// GetContactStats returns contact statistics.
func (h *WhatsAppHandler) GetContactStats(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts int `json:"total_contacts" db:"total_contacts"`
		OptedIn       int `json:"opted_in" db:"opted_in"`
		OptedOut      int `json:"opted_out" db:"opted_out"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.OptedOut, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND opted_in = false", accountID)

	// Tags breakdown
	type TagStat struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tagStats []TagStat
	h.db.Select(&tagStats, `
		SELECT tag, COUNT(*) as count
		FROM wa_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag ORDER BY count DESC LIMIT 20
	`, accountID)
	if tagStats == nil {
		tagStats = []TagStat{}
	}

	// Recent additions (last 30 days)
	var recentCount int
	h.db.Get(&recentCount, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days'", accountID)

	// Contacts with attributes
	var withAttrs int
	h.db.Get(&withAttrs, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND attributes != '{}'::jsonb", accountID)

	return response.Success(c, map[string]interface{}{
		"total_contacts":   stats.TotalContacts,
		"opted_in":         stats.OptedIn,
		"opted_out":        stats.OptedOut,
		"tags":             tagStats,
		"recent_30d":       recentCount,
		"with_attributes":  withAttrs,
	})
}

// GetContactFields returns unique attribute field names from contacts.
func (h *WhatsAppHandler) GetContactFields(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type FieldRow struct {
		Field string `json:"field" db:"field"`
		Count int    `json:"count" db:"count"`
	}
	var fields []FieldRow
	err := h.db.Select(&fields, `
		SELECT key AS field, COUNT(*) as count
		FROM wa_contacts, jsonb_each_text(attributes) AS kv(key, value)
		WHERE account_id = $1
		GROUP BY key ORDER BY key ASC
	`, accountID)
	if err != nil {
		log.Printf("[whatsapp] Failed to fetch fields: %v", err)
	}

	if fields == nil {
		fields = []FieldRow{}
	}

	return response.Success(c, fields)
}

// CleanupContacts lists or removes opted-out contacts.
func (h *WhatsAppHandler) CleanupContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	action := c.QueryParam("action") // "list" or "delete"

	if action == "delete" {
		result, err := h.db.Exec("DELETE FROM wa_contacts WHERE account_id = $1 AND opted_in = false", accountID)
		if err != nil {
			return response.InternalError(c, "Failed to delete opted-out contacts")
		}
		deleted, _ := result.RowsAffected()
		return response.Success(c, map[string]interface{}{
			"deleted": deleted,
		})
	}

	// Default: list opted-out contacts
	var contacts []WAContact
	h.db.Select(&contacts, `
		SELECT * FROM wa_contacts
		WHERE account_id = $1 AND opted_in = false
		ORDER BY opted_out_at DESC NULLS LAST, updated_at DESC
		LIMIT 500
	`, accountID)

	if contacts == nil {
		contacts = []WAContact{}
	}

	var optedOutCount int
	h.db.Get(&optedOutCount, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND opted_in = false", accountID)

	return response.Success(c, map[string]interface{}{
		"contacts": contacts,
		"total":    optedOutCount,
	})
}

// ============================================================
// Template Handlers
// ============================================================

func (h *WhatsAppHandler) ListTemplates(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var templates []WATemplate
	if err := h.db.Select(&templates, "SELECT * FROM wa_templates WHERE account_id = $1 ORDER BY name ASC", accountID); err != nil {
		log.Printf("[whatsapp] Failed to fetch templates: %v", err)
		return response.InternalError(c, "Failed to fetch templates")
	}

	if templates == nil {
		templates = []WATemplate{}
	}

	return response.Success(c, templates)
}

func (h *WhatsAppHandler) GetTemplate(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var tmpl WATemplate
	if err := h.db.Get(&tmpl, "SELECT * FROM wa_templates WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Template not found")
	}

	return response.Success(c, tmpl)
}

func (h *WhatsAppHandler) SyncTemplates(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, settings, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	templates, err := client.ListTemplates(settings.GupshupAppID)
	if err != nil {
		log.Printf("[whatsapp] Failed to sync templates: %v", err)
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to fetch templates from Gupshup: %v", err))
	}

	now := time.Now()
	synced := 0

	for _, t := range templates {
		status := strings.ToLower(t.Status)
		if status == "" {
			status = "pending"
		}

		_, err := h.db.Exec(`
			INSERT INTO wa_templates (account_id, gupshup_id, name, category, language, status, body_text, synced_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
			ON CONFLICT (account_id, name, language) DO UPDATE SET
				gupshup_id = EXCLUDED.gupshup_id,
				category = EXCLUDED.category,
				status = EXCLUDED.status,
				body_text = EXCLUDED.body_text,
				synced_at = EXCLUDED.synced_at,
				updated_at = NOW()
		`, accountID, t.ID, t.ElementName, t.Category, t.LanguageCode, status, t.Body, now)
		if err != nil {
			log.Printf("[whatsapp] Failed to upsert template %s: %v", t.ElementName, err)
			continue
		}
		synced++
	}

	return response.Success(c, map[string]interface{}{
		"synced": synced,
		"total":  len(templates),
	})
}

func (h *WhatsAppHandler) CreateTemplate(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, settings, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	var req struct {
		Name     string `json:"name"`
		Category string `json:"category"`
		Language string `json:"language"`
		Body     string `json:"body"`
		Example  string `json:"example"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" || req.Body == "" || req.Category == "" {
		return response.BadRequest(c, "Name, category, and body are required")
	}
	if req.Language == "" {
		req.Language = "en"
	}

	// Create template in Gupshup
	createReq := gupshup.CreateTemplateRequest{
		ElementName: req.Name,
		Language:    req.Language,
		Category:    req.Category,
		Content:     req.Body,
		Example:     req.Example,
		Vertical:    "TEXT",
	}

	result, err := client.CreateTemplate(settings.GupshupAppID, createReq)
	if err != nil {
		log.Printf("[whatsapp] Failed to create template in Gupshup: %v", err)
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Gupshup error: %v", err))
	}

	// Save to local database
	now := time.Now()
	gupshupID := result.Template.ID
	status := strings.ToLower(result.Template.Status)
	if status == "" {
		status = "pending"
	}

	var tmpl WATemplate
	err = h.db.Get(&tmpl, `
		INSERT INTO wa_templates (account_id, gupshup_id, name, category, language, status, body_text, synced_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		ON CONFLICT (account_id, name, language) DO UPDATE SET
			gupshup_id = EXCLUDED.gupshup_id,
			category = EXCLUDED.category,
			status = EXCLUDED.status,
			body_text = EXCLUDED.body_text,
			synced_at = EXCLUDED.synced_at,
			updated_at = NOW()
		RETURNING *
	`, accountID, gupshupID, req.Name, req.Category, req.Language, status, req.Body, now)
	if err != nil {
		log.Printf("[whatsapp] Failed to save template to DB: %v", err)
		// Template was created in Gupshup but failed to save locally - still return success
		return response.Success(c, map[string]interface{}{
			"message":    "Template created in Gupshup (pending approval)",
			"gupshup_id": gupshupID,
		})
	}

	return response.Created(c, tmpl)
}

func (h *WhatsAppHandler) DeleteTemplate(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var tmpl WATemplate
	if err := h.db.Get(&tmpl, "SELECT * FROM wa_templates WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Template not found")
	}

	// Try to delete from Gupshup
	client, settings, clientErr := h.getClient(accountID)
	if clientErr == nil && tmpl.Name != "" {
		if delErr := client.DeleteTemplate(settings.GupshupAppID, tmpl.Name); delErr != nil {
			log.Printf("[whatsapp] Warning: failed to delete template from Gupshup: %v", delErr)
		}
	}

	// Delete from local DB
	if _, err := h.db.Exec("DELETE FROM wa_templates WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.InternalError(c, "Failed to delete template")
	}

	return response.Success(c, map[string]interface{}{"deleted": true})
}

// ============================================================
// Campaign Handlers
// ============================================================

func (h *WhatsAppHandler) ListCampaigns(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	status := c.QueryParam("status")

	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int
	h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM wa_campaigns WHERE %s", where), args...)

	args = append(args, perPage, offset)
	var campaigns []WACampaign
	err := h.db.Select(&campaigns, fmt.Sprintf(
		"SELECT * FROM wa_campaigns WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	), args...)
	if err != nil {
		log.Printf("[whatsapp] Failed to fetch campaigns: %v", err)
		return response.InternalError(c, "Failed to fetch campaigns")
	}

	if campaigns == nil {
		campaigns = []WACampaign{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"results":  campaigns,
			"total":    total,
			"page":     page,
			"per_page": perPage,
		},
	})
}

func (h *WhatsAppHandler) GetCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign WACampaign
	if err := h.db.Get(&campaign, "SELECT * FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	// Fetch message breakdown
	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM wa_campaign_messages WHERE campaign_id = $1
		GROUP BY status
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}

	// Fetch individual recipient messages with contact details
	type RecipientRow struct {
		ID           int        `json:"id" db:"id"`
		ContactID    int        `json:"contact_id" db:"contact_id"`
		Phone        string     `json:"phone" db:"phone"`
		ContactName  string     `json:"contact_name" db:"contact_name"`
		Status       string     `json:"status" db:"status"`
		ErrorReason  string     `json:"error_reason" db:"error_reason"`
		SubmittedAt  *time.Time `json:"submitted_at" db:"submitted_at"`
		DeliveredAt  *time.Time `json:"delivered_at" db:"delivered_at"`
		ReadAt       *time.Time `json:"read_at" db:"read_at"`
		FailedAt     *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	}
	var recipients []RecipientRow
	h.db.Select(&recipients, `
		SELECT wcm.id, wcm.contact_id, wc.phone, wc.name AS contact_name,
		       wcm.status, wcm.error_reason, wcm.submitted_at,
		       wcm.delivered_at, wcm.read_at, wcm.failed_at, wcm.created_at
		FROM wa_campaign_messages wcm
		JOIN wa_contacts wc ON wc.id = wcm.contact_id
		WHERE wcm.campaign_id = $1
		ORDER BY wcm.created_at DESC
		LIMIT 500
	`, id)

	if recipients == nil {
		recipients = []RecipientRow{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"recipients":       recipients,
	})
}

func (h *WhatsAppHandler) CreateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var req struct {
		Name           string          `json:"name"`
		TemplateID     *int            `json:"template_id"`
		TargetFilter   json.RawMessage `json:"target_filter"`
		TemplateParams json.RawMessage `json:"template_params"`
		ScheduledAt    *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Campaign name is required")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}
	templateParams := req.TemplateParams
	if templateParams == nil {
		templateParams = json.RawMessage("[]")
	}

	var campaign WACampaign
	err := h.db.Get(&campaign, `
		INSERT INTO wa_campaigns (account_id, name, template_id, target_filter, template_params, scheduled_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING *
	`, accountID, req.Name, req.TemplateID, targetFilter, templateParams, req.ScheduledAt, userID)
	if err != nil {
		log.Printf("[whatsapp] Failed to create campaign: %v", err)
		return response.InternalError(c, "Failed to create campaign")
	}

	return response.Created(c, campaign)
}

func (h *WhatsAppHandler) UpdateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Only allow editing draft campaigns
	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" {
		return response.BadRequest(c, "Only draft campaigns can be edited")
	}

	var req struct {
		Name           string          `json:"name"`
		TemplateID     *int            `json:"template_id"`
		TargetFilter   json.RawMessage `json:"target_filter"`
		TemplateParams json.RawMessage `json:"template_params"`
		ScheduledAt    *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}
	templateParams := req.TemplateParams
	if templateParams == nil {
		templateParams = json.RawMessage("[]")
	}

	_, err2 := h.db.Exec(`
		UPDATE wa_campaigns SET name = $1, template_id = $2, target_filter = $3, template_params = $4, scheduled_at = $5, updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.TemplateID, targetFilter, templateParams, req.ScheduledAt, id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to update campaign")
	}

	return response.SuccessWithMessage(c, "Campaign updated", nil)
}

func (h *WhatsAppHandler) DeleteCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Only allow deleting draft/cancelled campaigns
	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" && currentStatus != "cancelled" && currentStatus != "failed" {
		return response.BadRequest(c, "Only draft, cancelled, or failed campaigns can be deleted")
	}

	_, err2 := h.db.Exec("DELETE FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to delete campaign")
	}

	return response.SuccessWithMessage(c, "Campaign deleted", nil)
}

func (h *WhatsAppHandler) TestCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Phone string `json:"phone"`
	}
	if err := c.Bind(&req); err != nil || req.Phone == "" {
		return response.BadRequest(c, "Phone number is required")
	}

	// Get campaign and template
	var campaign WACampaign
	if err := h.db.Get(&campaign, "SELECT * FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.TemplateID == nil {
		return response.BadRequest(c, "Campaign has no template assigned")
	}

	var tmpl WATemplate
	if err := h.db.Get(&tmpl, "SELECT * FROM wa_templates WHERE id = $1 AND account_id = $2", *campaign.TemplateID, accountID); err != nil {
		return response.NotFound(c, "Template not found")
	}

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	// Build template JSON
	templateJSON := fmt.Sprintf(`{"id":"%s","params":[]}`, tmpl.GupshupID)

	phone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, " ", ""), "-", ""), "+", "")
	result, err := client.SendTemplateMessage(phone, templateJSON)
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to send test message: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"message_id": result.MessageID,
		"status":     result.Status,
	})
}

// SendCampaign starts sending a campaign to all matching contacts.
func (h *WhatsAppHandler) SendCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign WACampaign
	if err := h.db.Get(&campaign, "SELECT * FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.Status != "draft" && campaign.Status != "paused" {
		return response.BadRequest(c, "Campaign must be in draft or paused status to send")
	}

	if campaign.TemplateID == nil {
		return response.BadRequest(c, "Campaign has no template assigned")
	}

	var tmpl WATemplate
	if err := h.db.Get(&tmpl, "SELECT * FROM wa_templates WHERE id = $1", *campaign.TemplateID); err != nil {
		return response.NotFound(c, "Template not found")
	}

	if tmpl.Status != "approved" && tmpl.Status != "APPROVED" {
		return response.BadRequest(c, "Template must be approved before sending")
	}

	// Count target contacts (opted-in only)
	var targetCount int
	h.db.Get(&targetCount, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND opted_in = true", accountID)

	if targetCount == 0 {
		return response.BadRequest(c, "No opted-in contacts to send to")
	}

	// Update campaign status
	now := time.Now()
	h.db.Exec(`
		UPDATE wa_campaigns SET status = 'sending', total_targets = $1, started_at = $2, updated_at = NOW()
		WHERE id = $3
	`, targetCount, now, campaign.ID)

	// Launch sending in background goroutine
	go h.executeCampaignSend(campaign.ID, accountID, tmpl)

	return response.Success(c, map[string]interface{}{
		"status":        "sending",
		"total_targets": targetCount,
	})
}

// executeCampaignSend runs in background and sends messages to all contacts.
func (h *WhatsAppHandler) executeCampaignSend(campaignID, accountID int, tmpl WATemplate) {
	client, settings, err := h.getClient(accountID)
	if err != nil {
		log.Printf("[whatsapp] Campaign %d: failed to get client: %v", campaignID, err)
		h.db.Exec("UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// Fetch campaign to get template_params
	var campaign WACampaign
	if err := h.db.Get(&campaign, "SELECT * FROM wa_campaigns WHERE id = $1", campaignID); err != nil {
		log.Printf("[whatsapp] Campaign %d: failed to fetch campaign: %v", campaignID, err)
		h.db.Exec("UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// Parse template params from campaign
	type TemplateParam struct {
		Index int    `json:"index"`
		Field string `json:"field"`
		Value string `json:"value"`
	}
	var templateParams []TemplateParam
	if campaign.TemplateParams != nil && string(campaign.TemplateParams) != "null" {
		json.Unmarshal(campaign.TemplateParams, &templateParams)
	}

	// Get all opted-in contacts
	var contacts []WAContact
	if err := h.db.Select(&contacts, "SELECT * FROM wa_contacts WHERE account_id = $1 AND opted_in = true", accountID); err != nil {
		log.Printf("[whatsapp] Campaign %d: failed to fetch contacts: %v", campaignID, err)
		h.db.Exec("UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	sendRate := settings.SendRate
	if sendRate <= 0 {
		sendRate = 10
	}

	// Rate limiter: send N messages per second
	ticker := time.NewTicker(time.Second / time.Duration(sendRate))
	defer ticker.Stop()

	var mu sync.Mutex
	sentCount := 0
	failedCount := 0

	for _, contact := range contacts {
		<-ticker.C

		// Check if campaign was paused/cancelled
		var status string
		h.db.Get(&status, "SELECT status FROM wa_campaigns WHERE id = $1", campaignID)
		if status == "paused" || status == "cancelled" {
			log.Printf("[whatsapp] Campaign %d: %s by user", campaignID, status)
			return
		}

		// Insert message record
		var msgID int
		err := h.db.Get(&msgID, `
			INSERT INTO wa_campaign_messages (campaign_id, contact_id, status)
			VALUES ($1, $2, 'queued') RETURNING id
		`, campaignID, contact.ID)
		if err != nil {
			log.Printf("[whatsapp] Campaign %d: failed to create message record: %v", campaignID, err)
			continue
		}

		// Build per-contact template params
		var params []string
		for _, p := range templateParams {
			val := p.Value
			// Replace contact field placeholders
			if p.Field != "" {
				switch p.Field {
				case "name":
					val = contact.Name
				case "phone":
					val = contact.Phone
				case "email":
					val = contact.Email
				default:
					// Check contact attributes for custom fields
					if contact.Attributes != nil {
						var attrs map[string]string
						if jsonErr := json.Unmarshal(contact.Attributes, &attrs); jsonErr == nil {
							if attrVal, ok := attrs[p.Field]; ok {
								val = attrVal
							}
						}
					}
				}
			}
			if val == "" {
				val = p.Value // Fallback to static value
			}
			params = append(params, val)
		}

		paramsJSON, _ := json.Marshal(params)
		templateJSON := fmt.Sprintf(`{"id":"%s","params":%s}`, tmpl.GupshupID, string(paramsJSON))

		// Send via Gupshup
		result, err := client.SendTemplateMessage(contact.Phone, templateJSON)
		if err != nil {
			log.Printf("[whatsapp] Campaign %d: failed to send to %s: %v", campaignID, contact.Phone, err)
			h.db.Exec(`
				UPDATE wa_campaign_messages SET status = 'failed', error_reason = $1, failed_at = NOW() WHERE id = $2
			`, err.Error(), msgID)
			mu.Lock()
			failedCount++
			mu.Unlock()
			continue
		}

		// Update message with Gupshup message ID
		h.db.Exec(`
			UPDATE wa_campaign_messages SET gupshup_msg_id = $1, status = 'submitted', submitted_at = NOW() WHERE id = $2
		`, result.MessageID, msgID)

		mu.Lock()
		sentCount++
		mu.Unlock()

		// Update campaign counters periodically (every 50 messages)
		if (sentCount+failedCount)%50 == 0 {
			h.db.Exec(`
				UPDATE wa_campaigns SET sent_count = $1, failed_count = $2, updated_at = NOW() WHERE id = $3
			`, sentCount, failedCount, campaignID)
		}
	}

	// Final update
	h.db.Exec(`
		UPDATE wa_campaigns SET
			status = 'sent',
			sent_count = $1,
			failed_count = $2,
			completed_at = NOW(),
			updated_at = NOW()
		WHERE id = $3
	`, sentCount, failedCount, campaignID)

	log.Printf("[whatsapp] Campaign %d: completed. Sent: %d, Failed: %d", campaignID, sentCount, failedCount)
}

func (h *WhatsAppHandler) PauseCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE wa_campaigns SET status = 'paused', updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'sending'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to pause campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.BadRequest(c, "Campaign is not currently sending")
	}

	return response.SuccessWithMessage(c, "Campaign paused", nil)
}

// ============================================================
// Analytics Handlers
// ============================================================

func (h *WhatsAppHandler) GetOverview(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts int `json:"total_contacts" db:"total_contacts"`
		OptedIn       int `json:"opted_in" db:"opted_in"`
		TotalCampaigns int `json:"total_campaigns" db:"total_campaigns"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.TotalCampaigns, "SELECT COUNT(*) FROM wa_campaigns WHERE account_id = $1", accountID)

	// Aggregate message stats across all campaigns for this account
	var msgStats struct {
		TotalSent      int `json:"total_sent" db:"total_sent"`
		TotalDelivered int `json:"total_delivered" db:"total_delivered"`
		TotalRead      int `json:"total_read" db:"total_read"`
		TotalFailed    int `json:"total_failed" db:"total_failed"`
	}

	h.db.Get(&msgStats, `
		SELECT
			COALESCE(SUM(sent_count), 0) as total_sent,
			COALESCE(SUM(delivered_count), 0) as total_delivered,
			COALESCE(SUM(read_count), 0) as total_read,
			COALESCE(SUM(failed_count), 0) as total_failed
		FROM wa_campaigns WHERE account_id = $1
	`, accountID)

	// Recent campaigns
	var recent []WACampaign
	h.db.Select(&recent, `
		SELECT * FROM wa_campaigns WHERE account_id = $1
		ORDER BY created_at DESC LIMIT 5
	`, accountID)

	if recent == nil {
		recent = []WACampaign{}
	}

	return response.Success(c, map[string]interface{}{
		"contacts":         stats,
		"messages":         msgStats,
		"recent_campaigns": recent,
	})
}

func (h *WhatsAppHandler) GetCampaignAnalytics(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign WACampaign
	if err := h.db.Get(&campaign, "SELECT * FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	// Status breakdown
	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM wa_campaign_messages WHERE campaign_id = $1
		GROUP BY status ORDER BY count DESC
	`, id)

	// Recent failed messages with reason
	var failedMessages []struct {
		Phone       string `json:"phone" db:"phone"`
		ErrorReason string `json:"error_reason" db:"error_reason"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	}
	h.db.Select(&failedMessages, `
		SELECT wc.phone, wcm.error_reason, wcm.failed_at
		FROM wa_campaign_messages wcm
		JOIN wa_contacts wc ON wc.id = wcm.contact_id
		WHERE wcm.campaign_id = $1 AND wcm.status = 'failed'
		ORDER BY wcm.failed_at DESC LIMIT 50
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}
	if failedMessages == nil {
		failedMessages = []struct {
			Phone       string `json:"phone" db:"phone"`
			ErrorReason string `json:"error_reason" db:"error_reason"`
			FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		}{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"failed_messages":  failedMessages,
	})
}

// ============================================================
// Webhook Handler — Public endpoint for Gupshup delivery reports
// ============================================================

func (h *WhatsAppHandler) WebhookReceive(c echo.Context) error {
	secret := c.Param("secret")
	if secret == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing secret"})
	}

	// Validate the secret matches some account
	var accountID int
	err := h.db.Get(&accountID, "SELECT account_id FROM wa_settings WHERE webhook_secret = $1", secret)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid webhook secret"})
	}

	// Parse the Gupshup webhook payload
	var payload struct {
		App       string `json:"app"`
		Timestamp int64  `json:"timestamp"`
		Version   int    `json:"version"`
		Type      string `json:"type"`
		Payload   struct {
			ID          string `json:"id"`
			GsID        string `json:"gsId"`
			Type        string `json:"type"`
			Destination string `json:"destination"`
			Payload     json.RawMessage `json:"payload"`
		} `json:"payload"`
	}

	if err := c.Bind(&payload); err != nil {
		log.Printf("[whatsapp-webhook] Failed to parse payload: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}

	log.Printf("[whatsapp-webhook] Received event type=%s, payload.type=%s, payload.id=%s, payload.gsId=%s, destination=%s",
		payload.Type, payload.Payload.Type, payload.Payload.ID, payload.Payload.GsID, payload.Payload.Destination)

	if payload.Type != "message-event" {
		log.Printf("[whatsapp-webhook] Ignoring non-message-event: %s", payload.Type)
		return c.JSON(http.StatusOK, map[string]string{"status": "ignored"})
	}

	msgID := payload.Payload.ID
	eventType := payload.Payload.Type

	if msgID == "" {
		log.Printf("[whatsapp-webhook] No message ID in payload")
		return c.JSON(http.StatusOK, map[string]string{"status": "no message id"})
	}

	now := time.Now()

	// Try to match by gupshup_msg_id first
	var campaignMsgID int
	var campaignID int
	err = h.db.QueryRow(`
		SELECT wcm.id, wcm.campaign_id FROM wa_campaign_messages wcm
		WHERE wcm.gupshup_msg_id = $1
		LIMIT 1
	`, msgID).Scan(&campaignMsgID, &campaignID)

	if err != nil {
		// Message not found — might be a non-campaign message or the gsId
		// Try with gsId
		if payload.Payload.GsID != "" {
			err = h.db.QueryRow(`
				SELECT wcm.id, wcm.campaign_id FROM wa_campaign_messages wcm
				WHERE wcm.gupshup_msg_id = $1
				LIMIT 1
			`, payload.Payload.GsID).Scan(&campaignMsgID, &campaignID)
		}
		if err != nil {
			log.Printf("[whatsapp-webhook] No matching message found for id=%s gsId=%s event=%s payload=%s", msgID, payload.Payload.GsID, eventType, string(payload.Payload.Payload))
			return c.JSON(http.StatusOK, map[string]string{"status": "no matching message"})
		}
	}

	log.Printf("[whatsapp-webhook] Matched campaign_msg_id=%d campaign_id=%d event=%s", campaignMsgID, campaignID, eventType)

	// Update message status based on event type
	switch eventType {
	case "enqueued":
		// Extract WhatsApp message ID from inner payload if present
		var innerPayload struct {
			WhatsappMessageID string `json:"whatsappMessageId"`
		}
		json.Unmarshal(payload.Payload.Payload, &innerPayload)

		h.db.Exec(`
			UPDATE wa_campaign_messages SET status = 'enqueued', enqueued_at = $1, wa_msg_id = $2 WHERE id = $3
		`, now, innerPayload.WhatsappMessageID, campaignMsgID)

	case "sent":
		h.db.Exec("UPDATE wa_campaign_messages SET status = 'sent', sent_at = $1 WHERE id = $2", now, campaignMsgID)
		h.db.Exec("UPDATE wa_campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1", campaignID)

	case "delivered":
		h.db.Exec("UPDATE wa_campaign_messages SET status = 'delivered', delivered_at = $1 WHERE id = $2", now, campaignMsgID)
		h.db.Exec("UPDATE wa_campaigns SET delivered_count = delivered_count + 1, updated_at = NOW() WHERE id = $1", campaignID)

	case "read":
		h.db.Exec("UPDATE wa_campaign_messages SET status = 'read', read_at = $1 WHERE id = $2", now, campaignMsgID)
		h.db.Exec("UPDATE wa_campaigns SET read_count = read_count + 1, updated_at = NOW() WHERE id = $1", campaignID)

	case "failed":
		var innerPayload struct {
			Code   int    `json:"code"`
			Reason string `json:"reason"`
		}
		json.Unmarshal(payload.Payload.Payload, &innerPayload)
		reason := innerPayload.Reason
		if reason == "" {
			reason = fmt.Sprintf("error code: %d", innerPayload.Code)
		}
		log.Printf("[whatsapp-webhook] FAILED: code=%d reason=%s rawPayload=%s", innerPayload.Code, reason, string(payload.Payload.Payload))

		h.db.Exec(`
			UPDATE wa_campaign_messages SET status = 'failed', error_reason = $1, failed_at = $2 WHERE id = $3
		`, reason, now, campaignMsgID)
		h.db.Exec("UPDATE wa_campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1", campaignID)
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// ============================================================
// Contact Group Handlers
// ============================================================

type WAContactGroup struct {
	ID          int       `json:"id" db:"id"`
	AccountID   int       `json:"account_id" db:"account_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Color       string    `json:"color" db:"color"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type WAContactGroupWithCount struct {
	WAContactGroup
	MemberCount int `json:"member_count" db:"member_count"`
}

// ListGroups returns all contact groups for the account.
func (h *WhatsAppHandler) ListGroups(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var groups []WAContactGroupWithCount
	err := h.db.Select(&groups, `
		SELECT g.*, COALESCE(m.cnt, 0) AS member_count
		FROM wa_contact_groups g
		LEFT JOIN (SELECT group_id, COUNT(*) AS cnt FROM wa_contact_group_members GROUP BY group_id) m
			ON m.group_id = g.id
		WHERE g.account_id = $1
		ORDER BY g.name ASC
	`, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to fetch groups")
	}
	if groups == nil {
		groups = []WAContactGroupWithCount{}
	}

	return response.Success(c, groups)
}

// GetGroup returns a single contact group.
func (h *WhatsAppHandler) GetGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var group WAContactGroup
	if err := h.db.Get(&group, "SELECT * FROM wa_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var memberCount int
	h.db.Get(&memberCount, "SELECT COUNT(*) FROM wa_contact_group_members WHERE group_id = $1", id)

	return response.Success(c, map[string]interface{}{
		"group":        group,
		"member_count": memberCount,
	})
}

// CreateGroup creates a new contact group.
func (h *WhatsAppHandler) CreateGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Group name is required")
	}
	if req.Color == "" {
		req.Color = "#25D366"
	}

	var group WAContactGroup
	err := h.db.Get(&group, `
		INSERT INTO wa_contact_groups (account_id, name, description, color)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`, accountID, req.Name, req.Description, req.Color)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			return response.BadRequest(c, "A group with this name already exists")
		}
		return response.InternalError(c, "Failed to create group")
	}

	return response.Created(c, group)
}

// UpdateGroup updates a contact group.
func (h *WhatsAppHandler) UpdateGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Group name is required")
	}

	result, err2 := h.db.Exec(`
		UPDATE wa_contact_groups SET name = $1, description = $2, color = $3, updated_at = NOW()
		WHERE id = $4 AND account_id = $5
	`, req.Name, req.Description, req.Color, id, accountID)
	if err2 != nil {
		if strings.Contains(err2.Error(), "duplicate key") || strings.Contains(err2.Error(), "unique") {
			return response.BadRequest(c, "A group with this name already exists")
		}
		return response.InternalError(c, "Failed to update group")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Group not found")
	}

	return response.SuccessWithMessage(c, "Group updated", nil)
}

// DeleteGroup deletes a contact group.
func (h *WhatsAppHandler) DeleteGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err2 := h.db.Exec("DELETE FROM wa_contact_groups WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to delete group")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Group not found")
	}

	return response.SuccessWithMessage(c, "Group deleted", nil)
}

// ListGroupMembers returns paginated members of a contact group.
func (h *WhatsAppHandler) ListGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 25
	}
	offset := (page - 1) * perPage

	query := c.QueryParam("query")

	var total int
	var members []WAContact

	if query != "" {
		search := "%" + query + "%"
		h.db.Get(&total, `
			SELECT COUNT(*) FROM wa_contact_group_members gm
			JOIN wa_contacts wc ON wc.id = gm.contact_id
			WHERE gm.group_id = $1 AND (wc.phone ILIKE $2 OR wc.name ILIKE $2 OR wc.email ILIKE $2)
		`, id, search)
		h.db.Select(&members, `
			SELECT wc.* FROM wa_contact_group_members gm
			JOIN wa_contacts wc ON wc.id = gm.contact_id
			WHERE gm.group_id = $1 AND (wc.phone ILIKE $2 OR wc.name ILIKE $2 OR wc.email ILIKE $2)
			ORDER BY wc.name ASC, wc.phone ASC
			LIMIT $3 OFFSET $4
		`, id, search, perPage, offset)
	} else {
		h.db.Get(&total, "SELECT COUNT(*) FROM wa_contact_group_members WHERE group_id = $1", id)
		h.db.Select(&members, `
			SELECT wc.* FROM wa_contact_group_members gm
			JOIN wa_contacts wc ON wc.id = gm.contact_id
			WHERE gm.group_id = $1
			ORDER BY wc.name ASC, wc.phone ASC
			LIMIT $2 OFFSET $3
		`, id, perPage, offset)
	}

	if members == nil {
		members = []WAContact{}
	}

	return response.Success(c, map[string]interface{}{
		"results":  members,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// AddGroupMembers adds contacts to a group.
func (h *WhatsAppHandler) AddGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "contact_ids is required")
	}

	added := 0
	for _, cid := range req.ContactIDs {
		_, insertErr := h.db.Exec(`
			INSERT INTO wa_contact_group_members (group_id, contact_id)
			VALUES ($1, $2) ON CONFLICT DO NOTHING
		`, id, cid)
		if insertErr == nil {
			added++
		}
	}

	return response.Success(c, map[string]interface{}{
		"added": added,
	})
}

// RemoveGroupMembers removes contacts from a group.
func (h *WhatsAppHandler) RemoveGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "contact_ids is required")
	}

	removed := 0
	for _, cid := range req.ContactIDs {
		result, delErr := h.db.Exec("DELETE FROM wa_contact_group_members WHERE group_id = $1 AND contact_id = $2", id, cid)
		if delErr == nil {
			rows, _ := result.RowsAffected()
			removed += int(rows)
		}
	}

	return response.Success(c, map[string]interface{}{
		"removed": removed,
	})
}
