package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/smsgate"
)

// fakeSMSGate stands in for the SMSGate API.
type fakeSMSGate struct {
	mu    sync.Mutex
	sends []map[string]interface{}
	// failFor decides a send's HTTP status from the recipient; 0 is success.
	failFor func(phone string) int
	hooks   []smsgate.Webhook
}

func (g *fakeSMSGate) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.mu.Lock()
	defer g.mu.Unlock()

	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/messages":
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		numbers, _ := body["phoneNumbers"].([]interface{})
		phone := ""
		if len(numbers) > 0 {
			phone, _ = numbers[0].(string)
		}

		if g.failFor != nil {
			if code := g.failFor(phone); code != 0 {
				w.WriteHeader(code)
				w.Write([]byte(`{"message":"refused"}`))

				return
			}
		}

		g.sends = append(g.sends, body)
		fmt.Fprintf(w, `{"id":"gw-%d","deviceId":"dev1","state":"Pending"}`, len(g.sends))
	case r.Method == http.MethodGet && r.URL.Path == "/devices":
		w.Write([]byte(`[{"id":"dev1","name":"Pixel","lastSeen":"2026-10-24T05:00:00Z","simCards":[{"slotIndex":0,"simNumber":1,"carrierName":"Ncell"}]}]`))
	case r.Method == http.MethodGet && r.URL.Path == "/webhooks":
		json.NewEncoder(w).Encode(g.hooks)
	case r.Method == http.MethodPost && r.URL.Path == "/webhooks":
		var hook smsgate.Webhook
		json.NewDecoder(r.Body).Decode(&hook)
		hook.ID = fmt.Sprintf("hook-%d", len(g.hooks)+100)
		g.hooks = append(g.hooks, hook)
		json.NewEncoder(w).Encode(hook)
	case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/webhooks/"):
		id := strings.TrimPrefix(r.URL.Path, "/webhooks/")
		kept := g.hooks[:0]
		for _, h := range g.hooks {
			if h.ID != id {
				kept = append(kept, h)
			}
		}
		g.hooks = kept
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

func (g *fakeSMSGate) sentTo() []string {
	g.mu.Lock()
	defer g.mu.Unlock()

	out := []string{}
	for _, s := range g.sends {
		numbers, _ := s["phoneNumbers"].([]interface{})
		for _, n := range numbers {
			out = append(out, fmt.Sprint(n))
		}
	}

	return out
}

type phoneFixture struct {
	db      *sqlx.DB
	h       *PhoneSMSHandler
	gw      *fakeSMSGate
	account int
	token   string
}

const phoneTestToken = "0123456789abcdef0123456789abcdef0123456789abcdef"

