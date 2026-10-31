package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/smsgate"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// This file is what makes Phone SMS different from SMS Marketing: messages go
// out through the account's own Android phone running SMSGate, one at a time,
// a gap apart and up to a daily limit; the phone reports delivery and replies
// back through a webhook.

// ============================================================
// Models
// ============================================================

type PhoneSMSSettings struct {
	ID                   int        `json:"id" db:"id"`
	AccountID            int        `json:"account_id" db:"account_id"`
	ServerURL            string     `json:"server_url" db:"server_url"`
	Username             string     `json:"username" db:"username"`
	Password             string     `json:"-" db:"password"`
	DeviceID             string     `json:"device_id" db:"device_id"`
	SimNumber            int        `json:"sim_number" db:"sim_number"`
	DailyLimit           int        `json:"daily_limit" db:"daily_limit"`
	SendGapSeconds       int        `json:"send_gap_seconds" db:"send_gap_seconds"`
	WebhookToken         string     `json:"-" db:"webhook_token"`
	SigningKey           string     `json:"-" db:"signing_key"`
	WebhooksRegisteredAt *time.Time `json:"webhooks_registered_at" db:"webhooks_registered_at"`
	IsActive             bool       `json:"is_active" db:"is_active"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

type PhoneSMSCampaign struct {
	ID             int             `json:"id" db:"id"`
	AccountID      int             `json:"account_id" db:"account_id"`
	Name           string          `json:"name" db:"name"`
	MessageText    string          `json:"message_text" db:"message_text"`
	Status         string          `json:"status" db:"status"`
	PauseReason    string          `json:"pause_reason" db:"pause_reason"`
	ResumeAt       *time.Time      `json:"resume_at" db:"resume_at"`
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

type PhoneSMSCampaignMessage struct {
	ID           int        `json:"id" db:"id"`
	CampaignID   int        `json:"campaign_id" db:"campaign_id"`
	ContactID    int        `json:"contact_id" db:"contact_id"`
	GatewayMsgID string     `json:"gateway_msg_id" db:"gateway_msg_id"`
	Status       string     `json:"status" db:"status"`
	Network      string     `json:"network" db:"network"`
	Credits      int        `json:"credits" db:"credits"`
	ErrorReason  string     `json:"error_reason" db:"error_reason"`
	SubmittedAt  *time.Time `json:"submitted_at" db:"submitted_at"`
	SentAt       *time.Time `json:"sent_at" db:"sent_at"`
	DeliveredAt  *time.Time `json:"delivered_at" db:"delivered_at"`
	FailedAt     *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// Limits on what an account may set.
const (
	phoneSMSDefaultDailyLimit = 100 // Ncell's unlimited pack allows 100 SMS a day
	phoneSMSMaxDailyLimit     = 5000
	phoneSMSDefaultGap        = 30
	phoneSMSMinGap            = 5
	phoneSMSMaxGap            = 3600
	phoneSMSMessageTTL        = 24 * 60 * 60 // seconds a message may wait for an offline phone
	phoneSMSResumeHour        = 9            // a campaign held by the daily limit carries on at 9 AM Nepal time
)

// phoneSMSGap is the wait between two messages of a campaign. A variable so
// tests can send without waiting.
var phoneSMSGap = func(seconds int) time.Duration {
	return time.Duration(seconds) * time.Second
}

// phoneSMSNow is the clock, replaced in tests.
var phoneSMSNow = time.Now

// phoneSMSE164 turns a stored contact number (10 digits starting with 9) into
// the international form SMSGate requires.
func phoneSMSE164(phone string) string {
	return "+977" + phone
}

// phoneSMSLocal turns a number the phone reports (+9779812345678) into the
// stored 10-digit form, or returns it unchanged if it isn't a Nepali mobile.
func phoneSMSLocal(phone string) string {
	p := strings.NewReplacer(" ", "", "-", "", "+", "").Replace(phone)
	if strings.HasPrefix(p, "977") && len(p) == 13 {
		p = p[3:]
	}

	if smsPhoneRegex.MatchString(p) {
		return p
	}

	return strings.TrimSpace(phone)
}

// phoneSMSDayStart is midnight Nepal time at the start of t's day.
func phoneSMSDayStart(t time.Time) time.Time {
	n := t.In(nepalZone)

	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, nepalZone)
}

// phoneSMSNextResume is 9 AM Nepal time on the day after t.
func phoneSMSNextResume(t time.Time) time.Time {
	return phoneSMSDayStart(t).AddDate(0, 0, 1).Add(phoneSMSResumeHour * time.Hour)
}

// phoneSMSOptOutWords are replies that unsubscribe a contact. The whole reply
// has to be one of them, so "please don't stop" doesn't opt anyone out.
var phoneSMSOptOutWords = map[string]bool{
	"STOP": true, "STOPALL": true, "UNSUBSCRIBE": true, "CANCEL": true, "END": true, "QUIT": true,
	"BAND": true, "BANDA": true, "RADDA": true, "बन्द": true, "रद्द": true,
}

func phoneSMSIsOptOut(text string) bool {
	word := strings.ToUpper(strings.Trim(strings.TrimSpace(text), ".!?,;:\"' "))

	return phoneSMSOptOutWords[word]
}

func phoneSMSMask(secret string) string {
	if secret == "" {
		return ""
	}

	if len(secret) <= 4 {
		return strings.Repeat("*", len(secret))
	}

	return strings.Repeat("*", len(secret)-4) + secret[len(secret)-4:]
}

func phoneSMSNewToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	return hex.EncodeToString(b), nil
}

// webhookURL is where this account's phone posts its events.
func (h *PhoneSMSHandler) webhookURL(token string) string {
	return h.siteURL + "/api/public/phone-sms/webhook/" + token
}

// settingsOf returns the account's Phone SMS settings.
func (h *PhoneSMSHandler) settingsOf(accountID int) (*PhoneSMSSettings, error) {
	var s PhoneSMSSettings
	if err := h.db.Get(&s, `SELECT * FROM phone_sms_settings WHERE account_id = $1`, accountID); err != nil {
		return nil, err
	}

	return &s, nil
}

// getClient builds an SMSGate client from the account's settings.
func (h *PhoneSMSHandler) getClient(accountID int) (*smsgate.Client, *PhoneSMSSettings, error) {
	s, err := h.settingsOf(accountID)
	if err != nil || s.Username == "" || s.Password == "" {
		return nil, nil, fmt.Errorf("Connect your phone in Phone SMS settings first")
	}

	return smsgate.NewClient(s.ServerURL, s.Username, s.Password), s, nil
}

// gatewayErrorMessage explains an SMSGate failure to the account owner.
func gatewayErrorMessage(err error) string {
	var apiErr *smsgate.APIError
	if errors.As(err, &apiErr) && apiErr.Status == http.StatusUnauthorized {
		return "SMSGate refused the username or password. Copy them again from the SMSGate app."
	}

	return fmt.Sprintf("Couldn't reach your phone through SMSGate: %v", err)
}

// ============================================================
// Settings
// ============================================================

// GetSettings returns the account's Phone SMS settings with secrets masked.
func (h *PhoneSMSHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	s, err := h.settingsOf(accountID)
	if err != nil {
		return response.Success(c, map[string]interface{}{
			"configured": false,
			"defaults": map[string]interface{}{
				"server_url":       smsgate.DefaultBaseURL,
				"daily_limit":      phoneSMSDefaultDailyLimit,
				"send_gap_seconds": phoneSMSDefaultGap,
			},
		})
	}

	return response.Success(c, map[string]interface{}{
		"configured":      s.Username != "" && s.Password != "",
		"settings":        s,
		"password":        phoneSMSMask(s.Password),
		"signing_key":     phoneSMSMask(s.SigningKey),
		"signing_key_set": s.SigningKey != "",
		"webhook_url":     h.webhookURL(s.WebhookToken),
	})
}

// UpdateSettings saves the SMSGate connection and pacing.
func (h *PhoneSMSHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		ServerURL      string `json:"server_url"`
		Username       string `json:"username"`
		Password       string `json:"password"`
		DeviceID       string `json:"device_id"`
		SimNumber      int    `json:"sim_number"`
		DailyLimit     int    `json:"daily_limit"`
		SendGapSeconds int    `json:"send_gap_seconds"`
		SigningKey     string `json:"signing_key"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	req.ServerURL = strings.TrimRight(strings.TrimSpace(req.ServerURL), "/")
	if req.ServerURL == "" {
		req.ServerURL = smsgate.DefaultBaseURL
	}

	if !strings.HasPrefix(req.ServerURL, "https://") || len(req.ServerURL) > 300 {
		return response.BadRequest(c, "The SMSGate server address must start with https://")
	}

	req.Username = strings.TrimSpace(req.Username)
	req.DeviceID = strings.TrimSpace(req.DeviceID)

	if req.SimNumber < 0 || req.SimNumber > 3 {
		return response.BadRequest(c, "SIM must be 1, 2, 3, or the phone's default")
	}

	if req.DailyLimit == 0 {
		req.DailyLimit = phoneSMSDefaultDailyLimit
	}

	if req.DailyLimit < 1 || req.DailyLimit > phoneSMSMaxDailyLimit {
		return response.BadRequest(c, fmt.Sprintf("Daily limit must be between 1 and %d", phoneSMSMaxDailyLimit))
	}

	if req.SendGapSeconds == 0 {
		req.SendGapSeconds = phoneSMSDefaultGap
	}

	if req.SendGapSeconds < phoneSMSMinGap || req.SendGapSeconds > phoneSMSMaxGap {
		return response.BadRequest(c, fmt.Sprintf("The gap between messages must be %d to %d seconds", phoneSMSMinGap, phoneSMSMaxGap))
	}

	// The masked values GetSettings handed out mean "keep what is saved".
	password := req.Password
	if strings.Contains(password, "*") {
		password = ""
	}

	signingKey := strings.TrimSpace(req.SigningKey)
	keepSigningKey := strings.Contains(signingKey, "*")

	token, err := phoneSMSNewToken()
	if err != nil {
		return response.InternalError(c, "Failed to save settings")
	}

	_, err = h.db.Exec(`
		INSERT INTO phone_sms_settings (account_id, server_url, username, password, device_id, sim_number,
			daily_limit, send_gap_seconds, webhook_token, signing_key, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			server_url = EXCLUDED.server_url,
			username = EXCLUDED.username,
			password = CASE WHEN EXCLUDED.password = '' THEN phone_sms_settings.password ELSE EXCLUDED.password END,
			device_id = EXCLUDED.device_id,
			sim_number = EXCLUDED.sim_number,
			daily_limit = EXCLUDED.daily_limit,
			send_gap_seconds = EXCLUDED.send_gap_seconds,
			webhook_token = CASE WHEN phone_sms_settings.webhook_token = '' THEN EXCLUDED.webhook_token ELSE phone_sms_settings.webhook_token END,
			signing_key = CASE WHEN $11 THEN phone_sms_settings.signing_key ELSE EXCLUDED.signing_key END,
			updated_at = NOW()
	`, accountID, req.ServerURL, req.Username, password, req.DeviceID, req.SimNumber,
		req.DailyLimit, req.SendGapSeconds, token, signingKey, keepSigningKey)
	if err != nil {
		log.Printf("[phone-sms] Failed to save settings for account %d: %v", accountID, err)
		return response.InternalError(c, "Failed to save settings")
	}

	return response.SuccessWithMessage(c, "Phone SMS settings saved", nil)
}

