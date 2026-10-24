package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
)

// apiKey makes a Phone SMS API key for the account, which gets 10 credits.
func (f *phoneFixture) apiKey(t *testing.T, account int, isTest bool) *mw.APIKeyInfo {
	t.Helper()

	f.db.MustExec(`UPDATE app_accounts SET api_enabled = true WHERE id = $1`, account)
	f.db.MustExec(`INSERT INTO api_credits (account_id, channel, balance) VALUES ($1, 'phone_sms', 10)
		ON CONFLICT (account_id, channel) DO NOTHING`, account)
	id := waInsertID(t, f.db, `INSERT INTO api_keys (account_id, channel, key_hash, key_prefix, name, is_test)
		VALUES ($1, 'phone_sms', 'x', $2, 'key', $3) RETURNING id`,
		account, fmt.Sprintf("nf_phonesms_k%d", time.Now().UnixNano()%1e8), isTest)

	return &mw.APIKeyInfo{KeyID: id, AccountID: account, Channel: "phone_sms", IsTest: isTest}
}

// api calls a public API handler as the key's caller, the way APIKeyAuth would
// have set it up.
func (f *phoneFixture) api(t *testing.T, handler echo.HandlerFunc, method, target, body string, key *mw.APIKeyInfo, id string) (int, map[string]interface{}) {
	t.Helper()

	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}

	e := echo.New()
	req := httptest.NewRequest(method, target, r)

	if body != "" {
		req.Header.Set("Content-Type", echo.MIMEApplicationJSON)
	}

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("account_id", key.AccountID)
	c.Set("api_key_info", key)

	if id != "" {
		c.SetParamNames("id")
		c.SetParamValues(id)
	}

	if err := handler(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	var decoded map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &decoded)

	return rec.Code, decoded
}

// credits returns the account's Phone SMS credit balance and reserved amount.
func (f *phoneFixture) credits(t *testing.T, account int) (float64, float64) {
	t.Helper()

	var c struct {
		Balance  float64 `db:"balance"`
		Reserved float64 `db:"reserved"`
	}
	f.db.Get(&c, `SELECT balance, reserved FROM api_credits WHERE account_id = $1 AND channel = 'phone_sms'`, account)

	return c.Balance, c.Reserved
}

// apiSettle waits for the account's API sender to finish.
func (f *phoneFixture) apiSettle(t *testing.T, account int) {
	t.Helper()

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(20 * time.Millisecond) {
		f.h.mu.Lock()
		running := f.h.apiSending[account]
		f.h.mu.Unlock()

		if !running && f.h.queuedAPIMessages(account) == 0 {
			return
		}
	}

	t.Fatalf("account %d still has API messages queued after 5s", account)
}

func (f *phoneFixture) apiRow(t *testing.T, id int) map[string]interface{} {
	t.Helper()

	code, body := f.api(t, f.h.APIGetMessage, http.MethodGet, "/", "", &mw.APIKeyInfo{AccountID: f.account}, fmt.Sprintf("phone_sms_msg_%d", id))
	if code != http.StatusOK {
		t.Fatalf("get message %d: %d %v", id, code, body)
	}

	data, _ := body["data"].(map[string]interface{})

	return data
}

func messageNumber(t *testing.T, messageID interface{}) int {
	t.Helper()

	var n int
	if _, err := fmt.Sscanf(fmt.Sprint(messageID), "phone_sms_msg_%d", &n); err != nil {
		t.Fatalf("message_id %v isn't phone_sms_msg_<n>", messageID)
	}

	return n
}

