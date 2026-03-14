package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/aakashsms"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// SMSHandler manages all SMS marketing endpoints.
type SMSHandler struct {
	db *sqlx.DB
}

// NewSMSHandler creates a new SMS handler.
func NewSMSHandler(db *sqlx.DB) *SMSHandler {
	return &SMSHandler{db: db}
}

// ============================================================
// Models
// ============================================================

type SMSSettings struct {
	ID        int       `json:"id" db:"id"`
	AccountID int       `json:"account_id" db:"account_id"`
	AuthToken string    `json:"auth_token" db:"auth_token"`
	SenderID  string    `json:"sender_id" db:"sender_id"`
	SendRate  int       `json:"send_rate" db:"send_rate"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type SMSContact struct {
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

type SMSCampaign struct {
	ID             int             `json:"id" db:"id"`
	AccountID      int             `json:"account_id" db:"account_id"`
	Name           string          `json:"name" db:"name"`
	MessageText    string          `json:"message_text" db:"message_text"`
	Status         string          `json:"status" db:"status"`
	TargetFilter   json.RawMessage `json:"target_filter" db:"target_filter"`
	TotalTargets   int             `json:"total_targets" db:"total_targets"`
	SentCount      int             `json:"sent_count" db:"sent_count"`
	DeliveredCount int             `json:"delivered_count" db:"delivered_count"`
	FailedCount    int             `json:"failed_count" db:"failed_count"`
	CreditsUsed    int             `json:"credits_used" db:"credits_used"`
	ScheduledAt    *time.Time      `json:"scheduled_at" db:"scheduled_at"`
	StartedAt      *time.Time      `json:"started_at" db:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at" db:"completed_at"`
	CreatedBy      *int            `json:"created_by" db:"created_by"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type SMSCampaignMessage struct {
	ID          int        `json:"id" db:"id"`
	CampaignID  int        `json:"campaign_id" db:"campaign_id"`
	ContactID   int        `json:"contact_id" db:"contact_id"`
	AakashMsgID string     `json:"aakash_msg_id" db:"aakash_msg_id"`
	Status      string     `json:"status" db:"status"`
	Network     string     `json:"network" db:"network"`
	Credits     int        `json:"credits" db:"credits"`
	ErrorReason string     `json:"error_reason" db:"error_reason"`
	SubmittedAt *time.Time `json:"submitted_at" db:"submitted_at"`
	DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
	FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// phone validation regex: 10 digits starting with 9
var smsPhoneRegex = regexp.MustCompile(`^9\d{9}$`)

// helper to build an Aakash SMS client from account settings
func (h *SMSHandler) getClient(accountID int) (*aakashsms.Client, *SMSSettings, error) {
	var settings SMSSettings
	err := h.db.Get(&settings, "SELECT * FROM sms_settings WHERE account_id = $1", accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("SMS settings not configured")
	}
	if settings.AuthToken == "" {
		return nil, nil, fmt.Errorf("Aakash SMS auth token not set")
	}

	client := aakashsms.NewClient(settings.AuthToken)
	return client, &settings, nil
}

// ============================================================
// Settings Handlers
// ============================================================

// GetSettings returns the SMS settings for the current account.
func (h *SMSHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var settings SMSSettings
	err := h.db.Get(&settings, "SELECT * FROM sms_settings WHERE account_id = $1", accountID)
	if err != nil {
		return response.Success(c, map[string]interface{}{
			"configured": false,
		})
	}

	// Mask the auth token — show only last 8 chars
	masked := settings
	if len(masked.AuthToken) > 8 {
		masked.AuthToken = strings.Repeat("*", len(masked.AuthToken)-8) + masked.AuthToken[len(masked.AuthToken)-8:]
	}

	return response.Success(c, map[string]interface{}{
		"configured": true,
		"settings":   masked,
	})
}

// UpdateSettings upserts SMS settings for the current account.
func (h *SMSHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		AuthToken string `json:"auth_token"`
		SenderID  string `json:"sender_id"`
		SendRate  int    `json:"send_rate"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.SendRate <= 0 {
		req.SendRate = 10
	}

	_, err := h.db.Exec(`
		INSERT INTO sms_settings (account_id, auth_token, sender_id, send_rate, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			auth_token = CASE WHEN EXCLUDED.auth_token = '' THEN sms_settings.auth_token ELSE EXCLUDED.auth_token END,
			sender_id = EXCLUDED.sender_id,
			send_rate = EXCLUDED.send_rate,
			updated_at = NOW()
	`, accountID, req.AuthToken, req.SenderID, req.SendRate)
	if err != nil {
		log.Printf("[sms] Failed to save settings: %v", err)
		return response.InternalError(c, "Failed to save settings")
	}

	return response.SuccessWithMessage(c, "SMS settings saved", nil)
}