// phoneSMSWebhookEvents are the events the phone reports back.
var phoneSMSWebhookEvents = []string{
	smsgate.EventSmsReceived, smsgate.EventSmsSent, smsgate.EventSmsDelivered, smsgate.EventSmsFailed,
}

// ensureWebhooks registers this account's webhook for each event SMSGate does
// not already have, and removes ones pointing at an old token of this site.
func (h *PhoneSMSHandler) ensureWebhooks(ctx context.Context, client *smsgate.Client, s *PhoneSMSSettings) error {
	want := h.webhookURL(s.WebhookToken)
	ourPrefix := h.siteURL + "/api/public/phone-sms/webhook/"

	existing, err := client.ListWebhooks(ctx)
	if err != nil {
		return err
	}

	have := map[string]bool{}

	for _, hook := range existing {
		switch {
		case hook.URL == want:
			have[hook.Event] = true
		case strings.HasPrefix(hook.URL, ourPrefix):
			if err := client.DeleteWebhook(ctx, hook.ID); err != nil {
				log.Printf("[phone-sms] account %d: removing an old webhook: %v", s.AccountID, err)
			}
		}
	}

	for _, event := range phoneSMSWebhookEvents {
		if have[event] {
			continue
		}

		if _, err := client.RegisterWebhook(ctx, smsgate.Webhook{URL: want, Event: event}); err != nil {
			return fmt.Errorf("registering %s: %w", event, err)
		}
	}

	_, err = h.db.Exec(`UPDATE phone_sms_settings SET webhooks_registered_at = NOW() WHERE id = $1`, s.ID)

	return err
}

