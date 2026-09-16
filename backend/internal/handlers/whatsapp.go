package handlers

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/lib/pq"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// WhatsAppHandler manages all WhatsApp marketing endpoints.
type WhatsAppHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

// NewWhatsAppHandler creates a new WhatsApp handler.
func NewWhatsAppHandler(db *sqlx.DB, cfg *config.Config) *WhatsAppHandler {
	return &WhatsAppHandler{db: db, cfg: cfg}
}

// ============================================================
// Models
// ============================================================

type WASettings struct {
	ID        int `json:"id" db:"id"`
	AccountID int `json:"account_id" db:"account_id"`
	// OpenWA replaced Gupshup. There are no per-account API credentials any
	// more: the gateway is process configuration, and all an account owns is
	// which gateway session belongs to it. LinkedPhone and SessionStatus are a
	// cache of what the gateway reports, refreshed on read, not settings.
	OpenWASessionID string    `json:"openwa_session_id" db:"openwa_session_id"`
	LinkedPhone     string    `json:"linked_phone" db:"linked_phone"`
	SessionStatus   string    `json:"session_status" db:"session_status"`
	SourcePhone     string    `json:"source_phone" db:"source_phone"`
	AppName         string    `json:"app_name" db:"app_name"`
	WebhookSecret   string    `json:"webhook_secret" db:"webhook_secret"`
	SendRate        int       `json:"send_rate" db:"send_rate"`
	IsActive        bool      `json:"is_active" db:"is_active"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
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
	ID        int    `json:"id" db:"id"`
	AccountID int    `json:"account_id" db:"account_id"`
	GupshupID string `json:"gupshup_id" db:"gupshup_id"`
	// Added by migration 029. The struct must declare it: these rows are read
	// with SELECT *, and sqlx is strict — a column with no destination field
	// fails the whole query, which took out template listing, template delete,
	// test sends and campaign sends at once.
	IsLegacyMetaTemplate bool            `json:"is_legacy_meta_template" db:"is_legacy_meta_template"`
	Name                 string          `json:"name" db:"name"`
	Category             string          `json:"category" db:"category"`
	Language             string          `json:"language" db:"language"`
	Status               string          `json:"status" db:"status"`
	HeaderType           string          `json:"header_type" db:"header_type"`
	HeaderText           string          `json:"header_text" db:"header_text"`
	BodyText             string          `json:"body_text" db:"body_text"`
	FooterText           string          `json:"footer_text" db:"footer_text"`
	ButtonType           string          `json:"button_type" db:"button_type"`
	Buttons              json.RawMessage `json:"buttons" db:"buttons"`
	SampleValues         json.RawMessage `json:"sample_values" db:"sample_values"`
	SyncedAt             *time.Time      `json:"synced_at" db:"synced_at"`
	CreatedAt            time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at" db:"updated_at"`
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

	// Continuous sending (migration 030). These must stay in step with the table:
	// sqlx maps columns strictly here, so a column with no field fails every
	// SELECT * against wa_campaigns, not just the ones that want the new value.
	SendIntervalSeconds int  `json:"send_interval_seconds" db:"send_interval_seconds"`
	Continuous          bool `json:"continuous" db:"continuous"`
}

