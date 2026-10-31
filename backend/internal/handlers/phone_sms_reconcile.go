package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/smsgate"
)

// The phone sends its sent, delivered and failed reports itself, and they are
// lost while it sleeps or is offline: on 26 October 2026 SMSGate had messages
// delivered and failed that were still "submitted" here. So messages without a
// final report are also checked with SMSGate directly, and ones the phone never
// took before they expired are closed as failed (and refunded, for the API).

// phoneSMSOfflineAfter: SMSGate hears from an idle phone about every 15
// minutes, so one it hasn't heard from for an hour is offline.
const phoneSMSOfflineAfter = time.Hour

// phoneSMSCheckAfter is how long after hand-off a message without a final
// report is first checked with SMSGate.
const phoneSMSCheckAfter = 15 * time.Minute

// phoneSMSStopCheckingSent: a message the phone sent is checked for a delivery
// report this long; some networks never send one.
const phoneSMSStopCheckingSent = 6 * time.Hour

// phoneSMSExpiry is when the phone can no longer send a message: its TTL, plus
// a margin.
const phoneSMSExpiry = phoneSMSMessageTTL*time.Second + 15*time.Minute

// phoneSMSOnline reports whether SMSGate heard from the phone recently enough
// for it to be online.
func phoneSMSOnline(lastSeen, now time.Time) bool {
	return !lastSeen.IsZero() && now.Sub(lastSeen) < phoneSMSOfflineAfter
}

// phoneSMSOfflineWarning explains an offline phone to the account.
func phoneSMSOfflineWarning(lastSeen time.Time) string {
	if lastSeen.IsZero() {
		return "No phone is connected to SMSGate. Open the SMSGate app on your phone and turn on Cloud server."
	}

	return fmt.Sprintf("SMSGate hasn't heard from your phone since %s. Messages wait until it is back online; "+
		"any it doesn't send within 24 hours are marked failed (EXPIRED) and refunded. "+
		"Check the phone is on and online, and that the SMSGate app is running.", lastSeen.UTC().Format(time.RFC3339))
}

// reconcile brings every account's unreported messages up to date with SMSGate.
func (h *PhoneSMSHandler) reconcile(now time.Time) {
	var accounts []int
	if err := h.db.Select(&accounts, `
		SELECT account_id FROM api_messages
		WHERE channel = 'phone_sms' AND provider_message_id <> '' AND sent_at < $1
		  AND (status = 'submitted' OR (status = 'sent' AND sent_at > $2))
		UNION
		SELECT c.account_id FROM phone_sms_campaign_messages m
		JOIN phone_sms_campaigns c ON c.id = m.campaign_id
		WHERE m.gateway_msg_id <> '' AND m.submitted_at < $1
		  AND (m.status = 'submitted' OR (m.status = 'sent' AND m.submitted_at > $2))`,
		now.Add(-phoneSMSCheckAfter), now.Add(-phoneSMSStopCheckingSent)); err != nil {
		log.Printf("[phone-sms] reconcile: listing accounts: %v", err)
		return
	}

	for _, accountID := range accounts {
		h.reconcileAccount(accountID, now)
	}
}

// reconcileAccount asks SMSGate about the account's messages that have no final
// report. It only asks about one the phone could have handled — it has been
// online since the hand-off — or one that has expired and needs closing, so an
// offline phone costs one call a run, not one per waiting message.
func (h *PhoneSMSHandler) reconcileAccount(accountID int, now time.Time) {
	client, _, err := h.getClient(accountID)
	if err != nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	devices, err := client.ListDevices(ctx)
	if err != nil {
		log.Printf("[phone-sms] reconcile: account %d: listing phones: %v", accountID, err)
		return
	}

	var lastSeen time.Time
	for _, d := range devices {
		if d.LastSeen.After(lastSeen) {
			lastSeen = d.LastSeen
		}
	}

	var unreported []struct {
		GatewayID string    `db:"gateway_id"`
		HandedAt  time.Time `db:"handed_at"`
	}
	if err := h.db.Select(&unreported, `
		SELECT provider_message_id AS gateway_id, sent_at AS handed_at FROM api_messages
		WHERE account_id = $1 AND channel = 'phone_sms' AND provider_message_id <> '' AND sent_at < $2
		  AND (status = 'submitted' OR (status = 'sent' AND sent_at > $3))
		UNION ALL
		SELECT m.gateway_msg_id, m.submitted_at FROM phone_sms_campaign_messages m
		JOIN phone_sms_campaigns c ON c.id = m.campaign_id
		WHERE c.account_id = $1 AND m.gateway_msg_id <> '' AND m.submitted_at < $2
		  AND (m.status = 'submitted' OR (m.status = 'sent' AND m.submitted_at > $3))
		ORDER BY handed_at LIMIT 200`,
		accountID, now.Add(-phoneSMSCheckAfter), now.Add(-phoneSMSStopCheckingSent)); err != nil {
		log.Printf("[phone-sms] reconcile: account %d: listing messages: %v", accountID, err)
		return
	}

	for _, m := range unreported {
		expired := now.Sub(m.HandedAt) > phoneSMSExpiry
		if !expired && !lastSeen.After(m.HandedAt) {
			continue
		}

		state, err := client.GetState(ctx, m.GatewayID)
		if err != nil {
			log.Printf("[phone-sms] reconcile: account %d: message %s: %v", accountID, m.GatewayID, err)
			continue
		}

		h.applyGatewayState(accountID, m.GatewayID, state, expired)
	}
}

// applyGatewayState records what SMSGate says became of a message, as if the
// phone's own report had arrived. A message the phone never sent is closed as
// EXPIRED once it can no longer be sent.
func (h *PhoneSMSHandler) applyGatewayState(accountID int, gatewayID string, st smsgate.MessageState, expired bool) {
	p := smsgate.SmsPayload{MessageID: gatewayID}

	at := func(state string) *time.Time {
		if t, ok := st.States[state]; ok {
			return &t
		}

		return nil
	}

	switch st.State {
	case "Sent":
		p.SentAt = at("Sent")
		h.recordStatus(accountID, smsgate.EventSmsSent, p)
	case "Delivered":
		p.DeliveredAt = at("Delivered")
		h.recordStatus(accountID, smsgate.EventSmsDelivered, p)
	case "Failed":
		p.FailedAt = at("Failed")
		for _, r := range st.Recipients {
			if r.Error != nil && *r.Error != "" {
				p.Reason = *r.Error
				break
			}
		}
		h.recordStatus(accountID, smsgate.EventSmsFailed, p)
	default: // Pending or Processed: the phone hasn't sent it
		if expired {
			p.Reason = "Your phone didn't send this within 24 hours (it was offline), so it was not sent."
			h.applyStatus(accountID, smsgate.EventSmsFailed, p, "EXPIRED")
		}
	}
}

// StartReconcile checks every interval for messages the phone hasn't reported on.
func (h *PhoneSMSHandler) StartReconcile(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.reconcile(phoneSMSNow())
		}
	}
}
