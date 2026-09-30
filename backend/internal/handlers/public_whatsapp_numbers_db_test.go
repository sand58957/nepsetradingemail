package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
)

// apiNumbersFixture is an account with three linked numbers (the first is the
// default), WhatsApp API credits, and one live WhatsApp key.
type apiNumbersFixture struct {
	*numbersFixture
	gw    *multiGateway
	h     *PublicWhatsAppHandler
	keyID int
}

func newAPINumbersFixture(t *testing.T) *apiNumbersFixture {
	t.Helper()

	gw := newMultiGateway("sess-a", "sess-b", "sess-c")
	srv := gw.server(t)
	nf := newNumbersFixture(t, srv, "sess-a", "sess-b", "sess-c")

	for _, f := range []string{"014_public_api.up.sql", "035_api_key_soft_delete.up.sql", "036_api_key_whatsapp_number.up.sql"} {
		migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", f))
		if err != nil {
			t.Fatalf("reading migration %s: %v", f, err)
		}

		if _, err := nf.db.Exec(string(migration)); err != nil {
			t.Fatalf("applying migration %s: %v", f, err)
		}
	}

	nf.db.MustExec(`INSERT INTO api_credits (account_id, channel, balance) VALUES ($1, 'whatsapp', 100)`, nf.account)

	f := &apiNumbersFixture{numbersFixture: nf, gw: gw, h: NewPublicWhatsAppHandler(nf.db, nf.h.cfg)}
	f.keyID = waInsertID(t, nf.db, `INSERT INTO api_keys (account_id, channel, key_hash, key_prefix, name)
		VALUES ($1, 'whatsapp', 'x', 'nf_whatsapp_testkey1', 'site') RETURNING id`, nf.account)

	return f
}

// serveAPI runs a public API handler as the fixture's key.
func (f *apiNumbersFixture) serveAPI(t *testing.T, handler echo.HandlerFunc, body string) (int, map[string]interface{}) {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", echo.MIMEApplicationJSON)

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("account_id", f.account)
	c.Set("api_key_info", &mw.APIKeyInfo{KeyID: f.keyID, AccountID: f.account, Channel: "whatsapp"})

	if err := handler(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	var decoded map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &decoded)

	return rec.Code, decoded
}

func (f *apiNumbersFixture) phone(i int) string { return fmt.Sprintf("97798000000%02d", i) }

func (f *apiNumbersFixture) lastSession(t *testing.T) string {
	t.Helper()

	sent := f.gw.sent()
	if len(sent) == 0 {
		t.Fatal("nothing was sent")
	}

	return sent[len(sent)-1].session
}

// What was reported on 30 September 2026: two linked numbers were connected but
// "can't be reached through the API", which only ever read the default number.
func TestAPISendsFromTheRightNumber(t *testing.T) {
	f := newAPINumbersFixture(t)
	send := `{"to":"9800000100","message":"hi"%s}`

	// Nothing chosen: the account's default number.
	code, body := f.serveAPI(t, f.h.Send, fmt.Sprintf(send, ""))
	if code != http.StatusOK || f.lastSession(t) != "sess-a" {
		t.Fatalf("no number chosen: status %d via %s, body %v; want the default sess-a", code, f.lastSession(t), body)
	}

	if data, _ := body["data"].(map[string]interface{}); data["from"] != f.phone(0) {
		t.Errorf("response says from %v, want the default %s", data["from"], f.phone(0))
	}

	// The key is set to the second number.
	f.db.MustExec(`UPDATE api_keys SET wa_number_id = $1 WHERE id = $2`, f.numbers[1], f.keyID)

	if code, body := f.serveAPI(t, f.h.Send, fmt.Sprintf(send, "")); code != http.StatusOK || f.lastSession(t) != "sess-b" {
		t.Errorf("key set to the second number: status %d via %s, body %v; want sess-b", code, f.lastSession(t), body)
	}

	// The request names the third number, written without the country code.
	if code, body := f.serveAPI(t, f.h.Send, fmt.Sprintf(send, `,"from":"9800000002"`)); code != http.StatusOK || f.lastSession(t) != "sess-c" {
		t.Errorf("from the third number: status %d via %s, body %v; want sess-c", code, f.lastSession(t), body)
	}

	var from string
	f.db.Get(&from, `SELECT "from" FROM api_messages ORDER BY id DESC LIMIT 1`)

	if from != f.phone(2) {
		t.Errorf("the message is recorded as from %q, want %s", from, f.phone(2))
	}
}