// TestConnection checks the credentials, lists the connected phones and makes
// sure the phone will report delivery and replies back.
func (h *PhoneSMSHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, s, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	devices, err := client.ListDevices(ctx)
	if err != nil {
		return response.Error(c, http.StatusBadGateway, gatewayErrorMessage(err))
	}

	if devices == nil {
		devices = []smsgate.Device{}
	}

	result := map[string]interface{}{
		"connected":  true,
		"devices":    devices,
		"webhooks":   "registered",
		"webhookUrl": h.webhookURL(s.WebhookToken),
	}

	if err := h.ensureWebhooks(ctx, client, s); err != nil {
		log.Printf("[phone-sms] account %d: webhooks: %v", accountID, err)
		result["webhooks"] = "Delivery reports and replies are not set up yet: " + err.Error()
	}

	return response.Success(c, result)
}

// ListDevices returns the phones connected to the account's SMSGate login.
func (h *PhoneSMSHandler) ListDevices(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 20*time.Second)
	defer cancel()

	devices, err := client.ListDevices(ctx)
	if err != nil {
		return response.Error(c, http.StatusBadGateway, gatewayErrorMessage(err))
	}

	if devices == nil {
		devices = []smsgate.Device{}
	}

	return response.Success(c, devices)
}

// ============================================================
// Sending
// ============================================================

// claim marks a campaign's sender as running in this process; false means one
// already is, so a second Send, Resume or restart can't double the messages.
func (h *PhoneSMSHandler) claim(campaignID int) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.running[campaignID] {
		return false
	}

	h.running[campaignID] = true

	return true
}

func (h *PhoneSMSHandler) release(campaignID int) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.running, campaignID)
}

// refreshCounts recomputes a campaign's counters from its messages, so status
// updates arriving late, twice or out of order can't skew them.
func (h *PhoneSMSHandler) refreshCounts(campaignID int) {
	h.db.Exec(`
		UPDATE phone_sms_campaigns c SET
			sent_count = m.sent, delivered_count = m.delivered, failed_count = m.failed, updated_at = NOW()
		FROM (
			SELECT COUNT(*) FILTER (WHERE status IN ('submitted', 'sent', 'delivered')) AS sent,
			       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
			       COUNT(*) FILTER (WHERE status = 'failed') AS failed
			FROM phone_sms_campaign_messages WHERE campaign_id = $1
		) m
		WHERE c.id = $1`, campaignID)
}

// sentToday counts the account's messages handed to the phone since midnight
// Nepal time, from campaigns and the API together.
func (h *PhoneSMSHandler) sentToday(accountID int, now time.Time) int {
	var n int
	h.db.Get(&n, `
		SELECT (SELECT COUNT(*) FROM phone_sms_campaign_messages m
		        JOIN phone_sms_campaigns c ON c.id = m.campaign_id
		        WHERE c.account_id = $1 AND m.submitted_at >= $2)
		     + (SELECT COUNT(*) FROM api_messages
		        WHERE account_id = $1 AND channel = 'phone_sms' AND provider_message_id <> '' AND sent_at >= $2)`,
		accountID, phoneSMSDayStart(now))

	return n
}

// takeTurn reserves the account's next slot on its phone and returns how long
// to wait for it. Campaigns and the API share the slots, so together they never
// hand the phone messages closer together than the account's gap.
func (h *PhoneSMSHandler) takeTurn(accountID int, gap time.Duration) time.Duration {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()

	at := h.nextTurn[accountID]
	if at.Before(now) {
		at = now
	}

	h.nextTurn[accountID] = at.Add(gap)

	return at.Sub(now)
}

