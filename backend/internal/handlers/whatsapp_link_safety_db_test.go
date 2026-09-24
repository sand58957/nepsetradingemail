package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

// instantSends removes the waits between campaign messages and shortens the watch
// on a dropped session, for the length of one test.
func instantSends(t *testing.T) {
	t.Helper()

	savedGap, savedWatch, savedPoll := sendGap, dropWatch, dropPoll
	sendGap = func(int) time.Duration { return 0 }
	dropWatch, dropPoll = 2*time.Second, 20*time.Millisecond

	t.Cleanup(func() { sendGap, dropWatch, dropPoll = savedGap, savedWatch, savedPoll })
}

// fakeGateway stands in for OpenWA. reply decides each send by its position
// (1-based) and returns the status and body to answer with; status reports the
// session's state at the moment it is asked.
type fakeGateway struct {
	mu       sync.Mutex
	sends    []string
	reply    func(n int, chatID string) (int, string)
	status   func() string
	unlinked bool
}

func (g *fakeGateway) server(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/sessions/sess-1":
			g.mu.Lock()
			status := g.status()
			g.mu.Unlock()

			json.NewEncoder(w).Encode(map[string]string{"id": "sess-1", "status": status})
		case r.Method == http.MethodPost && r.URL.Path == "/api/sessions/sess-1/messages/send-text":
			var body struct {
				ChatID string `json:"chatId"`
			}

			json.NewDecoder(r.Body).Decode(&body)

			g.mu.Lock()
			g.sends = append(g.sends, body.ChatID)
			code, payload := g.reply(len(g.sends), body.ChatID)
			g.mu.Unlock()

			w.WriteHeader(code)
			fmt.Fprint(w, payload)
		default:
			http.NotFound(w, r)
		}
	}))

	t.Cleanup(srv.Close)

	return srv
}

func (g *fakeGateway) sendCount() int {
	g.mu.Lock()
	defer g.mu.Unlock()

	return len(g.sends)
}

