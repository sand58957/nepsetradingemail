package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// Per-account WhatsApp numbers.
//
// The platform used to run one linked number for everybody: a super admin scanned
// a QR, and every account adopted whatever session happened to be ready. On a
// single-tenant install that is merely limiting. With real customers on it, it is
// worse than that — one account's campaign goes out from another account's phone,
// replies land in a stranger's inbox, and one tenant messaging people who never
// opted in gets everyone else's number banned along with theirs.
//
// So each account links its own number and sends from it. The rule that makes
// that safe is small and absolute: the session an endpoint acts on is always
// looked up from wa_settings for the authenticated account, and never taken from
// the request. There is deliberately no route here that accepts a session id.
//
// Linking is done by an owner or admin of the account, not by a super admin —
// scanning the QR requires the handset, and only the account holder has it.

// accountManager reports whether the caller may link or unlink this account's
// WhatsApp number. Owners and admins of the account can; so can a platform super
// admin, who has to be able to help a customer.
func (h *WhatsAppHandler) accountManager(c echo.Context) error {
	if mw.GetUserRole(c) == "superadmin" {
		return nil
	}

	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var role string

	err := h.db.Get(&role, `
		SELECT role FROM app_account_members WHERE account_id = $1 AND user_id = $2
	`, accountID, userID)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return response.Error(c, http.StatusForbidden, "You are not a member of this account")
		}

		return response.Error(c, http.StatusInternalServerError, "Could not check your permissions")
	}

	if role != "owner" && role != "admin" {
		return response.Error(c, http.StatusForbidden,
			"Only an owner or admin of this account can link a WhatsApp number")
	}

	return nil
}

// mySessionID returns the gateway session this account owns, or "" if it has not
// linked one. This is the only way a session id enters any handler in this file.
func (h *WhatsAppHandler) mySessionID(accountID int) (string, error) {
	settings, err := h.waSettings(accountID)
	if err != nil {
		return "", err
	}

	return settings.OpenWASessionID, nil
}

// sessionPayload renders a session for the UI, plus whether it can send.
func sessionPayload(s *openwa.Session) map[string]interface{} {
	phone := ""
	if s.Phone != nil {
		phone = *s.Phone
	}

	pushName := ""
	if s.PushName != nil {
		pushName = *s.PushName
	}

	lastError := ""
	if s.LastError != nil {
		lastError = *s.LastError
	}

	return map[string]interface{}{
		"id":         s.ID,
		"name":       s.Name,
		"status":     s.Status,
		"connected":  s.Connected(),
		"phone":      phone,
		"push_name":  pushName,
		"last_error": lastError,
	}
}

// GetMySession reports this account's own WhatsApp connection.
func (h *WhatsAppHandler) GetMySession(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Success(c, map[string]interface{}{
			"linked":  false,
			"session": nil,
		})
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	session, err := client.GetSession(c.Request().Context(), sessionID)
	if err != nil {
		// The stored session is gone from the gateway — deleted there, or the
		// gateway's storage was reset. Report it as unlinked rather than as an
		// error, and clear the stale id so the account can start again.
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.Status == http.StatusNotFound {
			h.db.Exec(`UPDATE wa_settings SET openwa_session_id = '', linked_phone = '', session_status = '',
				updated_at = NOW() WHERE account_id = $1`, accountID)

			return response.Success(c, map[string]interface{}{"linked": false, "session": nil})
		}

		return response.Error(c, http.StatusBadGateway, "Could not reach the WhatsApp gateway")
	}

	h.rememberSession(accountID, session)

	payload := map[string]interface{}{
		"linked":  true,
		"session": sessionPayload(session),
	}

	// Read back after rememberSession, which may just have noticed an unlink.
	if settings, err := h.waSettings(accountID); err == nil {
		if until, blocked := campaignsBlockedUntil(settings, time.Now()); blocked {
			payload["unlinked_at"] = settings.UnlinkedAt
			payload["campaigns_blocked_until"] = until
			payload["campaigns_blocked_message"] = unlinkCooldownMessage(settings, until)
		}
	}

	return response.Success(c, payload)
}

