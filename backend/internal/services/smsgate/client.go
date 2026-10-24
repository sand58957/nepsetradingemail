// Package smsgate talks to SMSGate (sms-gate.app), the open-source Android SMS
// gateway: an Android phone with the SMSGate app sends SMS from its own SIM,
// and this API hands it the messages. The same API is served by the public
// cloud relay and by a self-hosted SMSGate server.
//
// Field names follow the official Go client, github.com/android-sms-gateway/client-go.
package smsgate

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// DefaultBaseURL is SMSGate's public cloud relay.
const DefaultBaseURL = "https://api.sms-gate.app/3rdparty/v1"

// Webhook events this package understands.
const (
	EventSmsReceived  = "sms:received"
	EventSmsSent      = "sms:sent"
	EventSmsDelivered = "sms:delivered"
	EventSmsFailed    = "sms:failed"
)

// Client calls the SMSGate 3rd-party API with the username and password the
// app shows once it is connected.
type Client struct {
	baseURL    string
	username   string
	password   string
	httpClient *http.Client
}

// NewClient builds a client. An empty baseURL means the public cloud relay.
func NewClient(baseURL, username, password string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}

	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		username:   username,
		password:   password,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// TextMessage is the body of a text SMS.
type TextMessage struct {
	Text string `json:"text"`
}

// Message is a send request.
type Message struct {
	ID                 string       `json:"id,omitempty"`
	DeviceID           string       `json:"deviceId,omitempty"`
	TextMessage        *TextMessage `json:"textMessage"`
	PhoneNumbers       []string     `json:"phoneNumbers"`
	SimNumber          *int         `json:"simNumber,omitempty"`
	WithDeliveryReport *bool        `json:"withDeliveryReport,omitempty"`
	TTL                *uint64      `json:"ttl,omitempty"`
}

// RecipientState is one recipient's progress.
type RecipientState struct {
	PhoneNumber string  `json:"phoneNumber"`
	State       string  `json:"state"`
	Error       *string `json:"error,omitempty"`
}

// MessageState is what the API returns for a message: Pending, Processed,
// Sent, Delivered or Failed (and Cancelling/Cancelled).
type MessageState struct {
	ID         string               `json:"id"`
	DeviceID   string               `json:"deviceId"`
	State      string               `json:"state"`
	Recipients []RecipientState     `json:"recipients"`
	States     map[string]time.Time `json:"states"`
}

// SimCard is a SIM in a connected phone.
type SimCard struct {
	SlotIndex   int     `json:"slotIndex"`
	SimNumber   int     `json:"simNumber"`
	PhoneNumber *string `json:"phoneNumber,omitempty"`
	CarrierName *string `json:"carrierName,omitempty"`
}

// Device is a phone registered on the account.
type Device struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	LastSeen time.Time `json:"lastSeen"`
	SimCards []SimCard `json:"simCards,omitempty"`
}

// Webhook is a webhook registration. Each covers one event.
type Webhook struct {
	ID       string  `json:"id,omitempty"`
	DeviceID *string `json:"deviceId,omitempty"`
	URL      string  `json:"url"`
	Event    string  `json:"event"`
}

// APIError is a non-2xx answer from SMSGate.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("SMSGate answered %d: %s", e.Status, e.Message)
}

// RecipientProblem reports whether a send failure is about the message or its
// recipient (a 400 or 422), so trying the next contact makes sense. Anything
// else — bad credentials, no phone, SMSGate down — would fail for every contact.
func RecipientProblem(err error) bool {
	var apiErr *APIError

	return errors.As(err, &apiErr) && (apiErr.Status == http.StatusBadRequest || apiErr.Status == http.StatusUnprocessableEntity)
}

// Send queues a message on the phone.
func (c *Client) Send(ctx context.Context, msg Message) (MessageState, error) {
	var state MessageState
	err := c.do(ctx, http.MethodPost, "/messages", msg, &state)

	return state, err
}

