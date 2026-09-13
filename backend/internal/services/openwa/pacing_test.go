package openwa

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// The gateway's send governor answers 429 with code SEND_PACING_LIMITED when the
// linked number has hit its daily allowance, its much smaller allowance for
// contacts it has never messaged, or its failure breaker.
//
// None of those say anything about the recipient. The campaign sender records a
// wa_campaign_messages row for every contact it treats as failed, and that row is
// what "already reached" means — so mistaking a paced refusal for a failed send
// silently drops reachable people from every future run without ever having
// messaged them. The whole point of this type is to keep the two apart.
func TestPacedRefusalIsDistinguishedFromASendFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{
			"statusCode": 429,
			"error": "Too Many Requests",
			"message": "Reaching 1 new contact(s) would exceed the daily allowance of 5 new conversation(s) for a session 0 day(s) old (5 already used)",
			"code": "SEND_PACING_LIMITED",
			"retryAfterSeconds": 3600
		}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")

	_, err := client.SendText(context.Background(), "session-1", "9779805749767", "hello")
	if err == nil {
		t.Fatal("expected an error from a 429")
	}

	if !IsPacingLimited(err) {
		t.Fatalf("a paced refusal was not recognised as one: %v\n"+
			"The campaign sender would mark this contact failed and exclude them for good.", err)
	}

	var paced *PacingLimitedError
	if !errors.As(err, &paced) {
		t.Fatal("could not unwrap the pacing error")
	}

	if paced.RetryAfter != time.Hour {
		t.Errorf("RetryAfter = %s, want 1h — the caller uses this to decide when to resume", paced.RetryAfter)
	}

	if paced.Reason == "" {
		t.Error("Reason is empty; the operator needs to know which allowance was hit")
	}
}

// A 429 that is not the pacing governor (a plain proxy or ingress rate limit, say)
// must not be mistaken for one — those do not carry a retry budget the campaign
// can reason about, and treating them as pacing would park the campaign silently.
func TestPlainRateLimitIsNotTreatedAsPacing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}`))
	}))
	defer server.Close()

	_, err := NewClient(server.URL, "k").SendText(context.Background(), "s", "9779805749767", "hi")
	if err == nil {
		t.Fatal("expected an error")
	}

	if IsPacingLimited(err) {
		t.Error("a generic 429 was misread as a pacing refusal")
	}
}

// A 409 still means the session is not connected, and a 500 is still an ordinary
// send failure. Adding the 429 branch must not have disturbed either.
func TestOtherStatusesKeepTheirMeaning(t *testing.T) {
	cases := []struct {
		status    int
		wantPaced bool
		wantNoSes bool
	}{
		{http.StatusConflict, false, true},
		{http.StatusInternalServerError, false, false},
		{http.StatusBadRequest, false, false},
	}

	for _, c := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(c.status)
			w.Write([]byte(`{"message":"nope"}`))
		}))

		_, err := NewClient(server.URL, "k").SendText(context.Background(), "s", "9779805749767", "hi")
		server.Close()

		if err == nil {
			t.Errorf("status %d: expected an error", c.status)

			continue
		}

		if got := IsPacingLimited(err); got != c.wantPaced {
			t.Errorf("status %d: IsPacingLimited = %v, want %v", c.status, got, c.wantPaced)
		}

		if got := err == ErrNoConnectedSession; got != c.wantNoSes {
			t.Errorf("status %d: ErrNoConnectedSession = %v, want %v", c.status, got, c.wantNoSes)
		}
	}
}