// TestConnection verifies the Aakash SMS auth token by fetching credit balance.
func (h *SMSHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	balance, err := client.TestConnection()
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Connection failed: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"connected":  true,
		"balance":    fmt.Sprintf("%d", balance.AvailableCredit),
		"total_sent": balance.TotalSMSSent,
	})
}

// ============================================================
// Contact Handlers
// ============================================================

// ListContacts returns a paginated list of SMS contacts with search and filters.
func (h *SMSHandler) ListContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
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
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM sms_contacts WHERE %s", where)
	if err := h.db.Get(&total, countSQL, args...); err != nil {
		log.Printf("[sms] Failed to count contacts: %v", err)
		return response.InternalError(c, "Failed to count contacts")
	}

	// Fetch page
	args = append(args, perPage, offset)
	dataSQL := fmt.Sprintf("SELECT * FROM sms_contacts WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argIdx, argIdx+1)

	var contacts []SMSContact
	if err := h.db.Select(&contacts, dataSQL, args...); err != nil {
		log.Printf("[sms] Failed to fetch contacts: %v", err)
		return response.InternalError(c, "Failed to fetch contacts")
	}

	if contacts == nil {
		contacts = []SMSContact{}
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

// CreateContact adds a new SMS contact.
func (h *SMSHandler) CreateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Phone      string          `json:"phone"`
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Phone == "" {
		return response.BadRequest(c, "Phone number is required")
	}

	// Clean phone: remove spaces, dashes, plus
	phone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, " ", ""), "-", ""), "+", "")
	// Strip leading 977 country code if present
	if strings.HasPrefix(phone, "977") && len(phone) == 13 {
		phone = phone[3:]
	}

	// Validate: 10 digits starting with 9
	if !smsPhoneRegex.MatchString(phone) {
		return response.BadRequest(c, "Phone number must be 10 digits starting with 9")
	}

	tags := req.Tags
	if tags == nil {
		tags = json.RawMessage("[]")
	}
	attrs := req.Attributes
	if attrs == nil {
		attrs = json.RawMessage("{}")
	}

	now := time.Now()
	var contact SMSContact
	err := h.db.Get(&contact, `
		INSERT INTO sms_contacts (account_id, phone, name, email, opted_in, opted_in_at, tags, attributes)
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
		log.Printf("[sms] Failed to create contact: %v", err)
		return response.InternalError(c, "Failed to create contact")
	}

	return response.Created(c, contact)
}

// UpdateContact updates an existing SMS contact.
func (h *SMSHandler) UpdateContact(c echo.Context) error {
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
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM sms_contacts WHERE id = $1 AND account_id = $2)", id, accountID)
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
		UPDATE sms_contacts SET name = $1, email = $2, opted_in = $3, tags = $4, attributes = $5, updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.Email, optedIn, tags, attrs, id, accountID)
	if err2 != nil {
		log.Printf("[sms] Failed to update contact: %v", err2)
		return response.InternalError(c, "Failed to update contact")
	}

	return response.SuccessWithMessage(c, "Contact updated", nil)
}

// DeleteContact removes an SMS contact.
func (h *SMSHandler) DeleteContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM sms_contacts WHERE id = $1 AND account_id = $2", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete contact")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Contact not found")
	}

	return response.SuccessWithMessage(c, "Contact deleted", nil)
}

// ImportContacts parses a CSV file and bulk inserts SMS contacts.
func (h *SMSHandler) ImportContacts(c echo.Context) error {
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

	imported := 0
	skipped := 0
	now := time.Now()

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
		// Strip leading 977 country code
		if strings.HasPrefix(phone, "977") && len(phone) == 13 {
			phone = phone[3:]
		}
		if phone == "" || !smsPhoneRegex.MatchString(phone) {
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
				parts := strings.Split(tagStr, ",")
				for i := range parts {
					parts[i] = strings.TrimSpace(parts[i])
				}
				tagJSON, _ := json.Marshal(parts)
				tags = string(tagJSON)
			}
		}

		_, err2 := h.db.Exec(`
			INSERT INTO sms_contacts (account_id, phone, name, email, opted_in, opted_in_at, tags)
			VALUES ($1, $2, $3, $4, true, $5, $6::jsonb)
			ON CONFLICT (account_id, phone) DO NOTHING
		`, accountID, phone, name, email, now, tags)
		if err2 != nil {
			log.Printf("[sms] Import row error: %v", err2)
			skipped++
			continue
		}
		imported++
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
	})
}

// ExportContacts exports all SMS contacts as a CSV file.
func (h *SMSHandler) ExportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var contacts []SMSContact
	if err := h.db.Select(&contacts, "SELECT * FROM sms_contacts WHERE account_id = $1 ORDER BY created_at DESC", accountID); err != nil {
		return response.InternalError(c, "Failed to fetch contacts")
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=sms_contacts.csv")

	writer := csv.NewWriter(c.Response().Writer)
	writer.Write([]string{"phone", "name", "email", "tags", "opted_in", "created_at"})

	for _, ct := range contacts {
		optedIn := "true"
		if !ct.OptedIn {
			optedIn = "false"
		}
		writer.Write([]string{
			ct.Phone,
			ct.Name,
			ct.Email,
			string(ct.Tags),
			optedIn,
			ct.CreatedAt.Format(time.RFC3339),
		})
	}

	writer.Flush()
	return nil
}

// ============================================================
// Contact Tags & Stats
// ============================================================

// ListContactTags returns all unique tags across SMS contacts with their counts.
func (h *SMSHandler) ListContactTags(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type TagRow struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tags []TagRow
	err := h.db.Select(&tags, `
		SELECT tag, COUNT(*) as count
		FROM sms_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`, accountID)
	if err != nil {
		log.Printf("[sms] Failed to fetch tags: %v", err)
	}

	if tags == nil {
		tags = []TagRow{}
	}

	return response.Success(c, tags)
}

// CreateContactTag adds a tag to multiple contacts.
func (h *SMSHandler) CreateContactTag(c echo.Context) error {
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
		for _, cid := range req.ContactIDs {
			result, err := h.db.Exec(`
				UPDATE sms_contacts
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
func (h *SMSHandler) DeleteContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	tag := c.Param("tag")

	if tag == "" {
		return response.BadRequest(c, "Tag is required")
	}

	result, err := h.db.Exec(`
		UPDATE sms_contacts
		SET tags = tags - $1, updated_at = NOW()
		WHERE account_id = $2 AND tags @> to_jsonb($1::text)
	`, tag, accountID)
	if err != nil {
		log.Printf("[sms] Failed to delete tag: %v", err)
		return response.InternalError(c, "Failed to delete tag")
	}

	removed, _ := result.RowsAffected()

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"removed": removed,
	})
}

