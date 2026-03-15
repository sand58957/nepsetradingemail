package handlers

import (
	"encoding/csv"
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
	tgclient "github.com/sandeep/nepsetradingemail/backend/internal/services/telegram"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// TelegramHandler manages all Telegram marketing endpoints.
type TelegramHandler struct {
	db *sqlx.DB
}

// NewTelegramHandler creates a new Telegram handler.
func NewTelegramHandler(db *sqlx.DB) *TelegramHandler {
	return &TelegramHandler{db: db}
}

// ============================================================
// Models
// ============================================================

type TelegramSettings struct {
	ID            int       `json:"id" db:"id"`
	AccountID     int       `json:"account_id" db:"account_id"`
	BotToken      string    `json:"bot_token" db:"bot_token"`
	BotUsername   string    `json:"bot_username" db:"bot_username"`
	WebhookSecret string    `json:"webhook_secret" db:"webhook_secret"`
	SendRate      int       `json:"send_rate" db:"send_rate"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type TelegramContact struct {
	ID         int             `json:"id" db:"id"`
	AccountID  int             `json:"account_id" db:"account_id"`
	ChatID     int64           `json:"chat_id" db:"chat_id"`
	Username   string          `json:"username" db:"username"`
	FirstName  string          `json:"first_name" db:"first_name"`
	LastName   string          `json:"last_name" db:"last_name"`
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

type TelegramCampaign struct {
	ID             int             `json:"id" db:"id"`
	AccountID      int             `json:"account_id" db:"account_id"`
	Name           string          `json:"name" db:"name"`
	MessageText    string          `json:"message_text" db:"message_text"`
	MessageType    string          `json:"message_type" db:"message_type"`
	MediaURL       string          `json:"media_url" db:"media_url"`
	Buttons        json.RawMessage `json:"buttons" db:"buttons"`
	Status         string          `json:"status" db:"status"`
	TargetFilter   json.RawMessage `json:"target_filter" db:"target_filter"`
	TotalTargets   int             `json:"total_targets" db:"total_targets"`
	SentCount      int             `json:"sent_count" db:"sent_count"`
	DeliveredCount int             `json:"delivered_count" db:"delivered_count"`
	FailedCount    int             `json:"failed_count" db:"failed_count"`
	ScheduledAt    *time.Time      `json:"scheduled_at" db:"scheduled_at"`
	StartedAt      *time.Time      `json:"started_at" db:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at" db:"completed_at"`
	CreatedBy      *int            `json:"created_by" db:"created_by"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type TelegramCampaignMessage struct {
	ID            int        `json:"id" db:"id"`
	CampaignID    int        `json:"campaign_id" db:"campaign_id"`
	ContactID     int        `json:"contact_id" db:"contact_id"`
	TelegramMsgID int64      `json:"telegram_msg_id" db:"telegram_msg_id"`
	Status        string     `json:"status" db:"status"`
	ErrorReason   string     `json:"error_reason" db:"error_reason"`
	SubmittedAt   *time.Time `json:"submitted_at" db:"submitted_at"`
	DeliveredAt   *time.Time `json:"delivered_at" db:"delivered_at"`
	FailedAt      *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

// helper to build a Telegram Bot API client from account settings
func (h *TelegramHandler) getClient(accountID int) (*tgclient.Client, *TelegramSettings, error) {
	var settings TelegramSettings
	err := h.db.Get(&settings, "SELECT * FROM telegram_settings WHERE account_id = $1", accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("Telegram settings not configured")
	}
	if settings.BotToken == "" {
		return nil, nil, fmt.Errorf("Telegram bot token not set")
	}

	client := tgclient.NewClient(settings.BotToken)
	return client, &settings, nil
}

// ============================================================
// Settings Handlers
// ============================================================

// GetSettings returns the Telegram settings for the current account.
func (h *TelegramHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var settings TelegramSettings
	err := h.db.Get(&settings, "SELECT * FROM telegram_settings WHERE account_id = $1", accountID)
	if err != nil {
		return response.Success(c, map[string]interface{}{
			"configured": false,
		})
	}

	// Mask the bot token — show only last 8 chars
	masked := settings
	if len(masked.BotToken) > 8 {
		masked.BotToken = strings.Repeat("*", len(masked.BotToken)-8) + masked.BotToken[len(masked.BotToken)-8:]
	}

	return response.Success(c, map[string]interface{}{
		"configured": true,
		"settings":   masked,
	})
}

// UpdateSettings upserts Telegram settings for the current account.
func (h *TelegramHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		BotToken string `json:"bot_token"`
		SendRate int    `json:"send_rate"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.SendRate <= 0 {
		req.SendRate = 25
	}

	// If the token contains asterisks, it's the masked version — don't overwrite
	botToken := req.BotToken
	if strings.Contains(botToken, "*") {
		botToken = ""
	}

	// If we have a real new token, validate it and get bot username
	botUsername := ""
	if botToken != "" {
		client := tgclient.NewClient(botToken)
		user, err := client.GetMe()
		if err != nil {
			return response.BadRequest(c, fmt.Sprintf("Invalid bot token: %v", err))
		}
		botUsername = user.Username
	}

	_, err := h.db.Exec(`
		INSERT INTO telegram_settings (account_id, bot_token, bot_username, send_rate, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			bot_token = CASE WHEN EXCLUDED.bot_token = '' THEN telegram_settings.bot_token ELSE EXCLUDED.bot_token END,
			bot_username = CASE WHEN EXCLUDED.bot_username = '' THEN telegram_settings.bot_username ELSE EXCLUDED.bot_username END,
			send_rate = EXCLUDED.send_rate,
			updated_at = NOW()
	`, accountID, botToken, botUsername, req.SendRate)
	if err != nil {
		log.Printf("[telegram] Failed to save settings: %v", err)
		return response.InternalError(c, "Failed to save settings")
	}

	return response.SuccessWithMessage(c, "Telegram settings saved", nil)
}

// TestConnection verifies the Telegram bot token is valid.
func (h *TelegramHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	if err := client.TestConnection(); err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Connection failed: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"connected": true,
	})
}