// A "from" that isn't one of the account's numbers is refused before anything is
// charged or sent, and the error lists the numbers that would work.
func TestAPIRefusesAFromThatIsNotTheAccounts(t *testing.T) {
	f := newAPINumbersFixture(t)

	code, body := f.serveAPI(t, f.h.Send, `{"to":"9800000100","message":"hi","from":"9811111111"}`)

	errBody, _ := body["error"].(map[string]interface{})
	if code != http.StatusUnprocessableEntity || errBody["field"] != "from" {
		t.Fatalf("unknown from: status %d, body %v; want 422 on field from", code, body)
	}

	if msg, _ := errBody["message"].(string); !strings.Contains(msg, f.phone(1)) {
		t.Errorf("the error %q does not list the account's numbers", msg)
	}

	if len(f.gw.sent()) != 0 {
		t.Error("a message was sent despite the unknown from")
	}

	var balance float64
	f.db.Get(&balance, `SELECT balance FROM api_credits WHERE account_id = $1 AND channel = 'whatsapp'`, f.account)

	if balance != 100 {
		t.Errorf("balance %v after a refused send, want 100: nothing charged", balance)
	}
}

func TestAPIBulkSendsFromTheNamedNumber(t *testing.T) {
	f := newAPINumbersFixture(t)

	code, body := f.serveAPI(t, f.h.SendBulk,
		`{"recipients":[{"to":"9800000101"},{"to":"9800000102"}],"message":"hi","from":"9779800000001"}`)
	if code != http.StatusOK {
		t.Fatalf("bulk: status %d, body %v", code, body)
	}

	for _, s := range f.gw.sent() {
		if s.session != "sess-b" {
			t.Errorf("a bulk message went out via %s, want every one via sess-b", s.session)
		}
	}
}

// The status lists every linked number and says which one this key uses.
func TestAPIStatusListsTheNumbers(t *testing.T) {
	f := newAPINumbersFixture(t)
	f.db.MustExec(`UPDATE api_keys SET wa_number_id = $1 WHERE id = $2`, f.numbers[2], f.keyID)

	code, body := f.serveAPI(t, f.h.GetStatus, ``)
	data, _ := body["data"].(map[string]interface{})
	numbers, _ := data["numbers"].([]interface{})

	if code != http.StatusOK || len(numbers) != 3 {
		t.Fatalf("status: %d with %d numbers, body %v; want all 3", code, len(numbers), body)
	}

	if data["linked_phone"] != f.phone(2) || data["connected"] != true {
		t.Errorf("status says the key sends from %v (connected %v), want %s connected", data["linked_phone"],
			data["connected"], f.phone(2))
	}
}

// A key can be pointed at one of the account's numbers, cleared back to the
// default, and never pointed at another account's number.
func TestSettingTheNumberAKeySendsFrom(t *testing.T) {
	f := newAPINumbersFixture(t)
	keys := NewAPIKeyHandler(f.db)

	theirs := waInsertID(t, f.db, `INSERT INTO wa_numbers (account_id, openwa_session_id, is_default)
		VALUES ($1, 'sess-other', true) RETURNING id`, f.other)

	set := func(body string) int {
		code, _ := waServe(t, keys.UpdateKey, http.MethodPut, "/", strings.NewReader(body), echo.MIMEApplicationJSON,
			f.account, fmt.Sprint(f.keyID))

		return code
	}

	keyNumber := func() *int {
		var n *int
		f.db.Get(&n, `SELECT wa_number_id FROM api_keys WHERE id = $1`, f.keyID)

		return n
	}

	if code := set(fmt.Sprintf(`{"wa_number_id":%d}`, theirs)); code != http.StatusBadRequest || keyNumber() != nil {
		t.Errorf("pointing the key at another account's number: status %d, now %v; want 400 and unchanged", code, keyNumber())
	}

	if code := set(fmt.Sprintf(`{"wa_number_id":%d}`, f.numbers[1])); code != http.StatusOK || keyNumber() == nil || *keyNumber() != f.numbers[1] {
		t.Errorf("pointing the key at its own number: status %d, now %v; want %d", code, keyNumber(), f.numbers[1])
	}

	if code := set(`{"wa_number_id":0}`); code != http.StatusOK || keyNumber() != nil {
		t.Errorf("clearing the key's number: status %d, now %v; want the default (none)", code, keyNumber())
	}
}