// GetContactStats returns contact statistics for the SMS module.
func (h *SMSHandler) GetContactStats(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts int `json:"total_contacts" db:"total_contacts"`
		OptedIn       int `json:"opted_in" db:"opted_in"`
		OptedOut      int `json:"opted_out" db:"opted_out"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.OptedOut, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1 AND opted_in = false", accountID)

	// Tags breakdown
	type TagStat struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tagStats []TagStat
	h.db.Select(&tagStats, `
		SELECT tag, COUNT(*) as count
		FROM sms_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag ORDER BY count DESC LIMIT 20
	`, accountID)
	if tagStats == nil {
		tagStats = []TagStat{}
	}

	// Recent additions (last 30 days)
	var recentCount int
	h.db.Get(&recentCount, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days'", accountID)

	return response.Success(c, map[string]interface{}{
		"total_contacts": stats.TotalContacts,
		"opted_in":       stats.OptedIn,
		"opted_out":      stats.OptedOut,
		"tags":           tagStats,
		"recent_30d":     recentCount,
	})
}

// ============================================================
// Campaign Handlers
// ============================================================

// ListCampaigns returns a paginated list of SMS campaigns.
func (h *SMSHandler) ListCampaigns(c echo.Context) error {
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
	query := strings.TrimSpace(c.QueryParam("query"))

	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	if query != "" {
		where += fmt.Sprintf(" AND name ILIKE $%d", argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}

	var total int
	h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM sms_campaigns WHERE %s", where), args...)

	args = append(args, perPage, offset)
	var campaigns []SMSCampaign
	err := h.db.Select(&campaigns, fmt.Sprintf(
		"SELECT * FROM sms_campaigns WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	), args...)
	if err != nil {
		log.Printf("[sms] Failed to fetch campaigns: %v", err)
		return response.InternalError(c, "Failed to fetch campaigns")
	}

	if campaigns == nil {
		campaigns = []SMSCampaign{}
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

// GetCampaign returns a single SMS campaign with status breakdown and recipients.
func (h *SMSHandler) GetCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign SMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	// Fetch message status breakdown
	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM sms_campaign_messages WHERE campaign_id = $1
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
		ID          int        `json:"id" db:"id"`
		ContactID   int        `json:"contact_id" db:"contact_id"`
		Phone       string     `json:"phone" db:"phone"`
		ContactName string     `json:"contact_name" db:"contact_name"`
		Status      string     `json:"status" db:"status"`
		Network     string     `json:"network" db:"network"`
		Credits     int        `json:"credits" db:"credits"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		SubmittedAt *time.Time `json:"submitted_at" db:"submitted_at"`
		DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	}
	var recipients []RecipientRow
	h.db.Select(&recipients, `
		SELECT scm.id, scm.contact_id, sc.phone, sc.name AS contact_name,
		       scm.status, scm.network, scm.credits, scm.error_reason,
		       scm.submitted_at, scm.delivered_at, scm.failed_at, scm.created_at
		FROM sms_campaign_messages scm
		JOIN sms_contacts sc ON sc.id = scm.contact_id
		WHERE scm.campaign_id = $1
		ORDER BY scm.created_at DESC
		LIMIT 500
	`, id)

	if recipients == nil {
		recipients = []RecipientRow{}
	}

	// Network breakdown
	type NetworkBreakdown struct {
		Network string `json:"network" db:"network"`
		Count   int    `json:"count" db:"count"`
		Credits int    `json:"credits" db:"credits"`
	}
	var networkBreakdown []NetworkBreakdown
	h.db.Select(&networkBreakdown, `
		SELECT COALESCE(NULLIF(network, ''), 'Unknown') as network,
		       COUNT(*) as count, COALESCE(SUM(credits), 0) as credits
		FROM sms_campaign_messages WHERE campaign_id = $1
		GROUP BY COALESCE(NULLIF(network, ''), 'Unknown') ORDER BY count DESC
	`, id)
	if networkBreakdown == nil {
		networkBreakdown = []NetworkBreakdown{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":           campaign,
		"status_breakdown":   statusBreakdown,
		"network_breakdown":  networkBreakdown,
		"recipients":         recipients,
	})
}

