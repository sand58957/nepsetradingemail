package handlers

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// fakeAakash stands in for the Aakash SMS API.
type fakeAakash struct {
	mu   sync.Mutex
	sent []string
	// stall, when set, is called with each send's number (1, 2, …) before it
	// is answered.
	stall func(n int)
}

func (a *fakeAakash) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	to := r.PostForm.Get("to")

	a.mu.Lock()
	a.sent = append(a.sent, to)
	n := len(a.sent)
	stall := a.stall
	a.mu.Unlock()

	if stall != nil {
		stall(n)
	}

	fmt.Fprintf(w, `{"error":false,"message":"queued","data":{"valid":[{"id":"ak-%d","mobile":%q,"credit":1,"network":"NTC","status":"success"}],"invalid":[]}}`, n, to)
}

func (a *fakeAakash) sentTo() []string {
	a.mu.Lock()
	defer a.mu.Unlock()

	return append([]string{}, a.sent...)
}

// aakashTo sends the Aakash client's requests, which go to a fixed address,
// to a test server instead.
type aakashTo struct {
	url  *url.URL
	next http.RoundTripper
}

func (t aakashTo) RoundTrip(r *http.Request) (*http.Response, error) {
	if r.URL.Host == "sms.aakashsms.com" {
		r = r.Clone(r.Context())
		r.URL.Scheme, r.URL.Host, r.Host = t.url.Scheme, t.url.Host, ""
	}

	return t.next.RoundTrip(r)
}

type smsFixture struct {
	db      *sqlx.DB
	h       *SMSHandler
	aakash  *fakeAakash
	account int
}

func newSMSFixture(t *testing.T) *smsFixture {
	t.Helper()

	db := waTestDB(t)

	aakash := &fakeAakash{}
	srv := httptest.NewServer(aakash)
	t.Cleanup(srv.Close)

	target, _ := url.Parse(srv.URL)
	saved := http.DefaultTransport
	http.DefaultTransport = aakashTo{url: target, next: saved}
	t.Cleanup(func() { http.DefaultTransport = saved })

	account := waInsertID(t, db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	db.MustExec(`INSERT INTO sms_settings (account_id, auth_token, send_rate) VALUES ($1, 'test-token', 1000)`, account)

	return &smsFixture{db: db, h: NewSMSHandler(db), aakash: aakash, account: account}
}

func (f *smsFixture) contact(t *testing.T, account int, phone string) int {
	t.Helper()

	return waInsertID(t, f.db, `INSERT INTO sms_contacts (account_id, phone, name) VALUES ($1, $2, 'Contact ' || $2) RETURNING id`,
		account, phone)
}

func (f *smsFixture) campaign(t *testing.T) int {
	t.Helper()

	return waInsertID(t, f.db, `INSERT INTO sms_campaigns (account_id, name, message_text) VALUES ($1, 'Offer', 'Namaste') RETURNING id`,
		f.account)
}

func (f *smsFixture) campaignRow(t *testing.T, id int) SMSCampaign {
	t.Helper()

	var c SMSCampaign
	if err := f.db.Get(&c, `SELECT * FROM sms_campaigns WHERE id = $1`, id); err != nil {
		t.Fatalf("reading campaign: %v", err)
	}

	return c
}

func (f *smsFixture) senderRunning(id int) bool {
	f.h.mu.Lock()
	defer f.h.mu.Unlock()

	return f.h.running[id]
}

// settle waits for the campaign's sender to stop.
func (f *smsFixture) settle(t *testing.T, id int) SMSCampaign {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)

	for time.Now().Before(deadline) {
		if c := f.campaignRow(t, id); c.Status != "sending" && !f.senderRunning(id) {
			return c
		}

		time.Sleep(20 * time.Millisecond)
	}

	t.Fatalf("campaign %d still sending after 5s", id)

	return SMSCampaign{}
}

func (f *smsFixture) call(t *testing.T, handler echo.HandlerFunc, id int) int {
	t.Helper()

	code, _ := waServe(t, handler, http.MethodPost, "/", nil, "", f.account, strconv.Itoa(id))

	return code
}

// stallSecond holds the second send at the fake until release is called;
// waitHeld returns once that send has arrived.
func (f *smsFixture) stallSecond(t *testing.T) (waitHeld func(), release func()) {
	t.Helper()

	held := make(chan struct{})
	gate := make(chan struct{})
	var once sync.Once

	release = func() { once.Do(func() { close(gate) }) }
	t.Cleanup(release)

	f.aakash.mu.Lock()
	f.aakash.stall = func(n int) {
		if n == 2 {
			close(held)
			<-gate
		}
	}
	f.aakash.mu.Unlock()

	waitHeld = func() {
		select {
		case <-held:
		case <-time.After(5 * time.Second):
			t.Fatal("second send never arrived")
		}
	}

	return waitHeld, release
}

