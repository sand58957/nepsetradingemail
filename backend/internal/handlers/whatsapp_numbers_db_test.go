package handlers

import (
	"encoding/json"
	"fmt"
	"io"
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

// multiGateway stands in for OpenWA with any number of sessions.
type multiGateway struct {
	mu      sync.Mutex
	status  map[string]string // session id -> status
	sends   []gatewaySend
	created int
	// reply decides a send; nil answers every send with success.
	reply func(session string, n int) (int, string)
}

type gatewaySend struct {
	session, chat string
}

func newMultiGateway(sessions ...string) *multiGateway {
	g := &multiGateway{status: map[string]string{}}
	for _, s := range sessions {
		g.status[s] = openwa.StatusReady
	}

	return g
}

func (g *multiGateway) setStatus(session, status string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.status[session] = status
}

func (g *multiGateway) sent() []gatewaySend {
	g.mu.Lock()
	defer g.mu.Unlock()

	return append([]gatewaySend(nil), g.sends...)
}

func (g *multiGateway) server(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/sessions")
		parts := strings.Split(strings.Trim(path, "/"), "/")

		g.mu.Lock()
		defer g.mu.Unlock()

		switch {
		case r.Method == http.MethodPost && path == "":
			g.created++
			id := fmt.Sprintf("new-%d", g.created)
			g.status[id] = openwa.StatusCreated
			json.NewEncoder(w).Encode(map[string]string{"id": id, "status": openwa.StatusCreated})
		case len(parts) == 1 && r.Method == http.MethodGet:
			status, ok := g.status[parts[0]]
			if !ok {
				http.Error(w, `{"message":"Session not found"}`, http.StatusNotFound)

				return
			}

			json.NewEncoder(w).Encode(map[string]string{"id": parts[0], "status": status})
		case len(parts) == 1 && r.Method == http.MethodDelete:
			delete(g.status, parts[0])
			w.WriteHeader(http.StatusNoContent)
		case len(parts) == 2 && parts[1] == "start":
			g.status[parts[0]] = openwa.StatusQRReady
			json.NewEncoder(w).Encode(map[string]string{"id": parts[0], "status": openwa.StatusQRReady})
		case len(parts) == 2 && parts[1] == "qr":
			json.NewEncoder(w).Encode(map[string]string{"qrCode": "data:image/png;base64,AAAA"})
		case len(parts) == 2 && parts[1] == "logout":
			g.status[parts[0]] = openwa.StatusQRReady
			w.WriteHeader(http.StatusNoContent)
		case len(parts) == 3 && parts[1] == "messages" && parts[2] == "send-text":
			var body struct {
				ChatID string `json:"chatId"`
			}

			json.NewDecoder(r.Body).Decode(&body)
			g.sends = append(g.sends, gatewaySend{session: parts[0], chat: body.ChatID})

			code, payload := http.StatusOK, fmt.Sprintf(`{"messageId":"m%d","chatId":%q}`, len(g.sends), body.ChatID)
			if g.reply != nil {
				code, payload = g.reply(parts[0], len(g.sends))
			}

			w.WriteHeader(code)
			io.WriteString(w, payload)
		default:
			http.NotFound(w, r)
		}
	}))

	t.Cleanup(srv.Close)

	return srv
}

// numbersFixture is an account with numbers linked through the given sessions
// (the first is the default), a template, five contacts and a campaign to all of
// them.
type numbersFixture struct {
	*waFixture
	numbers    []int
	campaignID int
	tmpl       WATemplate
}

func newNumbersFixture(t *testing.T, gateway *httptest.Server, sessions ...string) *numbersFixture {
	t.Helper()

	f := newWAFixture(t)
	f.h = NewWhatsAppHandler(f.db, &config.Config{OpenWABaseURL: gateway.URL, OpenWAAPIKey: "test-key"})
	f.db.MustExec(`INSERT INTO wa_settings (account_id) VALUES ($1)`, f.account)

	nf := &numbersFixture{waFixture: f}

	for i, s := range sessions {
		nf.numbers = append(nf.numbers, waInsertID(t, f.db, `INSERT INTO wa_numbers
			(account_id, openwa_session_id, linked_phone, session_status, is_default)
			VALUES ($1, $2, $3, 'ready', $4) RETURNING id`, f.account, s, fmt.Sprintf("97798000000%02d", i), i == 0))
	}

	for i := 1; i <= 5; i++ {
		f.contact(t, f.account, fmt.Sprintf("98000001%02d", i), true, `[]`)
	}

	templateID := waInsertID(t, f.db, `INSERT INTO wa_templates (account_id, name, status, body_text)
		VALUES ($1, 'hello', 'approved', 'Hello') RETURNING id`, f.account)

	if err := f.db.Get(&nf.tmpl, `SELECT * FROM wa_templates WHERE id = $1`, templateID); err != nil {
		t.Fatalf("reading template: %v", err)
	}

	nf.campaignID = waInsertID(t, f.db, `INSERT INTO wa_campaigns (account_id, name, template_id, target_filter, status)
		VALUES ($1, 'everyone', $2, '{}'::jsonb, 'sending') RETURNING id`, f.account, templateID)

	return nf
}