// A message sent through the API goes out from the account's phone and SIM, in
// full, and follows the phone's reports to delivered.
func TestPhoneSMSAPISendGoesOutFromThePhone(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)
	long := strings.Repeat("Namaste ", 40) // past the 200-character preview

	code, body := f.api(t, f.h.APISend, http.MethodPost, "/", fmt.Sprintf(`{"to":"+977 9800000001","message":%q,"reference":"order-7"}`, long), key, "")
	data, _ := body["data"].(map[string]interface{})

	if code != http.StatusOK || data["status"] != "queued" || data["to"] != "9800000001" ||
		data["credits_used"] != float64(1) || data["credits_remaining"] != float64(9) {
		t.Fatalf("send: %d %v, want queued for 9800000001 using 1 of 10 credits", code, body)
	}

	id := messageNumber(t, data["message_id"])
	f.apiSettle(t, f.account)

	if got := strings.Join(f.gw.sentTo(), ","); got != "+9779800000001" {
		t.Errorf("sent to %s, want +9779800000001", got)
	}

	f.gw.mu.Lock()
	first := f.gw.sends[0]
	f.gw.mu.Unlock()

	if text := first["textMessage"].(map[string]interface{})["text"]; text != long || first["simNumber"] != float64(1) {
		t.Errorf("the phone got %d characters on SIM %v, want the whole %d-character message on SIM 1",
			len(fmt.Sprint(text)), first["simNumber"], len(long))
	}

	row := f.apiRow(t, id)
	if row["status"] != "submitted" || row["from"] != "SIM 1" || row["reference"] != "order-7" || row["sent_at"] == nil ||
		row["credits_charged"] != float64(1) {
		t.Errorf("after hand-off: %v, want submitted from SIM 1 for 1 credit", row)
	}

	var deducted int
	f.db.Get(&deducted, `SELECT COUNT(*) FROM api_credit_transactions WHERE channel = 'phone_sms' AND type = 'deduct' AND message_id = $1`, id)

	if balance, reserved := f.credits(t, f.account); balance != 9 || reserved != 0 || deducted != 1 {
		t.Errorf("credits after hand-off: balance %v reserved %v, %d deduct rows; want 9, 0 and one", balance, reserved, deducted)
	}

	var leftover int
	f.db.Get(&leftover, `SELECT COUNT(*) FROM api_messages WHERE metadata ? 'text'`)

	if leftover != 0 {
		t.Error("the full text is still stored after the phone has it")
	}

	f.webhook(t, f.token, phoneEvent("sms:sent", "gw-1", map[string]interface{}{}), nil)
	if got := f.apiRow(t, id)["status"]; got != "sent" {
		t.Errorf("after sms:sent: %v, want sent", got)
	}

	f.webhook(t, f.token, phoneEvent("sms:delivered", "gw-1", map[string]interface{}{}), nil)
	f.webhook(t, f.token, phoneEvent("sms:failed", "gw-1", map[string]interface{}{"reason": "late"}), nil)

	if row := f.apiRow(t, id); row["status"] != "delivered" || row["delivered_at"] == nil {
		t.Errorf("after delivery: %v, want delivered and kept delivered", row)
	}

	// The plain number works as the id too.
	if code, _ := f.api(t, f.h.APIGetMessage, http.MethodGet, "/", "", key, fmt.Sprint(id)); code != http.StatusOK {
		t.Errorf("get by number: %d, want 200", code)
	}
}

// The phone's daily limit covers campaigns and the API together; a call that
// doesn't fit is refused whole, before anything is queued.
func TestPhoneSMSAPIDailyLimit(t *testing.T) {
	f := newPhoneFixture(t)
	f.db.MustExec(`UPDATE phone_sms_settings SET daily_limit = 3`)
	key := f.apiKey(t, f.account, false)

	// One campaign message already went out today.
	contact := f.contact(t, f.account, "9800000009", true)
	campaign := f.campaign(t)
	f.db.MustExec(`INSERT INTO phone_sms_campaign_messages (campaign_id, contact_id, status, submitted_at) VALUES ($1, $2, 'submitted', NOW())`, campaign, contact)

	three := `{"message":"Hi","recipients":[{"to":"9800000001"},{"to":"9800000002"},{"to":"9800000003"}]}`
	code, body := f.api(t, f.h.APISendBulk, http.MethodPost, "/", three, key, "")
	errObj, _ := body["error"].(map[string]interface{})

	if code != http.StatusTooManyRequests || errObj["code"] != "DAILY_LIMIT_REACHED" {
		t.Fatalf("3 more after 1 of 3: %d %v, want 429 DAILY_LIMIT_REACHED", code, body)
	}

	if n := f.h.queuedAPIMessages(f.account); n != 0 {
		t.Errorf("%d queued after a refused call, want none", n)
	}

	two := `{"message":"Hi","recipients":[{"to":"9800000001"},{"to":"9800000002","message":"Hello you"}]}`
	code, body = f.api(t, f.h.APISendBulk, http.MethodPost, "/", two, key, "")
	data, _ := body["data"].(map[string]interface{})

	if code != http.StatusOK || data["queued"] != float64(2) || data["remaining_today"] != float64(0) {
		t.Fatalf("2 more: %d %v, want both queued and nothing left", code, body)
	}

	if code, _ := f.api(t, f.h.APISend, http.MethodPost, "/", `{"to":"9800000004","message":"Hi"}`, key, ""); code != http.StatusTooManyRequests {
		t.Errorf("one past the limit: %d, want 429", code)
	}

	f.apiSettle(t, f.account)

	_, body = f.api(t, f.h.APIBalance, http.MethodGet, "/", "", key, "")
	data, _ = body["data"].(map[string]interface{})

	if data["sent_today"] != float64(3) || data["remaining_today"] != float64(0) || data["daily_limit"] != float64(3) {
		t.Errorf("balance %v, want 3 of 3 used", data)
	}
}

