// Package openwa talks to a self-hosted OpenWA gateway, which replaced Gupshup
// as the WhatsApp transport.
//
// The two are not equivalent and the difference matters when reading this code.
// Gupshup fronted Meta's official WhatsApp Business API: it had approved message
// templates, a wallet balance, and a phone number provisioned through Meta.
// OpenWA drives an unofficial client (whatsapp-web.js or Baileys) against a real
// WhatsApp account that someone linked by scanning a QR code. So there are no
// templates to list or submit for approval, no balance to read, and the transport
// is only usable while a human-linked session is connected. Callers must handle
// "no session connected" as a normal, expected state rather than an error case.
//
// The gateway is reachable only on the internal Docker network; it publishes no
// port. Requests authenticate with an API key sent as X-API-Key.
package openwa

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Client is a handle on one OpenWA gateway.
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// NewClient returns a client for the gateway at baseURL. A zero-value baseURL or
// apiKey yields a client whose calls fail with ErrNotConfigured, so callers can
// construct one unconditionally and report the misconfiguration at the point of
// use rather than at startup.
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		// Sends go through a headless browser on the gateway side and are not
		// instant; the read timeout is generous for that reason.
		http: &http.Client{Timeout: 45 * time.Second},
	}
}

// ErrNotConfigured is returned when the gateway URL or API key is missing.
var ErrNotConfigured = fmt.Errorf("openwa: gateway URL or API key is not configured")

// PacingLimitedError reports that the gateway's send governor refused a message
// to protect the linked number, rather than the message itself failing.
//
// The governor enforces three things per session: a total daily allowance that
// ramps with the session's age, a much smaller daily allowance for contacts the
// number has never exchanged a message with, and a breaker that opens after a run
// of consecutive send failures. All three are properties of the session and the
// day, not of the recipient — so a caller that records the recipient as failed
// would exclude a perfectly reachable person from every future run.
//
// The right response is to stop sending and come back after RetryAfter.
type PacingLimitedError struct {
	Reason     string
	RetryAfter time.Duration
}

func (e *PacingLimitedError) Error() string {
	return "openwa: send paced: " + e.Reason
}

// IsPacingLimited reports whether err is the gateway's send governor refusing.
func IsPacingLimited(err error) bool {
	var paced *PacingLimitedError

	return errors.As(err, &paced)
}

// GatewayError carries a non-2xx answer from the gateway along with the status it
// used, so callers can decide what it means to their own client.
//
// Most of these are not faults. Asking for a QR code while a session is
// disconnected, starting a session that is already running, sending to a number
// the engine cannot resolve — the gateway answers 4xx and explains itself, and
// that explanation is what an operator needs to see.
type GatewayError struct {
	Status  int
	Method  string
	Path    string
	Message string
}

func (e *GatewayError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("openwa: %s %s: %d: %s", e.Method, e.Path, e.Status, e.Message)
	}

	return fmt.Sprintf("openwa: %s %s: %d", e.Method, e.Path, e.Status)
}

// ClientFault reports whether the gateway blamed the request rather than itself,
// which means retrying it unchanged will not help.
func (e *GatewayError) ClientFault() bool { return e.Status >= 400 && e.Status < 500 }

// AsGatewayError extracts a GatewayError from err, if there is one.
func AsGatewayError(err error) (*GatewayError, bool) {
	var gwErr *GatewayError

	return gwErr, errors.As(err, &gwErr)
}

// gatewayMessage pulls the human-readable part out of the gateway's error body,
// which is JSON with a "message" field, falling back to the raw text.
func gatewayMessage(payload []byte) string {
	var body struct {
		Message any `json:"message"`
	}

	if json.Unmarshal(payload, &body) == nil {
		switch m := body.Message.(type) {
		case string:
			if m != "" {
				return m
			}
		case []any:
			// Validation errors come back as an array of strings.
			parts := make([]string, 0, len(m))
			for _, item := range m {
				if s, ok := item.(string); ok {
					parts = append(parts, s)
				}
			}

			if len(parts) > 0 {
				return strings.Join(parts, "; ")
			}
		}
	}

	return snippet(payload)
}