// linkedFixture is an account with a linked number, a template, five contacts and
// a campaign to all of them, ready to send through gateway.
func linkedFixture(t *testing.T, gateway *httptest.Server) (*waFixture, int, WATemplate, []int) {
	t.Helper()

	f := newWAFixture(t)
	f.h = NewWhatsAppHandler(f.db, &config.Config{OpenWABaseURL: gateway.URL, OpenWAAPIKey: "test-key"})
	f.db.MustExec(`INSERT INTO wa_settings (account_id, openwa_session_id, linked_phone, session_status)
		VALUES ($1, 'sess-1', '9779800000000', 'ready')`, f.account)
	f.db.MustExec(`INSERT INTO wa_numbers (account_id, openwa_session_id, linked_phone, session_status, is_default)
		VALUES ($1, 'sess-1', '9779800000000', 'ready', true)`, f.account)

	var contacts []int
	for i := 1; i <= 5; i++ {
		contacts = append(contacts, f.contact(t, f.account, fmt.Sprintf("98000000%02d", 30+i), true, `[]`))
	}

	templateID := waInsertID(t, f.db, `INSERT INTO wa_templates (account_id, name, status, body_text)
		VALUES ($1, 'hello', 'approved', 'Hello') RETURNING id`, f.account)

	var tmpl WATemplate
	if err := f.db.Get(&tmpl, `SELECT * FROM wa_templates WHERE id = $1`, templateID); err != nil {
		t.Fatalf("reading template: %v", err)
	}

	campaignID := waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, template_id, target_filter, status)
		VALUES ($1, 'everyone', $2, '{}'::jsonb, 'sending') RETURNING id`, f.account, templateID)

	return f, campaignID, tmpl, contacts
}

type campaignOutcome struct {
	Status      string `db:"status"`
	PauseReason string `db:"pause_reason"`
	SentCount   int    `db:"sent_count"`
	FailedCount int    `db:"failed_count"`
	Submitted   int    `db:"submitted"`
	Failed      int    `db:"failed"`
}

func outcomeOf(t *testing.T, f *waFixture, campaignID int) campaignOutcome {
	t.Helper()

	var o campaignOutcome
	if err := f.db.Get(&o, `SELECT status, pause_reason, sent_count, failed_count,
		(SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = $1 AND status = 'submitted') AS submitted,
		(SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = $1 AND status = 'failed') AS failed
		FROM wa_campaigns WHERE id = $1`, campaignID); err != nil {
		t.Fatalf("reading campaign: %v", err)
	}

	return o
}

// What happened on 17 September 2026: WhatsApp unlinked the number mid-campaign.
// The run has to stop at the first refused send, leave everyone after it eligible
// rather than failed, record the unlink, and keep campaigns from starting again
// straight away.
func TestCampaignStopsWhenWhatsAppUnlinksTheNumber(t *testing.T) {
	instantSends(t)

	gw := &fakeGateway{}
	gw.status = func() string {
		if gw.unlinked {
			return openwa.StatusQRReady
		}

		return openwa.StatusReady
	}
	gw.reply = func(n int, chatID string) (int, string) {
		if n <= 2 {
			return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, n, chatID)
		}

		gw.unlinked = true

		return http.StatusConflict, `{"message":"Session is not connected"}`
	}

	f, campaignID, tmpl, _ := linkedFixture(t, gw.server(t))

	f.h.executeCampaignSend(campaignID, f.account, 50, tmpl)

	if got := gw.sendCount(); got != 3 {
		t.Errorf("the gateway was asked to send %d messages, want 3: two delivered, then the refusal", got)
	}

	o := outcomeOf(t, f, campaignID)
	if o.Status != "paused" || o.PauseReason != pauseReasonUnlinked {
		t.Errorf("campaign ended as %q with reason %q, want paused with the unlink reason", o.Status, o.PauseReason)
	}

	if o.Submitted != 2 || o.Failed != 0 || o.SentCount != 2 || o.FailedCount != 0 {
		t.Errorf("campaign recorded %+v, want 2 sent and nobody failed", o)
	}

	audience, _ := parseWAAudience(json.RawMessage(`{}`))
	if remaining, err := f.h.countUnreached(f.account, campaignID, audience); err != nil || remaining != 3 {
		t.Errorf("%d contacts still to reach (err %v), want 3: nobody after the unlink was messaged", remaining, err)
	}

	var settings WANumber
	f.db.Get(&settings, `SELECT * FROM wa_numbers WHERE account_id = $1`, f.account)

	if settings.UnlinkedAt == nil || time.Since(*settings.UnlinkedAt) > time.Minute {
		t.Errorf("unlinked_at = %v, want the moment of the unlink", settings.UnlinkedAt)
	}

	if settings.UnlinkedPhone != "9779800000000" {
		t.Errorf("unlinked_phone = %q, want the number that was linked, 9779800000000", settings.UnlinkedPhone)
	}

	code, body := waServe(t, f.h.SendCampaign, http.MethodPost, "/", strings.NewReader(`{"batch_size":10}`),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(campaignID))

	if msg, _ := body["message"].(string); code != http.StatusConflict || !strings.Contains(msg, "can start again on") {
		t.Errorf("sending again right after the unlink: status %d, message %q; want 409 explaining the wait", code, msg)
	}

	if o := outcomeOf(t, f, campaignID); o.Status != "paused" {
		t.Errorf("a refused send changed the campaign to %q", o.Status)
	}

	// A day later campaigns may start again.
	f.db.MustExec(`UPDATE wa_numbers SET unlinked_at = NOW() - INTERVAL '25 hours' WHERE account_id = $1`, f.account)

	gw.mu.Lock()
	gw.unlinked = false
	gw.reply = func(n int, chatID string) (int, string) {
		return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, n, chatID)
	}
	gw.mu.Unlock()

	code, body = waServe(t, f.h.SendCampaign, http.MethodPost, "/", strings.NewReader(`{"batch_size":10}`),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(campaignID))

	if code != http.StatusOK {
		t.Fatalf("sending a day after the unlink: status %d, body %v", code, body)
	}

	deadline := time.Now().Add(10 * time.Second)
	for outcomeOf(t, f, campaignID).Status == "sending" && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}

	if o := outcomeOf(t, f, campaignID); o.Status != "sent" || o.Submitted != 5 || o.PauseReason != "" {
		t.Errorf("after resuming the campaign ended as %+v, want sent to all 5 with no pause reason", o)
	}
}

// A gateway error that is not about the recipient, with the session still up
// afterwards, pauses the run too — without failing anyone and without the cooldown
// an unlink starts.
func TestCampaignPausesWithoutFailingAnyoneWhenTheGatewayErrors(t *testing.T) {
	instantSends(t)

	gw := &fakeGateway{}
	gw.status = func() string { return openwa.StatusReady }
	gw.reply = func(n int, chatID string) (int, string) {
		if n == 2 {
			return http.StatusInternalServerError, `{"message":"Internal server error"}`
		}

		return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, n, chatID)
	}

	f, campaignID, tmpl, _ := linkedFixture(t, gw.server(t))

	f.h.executeCampaignSend(campaignID, f.account, 50, tmpl)

	if got := gw.sendCount(); got != 2 {
		t.Errorf("the gateway was asked to send %d messages, want 2", got)
	}

	o := outcomeOf(t, f, campaignID)
	if o.Status != "paused" || o.PauseReason != pauseReasonDropped || o.Failed != 0 || o.Submitted != 1 {
		t.Errorf("campaign ended as %+v, want paused with the dropped-connection reason, 1 sent, none failed", o)
	}

	var unlinkedAt *time.Time
	f.db.Get(&unlinkedAt, `SELECT unlinked_at FROM wa_numbers WHERE account_id = $1`, f.account)

	if unlinkedAt != nil {
		t.Errorf("unlinked_at = %v after a gateway error on a session that stayed linked, want none", unlinkedAt)
	}
}

// A number WhatsApp cannot resolve fails for this campaign only, the run carries on,
// and later campaigns leave the contact out for a while.
func TestUnreachableNumbersAreLeftOutOfLaterCampaigns(t *testing.T) {
	instantSends(t)

	const unreachable = "9779800000033@c.us"

	gw := &fakeGateway{}
	gw.status = func() string { return openwa.StatusReady }
	gw.reply = func(n int, chatID string) (int, string) {
		if chatID == unreachable {
			return http.StatusBadRequest, `{"message":"WhatsApp could not resolve the recipient 9779800000033@c.us. ` +
				`Either the number is not on WhatsApp, or this session has no existing chat with it — message it ` +
				`once from the phone, then retry."}`
		}

		return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, n, chatID)
	}

	f, campaignID, tmpl, contacts := linkedFixture(t, gw.server(t))

	f.h.executeCampaignSend(campaignID, f.account, 50, tmpl)

	if o := outcomeOf(t, f, campaignID); o.Status != "sent" || o.Submitted != 4 || o.Failed != 1 || o.PauseReason != "" {
		t.Errorf("campaign ended as %+v, want sent with 4 delivered and 1 failed", o)
	}

	var marked int
	f.db.Get(&marked, `SELECT COUNT(*) FROM wa_contacts WHERE account_id = $1 AND unreachable_at IS NOT NULL`, f.account)

	if marked != 1 {
		t.Errorf("%d contacts marked unreachable, want 1", marked)
	}

	next := f.campaign(t, `{}`)
	audience, _ := parseWAAudience(json.RawMessage(`{}`))

	if remaining, _ := f.h.countUnreached(f.account, next, audience); remaining != 4 {
		t.Errorf("a new campaign would reach %d contacts, want 4: the unreachable number is left out", remaining)
	}

	// After 30 days it is tried again.
	f.db.MustExec(`UPDATE wa_contacts SET unreachable_at = NOW() - INTERVAL '31 days' WHERE id = ANY($1::int[])`,
		fmt.Sprintf("{%d,%d,%d,%d,%d}", contacts[0], contacts[1], contacts[2], contacts[3], contacts[4]))

	if remaining, _ := f.h.countUnreached(f.account, next, audience); remaining != 5 {
		t.Errorf("a new campaign would reach %d contacts a month later, want all 5", remaining)
	}
}