type WACampaignMessage struct {
	ID           int        `json:"id" db:"id"`
	CampaignID   int        `json:"campaign_id" db:"campaign_id"`
	ContactID    int        `json:"contact_id" db:"contact_id"`
	GupshupMsgID string     `json:"gupshup_msg_id" db:"gupshup_msg_id"`
	WAMsgID      string     `json:"wa_msg_id" db:"wa_msg_id"`
	Status       string     `json:"status" db:"status"`
	ErrorReason  string     `json:"error_reason" db:"error_reason"`
	SubmittedAt  *time.Time `json:"submitted_at" db:"submitted_at"`
	EnqueuedAt   *time.Time `json:"enqueued_at" db:"enqueued_at"`
	SentAt       *time.Time `json:"sent_at" db:"sent_at"`
	DeliveredAt  *time.Time `json:"delivered_at" db:"delivered_at"`
	ReadAt       *time.Time `json:"read_at" db:"read_at"`
	FailedAt     *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// getClient returns a gateway client and the session this account sends through.
//
// Unlike the Gupshup client it replaced, this can succeed while the transport is
// still unusable: the session exists but nobody has scanned its QR, or the link
// dropped. Sends surface that as openwa.ErrNoConnectedSession, which callers
// report as an actionable message rather than a failure.
// waSettings returns an account's WhatsApp settings row, creating it the first
// time the account needs one.
//
// A row used to appear only when someone opened WhatsApp settings and saved, so
// in practice two accounts out of forty-odd had one — and every other tenant was
// told "WhatsApp is not configured for this account" no matter what the gateway
// was doing. Nothing in the row is a decision the tenant has to make first: every
// column but account_id has a default, and the session is adopted from the
// gateway below. So create it on demand rather than treating its absence as a
// configuration error.
func (h *WhatsAppHandler) waSettings(accountID int) (*WASettings, error) {
	var settings WASettings

	err := h.db.Get(&settings, "SELECT * FROM wa_settings WHERE account_id = $1", accountID)
	if err == nil {
		return &settings, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("could not read WhatsApp settings for this account")
	}

	if _, insErr := h.db.Exec(
		`INSERT INTO wa_settings (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING`,
		accountID); insErr != nil {
		log.Printf("[whatsapp] creating settings row for account %d: %v", accountID, insErr)

		return nil, fmt.Errorf("could not set up WhatsApp for this account")
	}

	if err := h.db.Get(&settings, "SELECT * FROM wa_settings WHERE account_id = $1", accountID); err != nil {
		return nil, fmt.Errorf("could not set up WhatsApp for this account")
	}

	return &settings, nil
}

func (h *WhatsAppHandler) getClient(accountID int) (*openwa.Client, string, *WASettings, error) {
	settings, err := h.waSettings(accountID)
	if err != nil {
		return nil, "", nil, err
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	// An account sends only from the number it linked itself.
	//
	// This used to adopt whatever session on the gateway happened to be ready,
	// because there was one shared number and no way to tell which tenant it
	// belonged to. With per-account numbers that behaviour is a cross-tenant leak:
	// an account with no number of its own would send from another account's
	// phone, and the replies would land in that account's inbox.
	if settings.OpenWASessionID == "" {
		return nil, "", nil, fmt.Errorf(
			"no WhatsApp number is linked for this account — link one in WhatsApp settings")
	}

	return client, settings.OpenWASessionID, settings, nil
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

	settings, err := h.waSettings(accountID)
	if err != nil {
		return response.Success(c, map[string]interface{}{"configured": false})
	}

	// Whether a number is linked is a live property of the gateway, and every
	// tenant needs to see it — but the endpoints that list gateway sessions are
	// super-admin only, so the settings page had nothing to read and showed every
	// ordinary user "Unknown" for ever. Report the account's real connection state
	// here, where any signed-in member of the account can see it.
	connection := map[string]interface{}{
		"connected":    false,
		"status":       "not_linked",
		"linked_phone": settings.LinkedPhone,
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)
	sessionID := settings.OpenWASessionID

	// Deliberately no fallback to another session. An account reports on the number
	// it linked itself and nothing else: showing it a session belonging to a
	// different tenant told it that it could send when it could not, and named a
	// phone number that was not its own.

	if sessionID != "" {
		session, sErr := client.GetSession(c.Request().Context(), sessionID)
		switch {
		case sErr != nil:
			connection["status"] = "unreachable"
			connection["detail"] = "The WhatsApp gateway could not be reached."
		default:
			connection["connected"] = session.Connected()
			connection["status"] = session.Status

			if session.Phone != nil && *session.Phone != "" {
				connection["linked_phone"] = *session.Phone
			}

			if !session.Connected() {
				connection["detail"] = "No WhatsApp number is linked right now. An administrator links it by scanning a QR code."
			}
		}
	}

	// Nothing to mask: the gateway credential lives in process configuration, not
	// in this row, so no per-account secret is exposed here any more.
	return response.Success(c, map[string]interface{}{
		"configured": true,
		"settings":   settings,
		"connection": connection,
	})
}

func (h *WhatsAppHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		// The gateway session this account sends through. Created and linked by
		// a super admin; a tenant only chooses which one it uses.
		OpenWASessionID string `json:"openwa_session_id"`
		AppName         string `json:"app_name"`
		SendRate        int    `json:"send_rate"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.SendRate <= 0 {
		req.SendRate = 10
	}

	// Upsert settings
	_, err := h.db.Exec(`
		INSERT INTO wa_settings (account_id, openwa_session_id, app_name, webhook_secret, send_rate, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			openwa_session_id = EXCLUDED.openwa_session_id,
			app_name = EXCLUDED.app_name,
			send_rate = EXCLUDED.send_rate,
			updated_at = NOW()
	`, accountID, req.OpenWASessionID, req.AppName, generateSecret(), req.SendRate)
	if err != nil {
		log.Printf("[whatsapp] Failed to save settings: %v", err)
		return response.InternalError(c, "Failed to save settings")
	}

	return response.SuccessWithMessage(c, "WhatsApp settings saved", nil)
}

func (h *WhatsAppHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, sessionID, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	// There is no remote account to authenticate against any more and no wallet
	// to read: the only question that matters is whether a handset is still
	// linked to this session and able to send.
	session, err := client.GetSession(c.Request().Context(), sessionID)
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Could not reach the WhatsApp gateway: %v", err))
	}

	phone := ""
	if session.Phone != nil {
		phone = *session.Phone
	}

	lastError := ""
	if session.LastError != nil {
		lastError = *session.LastError
	}

	// Keep the cached copy in step so the settings screen does not disagree with
	// the gateway until the next send.
	if _, dbErr := h.db.Exec(
		`UPDATE wa_settings SET session_status = $1, linked_phone = $2, updated_at = NOW() WHERE account_id = $3`,
		session.Status, phone, accountID); dbErr != nil {
		log.Printf("[whatsapp] caching session status: %v", dbErr)
	}

	return response.Success(c, map[string]interface{}{
		"connected":    session.Connected(),
		"status":       session.Status,
		"linked_phone": phone,
		"last_error":   lastError,
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

	// Leave consent alone unless the request sets it. Defaulting a missing
	// opted_in to true re-subscribed an opted-out contact whenever anything else
	// about them was edited. A change records when it happened.
	_, err2 := h.db.Exec(`
		UPDATE wa_contacts SET
			name = $1, email = $2, tags = $4, attributes = $5,
			opted_in = COALESCE($3::boolean, opted_in),
			opted_in_at = CASE WHEN $3::boolean AND NOT opted_in THEN NOW() ELSE opted_in_at END,
			opted_out_at = CASE WHEN NOT $3::boolean AND opted_in THEN NOW() ELSE opted_out_at END,
			updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.Email, req.OptedIn, tags, attrs, id, accountID)
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

// sniffDelimiter picks the separator from a CSV's first line. Spreadsheets
// export semicolon- or tab-separated files in many locales; parsed with the
// wrong separator the whole header arrives as a single cell, so a file that
// plainly has a phone column is rejected for not having one.
func sniffDelimiter(firstLine []byte) rune {
	if bytes.Count(firstLine, []byte(",")) > 0 {
		return ','
	}

	if bytes.Count(firstLine, []byte(";")) > 0 {
		return ';'
	}

	if bytes.Count(firstLine, []byte("\t")) > 0 {
		return '\t'
	}

	return ','
}

// normaliseCSVHeader lowercases and trims each column, strips a UTF-8
// byte-order mark and any surrounding quotes, and returns both a lookup and the
// cleaned names so a failure can report what was actually read. The BOM matters:
// it is invisible in every editor and makes the first column compare unequal to
// its own name, which is the most common reason a valid export is refused.
func normaliseCSVHeader(header []string) (map[string]int, []string) {
	colMap := make(map[string]int, len(header))
	names := make([]string, 0, len(header))

	for i, col := range header {
		key := strings.TrimPrefix(col, "\ufeff")
		key = strings.TrimSpace(strings.ToLower(key))
		key = strings.Trim(key, `"'`)
		key = strings.TrimSpace(key)

		if _, seen := colMap[key]; !seen {
			colMap[key] = i
		}

		names = append(names, key)
	}

	return colMap, names
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

	// Peek at the first line to pick a delimiter before parsing. Spreadsheets
	// export semicolon- or tab-separated files in plenty of locales, and with the
	// wrong delimiter the entire header arrives as one cell, so the phone column
	// is "missing" even though it is right there.
	buffered := bufio.NewReader(src)

	firstLine, _ := buffered.Peek(4096)
	delimiter := sniffDelimiter(firstLine)

	reader := csv.NewReader(buffered)
	reader.TrimLeadingSpace = true
	reader.Comma = delimiter
	// Exports are not always rectangular; tolerate ragged rows and skip the bad
	// ones per-record rather than failing the whole file.
	reader.FieldsPerRecord = -1

	// Read header
	header, err := reader.Read()
	if err != nil {
		return response.BadRequest(c, "Could not read the first row of the CSV. Check the file is a plain CSV with a header row.")
	}

	// Map header columns. A UTF-8 byte-order mark on the first cell is invisible
	// but makes "phone" compare unequal to "phone", which is the single most
	// common reason a valid-looking export is rejected here.
	colMap, normalised := normaliseCSVHeader(header)

	// Accept the names people actually export rather than insisting on one.
	pick := func(names ...string) (int, bool) {
		for _, n := range names {
			if idx, ok := colMap[n]; ok {
				return idx, true
			}
		}

		return 0, false
	}

	phoneIdx, hasPhone := pick("phone", "phone_number", "phonenumber", "mobile", "mobile_number", "number", "msisdn", "contact", "contact_number", "whatsapp")
	if !hasPhone {
		// Say what was actually found: "must have a phone column" is unactionable
		// when the uploader is looking at a file that plainly has one.
		return response.BadRequest(c, fmt.Sprintf(
			"No phone column found. The first row was read as: %s. Rename one column to 'phone'.",
			strings.Join(normalised, ", ")))
	}

	nameIdx, hasName := pick("name", "full_name", "fullname", "contact_name")
	emailIdx, hasEmail := pick("email", "email_address")
	tagsIdx, hasTags := pick("tags", "tag")

	// Whether each person agreed to receive WhatsApp messages. Every imported row
	// used to be marked opted in, so "opted in" meant only "was in a file". Now a
	// row is opted in when its own consent column says yes, or when the uploader
	// confirms that everyone in the file agreed. Otherwise the contact is stored
	// but no campaign will message it.
	consentIdx, hasConsent := pick(consentColumns...)
	confirmed := consentConfirmed(c.FormValue("consent_confirmed"))

	// Parse group_ids from form data
	var groupIDs []int
	if gids := c.FormValue("group_ids"); gids != "" {
		json.Unmarshal([]byte(gids), &groupIDs)
	}

	skipped := 0
	now := time.Now()

	// Collect first, write in batches.
	//
	// This loop used to issue one INSERT ... RETURNING per row, then one more per
	// (group x contact) pair afterwards. A 3.1MB export is on the order of a
	// hundred thousand rows, so that was hundreds of thousands of sequential
	// round-trips: the request ran past nginx's 60s proxy_read_timeout and the
	// upload died with a 504 having written only part of the file.
	type pending struct {
		phone, name, email, tags string
		consent                  consentState
	}

	rows := make([]pending, 0, 4096)
	seen := make(map[string]int, 4096)

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}

		if err != nil {
			skipped++

			continue
		}

		if phoneIdx >= len(record) {
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
			if tagStr := strings.TrimSpace(record[tagsIdx]); tagStr != "" {
				parts := strings.Split(tagStr, ",")
				for i := range parts {
					parts[i] = strings.TrimSpace(parts[i])
				}

				tagJSON, _ := json.Marshal(parts)
				tags = string(tagJSON)
			}
		}

		consent := consentUnknown
		if hasConsent && consentIdx < len(record) {
			consent = parseConsentCell(record[consentIdx])
		}

		if consent == consentUnknown && confirmed {
			consent = consentGiven
		}

		// A file that repeats a number would make one batch touch the same row
		// twice, which Postgres rejects outright ("cannot affect row a second
		// time"). Collapse duplicates here and keep the last values seen.
		if at, dup := seen[phone]; dup {
			rows[at] = pending{phone, name, email, tags, consent}

			continue
		}

		seen[phone] = len(rows)
		rows = append(rows, pending{phone, name, email, tags, consent})
	}

	imported := 0
	optedIn := 0
	importedContactIDs := make([]int, 0, len(rows))

	// Rows are written grouped by what they say about consent, because each group
	// treats a contact that already exists differently (see importConflictSQL).
	byConsent := make(map[consentState][]pending, 3)
	for _, r := range rows {
		byConsent[r.consent] = append(byConsent[r.consent], r)
	}

	// 7 parameters per row; Postgres caps a statement at 65535, so 500 rows per
	// batch leaves ample headroom.
	const batchSize = 500

	for _, state := range []consentState{consentGiven, consentRefused, consentUnknown} {
		group := byConsent[state]
		conflict := importConflictSQL(state)

		// A new contact is opted in only with consent, and only then gets an
		// opt-in time.
		var optedInAt *time.Time
		if state == consentGiven {
			optedInAt = &now
		}

		for start := 0; start < len(group); start += batchSize {
			end := min(start+batchSize, len(group))

			batch := group[start:end]
			values := make([]string, 0, len(batch))
			args := make([]interface{}, 0, len(batch)*7)

			for i, r := range batch {
				b := i * 7
				values = append(values, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d::boolean, $%d::timestamptz, $%d::jsonb)",
					b+1, b+2, b+3, b+4, b+5, b+6, b+7))
				args = append(args, accountID, r.phone, r.name, r.email, state == consentGiven, optedInAt, r.tags)
			}

			var written []struct {
				ID      int  `db:"id"`
				OptedIn bool `db:"opted_in"`
			}

			err := h.db.Select(&written, `
				INSERT INTO wa_contacts (account_id, phone, name, email, opted_in, opted_in_at, tags)
				VALUES `+strings.Join(values, ",")+`
				ON CONFLICT (account_id, phone) DO UPDATE SET
				`+conflict+`
				RETURNING id, opted_in
			`, args...)
			if err != nil {
				log.Printf("[whatsapp] Import batch %d-%d failed: %v", start, end, err)
				skipped += len(batch)

				continue
			}

			imported += len(written)

			for _, w := range written {
				importedContactIDs = append(importedContactIDs, w.ID)

				if w.OptedIn {
					optedIn++
				}
			}
		}
	}

	// One statement per group rather than one per contact per group.
	if len(groupIDs) > 0 && len(importedContactIDs) > 0 {
		for _, gid := range groupIDs {
			if _, err := h.db.Exec(`
				INSERT INTO wa_contact_group_members (group_id, contact_id)
				SELECT $1, cid FROM unnest($2::int[]) AS cid
				WHERE EXISTS (SELECT 1 FROM wa_contact_groups WHERE id = $1 AND account_id = $3)
				ON CONFLICT DO NOTHING
			`, gid, pq.Array(importedContactIDs), accountID); err != nil {
				log.Printf("[whatsapp] Import: adding contacts to group %d: %v", gid, err)
			}
		}
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
		// Of the imported contacts, how many campaigns can now message and how many
		// they will skip. Counted from the rows as written, so a contact that was
		// already opted out and stayed that way is counted as not opted in.
		"opted_in":     optedIn,
		"not_opted_in": imported - optedIn,
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
		"total_contacts":  stats.TotalContacts,
		"opted_in":        stats.OptedIn,
		"opted_out":       stats.OptedOut,
		"tags":            tagStats,
		"recent_30d":      recentCount,
		"with_attributes": withAttrs,
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
	// Templates were a Meta construct: submitted through Gupshup, reviewed by
	// Meta, then referenced by the id it returned. This endpoint pulled that
	// remote list back down. The gateway that replaced it sends free-form text,
	// so there is no remote catalogue to sync from — the rows in wa_templates
	// are now the only copy, and they are edited here rather than upstream.
	return response.SuccessWithMessage(c,
		"Templates are stored here now. WhatsApp template approval no longer applies, so there is nothing to sync.",
		map[string]interface{}{"synced": 0})
}