// rememberSession keeps wa_settings in step with what the gateway reports, so the
// send path and the dashboard agree without another round trip.
//
// It is also where an unlink is noticed outside a campaign. A session that asks
// for a QR code while a phone is still recorded against it has lost its link —
// WhatsApp unlinked it, or someone removed it from the phone's linked devices —
// and that starts the campaign cooldown (whatsapp_link_safety.go). Unlinking from
// this dashboard clears the phone first, so it does not count. The comparison
// reads the row's old linked_phone, which is what Postgres gives the right-hand
// side of an UPDATE, and that old value is also recorded as the number the
// unlink happened to.
func (h *WhatsAppHandler) rememberSession(accountID int, s *openwa.Session) {
	phone := ""
	if s.Phone != nil {
		phone = *s.Phone
	}

	if _, err := h.db.Exec(`
		UPDATE wa_settings SET
			unlinked_at = CASE WHEN linked_phone <> '' AND $3::text = 'qr_ready' THEN NOW() ELSE unlinked_at END,
			unlinked_phone = CASE WHEN linked_phone <> '' AND $3::text = 'qr_ready' THEN linked_phone ELSE unlinked_phone END,
			openwa_session_id = $1, linked_phone = $2, session_status = $3, updated_at = NOW()
		WHERE account_id = $4
	`, s.ID, phone, s.Status, accountID); err != nil {
		log.Printf("[whatsapp] caching session state for account %d: %v", accountID, err)
	}
}

// CreateMySession gives this account its own session on the gateway and starts it
// so a QR code is produced. If the account already has one, that is returned
// instead of a second being created.
func (h *WhatsAppHandler) CreateMySession(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	existing, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	if existing != "" {
		// Already has one. Start it again rather than creating a duplicate: two
		// sessions for one account would both be charged against it and only one
		// could ever be the sender.
		session, startErr := client.StartSession(c.Request().Context(), existing)
		if startErr != nil {
			if gwErr, ok := openwa.AsGatewayError(startErr); ok && gwErr.Status == http.StatusNotFound {
				// Stale id; fall through and make a new one.
				h.db.Exec(`UPDATE wa_settings SET openwa_session_id = '' WHERE account_id = $1`, accountID)
			} else {
				return response.Error(c, http.StatusBadGateway, "Could not start your WhatsApp session")
			}
		} else {
			h.rememberSession(accountID, session)

			return response.SuccessWithMessage(c, "Session starting. Fetch the QR code to link your number.",
				sessionPayload(session))
		}
	}

	// Name it after the account so it is identifiable on the gateway and in its
	// logs, which is otherwise a wall of opaque UUIDs once there are many tenants.
	var accountName string
	h.db.Get(&accountName, `SELECT name FROM app_accounts WHERE id = $1`, accountID)

	name := fmt.Sprintf("account-%d", accountID)
	if slug := slugifyAccountName(accountName); slug != "" {
		name = fmt.Sprintf("account-%d-%s", accountID, slug)
	}

	session, err := client.CreateSession(c.Request().Context(), name)
	if err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusConflict, gwErr.Message)
		}

		return response.Error(c, http.StatusBadGateway, "Could not create a WhatsApp session")
	}

	h.rememberSession(accountID, session)

	started, err := client.StartSession(c.Request().Context(), session.ID)
	if err == nil {
		h.rememberSession(accountID, started)
		session = started
	}

	return response.SuccessWithMessage(c, "Session created. Scan the QR code with the phone that owns the number.",
		sessionPayload(session))
}

// GetMyQR returns the linking code for this account's own session.
func (h *WhatsAppHandler) GetMyQR(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Error(c, http.StatusConflict,
			"This account has no WhatsApp session yet. Create one first.")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	qr, err := client.GetQR(c.Request().Context(), sessionID)
	if err != nil {
		// A QR only exists while the session is waiting to be scanned. Say so
		// rather than reporting a gateway fault.
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusConflict, gwErr.Message)
		}

		return response.Error(c, http.StatusBadGateway, "Could not fetch the QR code")
	}

	return response.Success(c, qr)
}

