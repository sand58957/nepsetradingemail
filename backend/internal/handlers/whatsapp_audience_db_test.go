package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
)

// waTestDB builds the WhatsApp tables from the real migrations, in a schema of
// their own inside the database WA_TEST_DSN points at, and drops that schema
// when the test ends. Point it only at a disposable database, for example:
//
//	docker run -d --rm --name wa-test-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55439:5432 postgres:17-alpine
//	WA_TEST_DSN='postgres://postgres:test@127.0.0.1:55439/postgres?sslmode=disable' go test ./internal/handlers/
func waTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	dsn := os.Getenv("WA_TEST_DSN")
	if dsn == "" {
		t.Skip("set WA_TEST_DSN to a disposable Postgres database to run the WhatsApp database tests")
	}

	admin, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("connecting to WA_TEST_DSN: %v", err)
	}

	schema := fmt.Sprintf("wa_test_%d", time.Now().UnixNano())
	admin.MustExec("CREATE SCHEMA " + schema)

	t.Cleanup(func() {
		admin.Exec("DROP SCHEMA " + schema + " CASCADE")
		admin.Close()
	})

	u, err := url.Parse(dsn)
	if err != nil || u.Scheme == "" {
		t.Fatalf("WA_TEST_DSN must be a postgres:// URL")
	}

	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()

	db, err := sqlx.Connect("postgres", u.String())
	if err != nil {
		t.Fatalf("connecting with search_path: %v", err)
	}

	t.Cleanup(func() { db.Close() })

	var current string
	if err := db.Get(&current, "SELECT current_schema()"); err != nil || current != schema {
		t.Fatalf("tests must run in schema %s, got %q (%v)", schema, current, err)
	}

	// Tables the WhatsApp migrations reference but do not create.
	db.MustExec(`CREATE TABLE app_accounts (id SERIAL PRIMARY KEY);
		CREATE TABLE app_users (id SERIAL PRIMARY KEY);
		CREATE TABLE sms_contacts (id SERIAL PRIMARY KEY)`)

	for _, f := range []string{
		"010_whatsapp.up.sql",
		"013_contact_groups.up.sql",
		"029_openwa.up.sql",
		"030_campaign_continuous_send.up.sql",
		"031_whatsapp_link_safety.up.sql",
		"032_whatsapp_unlinked_phone.up.sql",
	} {
		migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", f))
		if err != nil {
			t.Fatalf("reading migration %s: %v", f, err)
		}

		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatalf("applying migration %s: %v", f, err)
		}
	}

	return db
}

func waInsertID(t *testing.T, db *sqlx.DB, query string, args ...interface{}) int {
	t.Helper()

	var id int
	if err := db.Get(&id, query, args...); err != nil {
		t.Fatalf("%s: %v", strings.Fields(query)[0]+" "+strings.Fields(query)[2], err)
	}

	return id
}

// waServe runs a handler as the given account, the way the auth middleware
// would have set it up.
func waServe(t *testing.T, handler echo.HandlerFunc, method, target string, body io.Reader, contentType string,
	accountID int, id string) (int, map[string]interface{}) {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(method, target, body)

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("account_id", accountID)

	if id != "" {
		c.SetParamNames("id")
		c.SetParamValues(id)
	}

	if err := handler(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	var decoded map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &decoded)

	return rec.Code, decoded
}

func sortedIDs(contacts []WAContact) []int {
	ids := make([]int, 0, len(contacts))
	for _, c := range contacts {
		ids = append(ids, c.ID)
	}

	sort.Ints(ids)

	return ids
}

type waFixture struct {
	db      *sqlx.DB
	h       *WhatsAppHandler
	account int
	other   int
}

func newWAFixture(t *testing.T) *waFixture {
	db := waTestDB(t)

	return &waFixture{
		db:      db,
		h:       NewWhatsAppHandler(db, &config.Config{}),
		account: waInsertID(t, db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`),
		other:   waInsertID(t, db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`),
	}
}

