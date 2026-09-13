package handlers

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// truncate feeds message previews into a Postgres parameter, so its output has
// to be valid UTF-8. A byte slice through a multi-byte character is not, and
// Postgres rejects the whole statement with "invalid byte sequence for encoding
// UTF8" — which took down the api_messages INSERT that was carrying it.
//
// This platform's messages are largely Nepali, where every Devanagari character
// is three bytes, so a preview a little over the limit hit a broken boundary
// almost every time.
func TestTruncateNeverProducesInvalidUTF8(t *testing.T) {
	cases := []struct {
		name string
		s    string
	}{
		{"devanagari", strings.Repeat("न", 70)},                   // 3 bytes each, 210 bytes
		{"devanagari with vowel signs", strings.Repeat("नम", 40)}, // mixed widths
		{"emoji", strings.Repeat("👍", 60)},                        // 4 bytes each
		{"mixed ascii and nepali", strings.Repeat("Order न ", 40)},
		{"ascii only", strings.Repeat("a", 300)},
	}

	for _, c := range cases {
		if !utf8.ValidString(c.s) {
			t.Fatalf("%s: the test input itself is not valid UTF-8", c.name)
		}

		got := truncate(c.s, 200)

		if !utf8.ValidString(got) {
			t.Errorf("%s: truncate produced invalid UTF-8 (%d bytes); Postgres rejects this parameter "+
				"and the insert carrying it fails", c.name, len(got))
		}

		if len(got) > 200 {
			t.Errorf("%s: truncate returned %d bytes, over the 200 budget", c.name, len(got))
		}
	}
}

// Cutting on a character boundary must not shorten anything that already fits,
// and must still shorten what does not.
func TestTruncateKeepsShortStringsWhole(t *testing.T) {
	short := "नमस्ते" // well under the limit
	if got := truncate(short, 200); got != short {
		t.Errorf("truncate(%q, 200) = %q, want it unchanged", short, got)
	}

	long := strings.Repeat("a", 250)
	if got := truncate(long, 200); len(got) != 200 {
		t.Errorf("truncate of a 250-byte ASCII string gave %d bytes, want 200", len(got))
	}
}