// StartMySession boots this account's session so it produces a QR code.
func (h *WhatsAppHandler) StartMySession(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Error(c, http.StatusConflict,
			"This account has no WhatsApp session yet. Create one first.")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	session, err := client.StartSession(c.Request().Context(), sessionID)
	if err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusConflict, gwErr.Message)
		}

		return response.Error(c, http.StatusBadGateway, "Could not start your WhatsApp session")
	}

	h.rememberSession(accountID, session)

	return response.SuccessWithMessage(c, "Session starting. Fetch the QR code to link your number.",
		sessionPayload(session))
}

// LogoutMySession unlinks this account's number. Re-linking needs a fresh scan.
func (h *WhatsAppHandler) LogoutMySession(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Error(c, http.StatusConflict, "This account has no WhatsApp number linked")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	if err := client.LogoutSession(c.Request().Context(), sessionID); err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); !ok || !gwErr.ClientFault() {
			return response.Error(c, http.StatusBadGateway, "Could not unlink the number")
		}
	}

	h.db.Exec(`UPDATE wa_settings SET linked_phone = '', session_status = 'disconnected', updated_at = NOW()
		WHERE account_id = $1`, accountID)

	return response.SuccessWithMessage(c, "Number unlinked. Scan a QR code to link again.", nil)
}

// DeleteMySession removes this account's session from the gateway entirely.
func (h *WhatsAppHandler) DeleteMySession(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Error(c, http.StatusConflict, "This account has no WhatsApp session")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	if err := client.DeleteSession(c.Request().Context(), sessionID); err != nil {
		if gwErr, ok := openwa.AsGatewayError(err); !ok || (!gwErr.ClientFault() && gwErr.Status != http.StatusNotFound) {
			return response.Error(c, http.StatusBadGateway, "Could not delete the session")
		}
	}

	// Clear it locally either way: a session the gateway no longer has must not
	// stay recorded here, or the account can never create a working one again.
	h.db.Exec(`UPDATE wa_settings SET openwa_session_id = '', linked_phone = '', session_status = '',
		updated_at = NOW() WHERE account_id = $1`, accountID)

	return response.SuccessWithMessage(c, "Session deleted", nil)
}

// TestMySession sends one message from this account's own number, so an operator
// can confirm a fresh link actually delivers without touching a campaign.
func (h *WhatsAppHandler) TestMySession(c echo.Context) error {
	if err := h.accountManager(c); err != nil {
		return err
	}

	accountID := mw.GetAccountID(c)

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

	sessionID, err := h.mySessionID(accountID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	if sessionID == "" {
		return response.Error(c, http.StatusConflict, "This account has no WhatsApp number linked")
	}

	client := openwa.NewClient(h.cfg.OpenWABaseURL, h.cfg.OpenWAAPIKey)

	result, err := client.SendText(c.Request().Context(), sessionID, req.Phone, req.Message)
	if err != nil {
		var paced *openwa.PacingLimitedError
		if errors.As(err, &paced) {
			return response.Error(c, http.StatusTooManyRequests,
				"Sending is paced to protect your number: "+paced.Reason)
		}

		if gwErr, ok := openwa.AsGatewayError(err); ok && gwErr.ClientFault() {
			return response.Error(c, http.StatusUnprocessableEntity, gwErr.Message)
		}

		if errors.Is(err, openwa.ErrNoConnectedSession) {
			return response.Error(c, http.StatusConflict, "Your WhatsApp number is not connected")
		}

		return response.Error(c, http.StatusBadGateway, "The test message could not be sent")
	}

	return response.SuccessWithMessage(c, "Test message sent", map[string]interface{}{
		"message_id": result.Identifier(),
	})
}

// slugifyAccountName reduces an account name to something safe to put in a
// session name: lowercase, alphanumerics and dashes, trimmed short.
func slugifyAccountName(name string) string {
	var b strings.Builder

	lastDash := true

	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case !lastDash:
			b.WriteByte('-')
			lastDash = true
		}

		if b.Len() >= 32 {
			break
		}
	}

	return strings.Trim(b.String(), "-")
}
