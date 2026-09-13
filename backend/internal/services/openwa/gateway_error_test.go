package openwa

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// The gateway answers 4xx to describe the state you asked about — no QR while a
// session is disconnected, a number that is not on WhatsApp. Those are not
// faults, and collapsing them into one opaque error made every caller report a
// 502. The settings page, polling a disconnected session's QR every four seconds,
// turned that into 304 gateway errors in a single hour.
func TestGatewayStatusSurvivesSoCallersCanTellStateFromFault(t *testing.T) {
	cases := []struct {
		name        string
		status      int
		body        string
		wantClient  bool
		wantMessage string
	}{
		{
			name:        "no QR while disconnected",
			status:      http.StatusBadRequest,
			body:        `{"statusCode":400,"message":"Session is not awaiting a QR scan"}`,
			wantClient:  true,
			wantMessage: "Session is not awaiting a QR scan",
		},
		{
			name:        "recipient not on WhatsApp",
			status:      http.StatusBadRequest,
			body:        `{"message":"WhatsApp could not resolve the recipient 9779800000001@c.us."}`,
			wantClient:  true,
			wantMessage: "WhatsApp could not resolve the recipient 9779800000001@c.us.",
		},
		{
			name:        "validation array",
			status:      http.StatusBadRequest,
			body:        `{"message":["phone must be a string","text should not be empty"]}`,
			wantClient:  true,
			wantMessage: "phone must be a string; text should not be empty",
		},
		{
			name:       "gateway actually broken",
			status:     http.StatusInternalServerError,
			body:       `{"message":"Internal server error"}`,
			wantClient: false,
		},
		{
			name:       "gateway down",
			status:     http.StatusBadGateway,
			body:       `nope`,
			wantClient: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(c.status)
				w.Write([]byte(c.body))
			}))
			defer server.Close()

			_, err := NewClient(server.URL, "k").GetQR(context.Background(), "s")
			if err == nil {
				t.Fatal("expected an error")
			}

			gwErr, ok := AsGatewayError(err)
			if !ok {
				t.Fatalf("error did not carry the gateway status: %v", err)
			}

			if gwErr.Status != c.status {
				t.Errorf("Status = %d, want %d", gwErr.Status, c.status)
			}

			if gwErr.ClientFault() != c.wantClient {
				t.Errorf("ClientFault() = %v, want %v — this decides whether the operator sees "+
					"an explanation or a 502", gwErr.ClientFault(), c.wantClient)
			}

			if c.wantMessage != "" && gwErr.Message != c.wantMessage {
				t.Errorf("Message = %q, want %q — this is the text the operator reads",
					gwErr.Message, c.wantMessage)
			}
		})
	}
}

// The two errors that already had meaning must keep it: a 409 is still "nothing
// linked", and a paced 429 is still the send governor.
func TestSpecialCasedStatusesStillWin(t *testing.T) {
	conflict := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
	}))
	defer conflict.Close()

	if _, err := NewClient(conflict.URL, "k").GetQR(context.Background(), "s"); err != ErrNoConnectedSession {
		t.Errorf("409 gave %v, want ErrNoConnectedSession", err)
	}

	paced := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"code":"SEND_PACING_LIMITED","message":"cap reached","retryAfterSeconds":60}`))
	}))
	defer paced.Close()

	_, err := NewClient(paced.URL, "k").SendText(context.Background(), "s", "9779805749767", "hi")
	if !IsPacingLimited(err) {
		t.Errorf("paced 429 gave %v, want a pacing error", err)
	}
}