// CreateCampaign creates a new SMS campaign in draft status.
func (h *SMSHandler) CreateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		TargetFilter json.RawMessage `json:"target_filter"`
		ScheduledAt  *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Campaign name is required")
	}
	if req.MessageText == "" {
		return response.BadRequest(c, "Message text is required")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}

	var campaign SMSCampaign
	err := h.db.Get(&campaign, `
		INSERT INTO sms_campaigns (account_id, name, message_text, target_filter, scheduled_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *
	`, accountID, req.Name, req.MessageText, targetFilter, req.ScheduledAt, userID)
	if err != nil {
		log.Printf("[sms] Failed to create campaign: %v", err)
		return response.InternalError(c, "Failed to create campaign")
	}

	return response.Created(c, campaign)
}

// UpdateCampaign updates a draft SMS campaign.
func (h *SMSHandler) UpdateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Only allow editing draft campaigns
	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" {
		return response.BadRequest(c, "Only draft campaigns can be edited")
	}

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		TargetFilter json.RawMessage `json:"target_filter"`
		ScheduledAt  *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}

	_, err2 := h.db.Exec(`
		UPDATE sms_campaigns SET name = $1, message_text = $2, target_filter = $3, scheduled_at = $4, updated_at = NOW()
		WHERE id = $5 AND account_id = $6
	`, req.Name, req.MessageText, targetFilter, req.ScheduledAt, id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to update campaign")
	}

	return response.SuccessWithMessage(c, "Campaign updated", nil)
}

