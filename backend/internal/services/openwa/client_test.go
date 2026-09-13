package openwa

import "testing"

// Phone formats arrive from contact imports, OTP forms and the API in whatever
// shape the user typed. Getting the country code wrong sends the message to the
// wrong person, or nobody.
func TestChatID(t *testing.T) {
	ok := []struct{ in, want string }{
		{"+977 9708072951", "9779708072951@c.us"},  // the test number, as written
		{"9779708072951", "9779708072951@c.us"},    // already country-coded
		{"9708072951", "9779708072951@c.us"},       // local ten-digit Nepali mobile
		{"00977-9708072951", "9779708072951@c.us"}, // international access prefix
		{"977 (970) 807-2951", "9779708072951@c.us"},
		{"15558649878", "15558649878@c.us"}, // a US number must be left alone
	}
	for _, c := range ok {
		got, err := ChatID(c.in)
		if err != nil {
			t.Errorf("ChatID(%q) returned %v", c.in, err)

			continue
		}

		if got != c.want {
			t.Errorf("ChatID(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	bad := []string{"", "12345", "abc", "+977", "1234567890123456789"}
	for _, in := range bad {
		if got, err := ChatID(in); err == nil {
			t.Errorf("ChatID(%q) = %q, want an error", in, got)
		}
	}
}

// A ten-digit local number must not be mistaken for an already-coded one.
func TestChatIDDoesNotDoubleCodeNepaliNumbers(t *testing.T) {
	local, _ := ChatID("9708072951")
	coded, _ := ChatID("9779708072951")

	if local != coded {
		t.Errorf("local %q and country-coded %q should resolve to the same chat id", local, coded)
	}
}

func TestUnconfiguredClientFailsClearly(t *testing.T) {
	for _, c := range []*Client{NewClient("", "key"), NewClient("http://x", "")} {
		if _, err := c.ListSessions(t.Context()); err != ErrNotConfigured {
			t.Errorf("expected ErrNotConfigured, got %v", err)
		}
	}
}

func TestSessionConnected(t *testing.T) {
	if !(Session{Status: StatusConnected}).Connected() {
		t.Error("a connected session should report Connected()")
	}

	for _, s := range []string{"created", "qr_ready", "disconnected", "failed", "stopped"} {
		if (Session{Status: s}).Connected() {
			t.Errorf("status %q should not report Connected()", s)
		}
	}
}

func TestRenderTemplate(t *testing.T) {
	got := RenderTemplate("Nepal Fillings", "Hello {{1}}, your order {{2}} has shipped.", "Reply STOP to opt out.",
		[]string{"Sandeep", "NF-1042"})
	want := "Nepal Fillings\n\nHello Sandeep, your order NF-1042 has shipped.\n\nReply STOP to opt out."

	if got != want {
		t.Errorf("RenderTemplate() =\n%q\nwant\n%q", got, want)
	}
}

// A campaign with too few parameters should show the gap, not silently drop words.
func TestRenderTemplateLeavesUnfilledPlaceholdersVisible(t *testing.T) {
	got := RenderTemplate("", "Hi {{1}}, see you on {{2}}.", "", []string{"Sandeep"})
	if got != "Hi Sandeep, see you on {{2}}." {
		t.Errorf("unexpected render: %q", got)
	}
}

func TestRenderTemplateOmitsEmptySections(t *testing.T) {
	if got := RenderTemplate("", "Just a body.", "", nil); got != "Just a body." {
		t.Errorf("got %q, want just the body with no blank lines", got)
	}
}