// ============================================================
// Contact Handlers
// ============================================================

// ListContacts returns a paginated list of Telegram contacts.
func (h *TelegramHandler) ListContacts(c echo.Context) error {
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

	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if query != "" {
		where += fmt.Sprintf(" AND (username ILIKE $%d OR first_name ILIKE $%d OR last_name ILIKE $%d OR name ILIKE $%d OR email ILIKE $%d OR CAST(chat_id AS TEXT) ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx, argIdx)
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

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM telegram_contacts WHERE %s", where)
	if err := h.db.Get(&total, countSQL, args...); err != nil {
		log.Printf("[telegram] Failed to count contacts: %v", err)
		return response.InternalError(c, "Failed to count contacts")
	}

	args = append(args, perPage, offset)
	dataSQL := fmt.Sprintf("SELECT * FROM telegram_contacts WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argIdx, argIdx+1)

	var contacts []TelegramContact
	if err := h.db.Select(&contacts, dataSQL, args...); err != nil {
		log.Printf("[telegram] Failed to fetch contacts: %v", err)
		return response.InternalError(c, "Failed to fetch contacts")
	}

	if contacts == nil {
		contacts = []TelegramContact{}
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

// GetContact returns a single Telegram contact by ID.
func (h *TelegramHandler) GetContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var contact TelegramContact
	err = h.db.Get(&contact, `SELECT * FROM telegram_contacts WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Contact not found")
	}

	return response.Success(c, contact)
}

// CreateContact adds a new Telegram contact.
func (h *TelegramHandler) CreateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		ChatID     int64           `json:"chat_id"`
		Username   string          `json:"username"`
		FirstName  string          `json:"first_name"`
		LastName   string          `json:"last_name"`
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
		GroupIDs   []int           `json:"group_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.ChatID == 0 {
		return response.BadRequest(c, "Chat ID is required")
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
	var contact TelegramContact
	err := h.db.Get(&contact, `
		INSERT INTO telegram_contacts (account_id, chat_id, username, first_name, last_name, name, email, opted_in, opted_in_at, tags, attributes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10)
		ON CONFLICT (account_id, chat_id) DO UPDATE SET
			username = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			name = EXCLUDED.name,
			email = EXCLUDED.email,
			tags = EXCLUDED.tags,
			attributes = EXCLUDED.attributes,
			updated_at = NOW()
		RETURNING *
	`, accountID, req.ChatID, req.Username, req.FirstName, req.LastName, req.Name, req.Email, now, tags, attrs)
	if err != nil {
		log.Printf("[telegram] Failed to create contact: %v", err)
		return response.InternalError(c, "Failed to create contact")
	}

	// Add contact to specified groups
	for _, gid := range req.GroupIDs {
		h.db.Exec(`
			INSERT INTO telegram_contact_group_members (group_id, contact_id)
			SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM telegram_contact_groups WHERE id = $1 AND account_id = $3)
			ON CONFLICT DO NOTHING
		`, gid, contact.ID, accountID)
	}

	return response.Created(c, contact)
}

// UpdateContact updates an existing Telegram contact.
func (h *TelegramHandler) UpdateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Username   string          `json:"username"`
		FirstName  string          `json:"first_name"`
		LastName   string          `json:"last_name"`
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		OptedIn    *bool           `json:"opted_in"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
		GroupIDs   *[]int          `json:"group_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var exists bool
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM telegram_contacts WHERE id = $1 AND account_id = $2)", id, accountID)
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
		UPDATE telegram_contacts SET username = $1, first_name = $2, last_name = $3, name = $4, email = $5, opted_in = $6, tags = $7, attributes = $8, updated_at = NOW()
		WHERE id = $9 AND account_id = $10
	`, req.Username, req.FirstName, req.LastName, req.Name, req.Email, optedIn, tags, attrs, id, accountID)
	if err2 != nil {
		log.Printf("[telegram] Failed to update contact: %v", err2)
		return response.InternalError(c, "Failed to update contact")
	}

	// Sync group memberships if group_ids provided
	if req.GroupIDs != nil {
		// Remove from all groups first
		h.db.Exec(`
			DELETE FROM telegram_contact_group_members
			WHERE contact_id = $1
			AND group_id IN (SELECT id FROM telegram_contact_groups WHERE account_id = $2)
		`, id, accountID)
		// Add to specified groups
		for _, gid := range *req.GroupIDs {
			h.db.Exec(`
				INSERT INTO telegram_contact_group_members (group_id, contact_id)
				SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM telegram_contact_groups WHERE id = $1 AND account_id = $3)
				ON CONFLICT DO NOTHING
			`, gid, id, accountID)
		}
	}

	return response.SuccessWithMessage(c, "Contact updated", nil)
}

// GetContactGroups returns the group IDs a contact belongs to.
func (h *TelegramHandler) GetContactGroups(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists bool
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM telegram_contacts WHERE id = $1 AND account_id = $2)", id, accountID)
	if !exists {
		return response.NotFound(c, "Contact not found")
	}

	var groupIDs []int
	h.db.Select(&groupIDs, `
		SELECT gm.group_id FROM telegram_contact_group_members gm
		JOIN telegram_contact_groups g ON g.id = gm.group_id
		WHERE gm.contact_id = $1 AND g.account_id = $2
	`, id, accountID)

	if groupIDs == nil {
		groupIDs = []int{}
	}

	return response.Success(c, groupIDs)
}

// DeleteContact removes a Telegram contact.
func (h *TelegramHandler) DeleteContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM telegram_contacts WHERE id = $1 AND account_id = $2", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete contact")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Contact not found")
	}

	return response.SuccessWithMessage(c, "Contact deleted", nil)
}

// ImportContacts parses a CSV file and bulk inserts Telegram contacts.
func (h *TelegramHandler) ImportContacts(c echo.Context) error {
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

	header, err := reader.Read()
	if err != nil {
		return response.BadRequest(c, "Failed to read CSV header")
	}

	colMap := map[string]int{}
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	chatIDIdx, hasChatID := colMap["chat_id"]
	if !hasChatID {
		return response.BadRequest(c, "CSV must have a 'chat_id' column")
	}
	usernameIdx, hasUsername := colMap["username"]
	firstNameIdx, hasFirstName := colMap["first_name"]
	lastNameIdx, hasLastName := colMap["last_name"]
	nameIdx, hasName := colMap["name"]
	emailIdx, hasEmail := colMap["email"]
	tagsIdx, hasTags := colMap["tags"]

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

		chatIDStr := strings.TrimSpace(record[chatIDIdx])
		chatID, parseErr := strconv.ParseInt(chatIDStr, 10, 64)
		if parseErr != nil || chatID == 0 {
			skipped++
			continue
		}

		username := ""
		if hasUsername && usernameIdx < len(record) {
			username = strings.TrimSpace(record[usernameIdx])
		}
		firstName := ""
		if hasFirstName && firstNameIdx < len(record) {
			firstName = strings.TrimSpace(record[firstNameIdx])
		}
		lastName := ""
		if hasLastName && lastNameIdx < len(record) {
			lastName = strings.TrimSpace(record[lastNameIdx])
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

		var contactID int
		err2 := h.db.Get(&contactID, `
			INSERT INTO telegram_contacts (account_id, chat_id, username, first_name, last_name, name, email, opted_in, opted_in_at, tags)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9::jsonb)
			ON CONFLICT (account_id, chat_id) DO UPDATE SET updated_at = NOW()
			RETURNING id
		`, accountID, chatID, username, firstName, lastName, name, email, now, tags)
		if err2 != nil {
			log.Printf("[telegram] Import row error: %v", err2)
			skipped++
			continue
		}
		imported++
		if len(groupIDs) > 0 {
			importedContactIDs = append(importedContactIDs, contactID)
		}
	}

	for _, gid := range groupIDs {
		for _, cid := range importedContactIDs {
			h.db.Exec(`
				INSERT INTO telegram_contact_group_members (group_id, contact_id)
				SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM telegram_contact_groups WHERE id = $1 AND account_id = $3)
				ON CONFLICT DO NOTHING
			`, gid, cid, accountID)
		}
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
	})
}

// ExportContacts exports all Telegram contacts as a CSV file.
func (h *TelegramHandler) ExportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var contacts []TelegramContact
	if err := h.db.Select(&contacts, "SELECT * FROM telegram_contacts WHERE account_id = $1 ORDER BY created_at DESC", accountID); err != nil {
		return response.InternalError(c, "Failed to fetch contacts")
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=telegram_contacts.csv")

	writer := csv.NewWriter(c.Response().Writer)
	writer.Write([]string{"chat_id", "username", "first_name", "last_name", "name", "email", "tags", "opted_in", "created_at"})

	for _, ct := range contacts {
		optedIn := "true"
		if !ct.OptedIn {
			optedIn = "false"
		}
		writer.Write([]string{
			fmt.Sprintf("%d", ct.ChatID),
			ct.Username,
			ct.FirstName,
			ct.LastName,
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

func (h *TelegramHandler) ListContactTags(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type TagRow struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tags []TagRow
	h.db.Select(&tags, `
		SELECT tag, COUNT(*) as count
		FROM telegram_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`, accountID)

	if tags == nil {
		tags = []TagRow{}
	}

	return response.Success(c, tags)
}

func (h *TelegramHandler) CreateContactTag(c echo.Context) error {
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

	for _, cid := range req.ContactIDs {
		result, err := h.db.Exec(`
			UPDATE telegram_contacts
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

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"updated": updated,
	})
}

