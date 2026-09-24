package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// Several WhatsApp numbers per account (migration 033).
//
// An account used to have exactly one, so support, sales and every brand it runs
// shared a number, and an unlink left it unable to send at all. Each number is a
// row here with its own gateway session, its own link state and its own hold
// after an unlink; one of them is the account's default.
//
// The rule that keeps this safe is the one the single-number code had: a handler
// acts on a row looked up by (account_id, id) for the authenticated account. The
// id in the URL is this table's own id, never the gateway session id — session
// ids are shared across tenants on one gateway, and guessing one would otherwise
// be enough to send as another tenant's phone or read its QR code.
//
// How many numbers an account may link is bounded here and, below that, by the
// gateway's own MAX_CONCURRENT_SESSIONS, which counts every tenant's sessions
// together. When the gateway refuses, its message is passed through rather than
// reported as a fault of ours.
const maxNumbersPerAccount = 3

// WANumber is one WhatsApp number an account can send from.
type WANumber struct {
	ID              int        `json:"id" db:"id"`
	AccountID       int        `json:"account_id" db:"account_id"`
	OpenWASessionID string     `json:"-" db:"openwa_session_id"`
	Label           string     `json:"label" db:"label"`
	LinkedPhone     string     `json:"linked_phone" db:"linked_phone"`
	SessionStatus   string     `json:"session_status" db:"session_status"`
	IsDefault       bool       `json:"is_default" db:"is_default"`
	UnlinkedAt      *time.Time `json:"unlinked_at" db:"unlinked_at"`
	UnlinkedPhone   string     `json:"unlinked_phone" db:"unlinked_phone"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// name returns what to call this number in a message to the operator.
func (n *WANumber) name() string {
	switch {
	case n.Label != "" && n.LinkedPhone != "":
		return n.Label + " (" + n.LinkedPhone + ")"
	case n.Label != "":
		return n.Label
	case n.LinkedPhone != "":
		return n.LinkedPhone
	default:
		return fmt.Sprintf("number %d", n.ID)
	}
}

// numbersOf returns every number an account has, the default first.
func (h *WhatsAppHandler) numbersOf(accountID int) ([]WANumber, error) {
	var numbers []WANumber

	err := h.db.Select(&numbers, `SELECT * FROM wa_numbers WHERE account_id = $1
		ORDER BY is_default DESC, id`, accountID)
	if err != nil {
		return nil, fmt.Errorf("could not read this account's WhatsApp numbers")
	}

	return numbers, nil
}

// numberOf returns one of this account's numbers, or nil when the id belongs to
// nobody or to another account — which the caller reports the same way, so an id
// cannot be probed for existence.
func (h *WhatsAppHandler) numberOf(accountID, id int) (*WANumber, error) {
	var number WANumber

	err := h.db.Get(&number, `SELECT * FROM wa_numbers WHERE id = $1 AND account_id = $2`, id, accountID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("could not read that WhatsApp number")
	}

	return &number, nil
}

// defaultNumberOf returns the number an account sends from unless a campaign says
// otherwise, or nil when it has none.
func (h *WhatsAppHandler) defaultNumberOf(accountID int) (*WANumber, error) {
	var number WANumber

	err := h.db.Get(&number, `SELECT * FROM wa_numbers WHERE account_id = $1
		ORDER BY is_default DESC, id LIMIT 1`, accountID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("could not read this account's WhatsApp number")
	}

	return &number, nil
}

// numberFromRequest resolves the :id path parameter to one of the authenticated
// account's numbers. A nil number means the request has already been answered —
// the response helpers return nil after writing an error, so callers must test
// the number, not the error: `if number == nil { return err }`.
func (h *WhatsAppHandler) numberFromRequest(c echo.Context) (*WANumber, error) {
	accountID := mw.GetAccountID(c)

	raw, err := validateParamID(c, "id")
	if err != nil || raw == "" {
		return nil, err
	}

	id, _ := strconv.Atoi(raw)

	number, err := h.numberOf(accountID, id)
	if err != nil {
		return nil, response.InternalError(c, err.Error())
	}

	if number == nil {
		return nil, response.NotFound(c, "No such WhatsApp number on this account")
	}

	return number, nil
}

// rememberNumber keeps a number's row in step with what the gateway reports, and
// is where an unlink outside a campaign is noticed: a session asking for a QR
// code while a phone is still recorded against it has lost its link, which starts
// that number's campaign hold (whatsapp_link_safety.go). Unlinking from the
// dashboard clears the phone first, so it does not count.
//
// A known phone is kept when the gateway's answer leaves it out — it does while
// a session is starting or reconnecting — and cleared only when the session asks
// for a QR code. Clearing it on every such answer lost the fact that the number
// was linked, and with it the ability to notice the unlink that followed.
func (h *WhatsAppHandler) rememberNumber(number *WANumber, s *openwa.Session) {
	phone := ""
	if s.Phone != nil {
		phone = *s.Phone
	}

	if _, err := h.db.Exec(`
		UPDATE wa_numbers SET
			unlinked_at = CASE WHEN linked_phone <> '' AND $2::text = 'qr_ready' THEN NOW() ELSE unlinked_at END,
			unlinked_phone = CASE WHEN linked_phone <> '' AND $2::text = 'qr_ready' THEN linked_phone ELSE unlinked_phone END,
			linked_phone = CASE WHEN $1::text <> '' THEN $1::text WHEN $2::text = 'qr_ready' THEN '' ELSE linked_phone END,
			session_status = $2, updated_at = NOW()
		WHERE id = $3
	`, phone, s.Status, number.ID); err != nil {
		log.Printf("[whatsapp] caching number %d state: %v", number.ID, err)
	}

	h.mirrorDefaultNumber(number.AccountID)
}

// mirrorDefaultNumber copies the account's default number into wa_settings.
//
// The public API, the settings screen and the credit checks were all written
// against those columns. Rather than change every one of them in the same step as
// the table they read from, the default number is written back here, so they keep
// describing the number the account sends from by default.
func (h *WhatsAppHandler) mirrorDefaultNumber(accountID int) {
	if _, err := h.db.Exec(`
		UPDATE wa_settings s SET
			openwa_session_id = COALESCE(n.openwa_session_id, ''),
			linked_phone = COALESCE(n.linked_phone, ''),
			session_status = COALESCE(n.session_status, ''),
			unlinked_at = n.unlinked_at,
			unlinked_phone = COALESCE(n.unlinked_phone, ''),
			updated_at = NOW()
		FROM (SELECT $1::int AS account_id) a
		LEFT JOIN LATERAL (
			SELECT openwa_session_id, linked_phone, session_status, unlinked_at, unlinked_phone
			FROM wa_numbers WHERE account_id = a.account_id ORDER BY is_default DESC, id LIMIT 1
		) n ON true
		WHERE s.account_id = a.account_id
	`, accountID); err != nil {
		log.Printf("[whatsapp] mirroring the default number for account %d: %v", accountID, err)
	}
}

// numberPayload renders a number for the dashboard, with its hold if it has one.
func (h *WhatsAppHandler) numberPayload(n *WANumber, session *openwa.Session, now time.Time) map[string]interface{} {
	status := n.SessionStatus
	phone := n.LinkedPhone
	connected := false
	lastError := ""

	if session != nil {
		status = session.Status
		connected = session.Connected()

		if session.Phone != nil && *session.Phone != "" {
			phone = *session.Phone
		}

		if session.LastError != nil {
			lastError = *session.LastError
		}
	}

	payload := map[string]interface{}{
		"id":           n.ID,
		"label":        n.Label,
		"linked_phone": phone,
		"status":       status,
		"connected":    connected,
		"is_default":   n.IsDefault,
		"last_error":   lastError,
		"linked":       n.OpenWASessionID != "",
	}

	if until, blocked := campaignsBlockedUntil(n, now); blocked {
		payload["campaigns_blocked_until"] = until
		payload["campaigns_blocked_message"] = unlinkCooldownMessage(n, until)
	}

	return payload
}

// ListMyNumbers reports every number this account can send from, with the live
// state of each from the gateway.
func (h *WhatsAppHandler) ListMyNumbers(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	numbers, err := h.numbersOf(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)
	now := time.Now()
	out := make([]map[string]interface{}, 0, len(numbers))

	for i := range numbers {
		number := &numbers[i]

		var session *openwa.Session

		if number.OpenWASessionID != "" {
			s, sErr := client.GetSession(c.Request().Context(), number.OpenWASessionID)
			switch {
			case sErr == nil:
				session = s

				h.rememberNumber(number, s)
			case isGatewayNotFound(sErr):
				// The gateway no longer has it — deleted there, or its storage was
				// reset. Clear the id so the account can link this slot again.
				h.db.Exec(`UPDATE wa_numbers SET openwa_session_id = '', linked_phone = '', session_status = '',
					updated_at = NOW() WHERE id = $1`, number.ID)
				h.mirrorDefaultNumber(accountID)

				number.OpenWASessionID = ""
			}
		}

		out = append(out, h.numberPayload(number, session, now))
	}

	return response.Success(c, map[string]interface{}{
		"numbers":   out,
		"max":       maxNumbersPerAccount,
		"remaining": maxNumbersPerAccount - len(numbers),
	})
}

// errNumberLimit says the account already has as many numbers as it may link.
var errNumberLimit = errors.New("this account is at its WhatsApp number limit")

// addNumber gives an account another number slot with a started gateway session,
// ready for a QR code. Shared by the per-number endpoint and by the older
// single-number one, so both create numbers the same way.
func (h *WhatsAppHandler) addNumber(ctx context.Context, accountID int, label string) (*WANumber, *openwa.Session, error) {
	numbers, err := h.numbersOf(accountID)
	if err != nil {
		return nil, nil, err
	}

	if len(numbers) >= maxNumbersPerAccount {
		return nil, nil, errNumberLimit
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	var accountName string
	h.db.Get(&accountName, `SELECT name FROM app_accounts WHERE id = $1`, accountID)

	// Name it after the account and the slot so it is identifiable in the
	// gateway's logs, which are otherwise a wall of UUIDs once there are many
	// tenants with several numbers each.
	name := fmt.Sprintf("account-%d", accountID)
	if slug := slugifyAccountName(accountName); slug != "" {
		name = fmt.Sprintf("account-%d-%s", accountID, slug)
	}

	if len(numbers) > 0 {
		name = fmt.Sprintf("%s-%d", name, len(numbers)+1)
	}

	session, err := client.CreateSession(ctx, name)
	if err != nil {
		return nil, nil, err
	}

	label = strings.TrimSpace(label)
	if len(label) > 40 {
		label = label[:40]
	}

	var numberID int

	if err := h.db.QueryRow(`
		INSERT INTO wa_numbers (account_id, openwa_session_id, label, session_status, is_default)
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, accountID, session.ID, label, session.Status, len(numbers) == 0).Scan(&numberID); err != nil {
		// Do not leave a session running on the gateway that nothing points at.
		client.DeleteSession(ctx, session.ID)

		return nil, nil, fmt.Errorf("could not record the new number")
	}

	if started, startErr := client.StartSession(ctx, session.ID); startErr == nil {
		session = started
	}

	number, err := h.numberOf(accountID, numberID)
	if err != nil || number == nil {
		return nil, nil, fmt.Errorf("could not read the new number back")
	}

	h.rememberNumber(number, session)
	number.SessionStatus = session.Status

	return number, session, nil
}