// DeleteCampaign deletes a draft SMS campaign.
func (h *SMSHandler) DeleteCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Only allow deleting draft campaigns
	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" {
		return response.BadRequest(c, "Only draft campaigns can be deleted")
	}

	_, err2 := h.db.Exec("DELETE FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to delete campaign")
	}

	return response.SuccessWithMessage(c, "Campaign deleted", nil)
}

// SendCampaign starts sending an SMS campaign to all matching contacts.
func (h *SMSHandler) SendCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign SMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.Status != "draft" && campaign.Status != "scheduled" {
		return response.BadRequest(c, "Campaign must be in draft or scheduled status to send")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	// Get settings to verify configuration
	_, settings, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}
	_ = settings

	// Query opted-in contacts matching target filter
	contactQuery := "SELECT * FROM sms_contacts WHERE account_id = $1 AND opted_in = true"
	contactArgs := []interface{}{accountID}

	// Apply target filter if present
	if campaign.TargetFilter != nil && string(campaign.TargetFilter) != "{}" && string(campaign.TargetFilter) != "null" {
		var filter struct {
			Tags []string `json:"tags"`
		}
		if jsonErr := json.Unmarshal(campaign.TargetFilter, &filter); jsonErr == nil && len(filter.Tags) > 0 {
			tagJSON, _ := json.Marshal(filter.Tags)
			contactQuery += " AND tags @> $2::jsonb"
			contactArgs = append(contactArgs, string(tagJSON))
		}
	}

	var contacts []SMSContact
	if err := h.db.Select(&contacts, contactQuery, contactArgs...); err != nil {
		log.Printf("[sms] Campaign %s: failed to fetch contacts: %v", id, err)
		return response.InternalError(c, "Failed to fetch target contacts")
	}

	if len(contacts) == 0 {
		return response.BadRequest(c, "No opted-in contacts to send to")
	}

	// Create campaign_messages rows for each contact
	for _, contact := range contacts {
		_, insertErr := h.db.Exec(`
			INSERT INTO sms_campaign_messages (campaign_id, contact_id, status)
			VALUES ($1, $2, 'queued')
		`, campaign.ID, contact.ID)
		if insertErr != nil {
			log.Printf("[sms] Campaign %s: failed to create message record for contact %d: %v", id, contact.ID, insertErr)
		}
	}

	// Update campaign status
	now := time.Now()
	h.db.Exec(`
		UPDATE sms_campaigns SET status = 'sending', total_targets = $1, started_at = $2, updated_at = NOW()
		WHERE id = $3
	`, len(contacts), now, campaign.ID)

	// Launch sending in background goroutine
	go h.executeCampaignSend(campaign.ID, accountID)

	return response.Success(c, map[string]interface{}{
		"status":        "sending",
		"total_targets": len(contacts),
	})
}

