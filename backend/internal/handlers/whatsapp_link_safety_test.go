package handlers

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

// The gap is the main brake on a linked number, so it must never come out shorter
// than promised, and it must actually vary: a steady beat is what it replaces.
func TestSendGapIsUnevenAndNeverShorterThanTheMinimum(t *testing.T) {
	cases := []struct {
		interval int
		min, max time.Duration
	}{
		{0, batchGapMin, batchGapMax - 1},
		{30, 30 * time.Second, 45 * time.Second},
		{maxIntervalSeconds, time.Hour, 90 * time.Minute},
	}

	for _, c := range cases {
		seen := map[time.Duration]bool{}

		for i := 0; i < 2000; i++ {
			gap := sendGap(c.interval)
			if gap < c.min || gap > c.max {
				t.Fatalf("sendGap(%d) = %s, want between %s and %s", c.interval, gap, c.min, c.max)
			}

			seen[gap] = true
		}

		if len(seen) < 100 {
			t.Errorf("sendGap(%d) gave only %d different gaps in 2000 tries; it should vary", c.interval, len(seen))
		}
	}
}

func TestAverageSendGapMatchesTheRange(t *testing.T) {
	if got := averageSendGap(0); got != 45*time.Second {
		t.Errorf("averageSendGap(0) = %s, want 45s", got)
	}

	if got := averageSendGap(40); got != 50*time.Second {
		t.Errorf("averageSendGap(40) = %s, want 50s", got)
	}
}

// Only a failure about the recipient lets the campaign move on to the next
// contact. Everything else stops it with nobody marked failed.
func TestRecipientRejectedOnlyForRecipientErrors(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"unresolvable recipient", &openwa.GatewayError{Status: 400, Message: "WhatsApp could not resolve the recipient"}, true},
		{"unusable request", &openwa.GatewayError{Status: 422, Message: "chatId must be a string"}, true},
		{"session not connected", openwa.ErrNoConnectedSession, false},
		{"wrapped session not connected", fmt.Errorf("sending: %w", openwa.ErrNoConnectedSession), false},
		{"page crashed", &openwa.GatewayError{Status: 500, Message: "Internal server error"}, false},
		{"gateway down", &openwa.GatewayError{Status: 502, Message: "Bad Gateway"}, false},
		{"session missing", &openwa.GatewayError{Status: 404, Message: "Session not found"}, false},
		{"bad API key", &openwa.GatewayError{Status: 401, Message: "Unauthorized"}, false},
		{"rate limited", &openwa.GatewayError{Status: 429, Message: "Too Many Requests"}, false},
		{"governor", &openwa.PacingLimitedError{Reason: "daily cap"}, false},
		{"network", errors.New("dial tcp: connection refused"), false},
	}

	for _, c := range cases {
		if got := recipientRejected(c.err); got != c.want {
			t.Errorf("%s: recipientRejected = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestRecipientUnreachableMatchesTheGatewayMessage(t *testing.T) {
	gateway := "WhatsApp could not resolve the recipient 9779800000001@c.us. Either the number is not on " +
		"WhatsApp, or this session has no existing chat with it — message it once from the phone, then retry."

	if !recipientUnreachable(&openwa.GatewayError{Status: 400, Message: gateway}) {
		t.Error("the gateway's unresolvable-recipient error was not recognised")
	}

	if recipientUnreachable(&openwa.GatewayError{Status: 400, Message: "linkPreview: false cannot be combined"}) {
		t.Error("an unrelated 400 was taken for an unreachable number")
	}

	if recipientUnreachable(&openwa.GatewayError{Status: 500, Message: gateway}) {
		t.Error("a 500 was taken for an unreachable number")
	}

	if recipientUnreachable(openwa.ErrNoConnectedSession) {
		t.Error("a dropped session was taken for an unreachable number")
	}
}

func TestCampaignsWaitADayAfterAnUnlink(t *testing.T) {
	now := time.Date(2026, 9, 17, 5, 0, 0, 0, time.UTC)
	hourAgo := now.Add(-time.Hour)
	dayAndHourAgo := now.Add(-25 * time.Hour)

	if _, blocked := campaignsBlockedUntil(nil, now); blocked {
		t.Error("no number must not block campaigns")
	}

	if _, blocked := campaignsBlockedUntil(&WANumber{}, now); blocked {
		t.Error("a number never unlinked must not block campaigns")
	}

	until, blocked := campaignsBlockedUntil(&WANumber{UnlinkedAt: &hourAgo}, now)
	if !blocked || !until.Equal(hourAgo.Add(24*time.Hour)) {
		t.Errorf("an hour after an unlink: blocked=%v until %s, want blocked until %s", blocked, until,
			hourAgo.Add(24*time.Hour))
	}

	if _, blocked := campaignsBlockedUntil(&WANumber{UnlinkedAt: &dayAndHourAgo}, now); blocked {
		t.Error("25 hours after an unlink campaigns must be allowed again")
	}

	// The hold belongs to the number that was unlinked.
	cases := []struct {
		name          string
		unlinked, now string
		wantBlocked   bool
	}{
		{"the unlinked number linked again", "9779805749767", "9779805749767", true},
		{"no number linked yet", "9779805749767", "", true},
		{"which number it was is not known", "", "9779709066745", true},
		{"a different number linked", "9779805749767", "9779709066745", false},
	}

	for _, c := range cases {
		settings := &WANumber{UnlinkedAt: &hourAgo, UnlinkedPhone: c.unlinked, LinkedPhone: c.now}
		if _, blocked := campaignsBlockedUntil(settings, now); blocked != c.wantBlocked {
			t.Errorf("%s: blocked = %v, want %v", c.name, blocked, c.wantBlocked)
		}
	}
}

func TestUnlinkCooldownMessageNamesTheNumber(t *testing.T) {
	at := time.Date(2026, 9, 17, 3, 26, 29, 0, time.UTC)
	until := at.Add(unlinkCooldown)

	msg := unlinkCooldownMessage(&WANumber{UnlinkedAt: &at, UnlinkedPhone: "9779805749767"}, until)
	for _, want := range []string{"9779805749767", "17 Sep at 9:11 AM Nepal time", "18 Sep at 9:11 AM Nepal time"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message %q does not contain %q", msg, want)
		}
	}

	if msg := unlinkCooldownMessage(&WANumber{UnlinkedAt: &at}, until); !strings.HasPrefix(msg, "This WhatsApp number was unlinked") {
		t.Errorf("without a recorded number the message reads %q", msg)
	}
}

func TestNepalClock(t *testing.T) {
	unlink := time.Date(2026, 9, 17, 3, 26, 29, 0, time.UTC)

	if got, want := nepalClock(unlink), "17 Sep at 9:11 AM Nepal time"; got != want {
		t.Errorf("nepalClock = %q, want %q", got, want)
	}
}
