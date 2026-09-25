package handlers

import (
	"errors"
	"fmt"
	"testing"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

func TestCleanContactPhone(t *testing.T) {
	cases := []struct {
		in, want    string
		spreadsheet bool
		invalid     bool
	}{
		{in: "9805749767", want: "9805749767"},
		{in: " +977-980-574-9767 ", want: "9779805749767"},
		{in: "9805749767.0", want: "9805749767"}, // Excel wrote a whole number as a decimal
		{in: "9779805749767.00", want: "9779805749767"},
		{in: "8.21064E11", spreadsheet: true},     // what stopped the campaigns: digits lost
		{in: "9.80574977E+09", spreadsheet: true}, // still 11 digits long, so length alone would pass it
		{in: "9.80574977e+09", spreadsheet: true},
		{in: "12345", invalid: true},
		{in: "", invalid: true},
	}

	for _, c := range cases {
		got, err := cleanContactPhone(c.in)

		switch {
		case c.spreadsheet:
			if !errors.Is(err, errSpreadsheetPhone) {
				t.Errorf("cleanContactPhone(%q) = %q, %v; want the spreadsheet error", c.in, got, err)
			}
		case c.invalid:
			if !openwa.IsInvalidPhone(err) {
				t.Errorf("cleanContactPhone(%q) = %q, %v; want an invalid phone error", c.in, got, err)
			}
		default:
			if err != nil || got != c.want {
				t.Errorf("cleanContactPhone(%q) = %q, %v; want %q", c.in, got, err, c.want)
			}
		}
	}
}

// A number that can't be addressed is the recipient's problem: the campaign fails
// that one message, marks the contact, and carries on.
func TestAnUnusablePhoneIsTheRecipientsProblem(t *testing.T) {
	_, err := openwa.ChatID("8.21064E11")

	if !recipientRejected(err) {
		t.Error("an unusable phone number stops the campaign as if the connection had dropped")
	}

	if !recipientUnreachable(err) {
		t.Error("an unusable phone number is not marked, so every campaign would try it again")
	}

	wrapped := fmt.Errorf("sending: %w", err)
	if !recipientRejected(wrapped) {
		t.Error("a wrapped unusable phone number is not recognised")
	}
}