// A test key records the call and sends nothing.
func TestPhoneSMSAPITestKeySendsNothing(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, true)

	code, body := f.api(t, f.h.APISend, http.MethodPost, "/", `{"to":"9800000001","message":"Hi"}`, key, "")
	data, _ := body["data"].(map[string]interface{})

	if code != http.StatusOK || data["status"] != "test" || data["test_mode"] != true {
		t.Fatalf("test send: %d %v, want status test", code, body)
	}

	time.Sleep(50 * time.Millisecond)

	if n := len(f.gw.sentTo()); n != 0 {
		t.Errorf("a test key sent %d messages", n)
	}

	if balance, _ := f.credits(t, f.account); balance != 10 || data["credits_used"] != float64(0) {
		t.Errorf("a test key used credits: balance %v, credits_used %v", balance, data["credits_used"])
	}
}

// When the phone can't be reached every queued message fails at once, saying
// why; a number SMSGate rejects fails on its own. Every failed message's credit
// comes back, including one the phone reports it couldn't send.
func TestPhoneSMSAPIFailures(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)

	f.gw.failFor = func(phone string) int {
		if phone == "+9779800000001" {
			return http.StatusBadRequest
		}

		return 0
	}

	_, body := f.api(t, f.h.APISendBulk, http.MethodPost, "/", `{"message":"Hi","recipients":[{"to":"9800000001"},{"to":"9800000002"}]}`, key, "")
	ids, _ := body["data"].(map[string]interface{})["message_ids"].([]interface{})
	f.apiSettle(t, f.account)

	if a, b := f.apiRow(t, messageNumber(t, ids[0])), f.apiRow(t, messageNumber(t, ids[1])); a["status"] != "failed" || a["error_code"] != "INVALID_RECIPIENT" || b["status"] != "submitted" {
		t.Errorf("rejected number: %v / %v, want only the first failed", a["status"], b["status"])
	}

	if balance, reserved := f.credits(t, f.account); balance != 9 || reserved != 0 {
		t.Errorf("after one rejected, one sent: balance %v reserved %v, want 9 and 0", balance, reserved)
	}

	sent := messageNumber(t, ids[1])

	f.gw.mu.Lock()
	f.gw.failFor = func(string) int { return http.StatusServiceUnavailable }
	f.gw.mu.Unlock()

	_, body = f.api(t, f.h.APISendBulk, http.MethodPost, "/", `{"message":"Hi","recipients":[{"to":"9800000003"},{"to":"9800000004"}]}`, key, "")
	ids, _ = body["data"].(map[string]interface{})["message_ids"].([]interface{})
	f.apiSettle(t, f.account)

	for _, id := range ids {
		row := f.apiRow(t, messageNumber(t, id))
		if row["status"] != "failed" || row["error_code"] != "PHONE_UNREACHABLE" || !strings.Contains(fmt.Sprint(row["error_message"]), "Couldn't reach your phone") {
			t.Errorf("phone down: %v, want failed as PHONE_UNREACHABLE", row)
		}
	}

	if balance, reserved := f.credits(t, f.account); balance != 9 || reserved != 0 {
		t.Errorf("after the phone went down: balance %v reserved %v, want both refunded (9, 0)", balance, reserved)
	}

	// The phone takes a message but then can't send it: its credit comes back
	// once, however often the report arrives.
	failed := phoneEvent("sms:failed", "gw-1", map[string]interface{}{"reason": "No service"})
	f.webhook(t, f.token, failed, nil)
	f.webhook(t, f.token, failed, nil)

	if row := f.apiRow(t, sent); row["status"] != "failed" || row["error_code"] != "SEND_FAILED" || row["error_message"] != "No service" {
		t.Errorf("after sms:failed: %v, want failed as SEND_FAILED", row)
	}

	var refunds int
	f.db.Get(&refunds, `SELECT COUNT(*) FROM api_credit_transactions WHERE type = 'refund' AND message_id = $1`, sent)

	if balance, _ := f.credits(t, f.account); balance != 10 || refunds != 1 {
		t.Errorf("after the phone couldn't send: balance %v with %d refunds, want 10 and one", balance, refunds)
	}

	var charged int
	f.db.Get(&charged, `SELECT COUNT(*) FROM api_messages WHERE status = 'failed' AND credits_charged <> 0`)

	if charged != 0 {
		t.Errorf("%d failed messages report credits charged, want none", charged)
	}
}

