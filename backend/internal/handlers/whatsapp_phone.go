package handlers

import (
	"errors"
	"regexp"
	"strings"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

// Phone numbers as they arrive from a form or a spreadsheet.
//
// Spreadsheets damage long numbers. Excel shows 821064xxxxxx as 8.21064E+11 and,
// when the file is saved as CSV, writes that text instead of the number: the last
// six digits are gone for good. Four contacts imported that way stopped three
// campaigns on 25 September 2026. Worse, a damaged number can still have ten or
// more digits left (9.80574977E+09 keeps 98057497709), so a length check alone
// would accept it and the message would go to a stranger. So a number in
// scientific notation is refused outright, with a reason the operator can act on.

// scientificNotation matches a number a spreadsheet turned into scientific
// notation, e.g. 9.80574977E+09.
var scientificNotation = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?[eE]\+?[0-9]+$`)

// wholeNumberAsDecimal matches a whole number a spreadsheet wrote as a decimal,
// e.g. 9805749767.0. Nothing is lost there, so it is repaired rather than refused.
var wholeNumberAsDecimal = regexp.MustCompile(`^([0-9]+)\.0+$`)

// errSpreadsheetPhone says a phone number was mangled into scientific notation.
var errSpreadsheetPhone = errors.New("this number was turned into scientific notation by a spreadsheet " +
	"and its last digits are lost — format the phone column as Text and export again")

// cleanContactPhone tidies a phone number the way contacts have always been stored
// (no spaces, dashes or plus sign) and refuses one that can't be messaged: a
// number in scientific notation, or one WhatsApp can't address (openwa.ChatID).
func cleanContactPhone(raw string) (string, error) {
	phone := strings.TrimSpace(raw)
	phone = strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(phone, " ", ""), "-", ""), "+", "")

	if m := wholeNumberAsDecimal.FindStringSubmatch(phone); m != nil {
		phone = m[1]
	}

	if scientificNotation.MatchString(phone) {
		return "", errSpreadsheetPhone
	}

	if _, err := openwa.ChatID(phone); err != nil {
		return "", err
	}

	return phone, nil
}