// serveAsManager runs a handler as a super admin of the fixture's account, which
// accountManager lets through.
func serveAsManager(t *testing.T, handler echo.HandlerFunc, method, body string, accountID int,
	id string) (int, map[string]interface{}) {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", echo.MIMEApplicationJSON)

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("account_id", accountID)
	c.Set("user_role", "superadmin")

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

func sessionsUsed(sends []gatewaySend) []string {
	out := make([]string, len(sends))
	for i, s := range sends {
		out[i] = s.session
	}

	return out
}

// A spread run takes turns across the linked numbers, and records which number
// sent each message.
func TestSpreadRunTakesTurnsAcrossNumbers(t *testing.T) {
	instantSends(t)

	gw := newMultiGateway("sess-a", "sess-b")
	f := newNumbersFixture(t, gw.server(t), "sess-a", "sess-b")
	f.db.MustExec(`UPDATE wa_campaigns SET rotate_numbers = true WHERE id = $1`, f.campaignID)

	f.h.executeCampaignSend(f.campaignID, f.account, 50, f.tmpl)

	if got, want := sessionsUsed(gw.sent()), []string{"sess-a", "sess-b", "sess-a", "sess-b", "sess-a"}; fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("messages went out from %v, want them to take turns: %v", got, want)
	}

	var perNumber []int
	f.db.Select(&perNumber, `SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = $1
		GROUP BY wa_number_id ORDER BY wa_number_id`, f.campaignID)

	if fmt.Sprint(perNumber) != "[3 2]" {
		t.Errorf("messages recorded per number %v, want [3 2]", perNumber)
	}

	if o := outcomeOf(t, f.waFixture, f.campaignID); o.Status != "sent" || o.Submitted != 5 {
		t.Errorf("campaign ended as %+v, want sent to all 5", o)
	}
}

// When one number of a spread run is unlinked, the others carry on: the contact
// it failed on is sent from the next number, nobody is marked failed, and the
// unlinked number starts its own hold.
func TestSpreadRunCarriesOnWhenOneNumberIsUnlinked(t *testing.T) {
	instantSends(t)

	gw := newMultiGateway("sess-a", "sess-b")
	gw.reply = func(session string, n int) (int, string) {
		if session == "sess-b" {
			gw.status["sess-b"] = openwa.StatusQRReady

			return http.StatusConflict, `{"message":"Session is not connected"}`
		}

		return http.StatusOK, fmt.Sprintf(`{"messageId":"m%d"}`, n)
	}

	f := newNumbersFixture(t, gw.server(t), "sess-a", "sess-b")
	f.db.MustExec(`UPDATE wa_campaigns SET rotate_numbers = true WHERE id = $1`, f.campaignID)

	f.h.executeCampaignSend(f.campaignID, f.account, 50, f.tmpl)

	o := outcomeOf(t, f.waFixture, f.campaignID)
	if o.Status != "sent" || o.Submitted != 5 || o.Failed != 0 {
		t.Errorf("campaign ended as %+v, want all 5 sent from the number still linked, nobody failed", o)
	}

	var fromB int
	f.db.Get(&fromB, `SELECT COUNT(*) FROM wa_campaign_messages WHERE wa_number_id = $1`, f.numbers[1])

	if fromB != 0 {
		t.Errorf("%d messages are recorded against the unlinked number, want 0", fromB)
	}

	var unlinked WANumber
	f.db.Get(&unlinked, `SELECT * FROM wa_numbers WHERE id = $1`, f.numbers[1])

	if unlinked.UnlinkedAt == nil {
		t.Error("the unlinked number has no hold")
	}

	var stillA WANumber
	f.db.Get(&stillA, `SELECT * FROM wa_numbers WHERE id = $1`, f.numbers[0])

	if stillA.UnlinkedAt != nil {
		t.Error("the number that stayed linked was put on hold")
	}
}