func (h *TelegramHandler) DeleteContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	tag := c.Param("tag")

	if tag == "" {
		return response.BadRequest(c, "Tag is required")
	}

	result, err := h.db.Exec(`
		UPDATE telegram_contacts
		SET tags = tags - $1, updated_at = NOW()
		WHERE account_id = $2 AND tags @> to_jsonb($1::text)
	`, tag, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete tag")
	}

	removed, _ := result.RowsAffected()

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"removed": removed,
	})
}

func (h *TelegramHandler) GetContactStats(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts int `db:"total_contacts"`
		OptedIn       int `db:"opted_in"`
		OptedOut      int `db:"opted_out"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM telegram_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM telegram_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.OptedOut, "SELECT COUNT(*) FROM telegram_contacts WHERE account_id = $1 AND opted_in = false", accountID)

	type TagStat struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tagStats []TagStat
	h.db.Select(&tagStats, `
		SELECT tag, COUNT(*) as count
		FROM telegram_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag ORDER BY count DESC LIMIT 20
	`, accountID)
	if tagStats == nil {
		tagStats = []TagStat{}
	}

	var recentCount int
	h.db.Get(&recentCount, "SELECT COUNT(*) FROM telegram_contacts WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days'", accountID)

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

func (h *TelegramHandler) ListCampaigns(c echo.Context) error {
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
	h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM telegram_campaigns WHERE %s", where), args...)

	args = append(args, perPage, offset)
	var campaigns []TelegramCampaign
	err := h.db.Select(&campaigns, fmt.Sprintf(
		"SELECT * FROM telegram_campaigns WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	), args...)
	if err != nil {
		log.Printf("[telegram] Failed to fetch campaigns: %v", err)
		return response.InternalError(c, "Failed to fetch campaigns")
	}

	if campaigns == nil {
		campaigns = []TelegramCampaign{}
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

func (h *TelegramHandler) GetCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign TelegramCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM telegram_campaign_messages WHERE campaign_id = $1
		GROUP BY status
	`, id)
	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}

	type RecipientRow struct {
		ID            int        `json:"id" db:"id"`
		ContactID     int        `json:"contact_id" db:"contact_id"`
		ChatID        int64      `json:"chat_id" db:"chat_id"`
		ContactName   string     `json:"contact_name" db:"contact_name"`
		Username      string     `json:"username" db:"username"`
		Status        string     `json:"status" db:"status"`
		ErrorReason   string     `json:"error_reason" db:"error_reason"`
		SubmittedAt   *time.Time `json:"submitted_at" db:"submitted_at"`
		DeliveredAt   *time.Time `json:"delivered_at" db:"delivered_at"`
		FailedAt      *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	}
	var recipients []RecipientRow
	h.db.Select(&recipients, `
		SELECT tcm.id, tcm.contact_id, tc.chat_id, COALESCE(NULLIF(tc.name, ''), tc.first_name || ' ' || tc.last_name) AS contact_name,
		       tc.username, tcm.status, tcm.error_reason,
		       tcm.submitted_at, tcm.delivered_at, tcm.failed_at, tcm.created_at
		FROM telegram_campaign_messages tcm
		JOIN telegram_contacts tc ON tc.id = tcm.contact_id
		WHERE tcm.campaign_id = $1
		ORDER BY tcm.created_at DESC
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

func (h *TelegramHandler) CreateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		MessageType  string          `json:"message_type"`
		MediaURL     string          `json:"media_url"`
		Buttons      json.RawMessage `json:"buttons"`
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

	if req.MessageType == "" {
		req.MessageType = "text"
	}
	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}
	buttons := req.Buttons
	if buttons == nil {
		buttons = json.RawMessage("[]")
	}

	var campaign TelegramCampaign
	err := h.db.Get(&campaign, `
		INSERT INTO telegram_campaigns (account_id, name, message_text, message_type, media_url, buttons, target_filter, scheduled_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING *
	`, accountID, req.Name, req.MessageText, req.MessageType, req.MediaURL, buttons, targetFilter, req.ScheduledAt, userID)
	if err != nil {
		log.Printf("[telegram] Failed to create campaign: %v", err)
		return response.InternalError(c, "Failed to create campaign")
	}

	return response.Created(c, campaign)
}

func (h *TelegramHandler) UpdateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" {
		return response.BadRequest(c, "Only draft campaigns can be edited")
	}

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		MessageType  string          `json:"message_type"`
		MediaURL     string          `json:"media_url"`
		Buttons      json.RawMessage `json:"buttons"`
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
	buttons := req.Buttons
	if buttons == nil {
		buttons = json.RawMessage("[]")
	}

	_, err2 := h.db.Exec(`
		UPDATE telegram_campaigns SET name = $1, message_text = $2, message_type = $3, media_url = $4, buttons = $5, target_filter = $6, scheduled_at = $7, updated_at = NOW()
		WHERE id = $8 AND account_id = $9
	`, req.Name, req.MessageText, req.MessageType, req.MediaURL, buttons, targetFilter, req.ScheduledAt, id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to update campaign")
	}

	return response.SuccessWithMessage(c, "Campaign updated", nil)
}

func (h *TelegramHandler) DeleteCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	tx, _ := h.db.Beginx()
	tx.Exec("DELETE FROM telegram_campaign_messages WHERE campaign_id = $1", id)
	result, err2 := tx.Exec("DELETE FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		tx.Rollback()
		return response.InternalError(c, "Failed to delete campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		tx.Rollback()
		return response.NotFound(c, "Campaign not found")
	}
	tx.Commit()

	return response.SuccessWithMessage(c, "Campaign deleted", nil)
}

func (h *TelegramHandler) SendCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign TelegramCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.Status != "draft" && campaign.Status != "scheduled" {
		return response.BadRequest(c, "Campaign must be in draft or scheduled status to send")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	_, _, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}

	// Query opted-in contacts matching target filter
	contactQuery := "SELECT * FROM telegram_contacts WHERE account_id = $1 AND opted_in = true"
	contactArgs := []interface{}{accountID}

	var filterGroups []int
	if campaign.TargetFilter != nil && string(campaign.TargetFilter) != "{}" && string(campaign.TargetFilter) != "null" {
		var filter struct {
			Tags   []string `json:"tags"`
			Groups []int    `json:"groups"`
		}
		if jsonErr := json.Unmarshal(campaign.TargetFilter, &filter); jsonErr == nil {
			if len(filter.Tags) > 0 {
				tagJSON, _ := json.Marshal(filter.Tags)
				contactQuery += " AND tags @> $2::jsonb"
				contactArgs = append(contactArgs, string(tagJSON))
			}
			filterGroups = filter.Groups
		}
	}

	var contacts []TelegramContact
	if err := h.db.Select(&contacts, contactQuery, contactArgs...); err != nil {
		return response.InternalError(c, "Failed to fetch target contacts")
	}

	// Include contacts from specified groups
	if len(filterGroups) > 0 {
		existingIDs := make(map[int]bool)
		for _, ct := range contacts {
			existingIDs[ct.ID] = true
		}
		for _, gid := range filterGroups {
			var groupContacts []TelegramContact
			h.db.Select(&groupContacts, `
				SELECT tc.* FROM telegram_contacts tc
				JOIN telegram_contact_group_members gm ON gm.contact_id = tc.id
				WHERE tc.account_id = $1 AND tc.opted_in = true AND gm.group_id = $2
			`, accountID, gid)
			for _, gc := range groupContacts {
				if !existingIDs[gc.ID] {
					contacts = append(contacts, gc)
					existingIDs[gc.ID] = true
				}
			}
		}
	}

	if len(contacts) == 0 {
		return response.BadRequest(c, "No opted-in contacts to send to")
	}

	// Create campaign_messages rows
	for _, contact := range contacts {
		h.db.Exec(`
			INSERT INTO telegram_campaign_messages (campaign_id, contact_id, status)
			VALUES ($1, $2, 'queued')
		`, campaign.ID, contact.ID)
	}

	now := time.Now()
	h.db.Exec(`
		UPDATE telegram_campaigns SET status = 'sending', total_targets = $1, started_at = $2, updated_at = NOW()
		WHERE id = $3
	`, len(contacts), now, campaign.ID)

	go h.executeCampaignSend(campaign.ID, accountID)

	return response.Success(c, map[string]interface{}{
		"status":        "sending",
		"total_targets": len(contacts),
	})
}

// executeCampaignSend runs in background and sends Telegram messages.
func (h *TelegramHandler) executeCampaignSend(campaignID, accountID int) {
	client, settings, err := h.getClient(accountID)
	if err != nil {
		log.Printf("[telegram] Campaign %d: failed to get client: %v", campaignID, err)
		h.db.Exec("UPDATE telegram_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	var campaign TelegramCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM telegram_campaigns WHERE id = $1", campaignID); err != nil {
		h.db.Exec("UPDATE telegram_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// Parse buttons for inline keyboard
	var buttons []struct {
		Text string `json:"text"`
		URL  string `json:"url"`
	}
	json.Unmarshal(campaign.Buttons, &buttons)

	var replyMarkup *tgclient.InlineKeyboardMarkup
	if len(buttons) > 0 {
		var keyboardButtons [][]tgclient.InlineKeyboardButton
		for _, btn := range buttons {
			keyboardButtons = append(keyboardButtons, []tgclient.InlineKeyboardButton{
				{Text: btn.Text, URL: btn.URL},
			})
		}
		replyMarkup = &tgclient.InlineKeyboardMarkup{InlineKeyboard: keyboardButtons}
	}

	type QueuedMessage struct {
		MessageID int   `db:"message_id"`
		ContactID int   `db:"contact_id"`
		ChatID    int64 `db:"chat_id"`
	}
	var queuedMessages []QueuedMessage
	if err := h.db.Select(&queuedMessages, `
		SELECT tcm.id AS message_id, tcm.contact_id, tc.chat_id
		FROM telegram_campaign_messages tcm
		JOIN telegram_contacts tc ON tc.id = tcm.contact_id
		WHERE tcm.campaign_id = $1 AND tcm.status = 'queued'
		ORDER BY tcm.id ASC
	`, campaignID); err != nil {
		h.db.Exec("UPDATE telegram_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	sendRate := settings.SendRate
	if sendRate <= 0 {
		sendRate = 25
	}

	ticker := time.NewTicker(time.Second / time.Duration(sendRate))
	defer ticker.Stop()

	var mu sync.Mutex
	sentCount := 0
	failedCount := 0

	for _, qm := range queuedMessages {
		<-ticker.C

		var status string
		h.db.Get(&status, "SELECT status FROM telegram_campaigns WHERE id = $1", campaignID)
		if status == "paused" || status == "cancelled" {
			log.Printf("[telegram] Campaign %d: %s by user", campaignID, status)
			return
		}

		var msg *tgclient.Message
		var sendErr error

		if campaign.MessageType == "photo" && campaign.MediaURL != "" {
			msg, sendErr = client.SendPhoto(qm.ChatID, campaign.MediaURL, campaign.MessageText, "HTML", replyMarkup)
		} else {
			msg, sendErr = client.SendMessage(qm.ChatID, campaign.MessageText, "HTML", replyMarkup)
		}

		if sendErr != nil {
			log.Printf("[telegram] Campaign %d: failed to send to %d: %v", campaignID, qm.ChatID, sendErr)
			errReason := sendErr.Error()

			// Check if user blocked the bot (403)
			if strings.Contains(errReason, "403") {
				h.db.Exec("UPDATE telegram_contacts SET opted_in = false, opted_out_at = NOW(), updated_at = NOW() WHERE id = $1", qm.ContactID)
			}

			h.db.Exec(`
				UPDATE telegram_campaign_messages SET status = 'failed', error_reason = $1, failed_at = NOW() WHERE id = $2
			`, errReason, qm.MessageID)
			mu.Lock()
			failedCount++
			mu.Unlock()
			continue
		}

		telegramMsgID := int64(0)
		if msg != nil {
			telegramMsgID = msg.MessageID
		}

		h.db.Exec(`
			UPDATE telegram_campaign_messages
			SET telegram_msg_id = $1, status = 'delivered', submitted_at = NOW(), delivered_at = NOW()
			WHERE id = $2
		`, telegramMsgID, qm.MessageID)

		mu.Lock()
		sentCount++
		mu.Unlock()

		if (sentCount+failedCount)%50 == 0 {
			mu.Lock()
			h.db.Exec(`
				UPDATE telegram_campaigns SET sent_count = $1, delivered_count = $1, failed_count = $2, updated_at = NOW() WHERE id = $3
			`, sentCount, failedCount, campaignID)
			mu.Unlock()
		}
	}

	h.db.Exec(`
		UPDATE telegram_campaigns SET
			status = 'sent',
			sent_count = $1,
			delivered_count = $1,
			failed_count = $2,
			completed_at = NOW(),
			updated_at = NOW()
		WHERE id = $3
	`, sentCount, failedCount, campaignID)

	log.Printf("[telegram] Campaign %d: completed. Sent: %d, Failed: %d", campaignID, sentCount, failedCount)
}

func (h *TelegramHandler) TestCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		ChatID int64 `json:"chat_id"`
	}
	if err := c.Bind(&req); err != nil || req.ChatID == 0 {
		return response.BadRequest(c, "Chat ID is required")
	}

	var campaign TelegramCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	client, _, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}

	// Parse buttons
	var buttons []struct {
		Text string `json:"text"`
		URL  string `json:"url"`
	}
	json.Unmarshal(campaign.Buttons, &buttons)

	var replyMarkup *tgclient.InlineKeyboardMarkup
	if len(buttons) > 0 {
		var keyboardButtons [][]tgclient.InlineKeyboardButton
		for _, btn := range buttons {
			keyboardButtons = append(keyboardButtons, []tgclient.InlineKeyboardButton{
				{Text: btn.Text, URL: btn.URL},
			})
		}
		replyMarkup = &tgclient.InlineKeyboardMarkup{InlineKeyboard: keyboardButtons}
	}

	var msg *tgclient.Message
	var sendErr error

	if campaign.MessageType == "photo" && campaign.MediaURL != "" {
		msg, sendErr = client.SendPhoto(req.ChatID, campaign.MediaURL, campaign.MessageText, "HTML", replyMarkup)
	} else {
		msg, sendErr = client.SendMessage(req.ChatID, campaign.MessageText, "HTML", replyMarkup)
	}

	if sendErr != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to send test message: %v", sendErr))
	}

	return response.Success(c, map[string]interface{}{
		"message_id": msg.MessageID,
		"status":     "delivered",
	})
}

func (h *TelegramHandler) PauseCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE telegram_campaigns SET status = 'paused', updated_at = NOW()
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

func (h *TelegramHandler) ResumeCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE telegram_campaigns SET status = 'sending', updated_at = NOW()
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

func (h *TelegramHandler) GetAudienceCount(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var body struct {
		Tags   []string `json:"tags"`
		Groups []int    `json:"groups"`
	}
	c.Bind(&body)

	where := "account_id = $1 AND opted_in = true"
	args := []interface{}{accountID}
	argIdx := 2

	if len(body.Tags) > 0 {
		tagJSON, _ := json.Marshal(body.Tags)
		where += fmt.Sprintf(" AND tags @> $%d::jsonb", argIdx)
		args = append(args, string(tagJSON))
		argIdx++
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM telegram_contacts WHERE %s", where)

	if len(body.Groups) > 0 {
		groupPlaceholders := make([]string, len(body.Groups))
		for i, gid := range body.Groups {
			groupPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, gid)
			argIdx++
		}
		query = fmt.Sprintf(`
			SELECT COUNT(DISTINCT id) FROM (
				SELECT id FROM telegram_contacts WHERE %s
				UNION
				SELECT tc.id FROM telegram_contacts tc
				JOIN telegram_contact_group_members gm ON gm.contact_id = tc.id
				WHERE tc.account_id = $1 AND tc.opted_in = true AND gm.group_id IN (%s)
			) combined
		`, where, strings.Join(groupPlaceholders, ","))
	}

	var count int
	h.db.Get(&count, query, args...)

	return response.Success(c, map[string]interface{}{
		"count": count,
	})
}

// ============================================================
// Analytics Handlers
// ============================================================

func (h *TelegramHandler) GetOverview(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts  int `json:"total_contacts" db:"total_contacts"`
		OptedIn        int `json:"opted_in" db:"opted_in"`
		TotalCampaigns int `json:"total_campaigns" db:"total_campaigns"`
	}

	var msgStats struct {
		TotalSent      int `json:"total_sent" db:"total_sent"`
		TotalDelivered int `json:"total_delivered" db:"total_delivered"`
		TotalFailed    int `json:"total_failed" db:"total_failed"`
	}

	var recent []TelegramCampaign

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		h.db.Get(&stats, `
			SELECT
				COUNT(*) as total_contacts,
				COUNT(*) FILTER (WHERE opted_in = true) as opted_in,
				0 as total_campaigns
			FROM telegram_contacts WHERE account_id = $1
		`, accountID)
		h.db.Get(&stats.TotalCampaigns, "SELECT COUNT(*) FROM telegram_campaigns WHERE account_id = $1", accountID)
	}()

	go func() {
		defer wg.Done()
		h.db.Get(&msgStats, `
			SELECT
				COALESCE(SUM(sent_count), 0) as total_sent,
				COALESCE(SUM(delivered_count), 0) as total_delivered,
				COALESCE(SUM(failed_count), 0) as total_failed
			FROM telegram_campaigns WHERE account_id = $1
		`, accountID)
	}()

	go func() {
		defer wg.Done()
		h.db.Select(&recent, `
			SELECT * FROM telegram_campaigns WHERE account_id = $1
			ORDER BY created_at DESC LIMIT 5
		`, accountID)
	}()

	wg.Wait()

	if recent == nil {
		recent = []TelegramCampaign{}
	}

	return response.Success(c, map[string]interface{}{
		"contacts":         stats,
		"messages":         msgStats,
		"recent_campaigns": recent,
	})
}

func (h *TelegramHandler) GetCampaignAnalytics(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign TelegramCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM telegram_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM telegram_campaign_messages WHERE campaign_id = $1
		GROUP BY status ORDER BY count DESC
	`, id)

	var failedMessages []struct {
		ChatID      int64      `json:"chat_id" db:"chat_id"`
		Username    string     `json:"username" db:"username"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	}
	h.db.Select(&failedMessages, `
		SELECT tc.chat_id, tc.username, tcm.error_reason, tcm.failed_at
		FROM telegram_campaign_messages tcm
		JOIN telegram_contacts tc ON tc.id = tcm.contact_id
		WHERE tcm.campaign_id = $1 AND tcm.status = 'failed'
		ORDER BY tcm.failed_at DESC LIMIT 50
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}
	if failedMessages == nil {
		failedMessages = []struct {
			ChatID      int64      `json:"chat_id" db:"chat_id"`
			Username    string     `json:"username" db:"username"`
			ErrorReason string     `json:"error_reason" db:"error_reason"`
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
// Contact Group Handlers
// ============================================================

type TelegramContactGroup struct {
	ID          int       `json:"id" db:"id"`
	AccountID   int       `json:"account_id" db:"account_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Color       string    `json:"color" db:"color"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type TelegramContactGroupWithCount struct {
	TelegramContactGroup
	MemberCount int `json:"member_count" db:"member_count"`
}

func (h *TelegramHandler) ListGroups(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var groups []TelegramContactGroupWithCount
	err := h.db.Select(&groups, `
		SELECT g.*, COALESCE(m.cnt, 0) AS member_count
		FROM telegram_contact_groups g
		LEFT JOIN (SELECT group_id, COUNT(*) AS cnt FROM telegram_contact_group_members GROUP BY group_id) m
			ON m.group_id = g.id
		WHERE g.account_id = $1
		ORDER BY g.name ASC
	`, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to fetch groups")
	}
	if groups == nil {
		groups = []TelegramContactGroupWithCount{}
	}

	return response.Success(c, groups)
}

func (h *TelegramHandler) GetGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var group TelegramContactGroup
	if err := h.db.Get(&group, "SELECT * FROM telegram_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var memberCount int
	h.db.Get(&memberCount, "SELECT COUNT(*) FROM telegram_contact_group_members WHERE group_id = $1", id)

	return response.Success(c, map[string]interface{}{
		"group":        group,
		"member_count": memberCount,
	})
}

func (h *TelegramHandler) CreateGroup(c echo.Context) error {
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
		req.Color = "#0088cc"
	}

	var group TelegramContactGroup
	err := h.db.Get(&group, `
		INSERT INTO telegram_contact_groups (account_id, name, description, color)
		VALUES ($1, $2, $3, $4) RETURNING *
	`, accountID, req.Name, req.Description, req.Color)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			return response.BadRequest(c, "A group with this name already exists")
		}
		return response.InternalError(c, "Failed to create group")
	}

	return response.Created(c, group)
}

func (h *TelegramHandler) UpdateGroup(c echo.Context) error {
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

	_, err2 := h.db.Exec(`
		UPDATE telegram_contact_groups SET name = $1, description = $2, color = $3, updated_at = NOW()
		WHERE id = $4 AND account_id = $5
	`, req.Name, req.Description, req.Color, id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to update group")
	}

	return response.SuccessWithMessage(c, "Group updated", nil)
}

func (h *TelegramHandler) DeleteGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	tx, _ := h.db.Beginx()
	tx.Exec("DELETE FROM telegram_contact_group_members WHERE group_id = $1", id)
	result, err2 := tx.Exec("DELETE FROM telegram_contact_groups WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		tx.Rollback()
		return response.InternalError(c, "Failed to delete group")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		tx.Rollback()
		return response.NotFound(c, "Group not found")
	}
	tx.Commit()

	return response.SuccessWithMessage(c, "Group deleted", nil)
}