// pause stops a campaign with a reason, optionally to carry on by itself at resumeAt.
func (h *PhoneSMSHandler) pause(campaignID int, reason string, resumeAt *time.Time) {
	h.db.Exec(`UPDATE phone_sms_campaigns SET status = 'paused', pause_reason = $2, resume_at = $3, updated_at = NOW()
		WHERE id = $1 AND status = 'sending'`, campaignID, reason, resumeAt)
}

// waitOrStop waits d, checking every few seconds that the campaign is still
// sending. It reports false when it was paused, cancelled or deleted.
func (h *PhoneSMSHandler) waitOrStop(campaignID int, d time.Duration) bool {
	for d > 0 {
		step := 5 * time.Second
		if d < step {
			step = d
		}

		time.Sleep(step)
		d -= step

		if !h.stillSending(campaignID) {
			return false
		}
	}

	return true
}

func (h *PhoneSMSHandler) stillSending(campaignID int) bool {
	var status string
	h.db.Get(&status, `SELECT status FROM phone_sms_campaigns WHERE id = $1`, campaignID)

	return status == "sending"
}

// simLabel names the SIM a message went out on, for the per-SIM breakdown.
func simLabel(sim int) string {
	if sim <= 0 {
		return "Default SIM"
	}

	return fmt.Sprintf("SIM %d", sim)
}