// ErrNoConnectedSession is returned when a send is attempted with no session in
// the ready state. This is an ordinary operational state — nobody has linked
// a phone yet, or the link dropped — not a bug, and callers should surface it as
// an actionable message rather than a 500.
var ErrNoConnectedSession = fmt.Errorf("openwa: no connected WhatsApp session")

// Session mirrors the gateway's session object.
type Session struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Status      string  `json:"status"`
	Phone       *string `json:"phone"`
	PushName    *string `json:"pushName"`
	ConnectedAt *string `json:"connectedAt"`
	LastActive  *string `json:"lastActive"`
	LastError   *string `json:"lastError"`
	Restriction *string `json:"restriction"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

// Connected reports whether this session can currently send.
func (s Session) Connected() bool { return s.Status == StatusReady }

// Session statuses, taken from the gateway's own SessionStatus enum. There is
// deliberately no "connected": an earlier version of this file guessed that
// name from a start-response payload, and because the gateway never emits it,
// every readiness check silently answered false — a linked, working number
// still reported "no session linked" and no message could be sent.
const (
	StatusCreated        = "created"
	StatusInitializing   = "initializing"
	StatusQRReady        = "qr_ready"
	StatusAuthenticating = "authenticating"
	StatusReady          = "ready" // the one status in which sends succeed
	StatusDisconnected   = "disconnected"
	StatusActionRequired = "action_required"
	StatusFailed         = "failed"
)

// QR carries a scannable code for linking a phone.
type QR struct {
	// QRCode is a ready-to-render data URI ("data:image/png;base64,..."),
	// so the admin UI can put it straight in an <img src>.
	QRCode string `json:"qrCode"`
	Status string `json:"status"`
}

// SendResult identifies a delivered message.
type SendResult struct {
	ID        string `json:"id"`
	MessageID string `json:"messageId"`
	ChatID    string `json:"chatId"`
	Status    string `json:"status"`
	Timestamp int64  `json:"timestamp"`
}

// MessageID returns whichever identifier the gateway populated, so callers have
// one field to store regardless of engine.
func (r SendResult) Identifier() string {
	if r.MessageID != "" {
		return r.MessageID
	}

	return r.ID
}

func (c *Client) configured() bool { return c.baseURL != "" && c.apiKey != "" }

// do issues a request and decodes the JSON body into out (which may be nil).
func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	if !c.configured() {
		return ErrNotConfigured
	}

	var reader io.Reader

	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("openwa: encoding request: %w", err)
		}

		reader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("openwa: building request: %w", err)
	}

	req.Header.Set("X-API-Key", c.apiKey)

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("openwa: %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	// Cap the read: a compromised or wedged gateway should not be able to
	// exhaust memory here.
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return fmt.Errorf("openwa: reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// 409 is the gateway's way of saying the session is not connected.
		if resp.StatusCode == http.StatusConflict {
			return ErrNoConnectedSession
		}

		// 429 with the pacing code is the gateway's send governor holding the
		// session back — a daily cap, the cold-contact allowance, or the failure
		// breaker. It says nothing about the recipient, so it must be told apart
		// from a real send failure: treated as one, the caller records the contact
		// as failed and permanently excludes them from later runs.
		if resp.StatusCode == http.StatusTooManyRequests {
			var refusal struct {
				Code              string `json:"code"`
				Message           string `json:"message"`
				RetryAfterSeconds int    `json:"retryAfterSeconds"`
			}

			if json.Unmarshal(payload, &refusal) == nil && refusal.Code == "SEND_PACING_LIMITED" {
				return &PacingLimitedError{
					Reason:     refusal.Message,
					RetryAfter: time.Duration(refusal.RetryAfterSeconds) * time.Second,
				}
			}
		}

		// Keep the gateway's own status. A 4xx from it is almost always a normal
		// operational state an operator needs to read — "this session has no QR
		// right now, start it first" — and flattening every one of them into a 502
		// turned those into alarming gateway faults that the settings page then
		// retried in a loop, 300 times in an hour.
		return &GatewayError{
			Status:  resp.StatusCode,
			Method:  method,
			Path:    path,
			Message: gatewayMessage(payload),
		}
	}

	if out == nil {
		return nil
	}

	if err := json.Unmarshal(payload, out); err != nil {
		return fmt.Errorf("openwa: decoding response: %w", err)
	}

	return nil
}

// snippet trims a response body for inclusion in an error, so a large HTML error
// page does not end up in the logs verbatim.
func snippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 240 {
		s = s[:240] + "…"
	}

	return s
}

// ListSessions returns every session the API key can see.
func (c *Client) ListSessions(ctx context.Context) ([]Session, error) {
	var out []Session

	if err := c.do(ctx, http.MethodGet, "/api/sessions", nil, &out); err != nil {
		return nil, err
	}

	return out, nil
}

// CreateSession registers a new session. It does not connect: the caller must
// Start it and have someone scan the resulting QR code.
func (c *Client) CreateSession(ctx context.Context, name string) (*Session, error) {
	var out Session

	if err := c.do(ctx, http.MethodPost, "/api/sessions", map[string]string{"name": name}, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

// GetSession reads one session's current state.
func (c *Client) GetSession(ctx context.Context, id string) (*Session, error) {
	var out Session

	if err := c.do(ctx, http.MethodGet, "/api/sessions/"+id, nil, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

// StartSession boots the engine so a QR code can be produced.
func (c *Client) StartSession(ctx context.Context, id string) (*Session, error) {
	var out Session

	if err := c.do(ctx, http.MethodPost, "/api/sessions/"+id+"/start", map[string]any{}, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

// StopSession shuts the engine down but keeps the linked account.
func (c *Client) StopSession(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodPost, "/api/sessions/"+id+"/stop", map[string]any{}, nil)
}

// LogoutSession unlinks the phone. The next Start needs a fresh QR scan.
func (c *Client) LogoutSession(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodPost, "/api/sessions/"+id+"/logout", map[string]any{}, nil)
}

// DeleteSession removes the session entirely.
func (c *Client) DeleteSession(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/api/sessions/"+id, nil, nil)
}

// GetQR fetches the current linking code. It is only meaningful while the
// session status is qr_ready.
func (c *Client) GetQR(ctx context.Context, id string) (*QR, error) {
	var out QR

	if err := c.do(ctx, http.MethodGet, "/api/sessions/"+id+"/qr", nil, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

// SendText sends a plain text message. phone may be given in any human format;
// it is normalised to the gateway's chat id.
func (c *Client) SendText(ctx context.Context, sessionID, phone, text string) (*SendResult, error) {
	chatID, err := ChatID(phone)
	if err != nil {
		return nil, err
	}

	var out SendResult

	body := map[string]string{"chatId": chatID, "text": text}
	if err := c.do(ctx, http.MethodPost, "/api/sessions/"+sessionID+"/messages/send-text", body, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

var nonDigits = regexp.MustCompile(`\D`)

// ChatID converts a phone number to the gateway's chat identifier.
//
// WhatsApp addresses individuals as "<country><number>@c.us" with no plus sign
// and no separators. Nepali numbers are frequently stored locally as ten digits
// beginning 97xxxxxxxx or 98xxxxxxxx, which are indistinguishable from a
// country-coded number by prefix alone, so length decides: exactly ten digits
// starting 9 is treated as a local Nepali mobile and gets the 977 country code.
func ChatID(phone string) (string, error) {
	digits := nonDigits.ReplaceAllString(phone, "")

	// Some inputs arrive as 00977…; strip the international access prefix.
	digits = strings.TrimPrefix(digits, "00")

	// "098…" is how a Nepali mobile is written locally, and it is the form that
	// arrives from most address books and CSV exports. The leading 0 is a national
	// trunk prefix and never part of an international number — no country code
	// begins with 0 — so it has to come off before the length is measured.
	// Left on, the number stayed 11 digits, skipped the country-code branch below,
	// and was handed to the gateway as 09805749767@c.us: a chat id that belongs to
	// nobody, so the message silently went nowhere.
	digits = strings.TrimPrefix(digits, "0")

	if len(digits) == 10 && strings.HasPrefix(digits, "9") {
		digits = "977" + digits
	}

	if len(digits) < 10 || len(digits) > 15 {
		return "", &InvalidPhoneError{Phone: phone}
	}

	return digits + "@c.us", nil
}

// InvalidPhoneError reports a phone number that can't be turned into a WhatsApp
// chat id. It is about that one number, never about the session, so a sender
// should record the one message as failed and carry on.
type InvalidPhoneError struct {
	Phone string
}

func (e *InvalidPhoneError) Error() string {
	return fmt.Sprintf("openwa: %q is not a usable phone number", e.Phone)
}

// IsInvalidPhone reports whether err is a phone number that can't be addressed.
func IsInvalidPhone(err error) bool {
	var invalid *InvalidPhoneError

	return errors.As(err, &invalid)
}

// FirstConnectedSession returns a session that can currently send.
//
// Platform-level messages — the login and registration OTP — are not tied to a
// tenant, so rather than pinning them to a session id in configuration (which
// would break the moment somebody re-linked and got a new id) they go out
// through whichever session is connected. Returns ErrNoConnectedSession when
// nothing is linked, which callers surface as "pick another channel".
func (c *Client) FirstConnectedSession(ctx context.Context) (*Session, error) {
	sessions, err := c.ListSessions(ctx)
	if err != nil {
		return nil, err
	}

	for i := range sessions {
		if sessions[i].Connected() {
			return &sessions[i], nil
		}
	}

	return nil, ErrNoConnectedSession
}

// SendTextFromAnySession sends through the first connected session. It is for
// platform messages that belong to no particular tenant.
func (c *Client) SendTextFromAnySession(ctx context.Context, phone, text string) (*SendResult, error) {
	session, err := c.FirstConnectedSession(ctx)
	if err != nil {
		return nil, err
	}

	return c.SendText(ctx, session.ID, phone, text)
}

var placeholder = regexp.MustCompile(`\{\{\s*(\d+)\s*\}\}`)

// RenderTemplate flattens a WhatsApp Business template into the plain text this
// gateway sends.
//
// Templates were a Meta construct: a header, a body with {{1}}-style positional
// placeholders, and a footer, submitted for approval and then referenced by id.
// An unofficial gateway has no such concept, so a campaign built on a template
// is rendered here into one message. Placeholders with no matching parameter are
// left as-is rather than blanked, so a mis-configured campaign is obvious in the
// delivered text instead of silently losing words.
func RenderTemplate(header, body, footer string, params []string) string {
	// Meta numbered a template's placeholders per component, so a header carried
	// its own {{1}}. Here the three parts are concatenated into one plain-text
	// message and share a single parameter list. Substituting only the body left
	// "Hi {{1}}" headers going out to recipients verbatim.
	fill := func(s string) string {
		return placeholder.ReplaceAllStringFunc(s, func(m string) string {
			idx := placeholder.FindStringSubmatch(m)
			if len(idx) != 2 {
				return m
			}

			n := 0
			for _, r := range idx[1] {
				n = n*10 + int(r-'0')
			}

			if n >= 1 && n <= len(params) {
				return params[n-1]
			}

			return m
		})
	}

	parts := make([]string, 0, 3)
	for _, p := range []string{strings.TrimSpace(fill(header)), strings.TrimSpace(fill(body)), strings.TrimSpace(fill(footer))} {
		if p != "" {
			parts = append(parts, p)
		}
	}

	return strings.Join(parts, "\n\n")
}