func (f *waFixture) contact(t *testing.T, account int, phone string, optedIn bool, tags string) int {
	return waInsertID(t, f.db, `INSERT INTO wa_contacts (account_id, phone, opted_in, tags)
		VALUES ($1, $2, $3, $4::jsonb) RETURNING id`, account, phone, optedIn, tags)
}

func (f *waFixture) group(t *testing.T, account int, name string) int {
	return waInsertID(t, f.db, `INSERT INTO wa_contact_groups (account_id, name) VALUES ($1, $2) RETURNING id`,
		account, name)
}

func (f *waFixture) member(groupID, contactID int) {
	f.db.MustExec(`INSERT INTO wa_contact_group_members (group_id, contact_id) VALUES ($1, $2)`, groupID, contactID)
}

func (f *waFixture) campaign(t *testing.T, filter string) int {
	return waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, target_filter)
		VALUES ($1, 'test', $2::jsonb) RETURNING id`, f.account, filter)
}

// The reported bug: a campaign aimed at one group or tag messaged every opted-in
// contact on the account.
func TestWAAudienceReachesOnlyTheChosenContacts(t *testing.T) {
	f := newWAFixture(t)

	vipInA := f.contact(t, f.account, "977001", true, `["vip"]`)
	vipKtmInB := f.contact(t, f.account, "977002", true, `["vip","ktm"]`)
	plain := f.contact(t, f.account, "977003", true, `[]`)
	optedOutInA := f.contact(t, f.account, "977004", false, `["vip"]`)
	elsewhere := f.contact(t, f.other, "977005", true, `["vip"]`)

	groupA := f.group(t, f.account, "A")
	groupB := f.group(t, f.account, "B")
	empty := f.group(t, f.account, "Empty")
	otherGroup := f.group(t, f.other, "Other")

	f.member(groupA, vipInA)
	f.member(groupA, optedOutInA)
	f.member(groupB, vipKtmInB)
	f.member(otherGroup, elsewhere)
	// The API never files a contact under another account's group, but the query
	// must not rely on that.
	f.member(otherGroup, plain)

	cases := []struct {
		name   string
		filter string
		want   []int
	}{
		{"no audience is every opted-in contact", `{}`, []int{vipInA, vipKtmInB, plain}},
		{"one group", fmt.Sprintf(`{"groups":[%d]}`, groupA), []int{vipInA}},
		{"two groups", fmt.Sprintf(`{"groups":[%d,%d]}`, groupA, groupB), []int{vipInA, vipKtmInB}},
		{"a tag", `{"tags":["vip"]}`, []int{vipInA, vipKtmInB}},
		{"a contact needs every chosen tag", `{"tags":["vip","ktm"]}`, []int{vipKtmInB}},
		{"tags and groups widen each other", fmt.Sprintf(`{"tags":["ktm"],"groups":[%d]}`, groupA), []int{vipInA, vipKtmInB}},
		{"a group with no members reaches nobody", fmt.Sprintf(`{"groups":[%d]}`, empty), []int{}},
		{"another account's group reaches nobody here", fmt.Sprintf(`{"groups":[%d]}`, otherGroup), []int{}},
		{"a tag nobody has reaches nobody", `{"tags":["nobody"]}`, []int{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			id := f.campaign(t, tc.filter)

			audience, err := parseWAAudience(json.RawMessage(tc.filter))
			if err != nil {
				t.Fatalf("parsing %s: %v", tc.filter, err)
			}

			contacts, err := f.h.unreachedContacts(f.account, id, audience, 0)
			if err != nil {
				t.Fatalf("unreachedContacts: %v", err)
			}

			if got := sortedIDs(contacts); fmt.Sprint(got) != fmt.Sprint(tc.want) {
				t.Errorf("filter %s reached contacts %v, want %v", tc.filter, got, tc.want)
			}

			n, err := f.h.countUnreached(f.account, id, audience)
			if err != nil {
				t.Fatalf("countUnreached: %v", err)
			}

			if n != len(tc.want) {
				t.Errorf("filter %s counted %d, want %d", tc.filter, n, len(tc.want))
			}
		})
	}

	t.Run("contacts already messaged drop out", func(t *testing.T) {
		id := f.campaign(t, `{"tags":["vip"]}`)
		f.db.MustExec(`INSERT INTO wa_campaign_messages (campaign_id, contact_id) VALUES ($1, $2)`, id, vipInA)

		contacts, err := f.h.unreachedContacts(f.account, id, waAudience{Tags: []string{"vip"}}, 0)
		if err != nil {
			t.Fatal(err)
		}

		if got := sortedIDs(contacts); fmt.Sprint(got) != fmt.Sprint([]int{vipKtmInB}) {
			t.Errorf("got %v, want only %d", got, vipKtmInB)
		}
	})

	t.Run("a batch takes the oldest contacts in the audience", func(t *testing.T) {
		id := f.campaign(t, fmt.Sprintf(`{"groups":[%d,%d]}`, groupA, groupB))

		contacts, err := f.h.unreachedContacts(f.account, id, waAudience{Groups: []int{groupA, groupB}}, 1)
		if err != nil {
			t.Fatal(err)
		}

		if got := sortedIDs(contacts); fmt.Sprint(got) != fmt.Sprint([]int{vipInA}) {
			t.Errorf("got %v, want %d", got, vipInA)
		}
	})
}

// The whole send loop, against a stand-in for the gateway: a campaign aimed at
// one group messages that group and nobody else on the account.
func TestCampaignSendMessagesOnlyItsAudience(t *testing.T) {
	var (
		mu     sync.Mutex
		sentTo []string
	)

	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/sessions/sess-1":
			json.NewEncoder(w).Encode(map[string]string{"id": "sess-1", "status": "ready"})
		case r.Method == http.MethodPost && r.URL.Path == "/api/sessions/sess-1/messages/send-text":
			var body struct {
				ChatID string `json:"chatId"`
			}

			json.NewDecoder(r.Body).Decode(&body)

			mu.Lock()
			sentTo = append(sentTo, body.ChatID)
			n := len(sentTo)
			mu.Unlock()

			json.NewEncoder(w).Encode(map[string]string{"messageId": fmt.Sprintf("m%d", n), "chatId": body.ChatID})
		default:
			http.NotFound(w, r)
		}
	}))
	defer gateway.Close()

	instantSends(t)

	f := newWAFixture(t)
	f.h = NewWhatsAppHandler(f.db, &config.Config{OpenWABaseURL: gateway.URL, OpenWAAPIKey: "test-key"})
	f.db.MustExec(`INSERT INTO wa_settings (account_id, openwa_session_id) VALUES ($1, 'sess-1')`, f.account)

	customers := f.group(t, f.account, "Customers")
	for _, phone := range []string{"9800000001", "9800000002"} {
		f.member(customers, f.contact(t, f.account, phone, true, `[]`))
	}

	for _, phone := range []string{"9800000003", "9800000004", "9800000005"} {
		f.contact(t, f.account, phone, true, `[]`)
	}

	templateID := waInsertID(t, f.db, `INSERT INTO wa_templates (account_id, name, status, body_text)
		VALUES ($1, 'hello', 'approved', 'Hello') RETURNING id`, f.account)

	var tmpl WATemplate
	if err := f.db.Get(&tmpl, `SELECT * FROM wa_templates WHERE id = $1`, templateID); err != nil {
		t.Fatalf("reading template: %v", err)
	}

	campaignID := waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, template_id, target_filter, status)
		VALUES ($1, 'customers only', $2, $3::jsonb, 'sending') RETURNING id`,
		f.account, templateID, fmt.Sprintf(`{"groups":[%d]}`, customers))

	f.h.executeCampaignSend(campaignID, f.account, 50, tmpl)

	mu.Lock()
	got := append([]string(nil), sentTo...)
	mu.Unlock()
	sort.Strings(got)

	if want := []string{"9779800000001@c.us", "9779800000002@c.us"}; fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("the gateway was asked to message %v, want only the group's %v", got, want)
	}

	var result struct {
		Status    string `db:"status"`
		SentCount int    `db:"sent_count"`
		Rows      int    `db:"rows"`
	}

	f.db.Get(&result, `SELECT status, sent_count,
		(SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = $1) AS rows
		FROM wa_campaigns WHERE id = $1`, campaignID)

	if result.Status != "sent" || result.SentCount != 2 || result.Rows != 2 {
		t.Errorf("campaign finished as %+v, want status sent with 2 sent and 2 message rows", result)
	}
}