// executeCampaignSend sends a campaign's queued messages one at a time, a gap
// apart, until none are left, the daily limit is reached, it is paused, or
// the phone can't be reached.
func (h *PhoneSMSHandler) executeCampaignSend(campaignID, accountID int) {
	if !h.claim(campaignID) {
		return
	}
	defer h.release(campaignID)

	client, settings, err := h.getClient(accountID)
	if err != nil {
		h.pause(campaignID, err.Error(), nil)
		return
	}

	var campaign PhoneSMSCampaign
	if err := h.db.Get(&campaign, `SELECT * FROM phone_sms_campaigns WHERE id = $1 AND account_id = $2`, campaignID, accountID); err != nil {
		log.Printf("[phone-sms] Campaign %d: %v", campaignID, err)
		return
	}

	withReport := true
	ttl := uint64(phoneSMSMessageTTL)

	var sim *int
	if settings.SimNumber > 0 {
		sim = &settings.SimNumber
	}

	for {
		if !h.stillSending(campaignID) {
			return
		}

		var next struct {
			MessageID int    `db:"message_id"`
			Phone     string `db:"phone"`
		}

		err := h.db.Get(&next, `
			SELECT m.id AS message_id, sc.phone
			FROM phone_sms_campaign_messages m
			JOIN phone_sms_contacts sc ON sc.id = m.contact_id
			WHERE m.campaign_id = $1 AND m.status = 'queued' AND sc.opted_in = true
			ORDER BY m.id LIMIT 1`, campaignID)
		if err != nil {
			// Nobody left (contacts who opted out by reply are skipped).
			h.db.Exec(`UPDATE phone_sms_campaign_messages m SET status = 'failed', error_reason = 'Opted out before sending', failed_at = NOW()
				FROM phone_sms_contacts sc WHERE sc.id = m.contact_id AND m.campaign_id = $1 AND m.status = 'queued' AND sc.opted_in = false`, campaignID)
			h.refreshCounts(campaignID)
			h.db.Exec(`UPDATE phone_sms_campaigns SET status = 'sent', pause_reason = '', completed_at = NOW(), updated_at = NOW()
				WHERE id = $1 AND status = 'sending'`, campaignID)
			log.Printf("[phone-sms] Campaign %d: completed", campaignID)

			return
		}

		now := phoneSMSNow()
		if limit := settings.DailyLimit; limit > 0 && h.sentToday(accountID, now) >= limit {
			resumeAt := phoneSMSNextResume(now)
			h.pause(campaignID, fmt.Sprintf("Reached today's limit of %d messages. Carries on by itself at %s.",
				limit, resumeAt.In(nepalZone).Format("3:04 PM on 2 Jan")), &resumeAt)
			log.Printf("[phone-sms] Campaign %d: daily limit %d reached, resumes %s", campaignID, limit, resumeAt)

			return
		}

		// Wait for the phone's next free slot, shared with API messages.
		if !h.waitOrStop(campaignID, h.takeTurn(accountID, phoneSMSGap(settings.SendGapSeconds))) {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		state, err := client.Send(ctx, smsgate.Message{
			DeviceID:           settings.DeviceID,
			TextMessage:        &smsgate.TextMessage{Text: campaign.MessageText},
			PhoneNumbers:       []string{phoneSMSE164(next.Phone)},
			SimNumber:          sim,
			WithDeliveryReport: &withReport,
			TTL:                &ttl,
		})
		cancel()

		if err != nil {
			if smsgate.RecipientProblem(err) {
				h.db.Exec(`UPDATE phone_sms_campaign_messages SET status = 'failed', error_reason = $2, failed_at = NOW() WHERE id = $1`,
					next.MessageID, err.Error())
				h.refreshCounts(campaignID)

				continue
			}

			// Bad credentials, no phone, SMSGate down: every contact would fail
			// the same way, so stop with nobody marked failed.
			log.Printf("[phone-sms] Campaign %d: stopped: %v", campaignID, err)
			h.pause(campaignID, gatewayErrorMessage(err)+" Check the phone is on and online, then resume.", nil)

			return
		}

		h.db.Exec(`UPDATE phone_sms_campaign_messages SET gateway_msg_id = $2, status = 'submitted', network = $3, submitted_at = NOW()
			WHERE id = $1`, next.MessageID, state.ID, simLabel(settings.SimNumber))
		h.refreshCounts(campaignID)
	}
}

// SendCampaign starts sending a draft or scheduled campaign to its audience.
func (h *PhoneSMSHandler) SendCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign PhoneSMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM phone_sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.Status != "draft" && campaign.Status != "scheduled" {
		return response.BadRequest(c, "Campaign must be in draft or scheduled status to send")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	if _, _, err := h.getClient(accountID); err != nil {
		return response.BadRequest(c, err.Error())
	}

	contacts, err := h.audience(accountID, campaign.TargetFilter)
	if err != nil {
		log.Printf("[phone-sms] Campaign %d: failed to fetch contacts: %v", campaign.ID, err)
		return response.InternalError(c, "Failed to fetch target contacts")
	}

	if len(contacts) == 0 {
		return response.BadRequest(c, "No opted-in contacts to send to")
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return response.InternalError(c, "Failed to start campaign")
	}
	defer tx.Rollback()

	// Claim the campaign: of two Sends racing, only one finds it still a draft.
	res, err := tx.Exec(`UPDATE phone_sms_campaigns SET status = 'sending', pause_reason = '', resume_at = NULL,
		total_targets = $2, started_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status IN ('draft', 'scheduled')`, campaign.ID, len(contacts))
	if err != nil {
		return response.InternalError(c, "Failed to start campaign")
	}

	if n, _ := res.RowsAffected(); n == 0 {
		return response.BadRequest(c, "Campaign is already sending")
	}

	for _, contact := range contacts {
		if _, err := tx.Exec(`INSERT INTO phone_sms_campaign_messages (campaign_id, contact_id, status) VALUES ($1, $2, 'queued')`,
			campaign.ID, contact.ID); err != nil {
			return response.InternalError(c, "Failed to queue messages")
		}
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Failed to start campaign")
	}

	go h.executeCampaignSend(campaign.ID, accountID)

	return response.Success(c, map[string]interface{}{
		"status":        "sending",
		"total_targets": len(contacts),
	})
}

// audience returns the opted-in contacts a campaign's filter selects: those
// with all the filter's tags, plus the members of its groups.
func (h *PhoneSMSHandler) audience(accountID int, targetFilter json.RawMessage) ([]PhoneSMSContact, error) {
	var filter struct {
		Tags   []string `json:"tags"`
		Groups []int    `json:"groups"`
	}

	if len(targetFilter) > 0 {
		json.Unmarshal(targetFilter, &filter)
	}

	query := "SELECT * FROM phone_sms_contacts WHERE account_id = $1 AND opted_in = true"
	args := []interface{}{accountID}

	if len(filter.Tags) > 0 {
		tagJSON, _ := json.Marshal(filter.Tags)
		query += " AND tags @> $2::jsonb"
		args = append(args, string(tagJSON))
	}

	var contacts []PhoneSMSContact
	if err := h.db.Select(&contacts, query+" ORDER BY id", args...); err != nil {
		return nil, err
	}

	seen := map[int]bool{}
	for _, c := range contacts {
		seen[c.ID] = true
	}

	for _, gid := range filter.Groups {
		var members []PhoneSMSContact
		if err := h.db.Select(&members, `
			SELECT sc.* FROM phone_sms_contacts sc
			JOIN phone_sms_contact_group_members gm ON gm.contact_id = sc.id
			JOIN phone_sms_contact_groups g ON g.id = gm.group_id
			WHERE sc.account_id = $1 AND g.account_id = $1 AND sc.opted_in = true AND gm.group_id = $2
			ORDER BY sc.id`, accountID, gid); err != nil {
			return nil, err
		}

		for _, m := range members {
			if !seen[m.ID] {
				contacts = append(contacts, m)
				seen[m.ID] = true
			}
		}
	}

	return contacts, nil
}

// TestCampaign sends the campaign's message to one number.
func (h *PhoneSMSHandler) TestCampaign(c echo.Context) error {
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

	var campaign PhoneSMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM phone_sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	phone := phoneSMSLocal(req.Phone)
	if !smsPhoneRegex.MatchString(phone) {
		return response.BadRequest(c, "Phone number must be 10 digits starting with 9")
	}

	client, settings, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	var sim *int
	if settings.SimNumber > 0 {
		sim = &settings.SimNumber
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	state, err := client.Send(ctx, smsgate.Message{
		DeviceID:     settings.DeviceID,
		TextMessage:  &smsgate.TextMessage{Text: campaign.MessageText},
		PhoneNumbers: []string{phoneSMSE164(phone)},
		SimNumber:    sim,
	})
	if err != nil {
		return response.Error(c, http.StatusBadGateway, gatewayErrorMessage(err))
	}

	return response.Success(c, map[string]interface{}{
		"message_id": state.ID,
		"status":     strings.ToLower(state.State),
		"message":    "Handed to your phone to send",
	})
}

// PauseCampaign pauses a sending campaign.
func (h *PhoneSMSHandler) PauseCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE phone_sms_campaigns SET status = 'paused', pause_reason = 'Paused by you', resume_at = NULL, updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'sending'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to pause campaign")
	}

	if rows, _ := result.RowsAffected(); rows == 0 {
		return response.BadRequest(c, "Campaign is not currently sending")
	}

	return response.SuccessWithMessage(c, "Campaign paused", nil)
}