// An unlink noticed outside a campaign — the settings page finding the session
// asking for a QR code — starts the cooldown too. Unlinking from the dashboard,
// which clears the phone first, does not.
func TestRememberSessionNoticesAnUnlink(t *testing.T) {
	f := newWAFixture(t)
	f.db.MustExec(`INSERT INTO wa_settings (account_id, openwa_session_id, linked_phone, session_status)
		VALUES ($1, 'sess-1', '9779800000000', 'ready')`, f.account)
	f.db.MustExec(`INSERT INTO wa_numbers (account_id, openwa_session_id, linked_phone, session_status, is_default)
		VALUES ($1, 'sess-1', '9779800000000', 'ready', true)`, f.account)

	unlinkedAt := func() *time.Time {
		var at *time.Time
		f.db.Get(&at, `SELECT unlinked_at FROM wa_numbers WHERE account_id = $1`, f.account)

		return at
	}

	phone := "9779800000000"
	f.h.rememberSession(f.account, &openwa.Session{ID: "sess-1", Status: openwa.StatusReady, Phone: &phone})

	if at := unlinkedAt(); at != nil {
		t.Fatalf("a linked session set unlinked_at to %v", at)
	}

	f.h.rememberSession(f.account, &openwa.Session{ID: "sess-1", Status: openwa.StatusQRReady})

	first := unlinkedAt()
	if first == nil {
		t.Fatal("a linked number asking for a QR code did not set unlinked_at")
	}

	var unlinkedPhone string
	f.db.Get(&unlinkedPhone, `SELECT unlinked_phone FROM wa_numbers WHERE account_id = $1`, f.account)

	if unlinkedPhone != "9779800000000" {
		t.Errorf("unlinked_phone = %q, want the number that was linked", unlinkedPhone)
	}

	time.Sleep(10 * time.Millisecond)
	f.h.rememberSession(f.account, &openwa.Session{ID: "sess-1", Status: openwa.StatusQRReady})

	if again := unlinkedAt(); again == nil || !again.Equal(*first) {
		t.Errorf("polling the same unlinked session moved unlinked_at from %v to %v", first, again)
	}

	// Unlinked from the dashboard: LogoutMySession clears the phone before the
	// session is next read.
	f.db.MustExec(`UPDATE wa_numbers SET linked_phone = '9779800000000', unlinked_at = NULL WHERE account_id = $1`,
		f.account)
	f.db.MustExec(`UPDATE wa_numbers SET linked_phone = '', session_status = 'disconnected' WHERE account_id = $1`,
		f.account)
	f.h.rememberSession(f.account, &openwa.Session{ID: "sess-1", Status: openwa.StatusQRReady})

	if at := unlinkedAt(); at != nil {
		t.Errorf("unlinking from the dashboard set unlinked_at to %v, want none", at)
	}
}