// After a restart, a continuous campaign that has already reached its whole
// audience is finished. Counting the whole contact list instead made it look
// unfinished and started another run.
func TestResumeFinishesACampaignThatReachedItsAudience(t *testing.T) {
	var (
		mu      sync.Mutex
		lookups int
	)

	release := make(chan struct{})

	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/sessions/sess-1" {
			http.NotFound(w, r)

			return
		}

		mu.Lock()
		lookups++
		n := lookups
		mu.Unlock()

		// The resumer's own readiness check is answered at once. Any later lookup
		// can only come from a send run it should not have started, so hold it.
		if n > 1 {
			<-release
		}

		json.NewEncoder(w).Encode(map[string]string{"id": "sess-1", "status": "ready"})
	}))
	defer gateway.Close()
	defer close(release)

	f := newWAFixture(t)
	f.h = NewWhatsAppHandler(f.db, &config.Config{OpenWABaseURL: gateway.URL, OpenWAAPIKey: "test-key"})
	f.db.MustExec(`INSERT INTO wa_settings (account_id, openwa_session_id) VALUES ($1, 'sess-1')`, f.account)

	customers := f.group(t, f.account, "Customers")
	reached := f.contact(t, f.account, "9800000011", true, `[]`)
	f.member(customers, reached)
	f.contact(t, f.account, "9800000012", true, `[]`)

	templateID := waInsertID(t, f.db, `INSERT INTO wa_templates (account_id, name, status, body_text)
		VALUES ($1, 'hello', 'approved', 'Hello') RETURNING id`, f.account)

	campaignID := waInsertID(t, f.db, `INSERT INTO wa_campaigns
		(account_id, name, template_id, target_filter, status, continuous, send_interval_seconds)
		VALUES ($1, 'customers only', $2, $3::jsonb, 'sending', true, 30) RETURNING id`,
		f.account, templateID, fmt.Sprintf(`{"groups":[%d]}`, customers))

	f.db.MustExec(`INSERT INTO wa_campaign_messages (campaign_id, contact_id, status) VALUES ($1, $2, 'submitted')`,
		campaignID, reached)

	f.h.ResumeInterruptedCampaigns()

	var status string
	f.db.Get(&status, `SELECT status FROM wa_campaigns WHERE id = $1`, campaignID)

	if status != "sent" {
		t.Errorf("status after resume = %q, want sent: everyone in the audience had been reached", status)
	}
}

