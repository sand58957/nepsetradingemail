package handlers

import (
	"os"
	"strings"
	"testing"
)

// CheckWhatsAppConfigured runs before the send path, and the send path is what
// assigns an account its gateway session. Requiring openwa_session_id to be set
// here therefore made the two depend on each other: the check refused because the
// id was empty, the id stayed empty because the send never ran, and the account
// could never send. Only the two accounts that happened to have been set up by
// hand worked; every other tenant was told WhatsApp was not connected.
func TestConfiguredCheckDoesNotDependOnTheSessionItGates(t *testing.T) {
	src, err := os.ReadFile("credits.go")
	if err != nil {
		t.Fatalf("reading credits.go: %v", err)
	}

	body := string(src)

	start := strings.Index(body, "func CheckWhatsAppConfigured")
	if start < 0 {
		t.Fatal("CheckWhatsAppConfigured not found")
	}

	end := strings.Index(body[start:], "\n}\n")
	if end < 0 {
		t.Fatal("could not bound CheckWhatsAppConfigured")
	}

	fn := body[start : start+end]

	if strings.Contains(fn, "openwa_session_id") {
		t.Error("CheckWhatsAppConfigured reads openwa_session_id again. That column is only written " +
			"by the send path this check gates, so an account that has never sent can never start.")
	}
}

// Every account gets its settings row on demand. It used to appear only when
// someone saved the settings form, so in practice two accounts out of forty had
// one and the rest were refused outright.
func TestWhatsAppSettingsRowIsCreatedOnDemand(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	if !strings.Contains(body, "INSERT INTO wa_settings (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING") {
		t.Error("waSettings no longer creates a missing row; accounts that have never opened " +
			"WhatsApp settings will be refused the channel")
	}

	// The two readers that must go through it rather than querying directly.
	for _, caller := range []string{"func (h *WhatsAppHandler) getClient", "func (h *WhatsAppHandler) GetSettings"} {
		at := strings.Index(body, caller)
		if at < 0 {
			t.Errorf("%s not found", caller)

			continue
		}

		window := body[at:min(at+900, len(body))]
		if !strings.Contains(window, "h.waSettings(") {
			t.Errorf("%s reads wa_settings directly instead of via waSettings, so it will fail "+
				"for an account that has no row yet", caller)
		}
	}
}