// A campaign that names a number sends everything from it, not from the default.
func TestCampaignSendsFromTheChosenNumber(t *testing.T) {
	instantSends(t)

	gw := newMultiGateway("sess-a", "sess-b")
	f := newNumbersFixture(t, gw.server(t), "sess-a", "sess-b")
	f.db.MustExec(`UPDATE wa_campaigns SET status = 'paused' WHERE id = $1`, f.campaignID)

	// A batch of 2 out of 5 contacts: the choice of number and the batch size come
	// in one body, and both must be honoured.
	code, body := waServe(t, f.h.SendCampaign, http.MethodPost, "/",
		strings.NewReader(fmt.Sprintf(`{"batch_size":2,"wa_number_id":%d}`, f.numbers[1])),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(f.campaignID))

	if code != http.StatusOK {
		t.Fatalf("send: status %d, body %v", code, body)
	}

	deadline := time.Now().Add(10 * time.Second)
	for outcomeOf(t, f.waFixture, f.campaignID).Status == "sending" && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}

	if got := len(gw.sent()); got != 2 {
		t.Errorf("%d messages went out, want the batch of 2 that was asked for", got)
	}

	for _, s := range gw.sent() {
		if s.session != "sess-b" {
			t.Fatalf("a message went out from %s, want every one from the chosen number sess-b", s.session)
		}
	}

	var stored *int
	f.db.Get(&stored, `SELECT wa_number_id FROM wa_campaigns WHERE id = $1`, f.campaignID)

	if stored == nil || *stored != f.numbers[1] {
		t.Errorf("the campaign records number %v, want %d so a resume uses it too", stored, f.numbers[1])
	}
}

// Another account's number can't be sent from, even by naming its id.
func TestSendCampaignRefusesAnotherAccountsNumber(t *testing.T) {
	instantSends(t)

	gw := newMultiGateway("sess-a", "sess-other")
	f := newNumbersFixture(t, gw.server(t), "sess-a")
	f.db.MustExec(`UPDATE wa_campaigns SET status = 'paused' WHERE id = $1`, f.campaignID)

	theirs := waInsertID(t, f.db, `INSERT INTO wa_numbers (account_id, openwa_session_id, is_default)
		VALUES ($1, 'sess-other', true) RETURNING id`, f.other)

	code, _ := waServe(t, f.h.SendCampaign, http.MethodPost, "/",
		strings.NewReader(fmt.Sprintf(`{"batch_size":10,"wa_number_id":%d}`, theirs)),
		echo.MIMEApplicationJSON, f.account, fmt.Sprint(f.campaignID))

	if code != http.StatusBadRequest {
		t.Errorf("naming another account's number: status %d, want 400", code)
	}

	if len(gw.sent()) != 0 {
		t.Errorf("messages were sent after naming another account's number: %v", gw.sent())
	}
}

// Every per-number endpoint looks the number up inside the caller's account, so
// another account's number id is simply not found.
func TestNumberEndpointsStayInsideTheAccount(t *testing.T) {
	gw := newMultiGateway("sess-a", "sess-other")
	f := newNumbersFixture(t, gw.server(t), "sess-a")

	theirs := waInsertID(t, f.db, `INSERT INTO wa_numbers (account_id, openwa_session_id, is_default)
		VALUES ($1, 'sess-other', true) RETURNING id`, f.other)

	for name, handler := range map[string]echo.HandlerFunc{
		"qr":      f.h.GetMyNumberQR,
		"start":   f.h.StartMyNumber,
		"rename":  f.h.RenameMyNumber,
		"default": f.h.SetMyDefaultNumber,
		"logout":  f.h.LogoutMyNumber,
		"delete":  f.h.DeleteMyNumber,
		"test":    f.h.TestMyNumber,
	} {
		code, _ := serveAsManager(t, handler, http.MethodPost, `{"label":"x","phone":"9800000000"}`, f.account,
			fmt.Sprint(theirs))

		if code != http.StatusNotFound {
			t.Errorf("%s on another account's number: status %d, want 404", name, code)
		}
	}

	var stillThere int
	f.db.Get(&stillThere, `SELECT COUNT(*) FROM wa_numbers WHERE id = $1 AND is_default`, theirs)

	if stillThere != 1 || gw.status["sess-other"] != openwa.StatusReady || len(gw.sent()) != 0 {
		t.Error("another account's number was changed through this account")
	}
}