// Starting a campaign whose audience matches nobody, or can't be read, must be
// refused before anything is sent, not quietly widened to everyone.
func TestSendCampaignRefusesAnAudienceItCannotSendTo(t *testing.T) {
	f := newWAFixture(t)

	f.contact(t, f.account, "977010", true, `[]`)
	empty := f.group(t, f.account, "Empty")

	template := waInsertID(t, f.db, `INSERT INTO wa_templates (account_id, name, status, body_text)
		VALUES ($1, 'hello', 'approved', 'Hello') RETURNING id`, f.account)

	for _, tc := range []struct {
		name, filter, wantMessage string
	}{
		{"an empty group", fmt.Sprintf(`{"groups":[%d]}`, empty), "No opted-in contacts are in the chosen groups"},
		{"an unreadable filter", `{"groups":["not-a-number"]}`, "audience can't be read"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, template_id, target_filter)
				VALUES ($1, 'test', $2, $3::jsonb) RETURNING id`, f.account, template, tc.filter)

			code, body := waServe(t, f.h.SendCampaign, http.MethodPost, "/", strings.NewReader(`{"batch_size":10}`),
				echo.MIMEApplicationJSON, f.account, fmt.Sprint(id))

			if code != http.StatusBadRequest {
				t.Fatalf("status %d, want 400; body %v", code, body)
			}

			if msg, _ := body["message"].(string); !strings.Contains(msg, tc.wantMessage) {
				t.Errorf("message %q does not contain %q", msg, tc.wantMessage)
			}

			var status string
			f.db.Get(&status, `SELECT status FROM wa_campaigns WHERE id = $1`, id)

			if status != "draft" {
				t.Errorf("campaign status is %q after a refused send, want draft", status)
			}
		})
	}
}

// The send dialog's estimate reads "remaining" from the campaign page, and it
// has to be the campaign's own audience.
func TestGetCampaignReportsRemainingForTheAudience(t *testing.T) {
	f := newWAFixture(t)

	inGroup := f.contact(t, f.account, "977020", true, `[]`)
	f.contact(t, f.account, "977021", true, `[]`)
	f.contact(t, f.account, "977022", true, `[]`)

	g := f.group(t, f.account, "G")
	f.member(g, inGroup)

	id := f.campaign(t, fmt.Sprintf(`{"groups":[%d]}`, g))

	code, body := waServe(t, f.h.GetCampaign, http.MethodGet, "/", nil, "", f.account, fmt.Sprint(id))
	if code != http.StatusOK {
		t.Fatalf("status %d, body %v", code, body)
	}

	data, _ := body["data"].(map[string]interface{})
	if remaining, _ := data["remaining"].(float64); remaining != 1 {
		t.Errorf("remaining = %v, want 1 (the group's one contact, not all 3)", data["remaining"])
	}
}

func waImport(t *testing.T, f *waFixture, csv string, confirmed bool) map[string]interface{} {
	t.Helper()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	part, err := w.CreateFormFile("file", "contacts.csv")
	if err != nil {
		t.Fatal(err)
	}

	part.Write([]byte(csv))

	if confirmed {
		w.WriteField("consent_confirmed", "true")
	}

	w.Close()

	code, body := waServe(t, f.h.ImportContacts, http.MethodPost, "/", &buf, w.FormDataContentType(), f.account, "")
	if code != http.StatusOK {
		t.Fatalf("import status %d, body %v", code, body)
	}

	data, _ := body["data"].(map[string]interface{})

	return data
}

type waConsentRow struct {
	OptedIn     bool `db:"opted_in"`
	HasOptInAt  bool `db:"has_opt_in_at"`
	HasOptOutAt bool `db:"has_opt_out_at"`
}

func (f *waFixture) consentOf(t *testing.T, phone string) waConsentRow {
	t.Helper()

	var row waConsentRow
	if err := f.db.Get(&row, `SELECT opted_in, opted_in_at IS NOT NULL AS has_opt_in_at,
		opted_out_at IS NOT NULL AS has_opt_out_at
		FROM wa_contacts WHERE account_id = $1 AND phone = $2`, f.account, phone); err != nil {
		t.Fatalf("reading contact %s: %v", phone, err)
	}

	return row
}

// Every imported row used to be marked opted in. Consent now has to come from the
// row itself or from the uploader confirming it for the whole file.
func TestImportOptsContactsInOnlyWithConsent(t *testing.T) {
	f := newWAFixture(t)

	t.Run("without confirmation contacts are stored but not opted in", func(t *testing.T) {
		data := waImport(t, f, "phone,name\n977101,Asha\n977102,Bikash\n", false)

		for _, phone := range []string{"977101", "977102"} {
			if row := f.consentOf(t, phone); row.OptedIn || row.HasOptInAt {
				t.Errorf("%s = %+v, want not opted in and no opt-in time", phone, row)
			}
		}

		if data["opted_in"] != float64(0) || data["not_opted_in"] != float64(2) {
			t.Errorf("response = %v, want opted_in 0 and not_opted_in 2", data)
		}
	})

	t.Run("confirming consent opts new contacts in", func(t *testing.T) {
		data := waImport(t, f, "phone\n977103\n", true)

		if row := f.consentOf(t, "977103"); !row.OptedIn || !row.HasOptInAt {
			t.Errorf("977103 = %+v, want opted in with an opt-in time", row)
		}

		if data["opted_in"] != float64(1) {
			t.Errorf("response = %v, want opted_in 1", data)
		}
	})

	t.Run("a consent column decides each row", func(t *testing.T) {
		waImport(t, f, "phone,opted_in\n977104,yes\n977105,no\n977106,\n", false)
		waImport(t, f, "phone,consent\n977107,no\n977108,\n", true)

		for phone, want := range map[string]bool{
			"977104": true,  // says yes
			"977105": false, // says no
			"977106": false, // blank, and nothing confirmed
			"977107": false, // says no, which beats the confirmation
			"977108": true,  // blank, and the upload was confirmed
		} {
			if row := f.consentOf(t, phone); row.OptedIn != want {
				t.Errorf("%s opted_in = %v, want %v", phone, row.OptedIn, want)
			}
		}
	})

	t.Run("confirming later opts in contacts that never had a decision", func(t *testing.T) {
		waImport(t, f, "phone\n977101\n", true)

		if row := f.consentOf(t, "977101"); !row.OptedIn || !row.HasOptInAt {
			t.Errorf("977101 = %+v, want opted in now that consent was confirmed", row)
		}
	})

	t.Run("a row saying no withdraws consent", func(t *testing.T) {
		waImport(t, f, "phone,opted_in\n977103,no\n", false)

		if row := f.consentOf(t, "977103"); row.OptedIn {
			t.Errorf("977103 = %+v, want opted out by the file", row)
		}
	})

	t.Run("an import never re-subscribes someone who was opted in and then out", func(t *testing.T) {
		// 977103 was opted in and has just been opted out.
		waImport(t, f, "phone\n977103\n", true)
		waImport(t, f, "phone,opted_in\n977103,yes\n", false)

		if row := f.consentOf(t, "977103"); row.OptedIn {
			t.Errorf("977103 = %+v, re-subscribed by an import", row)
		}

		f.db.MustExec(`INSERT INTO wa_contacts (account_id, phone, opted_in, opted_out_at)
			VALUES ($1, '977109', false, NOW())`, f.account)
		waImport(t, f, "phone\n977109\n", true)

		if row := f.consentOf(t, "977109"); row.OptedIn {
			t.Errorf("977109 = %+v, re-subscribed by an import despite an opt-out", row)
		}
	})

	t.Run("names are only filled in, never blanked", func(t *testing.T) {
		waImport(t, f, "phone,name\n977101,\n", true)

		var name string
		f.db.Get(&name, `SELECT name FROM wa_contacts WHERE account_id = $1 AND phone = '977101'`, f.account)

		if name != "Asha" {
			t.Errorf("name = %q, want Asha kept", name)
		}
	})
}

// Editing a contact without mentioning consent used to opt them back in.
func TestUpdateContactLeavesConsentAloneUnlessSet(t *testing.T) {
	f := newWAFixture(t)

	id := waInsertID(t, f.db, `INSERT INTO wa_contacts (account_id, phone, opted_in)
		VALUES ($1, '977201', false) RETURNING id`, f.account)

	put := func(body string) {
		code, resp := waServe(t, f.h.UpdateContact, http.MethodPut, "/", strings.NewReader(body),
			echo.MIMEApplicationJSON, f.account, fmt.Sprint(id))
		if code != http.StatusOK {
			t.Fatalf("PUT %s: status %d, body %v", body, code, resp)
		}
	}

	put(`{"name":"Renamed"}`)

	if row := f.consentOf(t, "977201"); row.OptedIn {
		t.Fatalf("editing the name opted the contact in: %+v", row)
	}

	put(`{"name":"Renamed","opted_in":true}`)

	if row := f.consentOf(t, "977201"); !row.OptedIn || !row.HasOptInAt {
		t.Errorf("after opting in: %+v, want opted in with an opt-in time", row)
	}

	put(`{"name":"Renamed","opted_in":false}`)

	if row := f.consentOf(t, "977201"); row.OptedIn || !row.HasOptOutAt {
		t.Errorf("after opting out: %+v, want opted out with an opt-out time", row)
	}
}