// executeCampaignSend runs in background and sends SMS messages to all queued contacts.
func (h *SMSHandler) executeCampaignSend(campaignID, accountID int) {
	client, settings, err := h.getClient(accountID)
	if err != nil {
		log.Printf("[sms] Campaign %d: failed to get client: %v", campaignID, err)
		h.db.Exec("UPDATE sms_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// Fetch campaign
	var campaign SMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM sms_campaigns WHERE id = $1", campaignID); err != nil {
		log.Printf("[sms] Campaign %d: failed to fetch campaign: %v", campaignID, err)
		h.db.Exec("UPDATE sms_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// Fetch queued messages with contact info
	type QueuedMessage struct {
		MessageID int    `db:"message_id"`
		ContactID int    `db:"contact_id"`
		Phone     string `db:"phone"`
	}
	var queuedMessages []QueuedMessage
	if err := h.db.Select(&queuedMessages, `
		SELECT scm.id AS message_id, scm.contact_id, sc.phone
		FROM sms_campaign_messages scm
		JOIN sms_contacts sc ON sc.id = scm.contact_id
		WHERE scm.campaign_id = $1 AND scm.status = 'queued'
		ORDER BY scm.id ASC
	`, campaignID); err != nil {
		log.Printf("[sms] Campaign %d: failed to fetch queued messages: %v", campaignID, err)
		h.db.Exec("UPDATE sms_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
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
	creditsUsed := 0

	for _, qm := range queuedMessages {
		<-ticker.C

		// Check if campaign was paused/cancelled
		var status string
		h.db.Get(&status, "SELECT status FROM sms_campaigns WHERE id = $1", campaignID)
		if status == "paused" || status == "cancelled" {
			log.Printf("[sms] Campaign %d: %s by user", campaignID, status)
			return
		}

		// Send via Aakash SMS
		result, err := client.SendSMS(qm.Phone, campaign.MessageText)
		if err != nil {
			log.Printf("[sms] Campaign %d: failed to send to %s: %v", campaignID, qm.Phone, err)
			h.db.Exec(`
				UPDATE sms_campaign_messages SET status = 'failed', error_reason = $1, failed_at = NOW() WHERE id = $2
			`, err.Error(), qm.MessageID)
			mu.Lock()
			failedCount++
			mu.Unlock()
			continue
		}

		// Extract message details from response
		aakashMsgID := ""
		network := ""
		credits := 0
		if len(result.Data.Valid) > 0 {
			v := result.Data.Valid[0]
			aakashMsgID = fmt.Sprintf("%d", v.ID)
			network = v.Network
			credits = v.Credit
		}

		// Update message with Aakash details
		h.db.Exec(`
			UPDATE sms_campaign_messages
			SET aakash_msg_id = $1, status = 'submitted', network = $2, credits = $3, submitted_at = NOW()
			WHERE id = $4
		`, aakashMsgID, network, credits, qm.MessageID)

		mu.Lock()
		sentCount++
		creditsUsed += credits
		mu.Unlock()

		// Update campaign counters periodically (every 50 messages)
		if (sentCount+failedCount)%50 == 0 {
			mu.Lock()
			h.db.Exec(`
				UPDATE sms_campaigns SET sent_count = $1, failed_count = $2, credits_used = $3, updated_at = NOW() WHERE id = $4
			`, sentCount, failedCount, creditsUsed, campaignID)
			mu.Unlock()
		}
	}

	// Final update
	h.db.Exec(`
		UPDATE sms_campaigns SET
			status = 'sent',
			sent_count = $1,
			failed_count = $2,
			credits_used = $3,
			completed_at = NOW(),
			updated_at = NOW()
		WHERE id = $4
	`, sentCount, failedCount, creditsUsed, campaignID)

	log.Printf("[sms] Campaign %d: completed. Sent: %d, Failed: %d, Credits: %d", campaignID, sentCount, failedCount, creditsUsed)
}

// TestCampaign sends a single test SMS using the campaign's message text.
func (h *SMSHandler) TestCampaign(c echo.Context) error {
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

	// Get campaign
	var campaign SMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	client, _, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}

	// Clean and validate phone
	phone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, " ", ""), "-", ""), "+", "")
	if strings.HasPrefix(phone, "977") && len(phone) == 13 {
		phone = phone[3:]
	}
	if !smsPhoneRegex.MatchString(phone) {
		return response.BadRequest(c, "Phone number must be 10 digits starting with 9")
	}

	result, err := client.SendSMS(phone, campaign.MessageText)
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to send test message: %v", err))
	}

	msgID := ""
	if len(result.Data.Valid) > 0 {
		msgID = fmt.Sprintf("%d", result.Data.Valid[0].ID)
	}

	credits := 0
	if len(result.Data.Valid) > 0 {
		credits = result.Data.Valid[0].Credit
	}

	return response.Success(c, map[string]interface{}{
		"message_id": msgID,
		"message":    result.Message,
		"status":     "submitted",
		"credits":    credits,
	})
}

// PauseCampaign pauses a currently sending campaign.
func (h *SMSHandler) PauseCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE sms_campaigns SET status = 'paused', updated_at = NOW()
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

