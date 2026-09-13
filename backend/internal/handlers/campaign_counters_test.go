package handlers

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// A WhatsApp campaign is delivered in phases, so wa_campaigns.sent_count and
// failed_count accumulate across every phase. Every write to them therefore has
// to add, never assign.
//
// The periodic progress flush inside the send loop assigned instead, and it fired
// whenever the running total hit a multiple of 50. With a 50-recipient phase it
// fired exactly once, set the counters to that phase's totals, and then the write
// at the end of the phase added the same totals again: a phase that sent 44 and
// failed 6 was recorded as 88 sent and 12 failed. Assigning was independently
// wrong, because it discarded whatever earlier phases had already recorded.
func TestCampaignCounterWritesAccumulateRatherThanAssign(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	// Any SET of sent_count/failed_count, however the statement is wrapped.
	assignment := regexp.MustCompile(`(sent_count|failed_count)\s*=\s*\$\d`)

	if m := assignment.FindAllString(string(src), -1); len(m) > 0 {
		t.Errorf("whatsapp.go assigns a campaign counter directly (%s). Phase totals accumulate, "+
			"so this both discards earlier phases and double-counts against the accumulating "+
			"write at the end of the phase.", strings.Join(m, ", "))
	}

	// And the accumulating form must actually be present, so this test cannot pass
	// merely because the counter writes were removed.
	if !strings.Contains(string(src), "sent_count = COALESCE(sent_count, 0) + $1") {
		t.Error("whatsapp.go no longer contains an accumulating sent_count write; " +
			"campaign progress would never be recorded")
	}
}

// Both early exits from the send loop — the user pausing mid-phase, and the
// consecutive-failure abort — used to return without recording what the phase had
// already sent, so those messages existed as wa_campaign_messages rows but never
// reached the campaign's totals.
func TestCampaignSendLoopFlushesCountersBeforeEveryEarlyReturn(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	start := strings.Index(body, "flushCounters := func()")
	if start < 0 {
		t.Fatal("the campaign sender no longer has a flushCounters helper")
	}

	end := strings.Index(body[start:], "\nfunc ")
	if end < 0 {
		end = len(body) - start
	}

	sender := body[start : start+end]

	// Each of these is a documented exit point that must record progress first.
	for _, exit := range []struct {
		name   string
		marker string
	}{
		// Located by log text rather than by the SQL they run, so that changing what
		// status they write does not silently stop this test finding them.
		{"user paused or cancelled mid-phase", `%s by user", campaignID, status)`},
		{"consecutive-failure abort", `sends failed in a row, stopping with`},
	} {
		at := strings.Index(sender, exit.marker)
		if at < 0 {
			t.Errorf("could not find the %s exit; if it was renamed, update this test", exit.name)

			continue
		}

		// flushCounters must appear within a few lines either side of the exit.
		lo := max(at-400, 0)
		hi := min(at+400, len(sender))

		if !strings.Contains(sender[lo:hi], "flushCounters()") {
			t.Errorf("the %s exit does not call flushCounters, so messages already sent in "+
				"this phase are dropped from the campaign totals", exit.name)
		}
	}
}