func (h *WhatsAppHandler) CreateTemplate(c echo.Context) error {
	accountID := mw.GetAccountID(c)

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

	// Nothing is submitted anywhere now. Templates used to go to Meta for review
	// via Gupshup and came back "pending" until approved; the gateway that
	// replaced it sends free-form text, so a template is just a saved message
	// body and is usable immediately.
	now := time.Now()
	gupshupID := ""
	status := "approved"
	var err error

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
		// Nothing was submitted anywhere, so a failed write means the template
		// does not exist. Reporting success here was left over from when the
		// template had already been created upstream.
		return response.InternalError(c, "Could not save the template")
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

	// Templates exist only in this database now, so deleting the row is the whole
	// operation — there is no remote catalogue to keep in step.
	//
	// Campaigns point at their template, and that reference is enforced. Deleting
	// one still in use raised a foreign-key violation that came back as a bare 500,
	// which tells the operator nothing; name the campaigns instead so they can see
	// what is holding it.
	var usedBy []string
	h.db.Select(&usedBy, `SELECT name FROM wa_campaigns WHERE template_id = $1 ORDER BY id`, id)

	if len(usedBy) > 0 {
		return response.Error(c, http.StatusConflict, fmt.Sprintf(
			"This template is used by %d campaign(s): %s. Delete or re-point them first.",
			len(usedBy), strings.Join(usedBy, ", ")))
	}

	// Delete from local DB
	if _, err := h.db.Exec("DELETE FROM wa_templates WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		// Anything still referencing it that the check above did not cover.
		if pqErr := (*pq.Error)(nil); errors.As(err, &pqErr) && pqErr.Code == "23503" {
			return response.Error(c, http.StatusConflict,
				"This template is still referenced by other records and cannot be deleted.")
		}

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
		ID          int        `json:"id" db:"id"`
		ContactID   int        `json:"contact_id" db:"contact_id"`
		Phone       string     `json:"phone" db:"phone"`
		ContactName string     `json:"contact_name" db:"contact_name"`
		Status      string     `json:"status" db:"status"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		SubmittedAt *time.Time `json:"submitted_at" db:"submitted_at"`
		DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
		ReadAt      *time.Time `json:"read_at" db:"read_at"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt   time.Time  `json:"created_at" db:"created_at"`
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

	payload := map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"recipients":       recipients,
	}

	// The send dialog reads "remaining" from this response to say how long a
	// continuous run will take, and it has to count the campaign's own audience,
	// not the whole contact list.
	if audience, aErr := parseWAAudience(campaign.TargetFilter); aErr != nil {
		payload["remaining"] = 0
		payload["audience_error"] = aErr.Error()
	} else if remaining, cErr := h.countUnreached(accountID, campaign.ID, audience); cErr == nil {
		payload["remaining"] = remaining
	}

	return response.Success(c, payload)
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

	// Delete campaign and its messages
	tx, _ := h.db.Beginx()
	tx.Exec("DELETE FROM wa_campaign_messages WHERE campaign_id = $1", id)
	result, err2 := tx.Exec("DELETE FROM wa_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
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

	client, sessionID, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	// The template is rendered here rather than referenced by id: the gateway
	// sends text, so header, body and footer are flattened into one message. No
	// parameters on a test send, so any {{n}} placeholders stay visible, which is
	// what you want when checking a template reads correctly.
	body := openwa.RenderTemplate(tmpl.HeaderText, tmpl.BodyText, tmpl.FooterText, nil)

	result, err := client.SendText(c.Request().Context(), sessionID, req.Phone, body)
	if err != nil {
		if errors.Is(err, openwa.ErrNoConnectedSession) {
			return response.Error(c, http.StatusConflict,
				"No WhatsApp number is linked. Ask an administrator to scan the QR code.")
		}

		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to send test message: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"message_id": result.Identifier(),
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

	// A campaign that stopped can always be started again: who has already been
	// reached is recorded in wa_campaign_messages, so resuming never re-messages
	// anyone. 'failed' used to be excluded here, which made it a dead end — five
	// places set it, nothing could clear it, and the only way out was deleting the
	// campaign, which cascades its message rows away and re-messages everyone.
	switch campaign.Status {
	case "draft", "paused", "failed":
	default:
		return response.BadRequest(c,
			"Campaign is "+campaign.Status+". Only a draft, paused or failed campaign can be sent.")
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

	// Two ways to pace a campaign.
	//
	// Batch mode sends a fixed number now and parks the campaign so an operator
	// starts the next phase by hand. Continuous mode keeps going until the list is
	// exhausted, leaving a chosen gap between messages.
	//
	// Either way something has to hold the rate down: the transport is an
	// unofficial WhatsApp client on a single number, and a fast run at strangers is
	// the surest way to get it restricted. In batch mode the batch size is that
	// brake; in continuous mode the interval is.
	var req struct {
		BatchSize       int  `json:"batch_size"`
		Continuous      bool `json:"continuous"`
		IntervalSeconds int  `json:"interval_seconds"`
	}
	_ = c.Bind(&req)

	const (
		defaultBatch = 50
		maxBatch     = 500
	)

	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = defaultBatch
	}

	if batchSize > maxBatch {
		batchSize = maxBatch
	}

	intervalSeconds := resolveSendInterval(req.Continuous, req.IntervalSeconds)

	audience, err := parseWAAudience(campaign.TargetFilter)
	if err != nil {
		return response.BadRequest(c, "This campaign's audience can't be read ("+err.Error()+
			"). Edit the campaign and choose its groups or tags again.")
	}

	// Contacts in this campaign's audience that it has not reached yet.
	remainingCount, err := h.countUnreached(accountID, campaign.ID, audience)
	if err != nil {
		log.Printf("[whatsapp] Campaign %d: counting recipients: %v", campaign.ID, err)

		return response.InternalError(c, "Could not work out who this campaign goes to")
	}

	// total_targets is the whole audience for this campaign, not the size of the
	// run being started: sent_count accumulates across every phase, and the UI
	// draws its progress bar as sent_count / total_targets. Storing just this
	// run's target made that fraction exceed 100% on the second phase, and a
	// continuous run over 30,000 contacts would have taken it wildly past.
	var alreadyAttempted int
	h.db.Get(&alreadyAttempted, `SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = $1`, campaign.ID)

	if remainingCount == 0 {
		return response.BadRequest(c, noRecipientsMessage(audience, alreadyAttempted))
	}

	targetCount := batchSize
	if req.Continuous || remainingCount < targetCount {
		targetCount = remainingCount
	}

	audienceTotal := alreadyAttempted + remainingCount

	// Persist the pacing alongside the status. The resumer that picks a campaign
	// back up after a restart reads these columns rather than being told again.
	now := time.Now()
	// Claim the campaign and start it in one statement. The status was read a few
	// lines above and written here, so two requests arriving together could both
	// pass the guard and launch a sender; each holds its own in-memory copy of the
	// contact list, and a contact's wa_campaign_messages row is only written when
	// its turn comes, so the usual "skip anyone already messaged" protection does
	// not help — the same person gets the message twice. Repeating the status
	// condition in the WHERE clause makes exactly one of them win.
	claimed, err := h.db.Exec(`
		UPDATE wa_campaigns SET
			status = 'sending',
			total_targets = $1,
			started_at = $2,
			continuous = $4,
			send_interval_seconds = $5,
			updated_at = NOW()
		WHERE id = $3 AND status IN ('draft', 'paused', 'failed')
	`, audienceTotal, now, campaign.ID, req.Continuous, intervalSeconds)

	if err != nil {
		return response.BadRequest(c, "Could not start the campaign")
	}

	if rows, _ := claimed.RowsAffected(); rows == 0 {
		return response.BadRequest(c, "This campaign is already sending")
	}

	// Launch sending in background goroutine
	go h.executeCampaignSend(campaign.ID, accountID, batchSize, tmpl)

	if req.Continuous {
		// Tell the operator up front how long this will take. At one message every
		// 30 seconds a 30,000-contact list runs for ten days, which is not obvious
		// from picking "30" in a form.
		// Widen before multiplying, and cap: a big enough audience times a long
		// interval overflows the nanosecond arithmetic and silently wraps negative,
		// which would print a finish date in the past.
		etaSeconds := int64(targetCount) * int64(intervalSeconds)
		if maxSeconds := int64(math.MaxInt64 / int64(time.Second)); etaSeconds > maxSeconds {
			etaSeconds = maxSeconds
		}

		eta := time.Duration(etaSeconds) * time.Second

		return response.Success(c, map[string]interface{}{
			"status":           "sending",
			"mode":             "continuous",
			"sending_now":      targetCount,
			"remaining_after":  0,
			"total_remaining":  remainingCount,
			"interval_seconds": intervalSeconds,
			"estimated_finish": now.Add(eta).UTC().Format(time.RFC3339),
			"message": fmt.Sprintf(
				"Sending to all %d remaining contacts, one every %ds. At that pace this takes about %s and will keep running on its own — pause the campaign to stop it.",
				targetCount, intervalSeconds, humaniseDuration(eta)),
		})
	}

	return response.Success(c, map[string]interface{}{
		"status":          "sending",
		"mode":            "batch",
		"sending_now":     targetCount,
		"remaining_after": remainingCount - targetCount,
		"total_remaining": remainingCount,
		"message":         fmt.Sprintf("Sending to %d contacts. %d will remain — run the campaign again to continue.", targetCount, remainingCount-targetCount),
	})
}

// humaniseDuration renders a send window the way an operator would say it, so a
// ten-day run reads as "10 days" rather than "240h0m0s".
func humaniseDuration(d time.Duration) string {
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%d seconds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%d minutes", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%.1f hours", d.Hours())
	default:
		return fmt.Sprintf("%.1f days", d.Hours()/24)
	}
}

