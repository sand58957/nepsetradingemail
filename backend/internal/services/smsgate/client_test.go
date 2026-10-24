package smsgate

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

// The send request carries the fields SMSGate expects, with the account's
// credentials, and the answer is read back.
func TestSendPostsTheMessageWithBasicAuth(t *testing.T) {
	var got map[string]interface{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "ABCDEF" || pass != "secret" {
			t.Errorf("basic auth %q/%q (%v), want ABCDEF/secret", user, pass, ok)
		}

		if r.Method != http.MethodPost || r.URL.Path != "/3rdparty/v1/messages" {
			t.Errorf("request %s %s, want POST /3rdparty/v1/messages", r.Method, r.URL.Path)
		}

		json.NewDecoder(r.Body).Decode(&got)
		w.Write([]byte(`{"id":"m1","deviceId":"d1","state":"Pending","recipients":[{"phoneNumber":"+9779800000001","state":"Pending"}]}`))
	}))
	defer srv.Close()

	sim, report, ttl := 2, true, uint64(60)
	state, err := NewClient(srv.URL+"/3rdparty/v1/", "ABCDEF", "secret").Send(context.Background(), Message{
		TextMessage: &TextMessage{Text: "Namaste"}, PhoneNumbers: []string{"+9779800000001"},
		SimNumber: &sim, WithDeliveryReport: &report, TTL: &ttl,
	})
	if err != nil || state.ID != "m1" || state.State != "Pending" {
		t.Fatalf("got %+v, %v", state, err)
	}

	text, _ := got["textMessage"].(map[string]interface{})
	numbers, _ := got["phoneNumbers"].([]interface{})

	if text["text"] != "Namaste" || len(numbers) != 1 || numbers[0] != "+9779800000001" ||
		got["simNumber"] != float64(2) || got["withDeliveryReport"] != true || got["ttl"] != float64(60) {
		t.Errorf("request body %v", got)
	}

	if _, has := got["deviceId"]; has {
		t.Errorf("an empty device id was sent: %v", got)
	}
}

// Only a 400 or 422 is about the recipient; the rest would fail for everyone.
func TestRecipientProblemSeparatesRecipientFromGatewayErrors(t *testing.T) {
	for _, c := range []struct {
		status int
		want   bool
	}{{400, true}, {422, true}, {401, false}, {404, false}, {500, false}, {502, false}} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(c.status)
			w.Write([]byte(`{"message":"nope"}`))
		}))

		_, err := NewClient(srv.URL, "u", "p").Send(context.Background(), Message{TextMessage: &TextMessage{Text: "x"}, PhoneNumbers: []string{"+1"}})
		srv.Close()

		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.Status != c.status || apiErr.Message != "nope" {
			t.Errorf("status %d: error %v, want an APIError with the message", c.status, err)
		}

		if RecipientProblem(err) != c.want {
			t.Errorf("status %d: RecipientProblem = %v, want %v", c.status, !c.want, c.want)
		}
	}

	if RecipientProblem(errors.New("connection refused")) {
		t.Error("a network error counted as a recipient problem")
	}
}

func sign(key string, body []byte, ts string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write(body)
	mac.Write([]byte(ts))

	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	body := []byte(`{"event":"sms:received"}`)
	ts := strconv.FormatInt(now.Unix(), 10)
	good := sign("key-1", body, ts)

	cases := []struct {
		name               string
		key, ts, signature string
		body               []byte
		at                 time.Time
		want               bool
	}{
		{"valid", "key-1", ts, good, body, now, true},
		{"wrong key", "key-2", ts, good, body, now, false},
		{"body changed", "key-1", ts, good, []byte(`{"event":"sms:sent"}`), now, false},
		{"timestamp changed", "key-1", strconv.FormatInt(now.Unix()+1, 10), good, body, now, false},
		{"replayed later", "key-1", ts, good, body, now.Add(6 * time.Minute), false},
		{"no signature", "key-1", ts, "", body, now, false},
		{"no key", "", ts, good, body, now, false},
	}

	for _, c := range cases {
		if got := VerifySignature(c.key, c.body, c.ts, c.signature, c.at); got != c.want {
			t.Errorf("%s: VerifySignature = %v, want %v", c.name, got, c.want)
		}
	}
}