func newPhoneFixture(t *testing.T) *phoneFixture {
	t.Helper()

	// With the API tables too: the daily limit counts API messages.
	db := apiKeysTestDB(t)

	migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", "037_phone_sms.up.sql"))
	if err != nil {
		t.Fatalf("reading migration: %v", err)
	}

	db.MustExec(string(migration))

	gw := &fakeSMSGate{}
	srv := httptest.NewServer(gw)
	t.Cleanup(srv.Close)

	savedGap := phoneSMSGap
	phoneSMSGap = func(int) time.Duration { return 0 }
	t.Cleanup(func() { phoneSMSGap = savedGap })

	account := waInsertID(t, db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	db.MustExec(`INSERT INTO phone_sms_settings (account_id, server_url, username, password, webhook_token, sim_number)
		VALUES ($1, $2, 'user', 'pass', $3, 1)`, account, srv.URL, phoneTestToken)

	return &phoneFixture{db: db, h: NewPhoneSMSHandler(db, "https://nepalfillings.test"), gw: gw, account: account, token: phoneTestToken}
}

func (f *phoneFixture) contact(t *testing.T, account int, phone string, optedIn bool) int {
	t.Helper()

	return waInsertID(t, f.db, `INSERT INTO phone_sms_contacts (account_id, phone, opted_in) VALUES ($1, $2, $3) RETURNING id`,
		account, phone, optedIn)
}

func (f *phoneFixture) campaign(t *testing.T) int {
	t.Helper()

	return waInsertID(t, f.db, `INSERT INTO phone_sms_campaigns (account_id, name, message_text) VALUES ($1, 'Offer', 'Namaste') RETURNING id`,
		f.account)
}

func (f *phoneFixture) campaignRow(t *testing.T, id int) PhoneSMSCampaign {
	t.Helper()

	var c PhoneSMSCampaign
	if err := f.db.Get(&c, `SELECT * FROM phone_sms_campaigns WHERE id = $1`, id); err != nil {
		t.Fatalf("reading campaign: %v", err)
	}

	return c
}

// settle waits for the campaign's sender to stop.
func (f *phoneFixture) settle(t *testing.T, id int) PhoneSMSCampaign {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)

	for time.Now().Before(deadline) {
		f.h.mu.Lock()
		running := f.h.running[id]
		f.h.mu.Unlock()

		if c := f.campaignRow(t, id); c.Status != "sending" && !running {
			return c
		}

		time.Sleep(20 * time.Millisecond)
	}

	t.Fatalf("campaign %d still sending after 5s", id)

	return PhoneSMSCampaign{}
}

func (f *phoneFixture) send(t *testing.T, id int) (int, map[string]interface{}) {
	t.Helper()

	return waServe(t, f.h.SendCampaign, http.MethodPost, "/", nil, "", f.account, strconv.Itoa(id))
}

func (f *phoneFixture) statuses(t *testing.T, id int) []string {
	t.Helper()

	var s []string
	f.db.Select(&s, `SELECT m.status FROM phone_sms_campaign_messages m JOIN phone_sms_contacts c ON c.id = m.contact_id
		WHERE m.campaign_id = $1 ORDER BY c.phone`, id)

	return s
}

// A campaign goes to every opted-in contact, one message each, in the
// international form SMSGate needs, from the chosen SIM.
func TestPhoneSMSCampaignSendsToEachOptedInContact(t *testing.T) {
	f := newPhoneFixture(t)
	f.contact(t, f.account, "9800000001", true)
	f.contact(t, f.account, "9800000002", false)
	f.contact(t, f.account, "9800000003", true)
	id := f.campaign(t)

	if code, body := f.send(t, id); code != http.StatusOK {
		t.Fatalf("send: %d %v", code, body)
	}

	c := f.settle(t, id)

	if got := strings.Join(f.gw.sentTo(), ","); got != "+9779800000001,+9779800000003" {
		t.Errorf("sent to %s, want the two opted-in contacts", got)
	}

	if sim := f.gw.sends[0]["simNumber"]; sim != float64(1) {
		t.Errorf("simNumber %v, want the saved SIM 1", sim)
	}

	if c.Status != "sent" || c.SentCount != 2 || c.TotalTargets != 2 {
		t.Errorf("campaign ended %+v, want sent to 2", c)
	}

	var ids []string
	f.db.Select(&ids, `SELECT gateway_msg_id FROM phone_sms_campaign_messages WHERE campaign_id = $1 ORDER BY id`, id)

	if strings.Join(ids, ",") != "gw-1,gw-2" {
		t.Errorf("gateway ids %v, want each message to keep SMSGate's id", ids)
	}
}