// maxIntervalSeconds bounds the gap between two campaign messages, in both the
// request that sets it and the sender that reads it back. One hour is already far
// slower than anyone needs; the bound exists so the value can never reach
// time.Duration arithmetic large enough to overflow and panic time.NewTicker.
const maxIntervalSeconds = 3600

const (
	defaultIntervalSeconds = 30
	minIntervalSeconds     = 1
)

// resolveSendInterval decides what goes in wa_campaigns.send_interval_seconds.
//
// The interval belongs to continuous mode. A batch run stores 0, which tells the
// sender to pace from the account's send rate instead. That distinction matters
// because the send dialog posts interval_seconds whatever the mode: taking the
// value unconditionally paced a 500-contact phase at the continuous default of
// 30s, four hours instead of the four minutes the dialog promises.
func resolveSendInterval(continuous bool, requested int) int {
	if !continuous {
		return 0
	}

	switch {
	case requested <= 0:
		return defaultIntervalSeconds
	case requested < minIntervalSeconds:
		return minIntervalSeconds
	case requested > maxIntervalSeconds:
		return maxIntervalSeconds
	default:
		return requested
	}
}

// executeCampaignSend runs in background and sends messages to all contacts.
func (h *WhatsAppHandler) executeCampaignSend(campaignID, accountID, batchSize int, tmpl WATemplate) {
	client, sessionID, settings, err := h.getClient(accountID)
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

	// The campaign's audience. An unreadable one stops the run: sending to
	// everyone instead is how a campaign aimed at one group used to reach the
	// whole list.
	audience, err := parseWAAudience(campaign.TargetFilter)
	if err != nil {
		log.Printf("[whatsapp] Campaign %d: not sending, %v", campaignID, err)
		h.db.Exec("UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)

		return
	}

	// Only contacts in the audience this campaign has not already reached. Sending
	// stays resumable either way: re-running a campaign, or picking one back up
	// after a restart, continues where it stopped rather than messaging everyone a
	// second time.
	//
	// A batch run takes one phase worth; a continuous run takes the lot and paces
	// itself with the interval instead.
	limit := batchSize
	if campaign.Continuous {
		limit = 0
	}

	contacts, err := h.unreachedContacts(accountID, campaignID, audience, limit)
	if err != nil {
		log.Printf("[whatsapp] Campaign %d: failed to fetch contacts: %v", campaignID, err)
		h.db.Exec("UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	// This runs detached from the HTTP request that started it, so it needs its
	// own context rather than one that is cancelled the moment the caller's
	// response is written.
	sendCtx := context.Background()

	// A campaign must not start against a session that cannot send. Without this
	// the loop walks the entire contact list marking every recipient failed: one
	// run against a logged-out session burned through 15,783 contacts in three
	// minutes before it was stopped by hand.
	session, sErr := client.GetSession(sendCtx, sessionID)
	if sErr != nil || !session.Connected() {
		state := "unreachable"
		if session != nil {
			state = session.Status
		}

		// Park rather than fail. The number being offline is a transient, recoverable
		// condition — most often the gateway container still coming up right after a
		// deploy — and marking it failed used to strand the campaign for good.
		log.Printf("[whatsapp] Campaign %d: not starting, session is %s — parked at paused", campaignID, state)
		h.db.Exec(`UPDATE wa_campaigns SET status='paused', updated_at=NOW() WHERE id=$1`, campaignID)

		return
	}

	// Work out the gap between messages.
	//
	// An explicit interval wins: it is the whole point of a continuous run, and it
	// is the only brake on one. Otherwise fall back to the account's send rate,
	// clamped — that value was set when the transport was Meta's official API,
	// where 100 a second was plausible, and account 20 still holds 100. The gateway
	// that replaced it throttles far below that and answers 429, and an unofficial
	// client sending that fast is the surest way to get the number restricted.
	const maxSendRate = 2

	var gap time.Duration

	switch {
	case campaign.SendIntervalSeconds > 0:
		// Clamp what came out of the database, not just what came in over HTTP.
		// time.NewTicker panics on a non-positive duration, and this goroutine has
		// no recover() above it, so a stored value large enough to overflow the
		// int64 nanosecond arithmetic would take the whole process down.
		seconds := campaign.SendIntervalSeconds
		if seconds > maxIntervalSeconds {
			log.Printf("[whatsapp] Campaign %d: stored interval %ds is out of range, using %ds",
				campaignID, seconds, maxIntervalSeconds)
			seconds = maxIntervalSeconds
		}

		gap = time.Duration(seconds) * time.Second
	default:
		sendRate := settings.SendRate
		if sendRate <= 0 {
			sendRate = 10
		}

		if sendRate > maxSendRate {
			log.Printf("[whatsapp] Campaign %d: send rate %d/s clamped to %d/s for the WhatsApp gateway",
				campaignID, sendRate, maxSendRate)
			sendRate = maxSendRate
		}

		gap = time.Second / time.Duration(sendRate)
	}

	log.Printf("[whatsapp] Campaign %d: %d to send, one every %s%s",
		campaignID, len(contacts), gap,
		map[bool]string{true: " (continuous, runs to completion)", false: " (single phase)"}[campaign.Continuous])

	var mu sync.Mutex
	sentCount := 0
	failedCount := 0

	// A campaign is sent in phases, so the counters on wa_campaigns accumulate
	// across every phase — the writes below add to them rather than assigning.
	// These track how much of this phase has already been added, so the periodic
	// flush and the final write between them count each message exactly once.
	flushedSent := 0
	flushedFailed := 0

	// Record whatever has not been written yet. Every way out of the send loop
	// goes through this, including the early returns for a user pause and for the
	// consecutive-failure abort — both of those used to return without recording
	// the messages the phase had already sent, so those sends vanished from the
	// campaign's totals while their per-recipient rows remained.
	flushCounters := func() {
		mu.Lock()
		deltaSent := sentCount - flushedSent
		deltaFailed := failedCount - flushedFailed
		flushedSent = sentCount
		flushedFailed = failedCount
		mu.Unlock()

		if deltaSent == 0 && deltaFailed == 0 {
			return
		}

		h.db.Exec(`
			UPDATE wa_campaigns SET
				sent_count = COALESCE(sent_count, 0) + $1,
				failed_count = COALESCE(failed_count, 0) + $2,
				updated_at = NOW()
			WHERE id = $3
		`, deltaSent, deltaFailed, campaignID)
	}

	// If the transport starts refusing everything — the session dropped, or the
	// gateway is rate-limiting — stop rather than marking the rest of the list
	// failed. Those recipients have not been contacted and should stay eligible
	// for a retry.
	consecutiveFailures := 0
	const maxConsecutiveFailures = 20

	// Wait out the gap between two messages, watching for the operator stopping the
	// campaign while we wait. Returns the status that ended the wait, or "" to carry
	// on sending.
	//
	// This used to be a plain <-ticker.C followed by one status read. That was fine
	// at two messages a second, but a continuous run can be paced up to an hour
	// apart, and Pause is the only control an operator has over a run that lasts
	// days — it must not sit unnoticed until the next message happens to be due.
	waitOrStop := func(d time.Duration) string {
		const poll = 3 * time.Second

		deadline := time.Now().Add(d)

		for {
			var status string
			h.db.Get(&status, "SELECT status FROM wa_campaigns WHERE id = $1", campaignID)

			if status == "paused" || status == "cancelled" {
				return status
			}

			left := time.Until(deadline)
			if left <= 0 {
				return ""
			}

			if left > poll {
				left = poll
			}

			time.Sleep(left)
		}
	}

	for i, contact := range contacts {
		// Pace between messages, not before the first one.
		wait := gap
		if i == 0 {
			wait = 0
		}

		if status := waitOrStop(wait); status != "" {
			log.Printf("[whatsapp] Campaign %d: %s by user", campaignID, status)
			flushCounters()

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

		// Render the template with this contact's parameters into the plain text
		// the gateway sends.
		body := openwa.RenderTemplate(tmpl.HeaderText, tmpl.BodyText, tmpl.FooterText, params)

		result, err := client.SendText(sendCtx, sessionID, contact.Phone, body)

		// The gateway's send governor refusing is not this contact failing. It is
		// the linked number having reached its allowance for the day, or its much
		// smaller allowance for people it has never messaged before, or its failure
		// breaker opening. Those are the protections that keep the number from being
		// banned, so the campaign stops and waits rather than pushing through.
		//
		// The queued row has to go: rows in wa_campaign_messages are what "already
		// reached" means, so leaving one behind would quietly drop this contact from
		// every future run without a message ever having been sent to them.
		if paced := (*openwa.PacingLimitedError)(nil); errors.As(err, &paced) {
			h.db.Exec(`DELETE FROM wa_campaign_messages WHERE id = $1`, msgID)

			log.Printf("[whatsapp] Campaign %d: paused by the send governor — %s (retry after %s). "+
				"%d recipients untouched and still eligible.",
				campaignID, paced.Reason, paced.RetryAfter, len(contacts)-(sentCount+failedCount))

			flushCounters()
			h.db.Exec(`UPDATE wa_campaigns SET status='paused', updated_at=NOW() WHERE id=$1`, campaignID)

			return
		}

		if err != nil {
			log.Printf("[whatsapp] Campaign %d: failed to send to %s: %v", campaignID, contact.Phone, err)
			h.db.Exec(`
				UPDATE wa_campaign_messages SET status = 'failed', error_reason = $1, failed_at = NOW() WHERE id = $2
			`, err.Error(), msgID)
			mu.Lock()
			failedCount++
			consecutiveFailures++
			stop := consecutiveFailures >= maxConsecutiveFailures
			mu.Unlock()

			if stop {
				log.Printf("[whatsapp] Campaign %d: %d sends failed in a row, stopping with %d recipients untouched",
					campaignID, consecutiveFailures, len(contacts)-(sentCount+failedCount))
				// Stopping here is the safety valve working, not the campaign failing.
				// Park it so an operator can check the number and continue; the
				// untouched recipients stay eligible.
				flushCounters()
				h.db.Exec(`UPDATE wa_campaigns SET status='paused', updated_at=NOW() WHERE id=$1`, campaignID)

				return
			}

			continue
		}

		mu.Lock()
		consecutiveFailures = 0
		mu.Unlock()

		// Update message with Gupshup message ID
		h.db.Exec(`
			UPDATE wa_campaign_messages SET gupshup_msg_id = $1, status = 'submitted', submitted_at = NOW() WHERE id = $2
		`, result.MessageID, msgID)

		mu.Lock()
		sentCount++
		mu.Unlock()

		// Flush progress periodically so the dashboard moves during a long phase.
		//
		// This used to assign the running totals outright, which contradicted the
		// accumulating write at the end of the phase: with a batch size that is a
		// multiple of 50 the flush fired, set the counters to this phase's totals,
		// and then the final write added those same totals on top. A 50-recipient
		// phase that sent 44 and failed 6 was recorded as 88 sent and 12 failed.
		// Assigning was also wrong on its own, since it discarded whatever earlier
		// phases had already recorded. Add the delta since the last flush instead.
		if (sentCount+failedCount)%50 == 0 {
			flushCounters()
		}
	}

	// How many contacts in the audience this campaign still has not reached.
	remaining, countErr := h.countUnreached(accountID, campaignID, audience)

	// A phase that leaves people unreached parks the campaign rather than
	// declaring it sent, so the next run picks up exactly where this one ended.
	// If the count itself failed, park it too: "sent" is a claim that nobody is
	// left, and that could not be checked.
	finalStatus := "sent"
	if remaining > 0 || countErr != nil {
		finalStatus = "paused"
	}

	if countErr != nil {
		log.Printf("[whatsapp] Campaign %d: counting who is left failed, parking: %v", campaignID, countErr)
	}

	// Only whatever the periodic flush has not already recorded.
	h.db.Exec(`
		UPDATE wa_campaigns SET
			status = $4,
			sent_count = COALESCE(sent_count, 0) + $1,
			failed_count = COALESCE(failed_count, 0) + $2,
			completed_at = CASE WHEN $4 = 'sent' THEN NOW() ELSE completed_at END,
			updated_at = NOW()
		WHERE id = $3
	`, sentCount-flushedSent, failedCount-flushedFailed, campaignID, finalStatus)

	log.Printf("[whatsapp] Campaign %d: phase finished — sent %d, failed %d, %d still to reach (status %s)",
		campaignID, sentCount, failedCount, remaining, finalStatus)
}

// ResumeInterruptedCampaigns picks up campaigns that were mid-send when the
// process last stopped. Call it once at startup.
//
// A campaign's progress lives in wa_campaign_messages, not in the goroutine, so
// resuming is just starting again: the contact query skips everyone already
// messaged. Without this a run left at 'sending' by a deploy or a crash sits
// there for ever, looking active while nothing is happening — tolerable when a
// phase lasted five minutes, but a continuous run over a 30,000-contact list
// takes days and will span several deploys.
//
// Continuous campaigns restart on their own. A batch run is deliberately left
// alone: its phase size was never persisted, and silently choosing one would send
// a different number of messages than the operator asked for. Those are moved to
// 'paused' instead, which is both true and actionable.
// waitForGateway blocks until the account's WhatsApp session is ready to send, or
// gives up after a few minutes.
//
// The resumer runs the instant the process boots, and the gateway is a separate
// container restarted by the same deploy. Without this wait the resumed run hit
// its pre-flight session check while whatsapp-web.js was still authenticating and
// stopped immediately — so every deploy would halt the very campaign the resumer
// exists to keep alive.
func (h *WhatsAppHandler) waitForGateway(accountID int) bool {
	const (
		attempts = 30
		delay    = 10 * time.Second
	)

	for attempt := 1; attempt <= attempts; attempt++ {
		client, sessionID, _, err := h.getClient(accountID)
		if err == nil && sessionID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			session, sErr := client.GetSession(ctx, sessionID)
			cancel()

			if sErr == nil && session.Connected() {
				return true
			}
		}

		if attempt == attempts {
			break
		}

		time.Sleep(delay)
	}

	return false
}

func (h *WhatsAppHandler) ResumeInterruptedCampaigns() {
	var interrupted []struct {
		ID           int             `db:"id"`
		AccountID    int             `db:"account_id"`
		TemplateID   *int            `db:"template_id"`
		Continuous   bool            `db:"continuous"`
		TargetFilter json.RawMessage `db:"target_filter"`
	}

	if err := h.db.Select(&interrupted, `
		SELECT id, account_id, template_id, continuous, target_filter
		FROM wa_campaigns WHERE status = 'sending' ORDER BY id
	`); err != nil {
		log.Printf("[whatsapp] resume: could not look for interrupted campaigns: %v", err)

		return
	}

	if len(interrupted) == 0 {
		return
	}

	for _, campaign := range interrupted {
		if campaign.Continuous && !h.waitForGateway(campaign.AccountID) {
			// Leave it at 'sending' rather than parking it. Nothing is sending, but
			// the next restart's resumer will find it again and try once more; parking
			// it here would need a human to notice and press send.
			log.Printf("[whatsapp] resume: gateway not ready for account %d, leaving campaign %d for the next restart",
				campaign.AccountID, campaign.ID)

			continue
		}

		if !campaign.Continuous {
			h.db.Exec(`UPDATE wa_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`, campaign.ID)
			log.Printf("[whatsapp] resume: campaign %d was interrupted mid-phase, parked at paused", campaign.ID)

			continue
		}

		if campaign.TemplateID == nil {
			h.db.Exec(`UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`, campaign.ID)
			log.Printf("[whatsapp] resume: campaign %d has no template, marked failed", campaign.ID)

			continue
		}

		var tmpl WATemplate
		if err := h.db.Get(&tmpl, "SELECT * FROM wa_templates WHERE id = $1", *campaign.TemplateID); err != nil {
			h.db.Exec(`UPDATE wa_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`, campaign.ID)
			log.Printf("[whatsapp] resume: campaign %d template %d unreadable (%v), parked at paused",
				campaign.ID, *campaign.TemplateID, err)

			continue
		}

		audience, err := parseWAAudience(campaign.TargetFilter)
		if err != nil {
			h.db.Exec(`UPDATE wa_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`, campaign.ID)
			log.Printf("[whatsapp] resume: campaign %d not resumed, %v", campaign.ID, err)

			continue
		}

		remaining, err := h.countUnreached(campaign.AccountID, campaign.ID, audience)
		if err != nil {
			// Leave it at 'sending' so the next restart tries again, as when the
			// gateway is not ready.
			log.Printf("[whatsapp] resume: counting recipients for campaign %d failed, leaving it: %v", campaign.ID, err)

			continue
		}

		if remaining == 0 {
			h.db.Exec(`
				UPDATE wa_campaigns SET status = 'sent', completed_at = NOW(), updated_at = NOW() WHERE id = $1
			`, campaign.ID)
			log.Printf("[whatsapp] resume: campaign %d had already reached everyone, marked sent", campaign.ID)

			continue
		}

		log.Printf("[whatsapp] resume: continuing campaign %d, %d contacts still to reach", campaign.ID, remaining)
		go h.executeCampaignSend(campaign.ID, campaign.AccountID, remaining, tmpl)
	}
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
		TotalContacts  int `json:"total_contacts" db:"total_contacts"`
		OptedIn        int `json:"opted_in" db:"opted_in"`
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
		Phone       string     `json:"phone" db:"phone"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
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
			Phone       string     `json:"phone" db:"phone"`
			ErrorReason string     `json:"error_reason" db:"error_reason"`
			FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		}{}
	}

	payload := map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"failed_messages":  failedMessages,
		"remaining":        0,
	}

	// How many contacts in this campaign's audience it has still not reached.
	if audience, aErr := parseWAAudience(campaign.TargetFilter); aErr != nil {
		payload["audience_error"] = aErr.Error()
	} else if remaining, cErr := h.countUnreached(accountID, campaign.ID, audience); cErr == nil {
		payload["remaining"] = remaining
	}

	return response.Success(c, payload)
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
			ID          string          `json:"id"`
			GsID        string          `json:"gsId"`
			Type        string          `json:"type"`
			Destination string          `json:"destination"`
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