// GetOverview returns aggregate SMS marketing statistics.
func (h *SMSHandler) GetOverview(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts  int `json:"total_contacts" db:"total_contacts"`
		OptedIn        int `json:"opted_in" db:"opted_in"`
		TotalCampaigns int `json:"total_campaigns" db:"total_campaigns"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM sms_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.TotalCampaigns, "SELECT COUNT(*) FROM sms_campaigns WHERE account_id = $1", accountID)

	// Aggregate message stats across all campaigns for this account
	var msgStats struct {
		TotalSent      int `json:"total_sent" db:"total_sent"`
		TotalDelivered int `json:"total_delivered" db:"total_delivered"`
		TotalFailed    int `json:"total_failed" db:"total_failed"`
		TotalCredits   int `json:"total_credits" db:"total_credits"`
	}

	h.db.Get(&msgStats, `
		SELECT
			COALESCE(SUM(sent_count), 0) as total_sent,
			COALESCE(SUM(delivered_count), 0) as total_delivered,
			COALESCE(SUM(failed_count), 0) as total_failed,
			COALESCE(SUM(credits_used), 0) as total_credits
		FROM sms_campaigns WHERE account_id = $1
	`, accountID)

	// Recent campaigns
	var recent []SMSCampaign
	h.db.Select(&recent, `
		SELECT * FROM sms_campaigns WHERE account_id = $1
		ORDER BY created_at DESC LIMIT 5
	`, accountID)

	if recent == nil {
		recent = []SMSCampaign{}
	}

	// Try to fetch credit balance from Aakash SMS
	var creditBalance int
	client, _, clientErr := h.getClient(accountID)
	if clientErr == nil {
		if bal, err := client.GetBalance(); err == nil {
			creditBalance = bal.AvailableCredit
		}
	}

	return response.Success(c, map[string]interface{}{
		"contacts":         stats,
		"messages":         msgStats,
		"recent_campaigns": recent,
		"credit_balance":   creditBalance,
	})
}

// GetCampaignAnalytics returns detailed analytics for a single SMS campaign.
func (h *SMSHandler) GetCampaignAnalytics(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign SMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	// Status breakdown
	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM sms_campaign_messages WHERE campaign_id = $1
		GROUP BY status ORDER BY count DESC
	`, id)

	// Recent failed messages with reason
	var failedMessages []struct {
		Phone       string     `json:"phone" db:"phone"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	}
	h.db.Select(&failedMessages, `
		SELECT sc.phone, scm.error_reason, scm.failed_at
		FROM sms_campaign_messages scm
		JOIN sms_contacts sc ON sc.id = scm.contact_id
		WHERE scm.campaign_id = $1 AND scm.status = 'failed'
		ORDER BY scm.failed_at DESC LIMIT 50
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}
	if failedMessages == nil {
		failedMessages = []struct {
			Phone       string     `json:"phone" db:"phone"`
			ErrorReason string     `json:"error_reason" db:"error_reason"`
			FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		}{}
	}

	// Network breakdown
	type NetworkStat struct {
		Network string `json:"network" db:"network"`
		Count   int    `json:"count" db:"count"`
		Credits int    `json:"credits" db:"credits"`
	}
	var networkBreakdown []NetworkStat
	h.db.Select(&networkBreakdown, `
		SELECT COALESCE(NULLIF(network, ''), 'Unknown') as network,
		       COUNT(*) as count, COALESCE(SUM(credits), 0) as credits
		FROM sms_campaign_messages WHERE campaign_id = $1
		GROUP BY COALESCE(NULLIF(network, ''), 'Unknown') ORDER BY count DESC
	`, id)
	if networkBreakdown == nil {
		networkBreakdown = []NetworkStat{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":          campaign,
		"status_breakdown":  statusBreakdown,
		"network_breakdown": networkBreakdown,
		"failed_messages":   failedMessages,
	})
}

// GetCreditBalance returns the current Aakash SMS credit balance.
func (h *SMSHandler) GetCreditBalance(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	bal, err := client.GetBalance()
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to fetch credit balance: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"credit_balance": bal.AvailableCredit,
	})
}

// ResumeCampaign resumes a paused campaign.
func (h *SMSHandler) ResumeCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE sms_campaigns SET status = 'sending', updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'paused'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to resume campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.BadRequest(c, "Campaign is not currently paused")
	}

	return response.SuccessWithMessage(c, "Campaign resumed", nil)
}

// GetAudienceCount returns the count of opted-in contacts matching a filter.
func (h *SMSHandler) GetAudienceCount(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var body struct {
		Tags []string `json:"tags"`
	}
	if err := c.Bind(&body); err != nil {
		// No filter — count all opted-in contacts
	}

	where := "account_id = $1 AND opted_in = true"
	args := []interface{}{accountID}

	if len(body.Tags) > 0 {
		tagJSON, _ := json.Marshal(body.Tags)
		where += " AND tags @> $2::jsonb"
		args = append(args, string(tagJSON))
	}

	var count int
	h.db.Get(&count, fmt.Sprintf("SELECT COUNT(*) FROM sms_contacts WHERE %s", where), args...)

	return response.Success(c, map[string]interface{}{
		"count": count,
	})
}
