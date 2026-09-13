package handlers

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// The public send handlers insert an api_messages row and reserve a credit
// before they know whether the send will succeed. Every failure path after that
// point therefore owes two things: hand the credit back, and close out the row
// it already wrote.
//
// Skipping the second one is invisible in review and in the happy path, and it
// shipped: rendering WhatsApp templates locally (rather than passing a name to
// Meta, as the Gupshup integration did) introduced a template lookup between the
// INSERT and the send, and the not-found branch refunded the credit and returned
// 400 without touching the row. Those rows sat at 'sending' for ever, still
// reporting credits_charged = 1 for a credit that had just been returned, and
// GET /messages served that to the caller.
//
// These are source-level checks rather than handler tests because the defect is
// a missing statement, not wrong behaviour in a statement that exists.

var publicAPIHandlers = []string{
	"public_whatsapp_api.go",
	"public_sms_api.go",
	"public_email_api.go",
}

func readHandlerSource(t *testing.T, name string) string {
	t.Helper()

	src, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("reading %s: %v", name, err)
	}

	return string(src)
}

// A row marked failed had its credit refunded, so the column the API reports as
// credits_charged has to say zero. Leaving it at the reserved amount overstates
// what the caller spent, and a caller reconciling GET /messages against their
// balance finds a discrepancy they cannot explain.
func TestFailedMessageRowsClearCreditsCharged(t *testing.T) {
	failedUpdate := regexp.MustCompile(`UPDATE api_messages SET status = 'failed'[^` + "`" + `]*`)

	for _, name := range publicAPIHandlers {
		src := readHandlerSource(t, name)

		matches := failedUpdate.FindAllString(src, -1)
		if len(matches) == 0 {
			t.Errorf("%s: no 'failed' row update found at all; did the send path change?", name)

			continue
		}

		for _, stmt := range matches {
			if !strings.Contains(stmt, "credits_charged = 0") {
				t.Errorf("%s: a failed-row update does not zero credits_charged, so the row "+
					"keeps claiming a credit that was refunded:\n\t%s", name, strings.TrimSpace(stmt))
			}
		}
	}
}

// Once the row exists, no failure path may return without closing it. This walks
// the WhatsApp Send handler specifically, because that is where the regression
// happened and where the template lookup still sits between the insert and the
// send.
func TestWhatsAppSendClosesItsRowOnEveryRefund(t *testing.T) {
	src := readHandlerSource(t, "public_whatsapp_api.go")

	insert := strings.Index(src, `INSERT INTO api_messages`)
	if insert < 0 {
		t.Fatal("no api_messages insert in public_whatsapp_api.go")
	}

	// Bound the search at the bulk handler so this only covers single Send.
	end := strings.Index(src, "func (h *PublicWhatsAppHandler) SendBulk")
	if end < 0 || end <= insert {
		t.Fatal("could not locate SendBulk to bound the single-send handler")
	}

	body := src[insert:end]
	lines := strings.Split(body, "\n")

	for i, line := range lines {
		if !strings.Contains(line, "RefundCredit(") {
			continue
		}

		// The branch taken when the insert itself failed is the one case with no
		// row to close — that refund is correct on its own.
		if strings.Contains(strings.Join(lines[max(i-4, 0):i], "\n"), `Scan(&msgID); err != nil`) {
			continue
		}

		// Elsewhere the refund and the row update are written adjacent to each
		// other; allow a few lines for the comment and a wrapped SQL string.
		window := strings.Join(lines[i:min(i+12, len(lines))], "\n")
		if !strings.Contains(window, "UPDATE api_messages") {
			t.Errorf("public_whatsapp_api.go: a RefundCredit call after the api_messages "+
				"insert does not close out the row, which strands it at 'sending' for ever:\n\t%s",
				strings.TrimSpace(line))
		}
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}

	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}

	return b
}