// Only one sender runs per campaign, so a second Send, Resume or restart can't
// send the same messages again.
func TestPhoneSMSOneSenderPerCampaign(t *testing.T) {
	f := newPhoneFixture(t)
	f.contact(t, f.account, "9800000001", true)
	id := f.campaign(t)

	f.db.MustExec(`UPDATE phone_sms_campaigns SET status = 'sending' WHERE id = $1`, id)
	f.db.MustExec(`INSERT INTO phone_sms_campaign_messages (campaign_id, contact_id) SELECT $1, id FROM phone_sms_contacts`, id)

	if !f.h.claim(id) {
		t.Fatal("first claim refused")
	}

	f.h.executeCampaignSend(id, f.account)

	if n := len(f.gw.sentTo()); n != 0 {
		t.Errorf("a second sender sent %d messages while one was running", n)
	}

	f.h.release(id)

	if code, _ := f.send(t, id); code != http.StatusBadRequest {
		t.Errorf("Send on a campaign already sending: %d, want 400", code)
	}
}

// The daily limit holds a campaign until 9 AM the next day, when it carries
// on by itself.
func TestPhoneSMSDailyLimitPausesAndCarriesOnNextMorning(t *testing.T) {
	f := newPhoneFixture(t)
	f.db.MustExec(`UPDATE phone_sms_settings SET daily_limit = 2`)

	for i := 1; i <= 3; i++ {
		f.contact(t, f.account, fmt.Sprintf("980000000%d", i), true)
	}

	id := f.campaign(t)
	f.send(t, id)
	c := f.settle(t, id)

	if n := len(f.gw.sentTo()); n != 2 || c.Status != "paused" || !strings.Contains(c.PauseReason, "limit of 2") {
		t.Fatalf("after the limit: %d sent, campaign %q (%s); want 2 sent and paused", n, c.Status, c.PauseReason)
	}

	want := phoneSMSNextResume(time.Now())
	if c.ResumeAt == nil || !c.ResumeAt.Equal(want) {
		t.Errorf("resume_at %v, want %v (9 AM tomorrow, Nepal time)", c.ResumeAt, want)
	}

	// Before the time nothing happens; at it, the campaign carries on with the
	// count for the new day starting at zero.
	f.h.resumeDue(want.Add(-time.Minute))

	if f.campaignRow(t, id).Status != "paused" {
		t.Error("resumed before its time")
	}

	savedNow := phoneSMSNow
	phoneSMSNow = func() time.Time { return want.Add(time.Minute) }
	t.Cleanup(func() { phoneSMSNow = savedNow })

	f.h.resumeDue(want.Add(time.Minute))
	c = f.settle(t, id)

	if n := len(f.gw.sentTo()); n != 3 || c.Status != "sent" {
		t.Errorf("next morning: %d sent, campaign %q; want all 3 and sent", n, c.Status)
	}
}

// When the phone can't be reached the campaign pauses with nobody marked
// failed, and Resume carries on from where it stopped.
func TestPhoneSMSPausesWhenThePhoneCantBeReachedAndResumes(t *testing.T) {
	f := newPhoneFixture(t)
	f.contact(t, f.account, "9800000001", true)
	f.contact(t, f.account, "9800000002", true)
	f.gw.failFor = func(string) int { return http.StatusServiceUnavailable }

	id := f.campaign(t)
	f.send(t, id)
	c := f.settle(t, id)

	if c.Status != "paused" || !strings.Contains(c.PauseReason, "Couldn't reach your phone") {
		t.Fatalf("campaign %q (%s), want paused because the phone can't be reached", c.Status, c.PauseReason)
	}

	if got := strings.Join(f.statuses(t, id), ","); got != "queued,queued" {
		t.Errorf("messages %s, want both still queued", got)
	}

	f.gw.mu.Lock()
	f.gw.failFor = nil
	f.gw.mu.Unlock()

	if code, body := waServe(t, f.h.ResumeCampaign, http.MethodPost, "/", nil, "", f.account, strconv.Itoa(id)); code != http.StatusOK {
		t.Fatalf("resume: %d %v", code, body)
	}

	if c = f.settle(t, id); c.Status != "sent" || len(f.gw.sentTo()) != 2 {
		t.Errorf("after resume: campaign %q, %d sent; want sent to both", c.Status, len(f.gw.sentTo()))
	}
}