// Numbers can be added up to the limit; the first becomes the default, and the
// default is mirrored into wa_settings for the public API.
func TestAddingNumbersStopsAtTheLimit(t *testing.T) {
	gw := newMultiGateway()
	f := newNumbersFixture(t, gw.server(t))

	for i := 1; i <= maxNumbersPerAccount; i++ {
		code, body := serveAsManager(t, f.h.AddMyNumber, http.MethodPost, fmt.Sprintf(`{"label":"Line %d"}`, i),
			f.account, "")
		if code != http.StatusOK {
			t.Fatalf("adding number %d: status %d, body %v", i, code, body)
		}
	}

	code, body := serveAsManager(t, f.h.AddMyNumber, http.MethodPost, `{}`, f.account, "")
	if msg, _ := body["message"].(string); code != http.StatusConflict || !strings.Contains(msg, "limit") {
		t.Errorf("adding one more than the limit: status %d, message %q; want 409 explaining the limit", code, msg)
	}

	if gw.created != maxNumbersPerAccount {
		t.Errorf("the gateway was asked for %d sessions, want %d", gw.created, maxNumbersPerAccount)
	}

	var defaults []string
	f.db.Select(&defaults, `SELECT label FROM wa_numbers WHERE account_id = $1 AND is_default`, f.account)

	if fmt.Sprint(defaults) != "[Line 1]" {
		t.Errorf("default numbers %v, want only the first, Line 1", defaults)
	}

	var mirrored string
	f.db.Get(&mirrored, `SELECT openwa_session_id FROM wa_settings WHERE account_id = $1`, f.account)

	if mirrored != "new-1" {
		t.Errorf("wa_settings mirrors session %q, want the default number's new-1", mirrored)
	}
}

// Removing the default number promotes another, and the mirror follows.
func TestDeletingTheDefaultPromotesAnother(t *testing.T) {
	gw := newMultiGateway("sess-a", "sess-b")
	f := newNumbersFixture(t, gw.server(t), "sess-a", "sess-b")
	f.h.mirrorDefaultNumber(f.account)

	code, body := serveAsManager(t, f.h.DeleteMyNumber, http.MethodDelete, ``, f.account, fmt.Sprint(f.numbers[0]))
	if code != http.StatusOK {
		t.Fatalf("delete: status %d, body %v", code, body)
	}

	var isDefault bool
	f.db.Get(&isDefault, `SELECT is_default FROM wa_numbers WHERE id = $1`, f.numbers[1])

	if !isDefault {
		t.Error("the remaining number did not become the default")
	}

	var mirrored string
	f.db.Get(&mirrored, `SELECT openwa_session_id FROM wa_settings WHERE account_id = $1`, f.account)

	if mirrored != "sess-b" {
		t.Errorf("wa_settings mirrors session %q after the delete, want sess-b", mirrored)
	}

	if _, still := gw.status["sess-a"]; still {
		t.Error("the deleted number's session was left running on the gateway")
	}
}

// Choosing a new default clears the old one in the same step.
func TestSetDefaultNumberMovesTheDefault(t *testing.T) {
	gw := newMultiGateway("sess-a", "sess-b")
	f := newNumbersFixture(t, gw.server(t), "sess-a", "sess-b")

	code, body := serveAsManager(t, f.h.SetMyDefaultNumber, http.MethodPost, ``, f.account, fmt.Sprint(f.numbers[1]))
	if code != http.StatusOK {
		t.Fatalf("set default: status %d, body %v", code, body)
	}

	var defaults []int
	f.db.Select(&defaults, `SELECT id FROM wa_numbers WHERE account_id = $1 AND is_default`, f.account)

	if fmt.Sprint(defaults) != fmt.Sprint([]int{f.numbers[1]}) {
		t.Errorf("default numbers %v, want only %d", defaults, f.numbers[1])
	}

	if sid, _ := f.h.mySessionID(f.account); sid != "sess-b" {
		t.Errorf("the single-number endpoints now act on %q, want the new default sess-b", sid)
	}
}
