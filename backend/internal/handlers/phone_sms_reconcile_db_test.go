package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/smsgate"
)

// handedAPIMessage is an API message the phone was handed `ago`, charged 1
// credit (already confirmed).
func (f *phoneFixture) handedAPIMessage(t *testing.T, key *mw.APIKeyInfo, gatewayID string, ago time.Duration) int {
	t.Helper()

	return waInsertID(t, f.db, `INSERT INTO api_messages (account_id, api_key_id, channel, "to", status, credits_charged, provider_message_id, sent_at)
		VALUES ($1, $2, 'phone_sms', '9800000001', 'submitted', 1, $3, NOW() - make_interval(secs => $4)) RETURNING id`,
		key.AccountID, key.KeyID, gatewayID, ago.Seconds())
}

// handedCampaignMessage is a campaign message the phone was handed `ago`.
func (f *phoneFixture) handedCampaignMessage(t *testing.T, campaign int, phone, gatewayID string, ago time.Duration) int {
	t.Helper()

	contact := f.contact(t, f.account, phone, true)

	return waInsertID(t, f.db, `INSERT INTO phone_sms_campaign_messages (campaign_id, contact_id, status, gateway_msg_id, submitted_at)
		VALUES ($1, $2, 'submitted', $3, NOW() - make_interval(secs => $4)) RETURNING id`,
		campaign, contact, gatewayID, ago.Seconds())
}

func (f *phoneFixture) gatewayStates(states map[string]smsgate.MessageState, lastSeen time.Time) {
	f.gw.mu.Lock()
	defer f.gw.mu.Unlock()

	f.gw.states = states
	f.gw.lastSeen = lastSeen
}

func (f *phoneFixture) apiStatus(t *testing.T, id int) (string, string, float64) {
	t.Helper()

	var row struct {
		Status  string  `db:"status"`
		Code    *string `db:"error_code"`
		Charged float64 `db:"credits_charged"`
	}
	f.db.Get(&row, `SELECT status, error_code, credits_charged FROM api_messages WHERE id = $1`, id)

	code := ""
	if row.Code != nil {
		code = *row.Code
	}

	return row.Status, code, row.Charged
}

func failedState(reason string) smsgate.MessageState {
	return smsgate.MessageState{State: "Failed", Recipients: []smsgate.RecipientState{{State: "Failed", Error: &reason}}}
}

// The phone's own reports can go missing (26 October 2026). Messages without
// one are checked with SMSGate: delivered stays charged, failed is refunded,
// still pending is left alone, and one handed over moments ago isn't asked about.
func TestPhoneSMSReconcileCatchesMissedReports(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)
	f.db.MustExec(`UPDATE api_credits SET balance = 6 WHERE account_id = $1 AND channel = 'phone_sms'`, f.account)

	delivered := f.handedAPIMessage(t, key, "gw-a", 30*time.Minute)
	failed := f.handedAPIMessage(t, key, "gw-b", 30*time.Minute)
	pending := f.handedAPIMessage(t, key, "gw-c", 30*time.Minute)
	fresh := f.handedAPIMessage(t, key, "gw-d", 5*time.Minute)

	campaign := f.campaign(t)
	campaignMsg := f.handedCampaignMessage(t, campaign, "9800000005", "gw-e", 30*time.Minute)

	f.gatewayStates(map[string]smsgate.MessageState{
		"gw-a": {State: "Delivered", States: map[string]time.Time{"Delivered": time.Now().Add(-20 * time.Minute)}},
		"gw-b": failedState("No service"),
		"gw-c": {State: "Pending"},
		"gw-d": {State: "Delivered"},
		"gw-e": {State: "Delivered"},
	}, time.Now())

	f.h.reconcile(time.Now())

	if st, _, charged := f.apiStatus(t, delivered); st != "delivered" || charged != 1 {
		t.Errorf("delivered message: %s, charged %v; want delivered and still charged", st, charged)
	}

	if st, code, charged := f.apiStatus(t, failed); st != "failed" || code != "SEND_FAILED" || charged != 0 {
		t.Errorf("failed message: %s %s, charged %v; want failed SEND_FAILED and refunded", st, code, charged)
	}

	if st, _, _ := f.apiStatus(t, pending); st != "submitted" {
		t.Errorf("pending message: %s, want it left as submitted", st)
	}

	if st, _, _ := f.apiStatus(t, fresh); st != "submitted" {
		t.Errorf("message handed over 5 minutes ago: %s, want it not checked yet", st)
	}

	if balance, _ := f.credits(t, f.account); balance != 7 {
		t.Errorf("balance %v, want 7 (the failed message's credit back)", balance)
	}

	var campaignStatus string
	f.db.Get(&campaignStatus, `SELECT status FROM phone_sms_campaign_messages WHERE id = $1`, campaignMsg)

	if c := f.campaignRow(t, campaign); campaignStatus != "delivered" || c.DeliveredCount != 1 {
		t.Errorf("campaign message %s, campaign delivered_count %d; want delivered and counted", campaignStatus, c.DeliveredCount)
	}

	if f.gw.stateCalls != 4 {
		t.Errorf("asked SMSGate about %d messages, want 4 (not the one handed over 5 minutes ago)", f.gw.stateCalls)
	}

	// A second run changes nothing and refunds nothing twice.
	f.h.reconcile(time.Now())

	if balance, _ := f.credits(t, f.account); balance != 7 {
		t.Errorf("after a second run: balance %v, want still 7", balance)
	}
}