// ResumeCampaign carries on a paused campaign by restarting its sender.
func (h *PhoneSMSHandler) ResumeCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	if _, _, err := h.getClient(accountID); err != nil {
		return response.BadRequest(c, err.Error())
	}

	result, err := h.db.Exec(`
		UPDATE phone_sms_campaigns SET status = 'sending', pause_reason = '', resume_at = NULL, updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'paused'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to resume campaign")
	}

	if rows, _ := result.RowsAffected(); rows == 0 {
		return response.BadRequest(c, "Campaign is not currently paused")
	}

	campaignID, _ := strconv.Atoi(id)
	go h.executeCampaignSend(campaignID, accountID)

	return response.SuccessWithMessage(c, "Campaign resumed", nil)
}

// resumeDue restarts campaigns held by the daily limit whose time has come.
func (h *PhoneSMSHandler) resumeDue(now time.Time) {
	var due []struct {
		ID        int `db:"id"`
		AccountID int `db:"account_id"`
	}

	h.db.Select(&due, `SELECT id, account_id FROM phone_sms_campaigns
		WHERE status = 'paused' AND resume_at IS NOT NULL AND resume_at <= $1`, now)

	for _, d := range due {
		res, err := h.db.Exec(`UPDATE phone_sms_campaigns SET status = 'sending', pause_reason = '', resume_at = NULL, updated_at = NOW()
			WHERE id = $1 AND status = 'paused' AND resume_at IS NOT NULL`, d.ID)
		if err != nil {
			continue
		}

		if n, _ := res.RowsAffected(); n == 1 {
			log.Printf("[phone-sms] Campaign %d: carrying on after the daily limit", d.ID)
			go h.executeCampaignSend(d.ID, d.AccountID)
		}
	}
}

// StartAutoResume checks every interval for campaigns due to carry on.
func (h *PhoneSMSHandler) StartAutoResume(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.resumeDue(phoneSMSNow())
		}
	}
}

// ResumeInterruptedCampaigns restarts the senders of campaigns that were
// sending when the server stopped, and of API messages still queued.
func (h *PhoneSMSHandler) ResumeInterruptedCampaigns() {
	var running []struct {
		ID        int `db:"id"`
		AccountID int `db:"account_id"`
	}

	h.db.Select(&running, `SELECT id, account_id FROM phone_sms_campaigns WHERE status = 'sending'`)

	for _, r := range running {
		log.Printf("[phone-sms] Campaign %d: carrying on after a restart", r.ID)
		go h.executeCampaignSend(r.ID, r.AccountID)
	}

	// API messages still waiting for their turn.
	var accounts []int
	h.db.Select(&accounts, `SELECT DISTINCT account_id FROM api_messages WHERE channel = 'phone_sms' AND status = 'queued'`)

	for _, accountID := range accounts {
		log.Printf("[phone-sms] Account %d: carrying on with queued API messages after a restart", accountID)
		h.kickAPISender(accountID)
	}
}

// ============================================================
// Campaign detail and analytics
// ============================================================

type phoneSMSStatusCount struct {
	Status string `json:"status" db:"status"`
	Count  int    `json:"count" db:"count"`
}

type phoneSMSNetworkCount struct {
	Network string `json:"network" db:"network"`
	Count   int    `json:"count" db:"count"`
	Credits int    `json:"credits" db:"credits"`
}

func (h *PhoneSMSHandler) breakdowns(campaignID string) ([]phoneSMSStatusCount, []phoneSMSNetworkCount) {
	statuses := []phoneSMSStatusCount{}
	h.db.Select(&statuses, `SELECT status, COUNT(*) AS count FROM phone_sms_campaign_messages
		WHERE campaign_id = $1 GROUP BY status ORDER BY count DESC`, campaignID)

	networks := []phoneSMSNetworkCount{}
	h.db.Select(&networks, `SELECT COALESCE(NULLIF(network, ''), 'Not sent yet') AS network, COUNT(*) AS count, 0 AS credits
		FROM phone_sms_campaign_messages WHERE campaign_id = $1
		GROUP BY COALESCE(NULLIF(network, ''), 'Not sent yet') ORDER BY count DESC`, campaignID)

	return statuses, networks
}

// GetCampaign returns a campaign with its recipients.
func (h *PhoneSMSHandler) GetCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign PhoneSMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM phone_sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

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
		SentAt      *time.Time `json:"sent_at" db:"sent_at"`
		DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	}

	recipients := []RecipientRow{}
	h.db.Select(&recipients, `
		SELECT m.id, m.contact_id, sc.phone, sc.name AS contact_name, m.status, m.network, m.credits, m.error_reason,
		       m.submitted_at, m.sent_at, m.delivered_at, m.failed_at, m.created_at
		FROM phone_sms_campaign_messages m
		JOIN phone_sms_contacts sc ON sc.id = m.contact_id
		WHERE m.campaign_id = $1
		ORDER BY m.created_at DESC, m.id DESC
		LIMIT 500`, id)

	statuses, networks := h.breakdowns(id)

	return response.Success(c, map[string]interface{}{
		"campaign":          campaign,
		"status_breakdown":  statuses,
		"network_breakdown": networks,
		"recipients":        recipients,
	})
}

// GetCampaignAnalytics returns a campaign's breakdowns and recent failures.
func (h *PhoneSMSHandler) GetCampaignAnalytics(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign PhoneSMSCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM phone_sms_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	statuses, networks := h.breakdowns(id)

	type failedRow struct {
		Phone       string     `json:"phone" db:"phone"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	}

	failed := []failedRow{}
	h.db.Select(&failed, `
		SELECT sc.phone, m.error_reason, m.failed_at
		FROM phone_sms_campaign_messages m
		JOIN phone_sms_contacts sc ON sc.id = m.contact_id
		WHERE m.campaign_id = $1 AND m.status = 'failed'
		ORDER BY m.failed_at DESC LIMIT 50`, id)

	return response.Success(c, map[string]interface{}{
		"campaign":          campaign,
		"status_breakdown":  statuses,
		"network_breakdown": networks,
		"failed_messages":   failed,
	})
}