// GetState returns a message's current state.
func (c *Client) GetState(ctx context.Context, id string) (MessageState, error) {
	var state MessageState
	err := c.do(ctx, http.MethodGet, "/messages/"+url.PathEscape(id), nil, &state)

	return state, err
}

// ListDevices returns the phones connected to the account.
func (c *Client) ListDevices(ctx context.Context) ([]Device, error) {
	var devices []Device
	err := c.do(ctx, http.MethodGet, "/devices", nil, &devices)

	return devices, err
}

// ListWebhooks returns the account's webhook registrations.
func (c *Client) ListWebhooks(ctx context.Context) ([]Webhook, error) {
	var hooks []Webhook
	err := c.do(ctx, http.MethodGet, "/webhooks", nil, &hooks)

	return hooks, err
}

// RegisterWebhook adds a webhook for one event.
func (c *Client) RegisterWebhook(ctx context.Context, hook Webhook) (Webhook, error) {
	var created Webhook
	err := c.do(ctx, http.MethodPost, "/webhooks", hook, &created)

	return created, err
}

// DeleteWebhook removes a webhook registration.
func (c *Client) DeleteWebhook(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/webhooks/"+url.PathEscape(id), nil, nil)
}

func (c *Client) do(ctx context.Context, method, path string, in, out interface{}) error {
	var body io.Reader

	if in != nil {
		raw, err := json.Marshal(in)
		if err != nil {
			return fmt.Errorf("encoding request: %w", err)
		}

		body = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("building request: %w", err)
	}

	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("reaching SMSGate: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		msg := strings.TrimSpace(string(raw))

		var parsed struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(raw, &parsed) == nil && parsed.Message != "" {
			msg = parsed.Message
		}

		if len(msg) > 300 {
			msg = msg[:300]
		}

		return &APIError{Status: resp.StatusCode, Message: msg}
	}

	if out == nil || len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}

	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decoding SMSGate's answer: %w", err)
	}

	return nil
}

// WebhookEvent is the envelope the phone posts for every event.
type WebhookEvent struct {
	ID        string          `json:"id"`
	WebhookID string          `json:"webhookId"`
	Event     string          `json:"event"`
	DeviceID  string          `json:"deviceId"`
	Payload   json.RawMessage `json:"payload"`
}

// SmsPayload covers the sms:* events. Which time is set depends on the event.
type SmsPayload struct {
	MessageID   string     `json:"messageId"`
	Message     string     `json:"message"`
	PhoneNumber string     `json:"phoneNumber"`
	Sender      *string    `json:"sender"`
	Recipient   *string    `json:"recipient"`
	SimNumber   *int       `json:"simNumber"`
	Reason      string     `json:"reason"`
	ReceivedAt  *time.Time `json:"receivedAt"`
	SentAt      *time.Time `json:"sentAt"`
	DeliveredAt *time.Time `json:"deliveredAt"`
	FailedAt    *time.Time `json:"failedAt"`
}

// SignatureMaxAge is how far X-Timestamp may be from now.
const SignatureMaxAge = 5 * time.Minute

// VerifySignature checks a webhook's X-Signature: the hex HMAC-SHA256, keyed
// with the app's signing key, of the raw body followed by the X-Timestamp
// value. Stale timestamps are refused so a captured request can't be replayed.
func VerifySignature(signingKey string, body []byte, timestamp, signature string, now time.Time) bool {
	if signingKey == "" || timestamp == "" || signature == "" {
		return false
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}

	if age := now.Sub(time.Unix(ts, 0)); age > SignatureMaxAge || age < -SignatureMaxAge {
		return false
	}

	want, err := hex.DecodeString(strings.TrimSpace(signature))
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(signingKey))
	mac.Write(body)
	mac.Write([]byte(timestamp))

	return hmac.Equal(mac.Sum(nil), want)
}
