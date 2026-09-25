package openwa

import (
	"strings"
	"testing"
)

// Every one of these is the same handset. The forms with a leading 0 are how a
// Nepali mobile is written locally and how it comes out of most address books
// and CSV exports, so they arrive constantly.
//
// ChatID used to measure the length before stripping that 0, so "09805749767"
// stayed eleven digits, missed the country-code branch, and went to the gateway
// as 09805749767@c.us — an address that belongs to nobody. The send was accepted
// and the message went nowhere.
func TestChatIDNormalisesEveryFormOfTheSameNumber(t *testing.T) {
	const want = "9779805749767@c.us"

	for _, in := range []string{
		"9805749767",       // bare national
		"09805749767",      // national with trunk prefix
		"9779805749767",    // country code, no plus
		"+9779805749767",   // E.164
		"+977 9805749767",  // E.164 with a space
		"977-980-574-9767", // punctuated
		"009779805749767",  // international access prefix
		"0977 9805749767",  // trunk prefix in front of a country code
	} {
		got, err := ChatID(in)
		if err != nil {
			t.Errorf("ChatID(%q) returned an error: %v", in, err)

			continue
		}

		if got != want {
			t.Errorf("ChatID(%q) = %q, want %q — this addresses a different person", in, got, want)
		}
	}
}

func TestChatIDRejectsUnusableNumbers(t *testing.T) {
	for _, in := range []string{"", "980574976", "abc", "0"} {
		if got, err := ChatID(in); err == nil {
			t.Errorf("ChatID(%q) = %q, want an error", in, got)
		}
	}
}

// The three parts are concatenated into one plain-text message and share one
// parameter list, so a placeholder in the header or footer has to be filled from
// that same list. Only the body was substituted, which shipped headers reading
// "Hi {{1}}" to real recipients.
func TestRenderTemplateFillsHeaderAndFooterToo(t *testing.T) {
	got := RenderTemplate("Hi {{1}}", "Your order {{2}} is ready.", "-- {{1}}", []string{"Sandeep", "A42"})
	want := "Hi Sandeep\n\nYour order A42 is ready.\n\n-- Sandeep"

	if got != want {
		t.Errorf("RenderTemplate() = %q, want %q", got, want)
	}
}

// A placeholder with no matching parameter is left as-is rather than blanked, so
// the gap is visible to whoever is testing the template instead of silently
// producing a sentence with a hole in it.
func TestRenderTemplateLeavesUnmatchedPlaceholders(t *testing.T) {
	got := RenderTemplate("", "A {{1}} and a {{3}}.", "", []string{"one"})
	want := "A one and a {{3}}."

	if got != want {
		t.Errorf("RenderTemplate() = %q, want %q", got, want)
	}
}

// A number that can't be addressed is reported as that number's problem, with a
// type callers can recognise, so a campaign can fail the one message and carry on
// instead of taking it for the session going down.
func TestChatIDReportsAnUnusableNumberAsInvalidPhone(t *testing.T) {
	for _, in := range []string{"8.21064E11", "12345", "", "98057"} {
		_, err := ChatID(in)
		if err == nil {
			t.Errorf("ChatID(%q) accepted an unusable number", in)

			continue
		}

		if !IsInvalidPhone(err) {
			t.Errorf("ChatID(%q) = %v, which IsInvalidPhone does not recognise", in, err)
		}

		if want := "is not a usable phone number"; !strings.Contains(err.Error(), want) {
			t.Errorf("ChatID(%q) error %q no longer says %q", in, err, want)
		}
	}

	if IsInvalidPhone(ErrNoConnectedSession) {
		t.Error("a dropped session was taken for an invalid phone number")
	}
}