func (h *TelegramHandler) ListGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
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
	h.db.Get(&total, `
		SELECT COUNT(*) FROM telegram_contact_group_members gm
		JOIN telegram_contacts tc ON tc.id = gm.contact_id
		WHERE gm.group_id = $1 AND tc.account_id = $2
	`, id, accountID)

	var members []TelegramContact
	h.db.Select(&members, `
		SELECT tc.* FROM telegram_contacts tc
		JOIN telegram_contact_group_members gm ON gm.contact_id = tc.id
		WHERE gm.group_id = $1 AND tc.account_id = $2
		ORDER BY tc.created_at DESC
		LIMIT $3 OFFSET $4
	`, id, accountID, perPage, offset)
	if members == nil {
		members = []TelegramContact{}
	}

	return response.Success(c, map[string]interface{}{
		"results":  members,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

func (h *TelegramHandler) AddGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "Contact IDs are required")
	}

	added := 0
	for _, cid := range req.ContactIDs {
		result, err := h.db.Exec(`
			INSERT INTO telegram_contact_group_members (group_id, contact_id)
			SELECT $1, $2 WHERE EXISTS (
				SELECT 1 FROM telegram_contact_groups WHERE id = $1 AND account_id = $3
			) AND EXISTS (
				SELECT 1 FROM telegram_contacts WHERE id = $2 AND account_id = $3
			)
			ON CONFLICT DO NOTHING
		`, id, cid, accountID)
		if err == nil {
			if n, _ := result.RowsAffected(); n > 0 {
				added++
			}
		}
	}

	return response.Success(c, map[string]interface{}{"added": added})
}