// A phone that went offline never takes its messages. Once they expire they are
// closed as EXPIRED and refunded; younger ones wait, and SMSGate isn't asked
// about them while the phone hasn't been back online.
func TestPhoneSMSReconcileExpiresWhatTheOfflinePhoneNeverTook(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)
	f.db.MustExec(`UPDATE api_credits SET balance = 8 WHERE account_id = $1 AND channel = 'phone_sms'`, f.account)

	old := f.handedAPIMessage(t, key, "gw-old", 30*time.Hour)
	young := f.handedAPIMessage(t, key, "gw-young", 2*time.Hour)

	campaign := f.campaign(t)
	oldCampaignMsg := f.handedCampaignMessage(t, campaign, "9800000005", "gw-oldc", 30*time.Hour)

	f.gatewayStates(map[string]smsgate.MessageState{
		"gw-old":   {State: "Pending"},
		"gw-young": {State: "Pending"},
		"gw-oldc":  {State: "Pending"},
	}, time.Now().Add(-96*time.Hour))

	f.h.reconcile(time.Now())

	row := f.apiRow(t, old)
	if row["status"] != "failed" || row["error_code"] != "EXPIRED" || row["credits_charged"] != float64(0) ||
		!strings.Contains(fmt.Sprint(row["error_message"]), "24 hours") {
		t.Errorf("expired message: %v, want failed EXPIRED and refunded", row)
	}

	if st, _, _ := f.apiStatus(t, young); st != "submitted" {
		t.Errorf("2-hour-old message: %s, want it still waiting for the phone", st)
	}

	var reason string
	f.db.Get(&reason, `SELECT error_reason FROM phone_sms_campaign_messages WHERE id = $1 AND status = 'failed'`, oldCampaignMsg)

	if !strings.Contains(reason, "24 hours") {
		t.Errorf("expired campaign message reason %q, want it closed as not sent", reason)
	}

	if balance, _ := f.credits(t, f.account); balance != 9 {
		t.Errorf("balance %v, want 9 (the expired message refunded)", balance)
	}

	if f.gw.stateCalls != 2 {
		t.Errorf("asked SMSGate about %d messages, want 2 (only the expired ones)", f.gw.stateCalls)
	}
}

// The status call says whether the phone is actually online, not just
// registered, and warns when it isn't.
func TestPhoneSMSAPIStatusSaysWhenThePhoneIsOffline(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)

	status := func() map[string]interface{} {
		code, body := f.api(t, f.h.APIStatus, http.MethodGet, "/", "", key, "")
		if code != http.StatusOK {
			t.Fatalf("status: %d %v", code, body)
		}

		data, _ := body["data"].(map[string]interface{})

		return data
	}

	f.gatewayStates(nil, time.Now().Add(-2*time.Hour))

	if d := status(); d["phone_reachable"] != false || d["phone_last_seen"] == nil ||
		!strings.Contains(fmt.Sprint(d["warning"]), "hasn't heard from your phone") {
		t.Errorf("phone last seen 2 hours ago: %v, want unreachable with a warning", d)
	}

	f.gatewayStates(nil, time.Now().Add(-5*time.Minute))

	if d := status(); d["phone_reachable"] != true || d["warning"] != nil {
		t.Errorf("phone seen 5 minutes ago: %v, want reachable and no warning", d)
	}
}
