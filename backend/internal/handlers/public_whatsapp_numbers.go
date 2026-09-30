package handlers

import (
	"errors"
	"fmt"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

// Which number a WhatsApp API message goes out from.
//
// The API used to read the account's one session from wa_settings, so after an
// account linked several numbers only its default could be reached through the
// API. Now, in order: the number the request names in "from", else the number
// the API key is set to send from (api_keys.wa_number_id, migration 036), else
// the account's default number. Every lookup stays inside the key's account.

// errFromNotOnAccount says a request's "from" is not one of the account's numbers.
var errFromNotOnAccount = errors.New("from is not one of this account's WhatsApp numbers")

// apiSendingNumber returns the number an API message sends from, or nil when the
// account has no number at all (reported to the caller as the channel being
// unavailable).
func apiSendingNumber(wa *WhatsAppHandler, accountID, keyID int, from string) (*WANumber, error) {
	numbers, err := wa.numbersOf(accountID)
	if err != nil {
		return nil, err
	}

	if from != "" {
		want, idErr := openwa.ChatID(from)
		if idErr != nil {
			return nil, errFromNotOnAccount
		}

		for i := range numbers {
			if have, err := openwa.ChatID(numbers[i].LinkedPhone); err == nil && have == want {
				return &numbers[i], nil
			}
		}

		return nil, errFromNotOnAccount
	}

	var keyNumber *int
	wa.db.Get(&keyNumber, `SELECT wa_number_id FROM api_keys WHERE id = $1 AND account_id = $2`, keyID, accountID)

	if keyNumber != nil {
		for i := range numbers {
			if numbers[i].ID == *keyNumber {
				return &numbers[i], nil
			}
		}
	}

	// numbersOf lists the default first.
	if len(numbers) > 0 {
		return &numbers[0], nil
	}

	return nil, nil
}

// fromNotOnAccountMessage lists the numbers a caller may put in "from".
func fromNotOnAccountMessage(wa *WhatsAppHandler, accountID int) string {
	numbers, _ := wa.numbersOf(accountID)

	phones := ""
	for _, n := range numbers {
		if n.LinkedPhone == "" {
			continue
		}

		if phones != "" {
			phones += ", "
		}

		phones += n.LinkedPhone
	}

	if phones == "" {
		return "This account has no linked WhatsApp number to send from."
	}

	return fmt.Sprintf("\"from\" must be one of this account's linked WhatsApp numbers: %s. Leave it out to send "+
		"from the number the key is set to.", phones)
}