// A person pausing a campaign clears a reason the campaign gave itself earlier.
func TestPausingByHandClearsTheReason(t *testing.T) {
	f := newWAFixture(t)

	id := waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, status, pause_reason)
		VALUES ($1, 'test', 'sending', 'old reason') RETURNING id`, f.account)

	code, body := waServe(t, f.h.PauseCampaign, http.MethodPost, "/", nil, "", f.account, fmt.Sprint(id))
	if code != http.StatusOK {
		t.Fatalf("pause: status %d, body %v", code, body)
	}

	var reason string
	f.db.Get(&reason, `SELECT pause_reason FROM wa_campaigns WHERE id = $1`, id)

	if reason != "" {
		t.Errorf("pause_reason = %q after a manual pause, want empty", reason)
	}
}

// What happened on 21 September 2026: after the old number was unlinked the
// account linked a different one, and the page held the new number and said it
// "was unlinked". The hold belongs to the unlinked number only.
func TestADifferentNumberIsNotHeldForAnUnlink(t *testing.T) {
	instantSends(t)

	gw := &fakeGateway{}
	gw.status = func() string { return openwa.StatusReady }
	gw.reply = func(n int, chatID string) (int, string) {
		return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, n, chatID)
	}

	f, campaignID, _, _ := linkedFixture(t, gw.server(t))
	f.db.MustExec(`UPDATE wa_campaigns SET status = 'paused' WHERE id = $1`, campaignID)

	// The old number was unlinked an hour ago.
	f.db.MustExec(`UPDATE wa_numbers SET unlinked_at = NOW() - INTERVAL '1 hour', unlinked_phone = '9779811111111'
		WHERE account_id = $1`, f.account)

	code, body := waServe(t, f.h.SendCampaign, http.MethodPost, "/", strings.NewReader(`{"batch_size":10}`),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(campaignID))

	if code != http.StatusOK {
		t.Fatalf("a different number is linked, but sending was refused: status %d, body %v", code, body)
	}

	deadline := time.Now().Add(10 * time.Second)
	for outcomeOf(t, f, campaignID).Status == "sending" && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}

	// Relinking the old number brings the hold back.
	f.db.MustExec(`UPDATE wa_numbers SET linked_phone = '9779811111111' WHERE account_id = $1`, f.account)

	other := waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, template_id, target_filter, status)
		SELECT account_id, 'again', template_id, '{}'::jsonb, 'paused' FROM wa_campaigns WHERE id = $1 RETURNING id`,
		campaignID)

	code, body = waServe(t, f.h.SendCampaign, http.MethodPost, "/", strings.NewReader(`{"batch_size":10}`),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(other))

	if msg, _ := body["message"].(string); code != http.StatusConflict || !strings.Contains(msg, "9779811111111") {
		t.Errorf("the unlinked number linked again: status %d, message %q; want 409 naming the number", code, msg)
	}
}