// AddMyNumber gives this account another number slot and starts a gateway session
// for it, so a QR code can be scanned.
func (h *WhatsAppHandler) AddMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	var req struct {
		Label string `json:"label"`
	}

	_ = c.Bind(&req)

	number, session, err := h.addNumber(c.Request().Context(), accountID, req.Label)
	if err != nil {
		return numberCreationError(c, err)
	}

	return response.SuccessWithMessage(c, "Number added. Scan the QR code with the phone that will send from it.",
		h.numberPayload(number, session, time.Now()))
}

// numberCreationError reports why a number could not be added, keeping the
// gateway's own words when it is the gateway refusing — most often its limit on
// how many numbers it runs at once, counted across every tenant.
func numberCreationError(c echo.Context, err error) error {
	if errors.Is(err, errNumberLimit) {
		return response.Error(c, http.StatusConflict, fmt.Sprintf(
			"This account already has %d WhatsApp numbers, which is the limit. Remove one before adding another.",
			maxNumbersPerAccount))
	}

	if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
		return response.Error(c, http.StatusConflict, gwErr.Message)
	}

	if _, ok := openwa.AsGatewayError(err); ok {
		return response.Error(c, http.StatusBadGateway, "Could not create a WhatsApp session")
	}

	return response.InternalError(c, err.Error())
}

