package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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

// The public API for Phone SMS (own SIM), at /api/v1/phone-sms. Messages go out
// on the account's own SIM, up to the daily limit set in Phone SMS settings, and
// use 1 Phone SMS API credit each, like the other channels: reserved when queued,
// confirmed when the phone takes the message, and returned if it fails. A send is
// queued and handed to the phone in turn, the same gap apart as campaign
// messages, so a burst of API calls can't get the SIM blocked by the operator.

const phoneSMSAPIMessagePrefix = "phone_sms_msg_"

// phoneSMSAPIMessage is how the API reports a message.
type phoneSMSAPIMessage struct {
	ID           int        `json:"id" db:"id"`
	MessageID    string     `json:"message_id" db:"-"`
	To           string     `json:"to" db:"to"`
	From         *string    `json:"from" db:"from"` // the SIM it went out on
	Status       string     `json:"status" db:"status"`
	Credits      float64    `json:"credits_charged" db:"credits_charged"`
	ErrorCode    *string    `json:"error_code" db:"error_code"`
	ErrorMessage *string    `json:"error_message" db:"error_message"`
	Reference    *string    `json:"reference" db:"reference"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	SentAt       *time.Time `json:"sent_at" db:"sent_at"`
	DeliveredAt  *time.Time `json:"delivered_at" db:"delivered_at"`
}

// phoneSMSOutgoing is one message an API call asks to send.
type phoneSMSOutgoing struct {
	To        string
	Text      string
	Reference *string
}

// phoneSMSAPINumber accepts 98XXXXXXXX, 9779XXXXXXXXX or +977 9XXXXXXXXX and
// returns the 10-digit form.
func phoneSMSAPINumber(to string) (string, bool) {
	p := phoneSMSLocal(to)

	return p, smsPhoneRegex.MatchString(p)
}

// APISend queues one SMS to go out from the account's phone.
func (h *PhoneSMSHandler) APISend(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		To        string  `json:"to"`
		Message   string  `json:"message"`
		Reference *string `json:"reference"`
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if req.To == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Phone number is required", "to")
	}

	to, ok := phoneSMSAPINumber(req.To)
	if !ok {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
			"Invalid phone number. Use 10 digits starting with 9, with or without +977", "to")
	}

	if req.Message == "" {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message text is required", "message")
	}

	if len(req.Message) > 1600 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Message too long. Maximum 1600 characters", "message")
	}

	ids, remaining, fail := h.apiQueue(keyInfo, []phoneSMSOutgoing{{To: to, Text: req.Message, Reference: req.Reference}})
	if fail != nil {
		return apiError(c, fail.status, fail.code, fail.message, "")
	}

	data := map[string]interface{}{
		"message_id":        phoneSMSAPIMessagePrefix + strconv.Itoa(ids[0]),
		"to":                to,
		"status":            "queued",
		"credits_used":      1,
		"credits_remaining": GetCreditBalance(h.db, keyInfo.AccountID, "phone_sms"),
		"remaining_today":   remaining,
	}

	if keyInfo.IsTest {
		data["status"] = "test"
		data["credits_used"] = 0
		data["test_mode"] = true
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data})
}

// APISendBulk queues up to 100 messages; they go out one at a time, a gap apart.
func (h *PhoneSMSHandler) APISendBulk(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	var req struct {
		Recipients []struct {
			To        string  `json:"to"`
			Message   string  `json:"message"`
			Reference *string `json:"reference"`
		} `json:"recipients"`
		Message string `json:"message"` // shared message if recipients don't have individual ones
	}

	if err := c.Bind(&req); err != nil {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Invalid request body", "")
	}

	if len(req.Recipients) == 0 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "At least one recipient is required", "recipients")
	}

	if len(req.Recipients) > 100 {
		return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Maximum 100 recipients per bulk request", "recipients")
	}

	msgs := make([]phoneSMSOutgoing, 0, len(req.Recipients))

	for i, r := range req.Recipients {
		to, ok := phoneSMSAPINumber(r.To)
		if !ok {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("Invalid phone number at index %d: %s", i, r.To), "recipients")
		}

		text := r.Message
		if text == "" {
			text = req.Message
		}

		if text == "" {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("No message for recipient at index %d", i), "recipients")
		}

		if len(text) > 1600 {
			return apiError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR",
				fmt.Sprintf("Message too long for recipient at index %d. Maximum 1600 characters", i), "recipients")
		}

		msgs = append(msgs, phoneSMSOutgoing{To: to, Text: text, Reference: r.Reference})
	}

	ids, remaining, fail := h.apiQueue(keyInfo, msgs)
	if fail != nil {
		return apiError(c, fail.status, fail.code, fail.message, "")
	}

	messageIDs := make([]string, len(ids))
	for i, id := range ids {
		messageIDs[i] = phoneSMSAPIMessagePrefix + strconv.Itoa(id)
	}

	data := map[string]interface{}{
		"total":             len(ids),
		"queued":            len(ids),
		"message_ids":       messageIDs,
		"credits_used":      len(ids),
		"credits_remaining": GetCreditBalance(h.db, keyInfo.AccountID, "phone_sms"),
		"remaining_today":   remaining,
	}

	if keyInfo.IsTest {
		data["queued"] = 0
		data["credits_used"] = 0
		data["test_mode"] = true
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data})
}

// phoneSMSAPIFailure is why a call was refused, for apiError.
type phoneSMSAPIFailure struct {
	status        int
	code, message string
}

var phoneSMSQueueFailed = &phoneSMSAPIFailure{http.StatusInternalServerError, "PROVIDER_ERROR", "Could not queue the message, so it was not sent."}

// apiQueue reserves a credit for each message, records them and starts the
// account's sender. It refuses the whole call when the phone's daily allowance
// or the credit balance can't take all of them. remaining is what is left of
// today's allowance afterwards, nil when there is no limit. A test key records
// the messages as "test", sends nothing and uses no credits.
func (h *PhoneSMSHandler) apiQueue(keyInfo *mw.APIKeyInfo, msgs []phoneSMSOutgoing) ([]int, *int, *phoneSMSAPIFailure) {
	accountID := keyInfo.AccountID

	settings, err := h.settingsOf(accountID)
	if err != nil || settings.Username == "" || settings.Password == "" {
		return nil, nil, &phoneSMSAPIFailure{http.StatusForbidden, "CHANNEL_NOT_CONFIGURED", "Connect your phone in Phone SMS settings first"}
	}

	status := "queued"
	if keyInfo.IsTest {
		status = "test"
	}

	remaining := h.allowanceLeft(accountID, settings)
	if !keyInfo.IsTest && remaining != nil {
		if *remaining < len(msgs) {
			return nil, nil, &phoneSMSAPIFailure{http.StatusTooManyRequests, "DAILY_LIMIT_REACHED",
				fmt.Sprintf("Your phone's daily limit of %d messages can take %d more today, and this call has %d. It resets at midnight Nepal time.",
					settings.DailyLimit, *remaining, len(msgs))}
		}

		*remaining -= len(msgs)
	}

	perMessage := 0.0
	if !keyInfo.IsTest {
		perMessage = 1
		total := perMessage * float64(len(msgs))

		if _, err := ReserveCredit(h.db, accountID, "phone_sms", total); err != nil {
			return nil, nil, &phoneSMSAPIFailure{http.StatusPaymentRequired, "INSUFFICIENT_CREDITS",
				fmt.Sprintf("Phone SMS credit balance too low. Need %.0f, have %.0f", total, GetCreditBalance(h.db, accountID, "phone_sms"))}
		}
	}

	// Nothing was queued: the reserved credits go back.
	queueFailed := func() ([]int, *int, *phoneSMSAPIFailure) {
		if perMessage > 0 {
			RefundCredit(h.db, accountID, "phone_sms", perMessage*float64(len(msgs)))
		}

		return nil, nil, phoneSMSQueueFailed
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return queueFailed()
	}
	defer tx.Rollback()

	ids := make([]int, len(msgs))

	for i, m := range msgs {
		// The full text waits in metadata until the phone has it; the row keeps
		// only the preview after that, as for the other channels.
		var metadata interface{}
		if !keyInfo.IsTest {
			raw, _ := json.Marshal(map[string]string{"text": m.Text})
			metadata = string(raw)
		}

		if err := tx.QueryRow(`
			INSERT INTO api_messages (account_id, api_key_id, channel, "to", content_preview, status, credits_charged, webhook_url, reference, metadata)
			VALUES ($1, $2, 'phone_sms', $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING id
		`, accountID, keyInfo.KeyID, m.To, truncate(m.Text, 200), status, perMessage, keyInfo.WebhookURL, m.Reference, metadata).Scan(&ids[i]); err != nil {
			log.Printf("[phone-sms] API: account %d: queueing a message: %v", accountID, err)

			return queueFailed()
		}
	}

	if err := tx.Commit(); err != nil {
		return queueFailed()
	}

	if !keyInfo.IsTest {
		h.kickAPISender(accountID)
	}

	return ids, remaining, nil
}

// allowanceLeft is how many more messages the phone may take today: the daily
// limit less what campaigns and the API sent today and API messages still
// waiting. nil means the account set no limit.
func (h *PhoneSMSHandler) allowanceLeft(accountID int, settings *PhoneSMSSettings) *int {
	if settings.DailyLimit <= 0 {
		return nil
	}

	// One statement, so a message moving from queued to sent while it runs is
	// counted once, not missed by two separate counts.
	var used int
	h.db.Get(&used, `
		SELECT (SELECT COUNT(*) FROM phone_sms_campaign_messages m
		        JOIN phone_sms_campaigns c ON c.id = m.campaign_id
		        WHERE c.account_id = $1 AND m.submitted_at >= $2)
		     + (SELECT COUNT(*) FROM api_messages
		        WHERE account_id = $1 AND channel = 'phone_sms'
		          AND (status = 'queued' OR (provider_message_id <> '' AND sent_at >= $2)))`,
		accountID, phoneSMSDayStart(phoneSMSNow()))

	left := settings.DailyLimit - used
	if left < 0 {
		left = 0
	}

	return &left
}

func (h *PhoneSMSHandler) queuedAPIMessages(accountID int) int {
	var n int
	h.db.Get(&n, `SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'phone_sms' AND status = 'queued'`, accountID)

	return n
}

// ============================================================
// Sending
// ============================================================

// kickAPISender starts the account's API sender unless one is already running.
func (h *PhoneSMSHandler) kickAPISender(accountID int) {
	if h.claimAPISender(accountID) {
		go h.runAPISender(accountID)
	}
}

func (h *PhoneSMSHandler) claimAPISender(accountID int) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.apiSending[accountID] {
		return false
	}

	h.apiSending[accountID] = true

	return true
}

// runAPISender sends the account's queued API messages until none are left.
func (h *PhoneSMSHandler) runAPISender(accountID int) {
	for {
		drained := h.sendQueuedAPIMessages(accountID)

		h.mu.Lock()
		delete(h.apiSending, accountID)
		h.mu.Unlock()

		// A message queued just as the queue ran dry found this sender still
		// running and didn't start another, so look once more.
		if !drained || h.queuedAPIMessages(accountID) == 0 || !h.claimAPISender(accountID) {
			return
		}
	}
}

// sendQueuedAPIMessages hands the queued messages to the phone one at a time,
// each in its turn. It reports false when it stopped because the database could
// not be read, with messages possibly still queued.
func (h *PhoneSMSHandler) sendQueuedAPIMessages(accountID int) bool {
	client, settings, err := h.getClient(accountID)
	if err != nil {
		h.failQueuedAPIMessages(accountID, "CHANNEL_NOT_CONFIGURED", err.Error())
		return true
	}

	withReport := true
	ttl := uint64(phoneSMSMessageTTL)

	var sim *int
	if settings.SimNumber > 0 {
		sim = &settings.SimNumber
	}

	for {
		var next struct {
			ID       int             `db:"id"`
			To       string          `db:"to"`
			Metadata json.RawMessage `db:"metadata"`
			Charged  float64         `db:"credits_charged"`
		}

		err := h.db.Get(&next, `SELECT id, "to", metadata, credits_charged FROM api_messages
			WHERE account_id = $1 AND channel = 'phone_sms' AND status = 'queued'
			ORDER BY id LIMIT 1`, accountID)
		if errors.Is(err, sql.ErrNoRows) {
			return true
		}

		if err != nil {
			log.Printf("[phone-sms] API: account %d: reading the queue: %v", accountID, err)
			return false
		}

		var meta struct {
			Text string `json:"text"`
		}
		json.Unmarshal(next.Metadata, &meta)

		if meta.Text == "" {
			h.failAPIMessage(accountID, next.ID, "VALIDATION_ERROR", "The message has no text")
			continue
		}

		if limit := settings.DailyLimit; limit > 0 && h.sentToday(accountID, phoneSMSNow()) >= limit {
			// Campaigns used up the allowance after these were accepted.
			h.failQueuedAPIMessages(accountID, "DAILY_LIMIT_REACHED",
				fmt.Sprintf("Your phone's daily limit of %d messages was used up before this message's turn.", limit))

			return true
		}

		time.Sleep(h.takeTurn(accountID, phoneSMSGap(settings.SendGapSeconds)))

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		state, err := client.Send(ctx, smsgate.Message{
			DeviceID:           settings.DeviceID,
			TextMessage:        &smsgate.TextMessage{Text: meta.Text},
			PhoneNumbers:       []string{phoneSMSE164(next.To)},
			SimNumber:          sim,
			WithDeliveryReport: &withReport,
			TTL:                &ttl,
		})
		cancel()

		if err != nil {
			if smsgate.RecipientProblem(err) {
				h.failAPIMessage(accountID, next.ID, "INVALID_RECIPIENT", err.Error())
				continue
			}

			// Bad credentials, no phone, SMSGate down: every queued message would
			// fail the same way, so they all fail now rather than one per gap.
			log.Printf("[phone-sms] API: account %d: stopped: %v", accountID, err)
			h.failQueuedAPIMessages(accountID, "PHONE_UNREACHABLE", gatewayErrorMessage(err))

			return true
		}

		h.db.Exec(`UPDATE api_messages SET status = 'submitted', provider_message_id = $2, "from" = $3,
			metadata = metadata - 'text', sent_at = NOW(), updated_at = NOW()
			WHERE id = $1 AND status = 'queued'`, next.ID, state.ID, simLabel(settings.SimNumber))

		// The phone has it: the reserved credit is spent.
		if next.Charged > 0 {
			ConfirmCredit(h.db, accountID, "phone_sms", next.Charged, next.ID)
		}
	}
}

// failAPIMessage closes a queued message as failed and returns its reserved credit.
func (h *PhoneSMSHandler) failAPIMessage(accountID, id int, code, reason string) {
	var charged float64

	err := h.db.QueryRow(`UPDATE api_messages SET status = 'failed', credits_charged = 0, error_code = $3, error_message = $4,
		metadata = metadata - 'text', updated_at = NOW()
		FROM (SELECT id AS qid, credits_charged AS charged FROM api_messages WHERE id = $1 AND account_id = $2) q
		WHERE api_messages.id = q.qid AND api_messages.status = 'queued'
		RETURNING q.charged`, id, accountID, code, reason).Scan(&charged)
	if err == nil && charged > 0 {
		RefundCredit(h.db, accountID, "phone_sms", charged)
	}
}

// failQueuedAPIMessages closes all the account's queued messages as failed and
// returns their reserved credits.
func (h *PhoneSMSHandler) failQueuedAPIMessages(accountID int, code, reason string) {
	var charged float64

	err := h.db.Get(&charged, `
		WITH failed AS (
			UPDATE api_messages SET status = 'failed', credits_charged = 0, error_code = $2, error_message = $3,
				metadata = metadata - 'text', updated_at = NOW()
			FROM (SELECT id AS qid, credits_charged AS charged FROM api_messages
			      WHERE account_id = $1 AND channel = 'phone_sms' AND status = 'queued') q
			WHERE api_messages.id = q.qid AND api_messages.status = 'queued'
			RETURNING q.charged
		)
		SELECT COALESCE(SUM(charged), 0) FROM failed`, accountID, code, reason)
	if err == nil && charged > 0 {
		RefundCredit(h.db, accountID, "phone_sms", charged)
	}
}

// recordAPIStatus applies the phone's sent, delivered or failed report to an API
// message of the account. Like campaign messages, a message never moves back.
func (h *PhoneSMSHandler) recordAPIStatus(accountID int, event string, p smsgate.SmsPayload, failCode string) {
	var msg struct {
		ID      int     `db:"id"`
		Status  string  `db:"status"`
		Charged float64 `db:"credits_charged"`
	}
	if err := h.db.Get(&msg, `SELECT id, status, credits_charged FROM api_messages
		WHERE account_id = $1 AND channel = 'phone_sms' AND provider_message_id = $2
		ORDER BY id DESC LIMIT 1`, accountID, p.MessageID); err != nil {
		return // a test message, or one sent from the phone by hand
	}

	switch event {
	case smsgate.EventSmsSent:
		if phoneSMSStatusRank[msg.Status] >= phoneSMSStatusRank["sent"] || msg.Status == "failed" {
			return
		}

		h.db.Exec(`UPDATE api_messages SET status = 'sent', updated_at = NOW() WHERE id = $1`, msg.ID)
	case smsgate.EventSmsDelivered:
		if msg.Status == "delivered" {
			return
		}

		at := phoneSMSNow()
		if p.DeliveredAt != nil {
			at = *p.DeliveredAt
		}

		h.db.Exec(`UPDATE api_messages SET status = 'delivered', delivered_at = $2, error_code = NULL, error_message = NULL,
			updated_at = NOW() WHERE id = $1`, msg.ID, at)
	case smsgate.EventSmsFailed:
		if msg.Status == "delivered" || msg.Status == "failed" {
			return
		}

		reason := p.Reason
		if reason == "" {
			reason = "The phone could not send it"
		}

		// The phone couldn't send it, so its credit comes back. Conditional, so a
		// report delivered twice refunds once.
		res, err := h.db.Exec(`UPDATE api_messages SET status = 'failed', credits_charged = 0, error_code = $3, error_message = $2,
			updated_at = NOW() WHERE id = $1 AND status NOT IN ('failed', 'delivered')`, msg.ID, reason, failCode)
		if err != nil {
			return
		}

		if n, _ := res.RowsAffected(); n == 1 && msg.Charged > 0 {
			RefundConfirmedCredit(h.db, accountID, "phone_sms", msg.Charged, msg.ID)
		}
	}
}

// ============================================================
// Reading
// ============================================================

// APIGetMessage returns one message, by "phone_sms_msg_123" or 123.
func (h *PhoneSMSHandler) APIGetMessage(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	id, err := strconv.Atoi(strings.TrimPrefix(c.Param("id"), phoneSMSAPIMessagePrefix))
	if err != nil || id <= 0 {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	var msg phoneSMSAPIMessage
	if err := h.db.Get(&msg, `
		SELECT id, "to", "from", status, credits_charged, error_code, error_message, reference, created_at, sent_at, delivered_at
		FROM api_messages WHERE id = $1 AND account_id = $2 AND channel = 'phone_sms'`, id, keyInfo.AccountID); err != nil {
		return apiError(c, http.StatusNotFound, "NOT_FOUND", "Message not found", "")
	}

	msg.MessageID = phoneSMSAPIMessagePrefix + strconv.Itoa(msg.ID)

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": msg})
}

// APIListMessages returns the account's API messages, newest first, 25 a page.
func (h *PhoneSMSHandler) APIListMessages(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}

	perPage := 25

	var total int
	h.db.Get(&total, `SELECT COUNT(*) FROM api_messages WHERE account_id = $1 AND channel = 'phone_sms'`, keyInfo.AccountID)

	messages := []phoneSMSAPIMessage{}
	h.db.Select(&messages, `
		SELECT id, "to", "from", status, credits_charged, error_code, error_message, reference, created_at, sent_at, delivered_at
		FROM api_messages WHERE account_id = $1 AND channel = 'phone_sms'
		ORDER BY id DESC LIMIT $2 OFFSET $3`, keyInfo.AccountID, perPage, (page-1)*perPage)

	for i := range messages {
		messages[i].MessageID = phoneSMSAPIMessagePrefix + strconv.Itoa(messages[i].ID)
	}

	return response.Paginated(c, messages, total, page, perPage)
}

// APIBalance reports the Phone SMS credit balance and the phone's daily allowance.
func (h *PhoneSMSHandler) APIBalance(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	now := phoneSMSNow()
	data := map[string]interface{}{
		"channel":        "phone_sms",
		"balance":        GetCreditBalance(h.db, keyInfo.AccountID, "phone_sms"),
		"credit_per_sms": 1,
		"sent_today":     h.sentToday(keyInfo.AccountID, now),
		"queued":         h.queuedAPIMessages(keyInfo.AccountID),
		"resets_at":      phoneSMSDayStart(now).AddDate(0, 0, 1),
	}

	if settings, err := h.settingsOf(keyInfo.AccountID); err == nil {
		data["daily_limit"] = settings.DailyLimit
		data["remaining_today"] = h.allowanceLeft(keyInfo.AccountID, settings)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data})
}

// APIStatus reports whether the phone is connected, and when SMSGate last
// heard from it.
func (h *PhoneSMSHandler) APIStatus(c echo.Context) error {
	keyInfo := mw.GetAPIKeyInfo(c)
	if keyInfo == nil {
		return response.Unauthorized(c, "Invalid API key")
	}

	client, settings, err := h.getClient(keyInfo.AccountID)

	data := map[string]interface{}{
		"channel":    "phone_sms",
		"configured": err == nil,
		"provider":   "smsgate",
	}

	if err == nil {
		data["daily_limit"] = settings.DailyLimit
		data["send_gap_seconds"] = settings.SendGapSeconds
		data["sim"] = simLabel(settings.SimNumber)

		ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
		devices, derr := client.ListDevices(ctx)
		cancel()

		if derr != nil {
			data["phone_reachable"] = false
			data["error"] = gatewayErrorMessage(derr)
		} else {
			// A registered phone isn't necessarily online: it is reachable only if
			// SMSGate heard from it within the last hour.
			now := phoneSMSNow()
			phones := make([]map[string]interface{}, 0, len(devices))

			var lastSeen time.Time
			for _, d := range devices {
				phones = append(phones, map[string]interface{}{
					"id": d.ID, "name": d.Name, "last_seen": d.LastSeen, "online": phoneSMSOnline(d.LastSeen, now),
				})

				if d.LastSeen.After(lastSeen) {
					lastSeen = d.LastSeen
				}
			}

			data["phones"] = phones
			data["phone_reachable"] = phoneSMSOnline(lastSeen, now)

			if !lastSeen.IsZero() {
				data["phone_last_seen"] = lastSeen
			}

			if !phoneSMSOnline(lastSeen, now) {
				data["warning"] = phoneSMSOfflineWarning(lastSeen)
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data})
}