// GetOverview returns the dashboard figures. In place of SMS Marketing's credit
// balance it shows today's use of the daily limit and recent replies.
func (h *PhoneSMSHandler) GetOverview(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var contacts struct {
		TotalContacts  int `json:"total_contacts" db:"total_contacts"`
		OptedIn        int `json:"opted_in" db:"opted_in"`
		TotalCampaigns int `json:"total_campaigns" db:"total_campaigns"`
	}
	h.db.Get(&contacts, `SELECT COUNT(*) AS total_contacts, COUNT(*) FILTER (WHERE opted_in) AS opted_in,
		(SELECT COUNT(*) FROM phone_sms_campaigns WHERE account_id = $1) AS total_campaigns
		FROM phone_sms_contacts WHERE account_id = $1`, accountID)

	var messages struct {
		TotalSent      int `json:"total_sent" db:"total_sent"`
		TotalDelivered int `json:"total_delivered" db:"total_delivered"`
		TotalFailed    int `json:"total_failed" db:"total_failed"`
		TotalCredits   int `json:"total_credits" db:"total_credits"`
	}
	h.db.Get(&messages, `SELECT COALESCE(SUM(sent_count), 0) AS total_sent, COALESCE(SUM(delivered_count), 0) AS total_delivered,
		COALESCE(SUM(failed_count), 0) AS total_failed, 0 AS total_credits
		FROM phone_sms_campaigns WHERE account_id = $1`, accountID)

	recent := []PhoneSMSCampaign{}
	h.db.Select(&recent, `SELECT * FROM phone_sms_campaigns WHERE account_id = $1 ORDER BY created_at DESC LIMIT 5`, accountID)

	var replies int
	h.db.Get(&replies, `SELECT COUNT(*) FROM phone_sms_inbox WHERE account_id = $1 AND received_at > NOW() - INTERVAL '7 days'`, accountID)

	dailyLimit := phoneSMSDefaultDailyLimit
	connected := false

	if s, err := h.settingsOf(accountID); err == nil {
		dailyLimit = s.DailyLimit
		connected = s.Username != "" && s.Password != ""
	}

	sentToday := h.sentToday(accountID, phoneSMSNow())

	return response.Success(c, map[string]interface{}{
		"contacts":         contacts,
		"messages":         messages,
		"recent_campaigns": recent,
		"connected":        connected,
		"sent_today":       sentToday,
		"daily_limit":      dailyLimit,
		"remaining_today":  max(0, dailyLimit-sentToday),
		"replies_7d":       replies,
	})
}

// ============================================================
// Groups
// ============================================================

// AddGroupMembers adds the account's own contacts to one of its groups; a
// contact id from another account is ignored.
func (h *PhoneSMSHandler) AddGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM phone_sms_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
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
		res, err := h.db.Exec(`
			INSERT INTO phone_sms_contact_group_members (group_id, contact_id)
			SELECT $1, id FROM phone_sms_contacts WHERE id = $2 AND account_id = $3
			ON CONFLICT DO NOTHING`, id, cid, accountID)
		if err == nil {
			n, _ := res.RowsAffected()
			added += int(n)
		}
	}

	return response.Success(c, map[string]interface{}{
		"added": added,
	})
}

// ============================================================
// Inbox and webhooks
// ============================================================