// GetMyNumberQR returns the linking code for one of this account's numbers.
func (h *WhatsAppHandler) GetMyNumberQR(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	if number.OpenWASessionID == "" {
		return response.Error(c, http.StatusConflict, "This number has no session yet. Start it first.")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	qr, err := client.GetQR(c.Request().Context(), number.OpenWASessionID)
	if err != nil {
		// A QR code only exists while a session is waiting to be scanned.
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusConflict, gwErr.Message)
		}

		return response.Error(c, http.StatusBadGateway, "Could not fetch the QR code")
	}

	return response.Success(c, qr)
}

// StartMyNumber boots a number's session so it produces a QR code.
func (h *WhatsAppHandler) StartMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	if number.OpenWASessionID == "" {
		return response.Error(c, http.StatusConflict, "This number has no session. Remove it and add it again.")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	session, err := client.StartSession(c.Request().Context(), number.OpenWASessionID)
	if err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusConflict, gwErr.Message)
		}

		return response.Error(c, http.StatusBadGateway, "Could not start this number's session")
	}

	h.rememberNumber(number, session)

	return response.SuccessWithMessage(c, "Starting. Fetch the QR code to link the number.",
		h.numberPayload(number, session, time.Now()))
}

// RenameMyNumber sets what the account calls one of its numbers.
func (h *WhatsAppHandler) RenameMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	var req struct {
		Label string `json:"label"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	label := strings.TrimSpace(req.Label)
	if len(label) > 40 {
		label = label[:40]
	}

	h.db.Exec(`UPDATE wa_numbers SET label = $1, updated_at = NOW() WHERE id = $2`, label, number.ID)

	return response.SuccessWithMessage(c, "Name saved", nil)
}

// SetMyDefaultNumber picks which number campaigns and the API use unless they
// name another one.
func (h *WhatsAppHandler) SetMyDefaultNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	// Both writes in one transaction: a unique index allows an account only one
	// default, so clearing and setting must not be visible apart.
	tx, txErr := h.db.Begin()
	if txErr != nil {
		return response.InternalError(c, "Could not change the default number")
	}

	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE wa_numbers SET is_default = false, updated_at = NOW()
		WHERE account_id = $1 AND is_default AND id <> $2`, number.AccountID, number.ID); err != nil {
		return response.InternalError(c, "Could not change the default number")
	}

	if _, err := tx.Exec(`UPDATE wa_numbers SET is_default = true, updated_at = NOW() WHERE id = $1`,
		number.ID); err != nil {
		return response.InternalError(c, "Could not change the default number")
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Could not change the default number")
	}

	h.mirrorDefaultNumber(number.AccountID)

	return response.SuccessWithMessage(c, "Default number changed", nil)
}