// A call needing more credits than the account has is refused whole, before
// anything is queued or reserved.
func TestPhoneSMSAPINeedsCredits(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)
	f.db.MustExec(`UPDATE api_credits SET balance = 1 WHERE account_id = $1 AND channel = 'phone_sms'`, f.account)

	code, body := f.api(t, f.h.APISendBulk, http.MethodPost, "/", `{"message":"Hi","recipients":[{"to":"9800000001"},{"to":"9800000002"}]}`, key, "")
	errObj, _ := body["error"].(map[string]interface{})

	if code != http.StatusPaymentRequired || errObj["code"] != "INSUFFICIENT_CREDITS" {
		t.Fatalf("2 messages with 1 credit: %d %v, want 402 INSUFFICIENT_CREDITS", code, body)
	}

	if balance, reserved := f.credits(t, f.account); balance != 1 || reserved != 0 || f.h.queuedAPIMessages(f.account) != 0 {
		t.Errorf("after the refusal: balance %v reserved %v, %d queued; want 1, 0 and none", balance, reserved, f.h.queuedAPIMessages(f.account))
	}

	if code, _ := f.api(t, f.h.APISend, http.MethodPost, "/", `{"to":"9800000001","message":"Hi"}`, key, ""); code != http.StatusOK {
		t.Errorf("1 message with 1 credit: %d, want 200", code)
	}

	f.apiSettle(t, f.account)
	_, body = f.api(t, f.h.APIBalance, http.MethodGet, "/", "", key, "")

	if data, _ := body["data"].(map[string]interface{}); data["balance"] != float64(0) || data["credit_per_sms"] != float64(1) {
		t.Errorf("balance %v, want 0 credits left at 1 per SMS", data)
	}
}