// A group only takes the account's own contacts, and its member list shows
// only them even if an old membership row points at another account's contact.
func TestSMSGroupsKeepToTheAccount(t *testing.T) {
	f := newSMSFixture(t)
	other := waInsertID(t, f.db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	mine := f.contact(t, f.account, "9800000001")
	theirs := f.contact(t, other, "9800000002")
	group := waInsertID(t, f.db, `INSERT INTO sms_contact_groups (account_id, name) VALUES ($1, 'VIP') RETURNING id`, f.account)

	body := fmt.Sprintf(`{"contact_ids":[%d,%d]}`, mine, theirs)
	code, resp := waServe(t, f.h.AddGroupMembers, http.MethodPost, "/", strings.NewReader(body), echo.MIMEApplicationJSON, f.account, strconv.Itoa(group))

	data, _ := resp["data"].(map[string]interface{})
	if code != http.StatusOK || data["added"] != float64(1) {
		t.Errorf("add members: %d %v, want only the account's own contact added", code, resp)
	}

	var stored int
	f.db.Get(&stored, `SELECT COUNT(*) FROM sms_contact_group_members WHERE contact_id = $1`, theirs)
	if stored != 0 {
		t.Errorf("another account's contact was stored in the group")
	}

	// A membership row left over from before the fix.
	f.db.MustExec(`INSERT INTO sms_contact_group_members (group_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, group, theirs)

	for _, target := range []string{"/", "/?query=98000"} {
		code, resp := waServe(t, f.h.ListGroupMembers, http.MethodGet, target, nil, "", f.account, strconv.Itoa(group))
		data, _ := resp["data"].(map[string]interface{})
		results, _ := data["results"].([]interface{})

		var phones []string
		for _, r := range results {
			phones = append(phones, fmt.Sprint(r.(map[string]interface{})["phone"]))
		}

		if code != http.StatusOK || data["total"] != float64(1) || strings.Join(phones, ",") != "9800000001" {
			t.Errorf("GET %s: %d total=%v phones=%v, want only the account's own contact", target, code, data["total"], phones)
		}
	}
}

// Two Sends racing on one draft start it once: one is refused, and every
// contact gets one message.
func TestSMSSendClaimsTheCampaignOnce(t *testing.T) {
	f := newSMSFixture(t)
	f.contact(t, f.account, "9800000001")
	f.contact(t, f.account, "9800000002")
	id := f.campaign(t)

	// Hold the campaign's row so both Sends get past their first look at it
	// (still a draft) and meet where they start it.
	lock := f.db.MustBegin()
	lock.MustExec(`SELECT 1 FROM sms_campaigns WHERE id = $1 FOR UPDATE`, id)

	codes := make([]int, 2)

	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)

		go func(i int) {
			defer wg.Done()
			codes[i] = f.call(t, f.h.SendCampaign, id)
		}(i)
	}

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		var waiting int
		f.db.Get(&waiting, `SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`)

		if waiting == 2 {
			break
		}
	}

	lock.Rollback()
	wg.Wait()
	sort.Ints(codes)

	if codes[0] != http.StatusOK || codes[1] != http.StatusBadRequest {
		t.Errorf("two Sends answered %v, want one 200 and one 400", codes)
	}

	c := f.settle(t, id)

	var queued int
	f.db.Get(&queued, `SELECT COUNT(*) FROM sms_campaign_messages WHERE campaign_id = $1`, id)

	sent := f.aakash.sentTo()
	sort.Strings(sent)

	if queued != 2 || strings.Join(sent, ",") != "9800000001,9800000002" || c.Status != "sent" || c.SentCount != 2 {
		t.Errorf("%d messages queued, sent to %v, campaign %q sent=%d; want each contact messaged once", queued, sent, c.Status, c.SentCount)
	}

	if code := f.call(t, f.h.SendCampaign, id); code != http.StatusBadRequest {
		t.Errorf("Send on a sent campaign: %d, want 400", code)
	}
}

// Pause stops the sender; Resume starts it again for the rest, and the
// campaign's counts cover both runs.
func TestSMSResumeSendsTheRest(t *testing.T) {
	f := newSMSFixture(t)
	for i := 1; i <= 3; i++ {
		f.contact(t, f.account, fmt.Sprintf("980000000%d", i))
	}

	id := f.campaign(t)
	waitHeld, release := f.stallSecond(t)

	if code := f.call(t, f.h.SendCampaign, id); code != http.StatusOK {
		t.Fatalf("send: %d", code)
	}

	waitHeld()

	if code := f.call(t, f.h.PauseCampaign, id); code != http.StatusOK {
		t.Fatalf("pause: %d", code)
	}

	release()

	if c := f.settle(t, id); c.Status != "paused" || len(f.aakash.sentTo()) != 2 || c.SentCount != 2 {
		t.Fatalf("after pause: campaign %q, %d sent, sent_count %d; want paused after 2", c.Status, len(f.aakash.sentTo()), c.SentCount)
	}

	if code := f.call(t, f.h.ResumeCampaign, id); code != http.StatusOK {
		t.Fatalf("resume: %d", code)
	}

	c := f.settle(t, id)

	if got := strings.Join(f.aakash.sentTo(), ","); got != "9800000001,9800000002,9800000003" {
		t.Errorf("sent to %s, want each contact once", got)
	}

	if c.Status != "sent" || c.SentCount != 3 || c.CreditsUsed != 3 || c.FailedCount != 0 {
		t.Errorf("campaign %q sent=%d credits=%d failed=%d, want sent with 3 and 3", c.Status, c.SentCount, c.CreditsUsed, c.FailedCount)
	}
}

// A Resume that lands while the first sender is still inside a send doesn't
// start a second one; the first carries on and nobody gets two messages.
func TestSMSResumeWhileStillSendingSendsOnce(t *testing.T) {
	f := newSMSFixture(t)
	for i := 1; i <= 3; i++ {
		f.contact(t, f.account, fmt.Sprintf("980000000%d", i))
	}

	id := f.campaign(t)
	waitHeld, release := f.stallSecond(t)

	f.call(t, f.h.SendCampaign, id)
	waitHeld()

	if code := f.call(t, f.h.PauseCampaign, id); code != http.StatusOK {
		t.Fatalf("pause: %d", code)
	}

	if code := f.call(t, f.h.ResumeCampaign, id); code != http.StatusOK {
		t.Fatalf("resume: %d", code)
	}

	// Give the resumed sender time to start, if it were going to.
	time.Sleep(100 * time.Millisecond)
	release()

	c := f.settle(t, id)

	if got := strings.Join(f.aakash.sentTo(), ","); got != "9800000001,9800000002,9800000003" {
		t.Errorf("sent to %s, want each contact once", got)
	}

	if c.Status != "sent" || c.SentCount != 3 {
		t.Errorf("campaign %q sent=%d, want sent to 3", c.Status, c.SentCount)
	}
}

// Deleting a campaign while it sends stops its sender; nobody else is messaged.
func TestSMSDeletedCampaignStopsSending(t *testing.T) {
	f := newSMSFixture(t)
	for i := 1; i <= 3; i++ {
		f.contact(t, f.account, fmt.Sprintf("980000000%d", i))
	}

	id := f.campaign(t)
	waitHeld, release := f.stallSecond(t)

	f.call(t, f.h.SendCampaign, id)
	waitHeld()

	if code := f.call(t, f.h.DeleteCampaign, id); code != http.StatusOK {
		t.Fatalf("delete: %d", code)
	}

	release()

	for deadline := time.Now().Add(5 * time.Second); f.senderRunning(id) && time.Now().Before(deadline); {
		time.Sleep(20 * time.Millisecond)
	}

	if got := strings.Join(f.aakash.sentTo(), ","); got != "9800000001,9800000002" {
		t.Errorf("sent to %s, want nothing after the one in flight when it was deleted", got)
	}
}

// A contact who opts out while the campaign is paused isn't messaged when it
// resumes; their message is closed as failed.
func TestSMSResumeSkipsContactsWhoOptedOut(t *testing.T) {
	f := newSMSFixture(t)
	f.contact(t, f.account, "9800000001")
	gone := f.contact(t, f.account, "9800000002")
	id := f.campaign(t)

	f.db.MustExec(`UPDATE sms_campaigns SET status = 'paused', total_targets = 2 WHERE id = $1`, id)
	f.db.MustExec(`INSERT INTO sms_campaign_messages (campaign_id, contact_id) SELECT $1, id FROM sms_contacts ORDER BY id`, id)
	f.db.MustExec(`UPDATE sms_contacts SET opted_in = false WHERE id = $1`, gone)

	if code := f.call(t, f.h.ResumeCampaign, id); code != http.StatusOK {
		t.Fatalf("resume: %d", code)
	}

	c := f.settle(t, id)

	if got := strings.Join(f.aakash.sentTo(), ","); got != "9800000001" {
		t.Errorf("sent to %s, want only the contact still opted in", got)
	}

	var reason string
	f.db.Get(&reason, `SELECT error_reason FROM sms_campaign_messages WHERE contact_id = $1 AND status = 'failed'`, gone)

	if c.Status != "sent" || c.SentCount != 1 || c.FailedCount != 1 || reason != "Opted out before sending" {
		t.Errorf("campaign %q sent=%d failed=%d, opted-out reason %q; want 1 sent and the opted-out one closed", c.Status, c.SentCount, c.FailedCount, reason)
	}
}