// LogoutMyNumber unlinks the phone from one number, keeping the slot.
func (h *WhatsAppHandler) LogoutMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	if number.OpenWASessionID == "" {
		return response.Error(c, http.StatusConflict, "No phone is linked to this number")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	if err := client.LogoutSession(c.Request().Context(), number.OpenWASessionID); err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); !ok || !gwErr.ClientFault() {
			return response.Error(c, http.StatusBadGateway, "Could not unlink the number")
		}
	}

	// Clearing the phone first is what tells the unlink watcher that this was
	// deliberate, so it does not start a campaign hold.
	h.db.Exec(`UPDATE wa_numbers SET linked_phone = '', session_status = 'disconnected', updated_at = NOW()
		WHERE id = $1`, number.ID)
	h.mirrorDefaultNumber(number.AccountID)

	return response.SuccessWithMessage(c, "Number unlinked. Scan a QR code to link a phone again.", nil)
}

// DeleteMyNumber removes a number from the account and from the gateway.
func (h *WhatsAppHandler) DeleteMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	if number.OpenWASessionID != "" {
		client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

		if err := client.DeleteSession(c.Request().Context(), number.OpenWASessionID); err != nil {
			if gwErr, ok := openwa.AsGatewayError(err); !ok || (!gwErr.ClientFault() && gwErr.Status != http.StatusNotFound) {
				return response.Error(c, http.StatusBadGateway, "Could not delete this number's session")
			}
		}
	}

	// Campaign message rows keep pointing at nothing rather than disappearing:
	// wa_number_id is ON DELETE SET NULL, so a number can be removed without
	// losing what it sent.
	h.db.Exec(`DELETE FROM wa_numbers WHERE id = $1`, number.ID)

	// Whichever number is left becomes the default, so an account is never left
	// without one while it still has numbers.
	h.db.Exec(`UPDATE wa_numbers SET is_default = true, updated_at = NOW() WHERE id = (
		SELECT id FROM wa_numbers WHERE account_id = $1 ORDER BY id LIMIT 1
	) AND NOT EXISTS (SELECT 1 FROM wa_numbers WHERE account_id = $1 AND is_default)`, number.AccountID)

	h.mirrorDefaultNumber(number.AccountID)

	return response.SuccessWithMessage(c, "Number removed", nil)
}