func (h *TelegramHandler) RemoveGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "Contact IDs are required")
	}

	removed := 0
	for _, cid := range req.ContactIDs {
		result, err := h.db.Exec(`
			DELETE FROM telegram_contact_group_members
			WHERE group_id = $1 AND contact_id = $2
			AND EXISTS (SELECT 1 FROM telegram_contact_groups WHERE id = $1 AND account_id = $3)
		`, id, cid, accountID)
		if err == nil {
			if n, _ := result.RowsAffected(); n > 0 {
				removed++
			}
		}
	}

	return response.Success(c, map[string]interface{}{"removed": removed})
}

// ============================================================
// Webhook Handler (receives updates from Telegram)
// ============================================================

func (h *TelegramHandler) WebhookReceive(c echo.Context) error {
	secret := c.Param("secret")
	if secret == "" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "forbidden"})
	}

	// Find account by webhook secret
	var settings TelegramSettings
	if err := h.db.Get(&settings, "SELECT * FROM telegram_settings WHERE webhook_secret = $1", secret); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "invalid secret"})
	}

	// Parse Telegram update
	var update struct {
		Message *struct {
			MessageID int64  `json:"message_id"`
			Text      string `json:"text"`
			Chat      struct {
				ID        int64  `json:"id"`
				Type      string `json:"type"`
				FirstName string `json:"first_name"`
				LastName  string `json:"last_name"`
				Username  string `json:"username"`
			} `json:"chat"`
			From *struct {
				ID        int64  `json:"id"`
				FirstName string `json:"first_name"`
				LastName  string `json:"last_name"`
				Username  string `json:"username"`
			} `json:"from"`
		} `json:"message"`
		MyChatMember *struct {
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			NewChatMember struct {
				Status string `json:"status"`
			} `json:"new_chat_member"`
		} `json:"my_chat_member"`
	}

	if err := c.Bind(&update); err != nil {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	}

	accountID := settings.AccountID

	// Handle /start command — auto-subscribe
	if update.Message != nil && strings.HasPrefix(update.Message.Text, "/start") {
		chatID := update.Message.Chat.ID
		firstName := update.Message.Chat.FirstName
		lastName := update.Message.Chat.LastName
		username := update.Message.Chat.Username
		name := strings.TrimSpace(firstName + " " + lastName)

		// Extract deep link payload
		source := ""
		parts := strings.SplitN(update.Message.Text, " ", 2)
		if len(parts) > 1 {
			source = parts[1]
		}

		now := time.Now()
		attrs := "{}"
		if source != "" {
			attrsJSON, _ := json.Marshal(map[string]string{"source": source})
			attrs = string(attrsJSON)
		}

		h.db.Exec(`
			INSERT INTO telegram_contacts (account_id, chat_id, username, first_name, last_name, name, opted_in, opted_in_at, attributes)
			VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8::jsonb)
			ON CONFLICT (account_id, chat_id) DO UPDATE SET
				username = EXCLUDED.username,
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				name = EXCLUDED.name,
				opted_in = true,
				opted_in_at = EXCLUDED.opted_in_at,
				updated_at = NOW()
		`, accountID, chatID, username, firstName, lastName, name, now, attrs)

		// Send welcome message
		client := tgclient.NewClient(settings.BotToken)
		client.SendMessage(chatID, "Welcome! You have been subscribed to our updates. Send /stop to unsubscribe.", "", nil)
	}

	// Handle /stop command — unsubscribe
	if update.Message != nil && update.Message.Text == "/stop" {
		chatID := update.Message.Chat.ID
		h.db.Exec(`
			UPDATE telegram_contacts SET opted_in = false, opted_out_at = NOW(), updated_at = NOW()
			WHERE account_id = $1 AND chat_id = $2
		`, accountID, chatID)

		client := tgclient.NewClient(settings.BotToken)
		client.SendMessage(chatID, "You have been unsubscribed. Send /start to subscribe again.", "", nil)
	}

	// Handle bot blocked/kicked
	if update.MyChatMember != nil && (update.MyChatMember.NewChatMember.Status == "kicked" || update.MyChatMember.NewChatMember.Status == "left") {
		chatID := update.MyChatMember.Chat.ID
		h.db.Exec(`
			UPDATE telegram_contacts SET opted_in = false, opted_out_at = NOW(), updated_at = NOW()
			WHERE account_id = $1 AND chat_id = $2
		`, accountID, chatID)
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