// A number SMSGate rejects fails on its own; the rest still go out.
func TestPhoneSMSRejectedNumberFailsAlone(t *testing.T) {
	f := newPhoneFixture(t)
	f.contact(t, f.account, "9800000001", true)
	f.contact(t, f.account, "9800000002", true)
	f.gw.failFor = func(phone string) int {
		if phone == "+9779800000001" {
			return http.StatusBadRequest
		}

		return 0
	}

	id := f.campaign(t)
	f.send(t, id)
	c := f.settle(t, id)

	if got := strings.Join(f.statuses(t, id), ","); got != "failed,submitted" || c.Status != "sent" || c.FailedCount != 1 {
		t.Errorf("messages %s, campaign %q failed=%d; want one failed, one sent, campaign finished", got, c.Status, c.FailedCount)
	}
}

func (f *phoneFixture) webhook(t *testing.T, token string, body []byte, header http.Header) int {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	for k, v := range header {
		req.Header[k] = v
	}

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("token")
	c.SetParamValues(token)

	if err := f.h.Webhook(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	return rec.Code
}

func phoneEvent(event, messageID string, payload map[string]interface{}) []byte {
	payload["messageId"] = messageID
	raw, _ := json.Marshal(map[string]interface{}{"id": "ev-" + messageID + event, "event": event, "deviceId": "dev1", "payload": payload})

	return raw
}

// Delivery reports move a message forward, never back, and only within the
// account the webhook token belongs to.
func TestPhoneSMSWebhookStatusReports(t *testing.T) {
	f := newPhoneFixture(t)
	f.contact(t, f.account, "9800000001", true)
	id := f.campaign(t)
	f.send(t, id)
	f.settle(t, id)

	if code := f.webhook(t, "wrong-token-wrong-token-wrong-token-xx", phoneEvent("sms:delivered", "gw-1", map[string]interface{}{}), nil); code != http.StatusNotFound {
		t.Errorf("unknown token: %d, want 404", code)
	}

	// Another account's token can't touch this account's message.
	other := waInsertID(t, f.db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	otherToken := strings.Repeat("f", 48)
	f.db.MustExec(`INSERT INTO phone_sms_settings (account_id, webhook_token) VALUES ($1, $2)`, other, otherToken)
	f.webhook(t, otherToken, phoneEvent("sms:delivered", "gw-1", map[string]interface{}{}), nil)

	if got := f.statuses(t, id)[0]; got != "submitted" {
		t.Errorf("after another account's report: %s, want unchanged", got)
	}

	for _, step := range []struct{ event, want string }{
		{"sms:sent", "sent"},
		{"sms:delivered", "delivered"},
		{"sms:sent", "delivered"},   // late
		{"sms:failed", "delivered"}, // a delivered message stays delivered
	} {
		if code := f.webhook(t, f.token, phoneEvent(step.event, "gw-1", map[string]interface{}{"reason": "x"}), nil); code != http.StatusOK {
			t.Fatalf("%s: %d", step.event, code)
		}

		if got := f.statuses(t, id)[0]; got != step.want {
			t.Errorf("after %s: %s, want %s", step.event, got, step.want)
		}
	}

	if c := f.campaignRow(t, id); c.DeliveredCount != 1 || c.SentCount != 1 {
		t.Errorf("counts sent=%d delivered=%d, want 1 and 1", c.SentCount, c.DeliveredCount)
	}
}

// With a signing key saved, only requests signed with it are accepted.
func TestPhoneSMSWebhookChecksTheSignature(t *testing.T) {
	f := newPhoneFixture(t)
	f.db.MustExec(`UPDATE phone_sms_settings SET signing_key = 'sign-me'`)

	body := phoneEvent("sms:received", "in-1", map[string]interface{}{"message": "hi", "sender": "+9779800000009"})

	if code := f.webhook(t, f.token, body, nil); code != http.StatusUnauthorized {
		t.Errorf("unsigned: %d, want 401", code)
	}

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte("sign-me"))
	mac.Write(body)
	mac.Write([]byte(ts))

	header := http.Header{"X-Timestamp": {ts}, "X-Signature": {hex.EncodeToString(mac.Sum(nil))}}
	if code := f.webhook(t, f.token, body, header); code != http.StatusOK {
		t.Errorf("signed: %d, want 200", code)
	}
}

// A STOP reply lands in the inbox and opts the sender out; a reply that only
// mentions stopping does not, and a repeated delivery is stored once.
func TestPhoneSMSStopReplyOptsOut(t *testing.T) {
	f := newPhoneFixture(t)
	stopper := f.contact(t, f.account, "9800000001", true)
	chatty := f.contact(t, f.account, "9800000002", true)

	stop := phoneEvent("sms:received", "in-1", map[string]interface{}{"message": " Stop. ", "sender": "+9779800000001", "simNumber": 1})
	f.webhook(t, f.token, stop, nil)
	f.webhook(t, f.token, stop, nil)
	f.webhook(t, f.token, phoneEvent("sms:received", "in-2", map[string]interface{}{"message": "please stop calling me later", "sender": "+9779800000002"}), nil)

	var optedIn []bool
	f.db.Select(&optedIn, `SELECT opted_in FROM phone_sms_contacts WHERE id IN ($1, $2) ORDER BY id`, stopper, chatty)

	if fmt.Sprint(optedIn) != "[false true]" {
		t.Errorf("opted in %v, want only the STOP sender opted out", optedIn)
	}

	var rows int
	f.db.Get(&rows, `SELECT COUNT(*) FROM phone_sms_inbox WHERE account_id = $1`, f.account)

	if rows != 2 {
		t.Errorf("%d inbox rows, want 2 (the repeat stored once)", rows)
	}

	code, body := waServe(t, f.h.ListInbox, http.MethodGet, "/", nil, "", f.account, "")
	data, _ := body["data"].(map[string]interface{})
	results, _ := data["results"].([]interface{})

	if code != http.StatusOK || len(results) != 2 {
		t.Errorf("inbox: %d with %d results, want 2", code, len(results))
	}
}

// Someone who opts out after a campaign was queued is not messaged.
func TestPhoneSMSSkipsContactsWhoOptedOutMeanwhile(t *testing.T) {
	f := newPhoneFixture(t)
	gone := f.contact(t, f.account, "9800000001", true)
	f.contact(t, f.account, "9800000002", true)
	id := f.campaign(t)

	f.db.MustExec(`UPDATE phone_sms_campaigns SET status = 'sending' WHERE id = $1`, id)
	f.db.MustExec(`INSERT INTO phone_sms_campaign_messages (campaign_id, contact_id) SELECT $1, id FROM phone_sms_contacts ORDER BY id`, id)
	f.db.MustExec(`UPDATE phone_sms_contacts SET opted_in = false WHERE id = $1`, gone)

	f.h.executeCampaignSend(id, f.account)

	if got := strings.Join(f.gw.sentTo(), ","); got != "+9779800000002" {
		t.Errorf("sent to %s, want only the contact still opted in", got)
	}

	if got := strings.Join(f.statuses(t, id), ","); got != "failed,submitted" {
		t.Errorf("messages %s, want the opted-out one closed as failed", got)
	}
}

// A group only takes the account's own contacts.
func TestPhoneSMSGroupsKeepToTheAccount(t *testing.T) {
	f := newPhoneFixture(t)
	other := waInsertID(t, f.db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	mine := f.contact(t, f.account, "9800000001", true)
	theirs := f.contact(t, other, "9800000002", true)
	group := waInsertID(t, f.db, `INSERT INTO phone_sms_contact_groups (account_id, name) VALUES ($1, 'VIP') RETURNING id`, f.account)

	body := fmt.Sprintf(`{"contact_ids":[%d,%d]}`, mine, theirs)
	code, resp := waServe(t, f.h.AddGroupMembers, http.MethodPost, "/", strings.NewReader(body), echo.MIMEApplicationJSON, f.account, strconv.Itoa(group))

	data, _ := resp["data"].(map[string]interface{})
	if code != http.StatusOK || data["added"] != float64(1) {
		t.Errorf("add members: %d %v, want only the account's own contact added", code, resp)
	}
}

// Saving settings checks the values, keeps secrets that come back masked, and
// never hands the password out.
func TestPhoneSMSSettings(t *testing.T) {
	f := newPhoneFixture(t)

	put := func(body string) int {
		code, _ := waServe(t, f.h.UpdateSettings, http.MethodPut, "/", strings.NewReader(body), echo.MIMEApplicationJSON, f.account, "")

		return code
	}

	if code := put(`{"server_url":"http://insecure.example","username":"u","password":"p"}`); code != http.StatusBadRequest {
		t.Errorf("http server address: %d, want 400", code)
	}

	if code := put(`{"username":"u","password":"p","sim_number":4}`); code != http.StatusBadRequest {
		t.Errorf("SIM 4: %d, want 400", code)
	}

	if code := put(`{"server_url":"https://sms.example/3rdparty/v1/","username":"u2","password":"new-password","signing_key":"key-123456","daily_limit":50,"send_gap_seconds":45}`); code != http.StatusOK {
		t.Fatalf("valid settings: %d", code)
	}

	code, body := waServe(t, f.h.GetSettings, http.MethodGet, "/", nil, "", f.account, "")
	data, _ := body["data"].(map[string]interface{})

	raw, _ := json.Marshal(body)
	if code != http.StatusOK || strings.Contains(string(raw), "new-password") || strings.Contains(string(raw), "key-123456") {
		t.Fatalf("settings answer leaks a secret: %s", raw)
	}

	if code := put(fmt.Sprintf(`{"server_url":"https://sms.example/3rdparty/v1","username":"u2","password":%q,"signing_key":%q,"daily_limit":50,"send_gap_seconds":45}`,
		data["password"], data["signing_key"])); code != http.StatusOK {
		t.Fatalf("saving the masked values back: %d", code)
	}

	s, _ := f.h.settingsOf(f.account)
	if s.Password != "new-password" || s.SigningKey != "key-123456" || s.ServerURL != "https://sms.example/3rdparty/v1" ||
		s.DailyLimit != 50 || s.SendGapSeconds != 45 || s.WebhookToken != phoneTestToken {
		t.Errorf("saved %+v, want the masked secrets and the webhook token kept", *s)
	}
}

// Connecting registers the four webhooks once, replaces ones left by an old
// token of this site, and leaves the account's other webhooks alone.
func TestPhoneSMSConnectRegistersWebhooks(t *testing.T) {
	f := newPhoneFixture(t)
	f.gw.hooks = []smsgate.Webhook{
		{ID: "stale", URL: "https://nepalfillings.test/api/public/phone-sms/webhook/oldtoken", Event: "sms:received"},
		{ID: "theirs", URL: "https://example.com/hook", Event: "sms:received"},
	}

	for i := 0; i < 2; i++ {
		if code, body := waServe(t, f.h.TestConnection, http.MethodPost, "/", nil, "", f.account, ""); code != http.StatusOK {
			t.Fatalf("connect: %d %v", code, body)
		}
	}

	want := "https://nepalfillings.test/api/public/phone-sms/webhook/" + phoneTestToken
	events := map[string]int{}

	for _, h := range f.gw.hooks {
		switch h.URL {
		case want:
			events[h.Event]++
		case "https://example.com/hook":
		default:
			t.Errorf("left behind %s", h.URL)
		}
	}

	if len(events) != 4 || events["sms:received"] != 1 || events["sms:delivered"] != 1 {
		t.Errorf("registered %v, want each of the 4 events once", events)
	}
}