// TestMyNumber sends one message from a chosen number, so an operator can confirm
// a fresh link delivers without touching a campaign.
func (h *WhatsAppHandler) TestMyNumber(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	number, err := h.numberFromRequest(c)
	if number == nil {
		return err
	}

	var req struct {
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone == "" {
		return response.BadRequest(c, "A destination phone number is required")
	}

	if strings.TrimSpace(req.Message) == "" {
		req.Message = "Test message from Nepal Fillings."
	}

	if _, err := openwa.ChatID(req.Phone); err != nil {
		return response.BadRequest(c, "That does not look like a usable phone number")
	}

	if number.OpenWASessionID == "" {
		return response.Error(c, http.StatusConflict, "No phone is linked to this number")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	result, err := client.SendText(c.Request().Context(), number.OpenWASessionID, req.Phone, req.Message)
	if err != nil {
		return response.Error(c, testSendStatus(err), testSendMessage(err))
	}

	return response.SuccessWithMessage(c, "Test message sent", map[string]interface{}{
		"message_id": result.Identifier(),
	})
}

// testSendStatus and testSendMessage turn a gateway failure into something an
// operator can act on, for both the per-number and the legacy test endpoints.
func testSendStatus(err error) int {
	var paced *openwa.PacingLimitedError

	switch {
	case errors.As(err, &paced):
		return http.StatusTooManyRequests
	case errors.Is(err, openwa.ErrNoConnectedSession):
		return http.StatusConflict
	}

	if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
		return http.StatusUnprocessableEntity
	}

	return http.StatusBadGateway
}

func testSendMessage(err error) string {
	var paced *openwa.PacingLimitedError

	switch {
	case errors.As(err, &paced):
		return "Sending is paced to protect your number: " + paced.Reason
	case errors.Is(err, openwa.ErrNoConnectedSession):
		return "That WhatsApp number is not connected"
	}

	if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
		return gwErr.Message
	}

	return "The test message could not be sent"
}

// isGatewayNotFound reports whether the gateway answered that it has no such
// session.
func isGatewayNotFound(err error) bool {
	gwErr, ok := openwa.AsGatewayError(err)

	return ok && gwErr.Status == http.StatusNotFound
}

// campaignSenders resolves the numbers a campaign sends from: every linked number
// when it spreads, otherwise the one it names, otherwise the account's default.
//
// Spreading does not send faster. The gap between messages is unchanged, so the
// same run is shared out and each number carries less of it — which is the point,
// since volume to people who never chatted with a number is what gets it
// unlinked. Sending the same campaign from several numbers at full speed would
// only lose them all together.
func (h *WhatsAppHandler) campaignSenders(accountID int, campaign *WACampaign) ([]WANumber, error) {
	if campaign.RotateNumbers {
		numbers, err := h.numbersOf(accountID)
		if err != nil {
			return nil, err
		}

		linked := numbers[:0]

		for _, n := range numbers {
			if n.OpenWASessionID != "" {
				linked = append(linked, n)
			}
		}

		if len(linked) == 0 {
			return nil, fmt.Errorf("no WhatsApp number is linked for this account — link one in WhatsApp settings")
		}

		return linked, nil
	}

	if campaign.WANumberID != nil {
		number, err := h.numberOf(accountID, *campaign.WANumberID)
		if err != nil {
			return nil, err
		}

		if number == nil {
			return nil, fmt.Errorf("the number this campaign sends from is no longer on this account — choose another")
		}

		if number.OpenWASessionID == "" {
			return nil, fmt.Errorf("no phone is linked to %s — link one in WhatsApp settings", number.name())
		}

		return []WANumber{*number}, nil
	}

	number, err := h.defaultNumberOf(accountID)
	if err != nil {
		return nil, err
	}

	if number == nil || number.OpenWASessionID == "" {
		return nil, fmt.Errorf("no WhatsApp number is linked for this account — link one in WhatsApp settings")
	}

	return []WANumber{*number}, nil
}

// sendableSenders drops the numbers that are waiting out an unlink, and says
// which they were so the caller can explain itself.
func sendableSenders(senders []WANumber, now time.Time) (ready []WANumber, held []WANumber) {
	for _, n := range senders {
		if _, blocked := campaignsBlockedUntil(&n, now); blocked {
			held = append(held, n)

			continue
		}

		ready = append(ready, n)
	}

	return ready, held
}