// Another account's messages can't be read, and the list shows only the
// caller's own.
func TestPhoneSMSAPIMessagesKeepToTheAccount(t *testing.T) {
	f := newPhoneFixture(t)
	other := waInsertID(t, f.db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	f.db.MustExec(`INSERT INTO phone_sms_settings (account_id, username, password, webhook_token) VALUES ($1, 'u', 'p', $2)`,
		other, strings.Repeat("e", 48))
	mine := f.apiKey(t, f.account, true)
	theirs := f.apiKey(t, other, true)

	f.api(t, f.h.APISend, http.MethodPost, "/", `{"to":"9800000001","message":"mine"}`, mine, "")
	f.api(t, f.h.APISend, http.MethodPost, "/", `{"to":"9800000002","message":"theirs"}`, theirs, "")

	_, body := f.api(t, f.h.APIListMessages, http.MethodGet, "/", "", theirs, "")
	results, _ := body["data"].([]interface{})

	if len(results) != 1 || body["total"] != float64(1) || results[0].(map[string]interface{})["to"] != "9800000002" {
		t.Fatalf("their list: %v, want only their message", body)
	}

	theirID := results[0].(map[string]interface{})["message_id"]

	if code, _ := f.api(t, f.h.APIGetMessage, http.MethodGet, "/", "", mine, fmt.Sprint(theirID)); code != http.StatusNotFound {
		t.Errorf("reading another account's message: %d, want 404", code)
	}
}

// API messages still queued when the server stopped go out after the restart.
func TestPhoneSMSAPIQueuedMessagesCarryOnAfterRestart(t *testing.T) {
	f := newPhoneFixture(t)
	key := f.apiKey(t, f.account, false)

	f.db.MustExec(`INSERT INTO api_messages (account_id, api_key_id, channel, "to", status, metadata)
		VALUES ($1, $2, 'phone_sms', '9800000001', 'queued', '{"text":"Hi"}')`, f.account, key.KeyID)

	f.h.ResumeInterruptedCampaigns()
	f.apiSettle(t, f.account)

	if got := strings.Join(f.gw.sentTo(), ","); got != "+9779800000001" {
		t.Errorf("after the restart sent to %q, want the queued message", got)
	}
}

// Campaigns and the API take turns on the phone: each slot is the account's gap
// after the last, and other accounts' phones don't wait.
func TestPhoneSMSTurnsShareTheGap(t *testing.T) {
	h := NewPhoneSMSHandler(nil, "")
	gap := 30 * time.Second

	waits := []time.Duration{h.takeTurn(1, gap), h.takeTurn(1, gap), h.takeTurn(1, gap), h.takeTurn(2, gap)}
	want := []time.Duration{0, gap, 2 * gap, 0}

	for i := range waits {
		if d := waits[i] - want[i]; d < -time.Second || d > time.Second {
			t.Errorf("turn %d waits %v, want about %v", i, waits[i], want[i])
		}
	}
}

// A Phone SMS key is created like the others, with a credit row, but starts
// nf_phonesms_, and the API accepts it only for Phone SMS.
func TestPhoneSMSAPIKeyAuthenticates(t *testing.T) {
	f := newPhoneFixture(t)
	keys := NewAPIKeyHandler(f.db)

	code, body := waServe(t, keys.CreateKey, http.MethodPost, "/", strings.NewReader(`{"channel":"phone_sms","name":"shop"}`),
		echo.MIMEApplicationJSON, f.account, "")
	data, _ := body["data"].(map[string]interface{})
	raw := fmt.Sprint(data["key"])

	if code != http.StatusCreated || !strings.HasPrefix(raw, "nf_phonesms_") {
		t.Fatalf("create key: %d %v, want a nf_phonesms_ key", code, body)
	}

	var credits int
	f.db.Get(&credits, `SELECT COUNT(*) FROM api_credits WHERE account_id = $1 AND channel = 'phone_sms'`, f.account)

	if credits != 1 {
		t.Errorf("%d Phone SMS credit rows, want one created with the key", credits)
	}

	call := func(channel string) (int, *mw.APIKeyInfo) {
		var seen *mw.APIKeyInfo

		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+raw)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		mw.APIKeyAuth(f.db, channel)(func(c echo.Context) error {
			seen = mw.GetAPIKeyInfo(c)
			return c.NoContent(http.StatusOK)
		})(c)

		return rec.Code, seen
	}

	if code, info := call("phone_sms"); code != http.StatusOK || info == nil || info.Channel != "phone_sms" || info.AccountID != f.account {
		t.Errorf("Phone SMS API with the new key: %d %+v, want it accepted", code, info)
	}

	if code, _ := call("sms"); code != http.StatusForbidden {
		t.Errorf("SMS API with a Phone SMS key: %d, want 403", code)
	}
}

// An admin can give an account Phone SMS API credits, as for the other channels.
func TestAdminGivesPhoneSMSCredits(t *testing.T) {
	f := newPhoneFixture(t)
	credits := NewCreditHandler(f.db)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"channel":"phone_sms","amount":50,"description":"Starter pack"}`))
	req.Header.Set("Content-Type", echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("account_id")
	c.SetParamValues(fmt.Sprint(f.account))

	if err := credits.AdminAdjustCredits(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	var purchases int
	f.db.Get(&purchases, `SELECT COUNT(*) FROM api_credit_transactions WHERE account_id = $1 AND channel = 'phone_sms' AND type = 'purchase' AND amount = 50`, f.account)

	if balance, _ := f.credits(t, f.account); rec.Code != http.StatusOK || balance != 50 || purchases != 1 {
		t.Errorf("giving 50 Phone SMS credits: %d %s, balance %v, %d purchase rows; want 200, 50 and one", rec.Code, rec.Body.String(), balance, purchases)
	}
}
