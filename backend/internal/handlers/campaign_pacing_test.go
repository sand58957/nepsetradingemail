package handlers

import (
	"os"
	"strings"
	"testing"
	"time"
)

// The send dialog posts interval_seconds in both modes, so the mode — not the
// presence of the field — has to decide whether it is used. Taking it whatever
// the mode paced a 500-contact batch at the continuous default of 30 seconds:
// four hours, where the dialog promises about four minutes.
func TestResolveSendIntervalIgnoresTheFieldInBatchMode(t *testing.T) {
	for _, requested := range []int{0, 1, 30, 600, 3600, 99999, -5} {
		if got := resolveSendInterval(false, requested); got != 0 {
			t.Errorf("resolveSendInterval(false, %d) = %d, want 0 — a batch run must use the "+
				"batch gap, not the continuous interval", requested, got)
		}
	}
}

func TestResolveSendIntervalClampsContinuousMode(t *testing.T) {
	cases := []struct {
		requested int
		want      int
		why       string
	}{
		{0, defaultIntervalSeconds, "unset falls back to the default"},
		{-1, defaultIntervalSeconds, "negative falls back to the default"},
		{1, minIntervalSeconds, "below the minimum is raised to it"},
		{29, minIntervalSeconds, "just below the minimum is raised to it"},
		{30, 30, "the minimum is allowed"},
		{600, 600, "an ordinary value passes through"},
		{3600, 3600, "the maximum is allowed"},
		{3601, maxIntervalSeconds, "above the maximum is clamped"},
		{1 << 40, maxIntervalSeconds, "a value that would overflow the duration is clamped"},
	}

	for _, c := range cases {
		if got := resolveSendInterval(true, c.requested); got != c.want {
			t.Errorf("resolveSendInterval(true, %d) = %d, want %d (%s)", c.requested, got, c.want, c.why)
		}
	}
}

// time.NewTicker panics on a non-positive duration and the send loop runs in a
// bare goroutine with no recover above it, so a bad interval would take the whole
// process down rather than one campaign. Every value the resolver can return must
// therefore produce a positive duration.
func TestEveryResolvedIntervalMakesAPositiveTicker(t *testing.T) {
	for _, requested := range []int{-1 << 40, -1, 0, 1, 3600, 1 << 40} {
		seconds := resolveSendInterval(true, requested)

		gap := time.Duration(seconds) * time.Second
		if gap <= 0 {
			t.Errorf("resolveSendInterval(true, %d) = %d gives a %s ticker interval; "+
				"time.NewTicker panics on that and would kill the process", requested, seconds, gap)
		}
	}
}

// A campaign that stopped has to be startable again — who was already reached is
// recorded in wa_campaign_messages, so resuming never re-messages anyone. When
// 'failed' was excluded, five code paths could set it and nothing could clear it:
// the only way out was deleting the campaign, which cascades its message rows away
// and re-messages every contact already reached.
func TestSendCampaignAcceptsEveryStoppedStatus(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	start := strings.Index(body, "func (h *WhatsAppHandler) SendCampaign")
	if start < 0 {
		t.Fatal("SendCampaign not found")
	}

	guard := body[start : start+2000]

	for _, status := range []string{"draft", "paused", "failed"} {
		if !strings.Contains(guard, `"`+status+`"`) {
			t.Errorf("SendCampaign does not admit a %q campaign; a campaign in that state "+
				"cannot be continued and its remaining contacts are unreachable", status)
		}
	}
}

// Stopping because the number went offline, or because sends started failing in a
// row, is the safety valve doing its job — not the campaign failing. Both park the
// campaign so it can be continued once the number is back.
func TestTransientStopsParkRatherThanFail(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	for _, site := range []struct {
		name   string
		marker string
	}{
		{"the pre-flight session check", "no number can send, parked at paused"},
		{"the consecutive-failure abort", "sends failed in a row, stopping with"},
	} {
		at := strings.Index(body, site.marker)
		if at < 0 {
			t.Errorf("could not find %s; if its log line changed, update this test", site.name)

			continue
		}

		window := body[at:min(at+600, len(body))]
		if strings.Contains(window, "status='failed'") || strings.Contains(window, "status = 'failed'") {
			t.Errorf("%s marks the campaign failed. It is a recoverable stop and should park "+
				"the campaign at paused so the remaining contacts can still be reached.", site.name)
		}
	}
}