// ListInbox returns the SMS the account's phone received, newest first.
func (h *PhoneSMSHandler) ListInbox(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 25
	}

	where := "i.account_id = $1"
	args := []interface{}{accountID}

	if q := strings.TrimSpace(c.QueryParam("query")); q != "" {
		where += " AND (i.phone ILIKE $2 OR i.message ILIKE $2 OR COALESCE(sc.name, '') ILIKE $2)"
		args = append(args, "%"+q+"%")
	}

	var total int
	h.db.Get(&total, `SELECT COUNT(*) FROM phone_sms_inbox i LEFT JOIN phone_sms_contacts sc ON sc.id = i.contact_id WHERE `+where, args...)

	type inboxRow struct {
		ID          int       `json:"id" db:"id"`
		ContactID   *int      `json:"contact_id" db:"contact_id"`
		ContactName string    `json:"contact_name" db:"contact_name"`
		Phone       string    `json:"phone" db:"phone"`
		Message     string    `json:"message" db:"message"`
		SimNumber   int       `json:"sim_number" db:"sim_number"`
		OptedOut    bool      `json:"opted_out" db:"opted_out"`
		ReceivedAt  time.Time `json:"received_at" db:"received_at"`
	}

	rows := []inboxRow{}
	h.db.Select(&rows, fmt.Sprintf(`
		SELECT i.id, i.contact_id, COALESCE(sc.name, '') AS contact_name, i.phone, i.message, i.sim_number, i.opted_out, i.received_at
		FROM phone_sms_inbox i LEFT JOIN phone_sms_contacts sc ON sc.id = i.contact_id
		WHERE %s ORDER BY i.received_at DESC, i.id DESC LIMIT %d OFFSET %d`, where, perPage, (page-1)*perPage), args...)

	return response.Success(c, map[string]interface{}{
		"results":  rows,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// phoneSMSStatusRank orders message statuses so a late or repeated report
// never moves a message backwards (a 'sent' arriving after 'delivered').
var phoneSMSStatusRank = map[string]int{"queued": 0, "submitted": 1, "sent": 2, "delivered": 3}

// Webhook receives the events the phone posts: replies, and sent, delivered or
// failed reports for campaign messages. The secret token in the address picks
// the account; when the account has saved its SMSGate signing key, the
// signature must match too.
func (h *PhoneSMSHandler) Webhook(c echo.Context) error {
	token := c.Param("token")
	if len(token) < 32 {
		return response.NotFound(c, "Not found")
	}

	var s PhoneSMSSettings
	if err := h.db.Get(&s, `SELECT * FROM phone_sms_settings WHERE webhook_token = $1`, token); err != nil {
		return response.NotFound(c, "Not found")
	}

	body, err := io.ReadAll(io.LimitReader(c.Request().Body, 1<<20))
	if err != nil {
		return response.BadRequest(c, "Unreadable body")
	}

	if s.SigningKey != "" && !smsgate.VerifySignature(s.SigningKey, body,
		c.Request().Header.Get("X-Timestamp"), c.Request().Header.Get("X-Signature"), phoneSMSNow()) {
		return response.Unauthorized(c, "Signature does not match")
	}

	var event smsgate.WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return response.BadRequest(c, "Not an SMSGate event")
	}

	var payload smsgate.SmsPayload
	json.Unmarshal(event.Payload, &payload)

	switch event.Event {
	case smsgate.EventSmsReceived:
		h.recordReply(s.AccountID, event.DeviceID, payload)
	case smsgate.EventSmsSent, smsgate.EventSmsDelivered, smsgate.EventSmsFailed:
		h.recordStatus(s.AccountID, event.Event, payload)
	}

	return c.NoContent(http.StatusOK)
}

// recordReply stores an SMS the phone received and opts the sender out when
// the reply is STOP (or one of the other opt-out words).
func (h *PhoneSMSHandler) recordReply(accountID int, deviceID string, p smsgate.SmsPayload) {
	from := p.PhoneNumber
	if p.Sender != nil && *p.Sender != "" {
		from = *p.Sender
	}

	phone := phoneSMSLocal(from)
	if phone == "" {
		return
	}

	sim := 0
	if p.SimNumber != nil {
		sim = *p.SimNumber
	}

	receivedAt := phoneSMSNow()
	if p.ReceivedAt != nil {
		receivedAt = *p.ReceivedAt
	}

	optOut := phoneSMSIsOptOut(p.Message)

	var contactID *int
	var cid int
	if h.db.Get(&cid, `SELECT id FROM phone_sms_contacts WHERE account_id = $1 AND phone = $2`, accountID, phone) == nil {
		contactID = &cid
	}

	res, err := h.db.Exec(`
		INSERT INTO phone_sms_inbox (account_id, contact_id, phone, message, sim_number, device_id, gateway_msg_id, opted_out, received_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (account_id, device_id, gateway_msg_id) DO NOTHING`,
		accountID, contactID, phone, p.Message, sim, deviceID, p.MessageID, optOut, receivedAt)
	if err != nil {
		log.Printf("[phone-sms] account %d: saving a reply: %v", accountID, err)
		return
	}

	// A retried delivery of the same reply changes nothing more.
	if n, _ := res.RowsAffected(); n == 0 {
		return
	}

	if optOut && contactID != nil {
		h.db.Exec(`UPDATE phone_sms_contacts SET opted_in = false, opted_out_at = NOW(), updated_at = NOW()
			WHERE id = $1 AND opted_in = true`, *contactID)
		log.Printf("[phone-sms] account %d: contact %d opted out by reply", accountID, *contactID)
	}
}

// recordStatus applies a sent, delivered or failed report to the campaign
// message it belongs to, within the account the webhook token belongs to.
func (h *PhoneSMSHandler) recordStatus(accountID int, event string, p smsgate.SmsPayload) {
	h.applyStatus(accountID, event, p, "SEND_FAILED")
}

// applyStatus is recordStatus with the error code an API message gets when it
// fails: SEND_FAILED for the phone's own report, EXPIRED when the phone never
// took it in time.
func (h *PhoneSMSHandler) applyStatus(accountID int, event string, p smsgate.SmsPayload, failCode string) {
	if p.MessageID == "" {
		return
	}

	var msg struct {
		ID         int    `db:"id"`
		CampaignID int    `db:"campaign_id"`
		Status     string `db:"status"`
	}
	if err := h.db.Get(&msg, `
		SELECT m.id, m.campaign_id, m.status FROM phone_sms_campaign_messages m
		JOIN phone_sms_campaigns c ON c.id = m.campaign_id
		WHERE c.account_id = $1 AND m.gateway_msg_id = $2
		ORDER BY m.id DESC LIMIT 1`, accountID, p.MessageID); err != nil {
		// An API message, or else a test message or one sent from the phone by hand.
		h.recordAPIStatus(accountID, event, p, failCode)
		return
	}

	at := phoneSMSNow()

	switch event {
	case smsgate.EventSmsSent:
		if phoneSMSStatusRank[msg.Status] >= phoneSMSStatusRank["sent"] || msg.Status == "failed" {
			return
		}

		if p.SentAt != nil {
			at = *p.SentAt
		}

		h.db.Exec(`UPDATE phone_sms_campaign_messages SET status = 'sent', sent_at = $2 WHERE id = $1`, msg.ID, at)
	case smsgate.EventSmsDelivered:
		if msg.Status == "delivered" {
			return
		}

		if p.DeliveredAt != nil {
			at = *p.DeliveredAt
		}

		h.db.Exec(`UPDATE phone_sms_campaign_messages SET status = 'delivered', delivered_at = $2, error_reason = '' WHERE id = $1`, msg.ID, at)
	case smsgate.EventSmsFailed:
		if msg.Status == "delivered" || msg.Status == "failed" {
			return
		}

		if p.FailedAt != nil {
			at = *p.FailedAt
		}

		reason := p.Reason
		if reason == "" {
			reason = "The phone could not send it"
		}

		h.db.Exec(`UPDATE phone_sms_campaign_messages SET status = 'failed', failed_at = $2, error_reason = $3 WHERE id = $1`, msg.ID, at, reason)
	}

	h.refreshCounts(msg.CampaignID)
}
