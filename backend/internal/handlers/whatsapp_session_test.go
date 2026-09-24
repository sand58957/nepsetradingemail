package handlers

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// The one rule that makes per-account WhatsApp numbers safe: a handler acts on
// the session recorded for the authenticated account, and never on a session id
// supplied by the caller. Accept one from the request — a path parameter, a body
// field, a query string — and any tenant can drive any other tenant's number by
// guessing a UUID: send as them, read their QR, unlink their phone.
//
// So this checks the shape rather than the behaviour: no route in this file may
// read a session id from the request at all.
func TestNoSessionEndpointTakesASessionIDFromTheCaller(t *testing.T) {
	src, err := os.ReadFile("whatsapp_session.go")
	if err != nil {
		t.Fatalf("reading whatsapp_session.go: %v", err)
	}

	body := string(src)

	// c.Param / c.QueryParam / c.FormValue reading anything id-shaped.
	fromRequest := regexp.MustCompile(`c\.(Param|QueryParam|FormValue)\(\s*"[^"]*(?i:id|session)[^"]*"\s*\)`)
	if found := fromRequest.FindAllString(body, -1); len(found) > 0 {
		t.Errorf("a session handler reads an identifier from the request (%s). Every tenant could then "+
			"address another tenant's WhatsApp session by guessing its id.", strings.Join(found, ", "))
	}

	// A bound request struct carrying a session id would do the same thing.
	bindsSessionID := regexp.MustCompile(`(?i)SessionID\s+string\s+` + "`" + `json:`)
	if bindsSessionID.MatchString(body) {
		t.Error("a request struct binds a session id from JSON; the session must come from " +
			"wa_settings for the authenticated account instead")
	}

	// And the positive half: every handler must go through the account lookup.
	handlers := []string{
		"GetMySession", "CreateMySession", "StartMySession",
		"GetMyQR", "LogoutMySession", "DeleteMySession", "TestMySession",
	}

	for _, name := range handlers {
		at := strings.Index(body, "func (h *WhatsAppHandler) "+name+"(")
		if at < 0 {
			t.Errorf("%s not found", name)

			continue
		}

		end := strings.Index(body[at+1:], "\nfunc ")
		if end < 0 {
			end = len(body) - at - 1
		}

		fn := body[at : at+1+end]

		if !strings.Contains(fn, "h.mySessionID(accountID)") {
			t.Errorf("%s does not resolve the session via mySessionID(accountID); it must not act on "+
				"any session other than the authenticated account's", name)
		}
	}
}

// Creating, linking and unlinking change who can send as a phone number, so they
// need more than membership. Reading the current state does not.
func TestMutatingSessionEndpointsRequireAnAccountManager(t *testing.T) {
	src, err := os.ReadFile("whatsapp_session.go")
	if err != nil {
		t.Fatalf("reading whatsapp_session.go: %v", err)
	}

	body := string(src)

	mustGuard := []string{
		"CreateMySession", "StartMySession", "GetMyQR",
		"LogoutMySession", "DeleteMySession", "TestMySession",
	}

	for _, name := range mustGuard {
		at := strings.Index(body, "func (h *WhatsAppHandler) "+name+"(")
		if at < 0 {
			t.Errorf("%s not found", name)

			continue
		}

		// The guard is the first thing the handler does.
		head := body[at:min(at+240, len(body))]
		if !strings.Contains(head, "h.accountManager(c)") {
			t.Errorf("%s does not check accountManager first, so any member of the account — or worse, "+
				"any signed-in user — could change which phone number it sends from", name)
		}
	}
}

// The send path must not fall back to somebody else's number. It used to adopt
// whichever gateway session happened to be ready, which with per-account numbers
// means an account with none of its own sends from another account's phone and
// the replies arrive in that account's inbox.
func TestSendPathDoesNotBorrowAnotherAccountsSession(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	at := strings.Index(body, "func (h *WhatsAppHandler) getClient")
	if at < 0 {
		t.Fatal("getClient not found")
	}

	end := strings.Index(body[at:], "\n}\n")
	if end < 0 {
		t.Fatal("could not bound getClient")
	}

	fn := body[at : at+end]

	if strings.Contains(fn, "FirstConnectedSession") {
		t.Error("getClient adopts the first ready gateway session again. That is another tenant's " +
			"number: their phone sends the message and their inbox gets the reply.")
	}
}

// The per-number endpoints take an id from the URL, which is safe only because it
// is this table's own id looked up inside the caller's account. They must never
// read a gateway session id from the request, and every handler that acts on one
// number must resolve it through numberFromRequest.
func TestNumberEndpointsResolveTheNumberInsideTheAccount(t *testing.T) {
	src, err := os.ReadFile("whatsapp_numbers.go")
	if err != nil {
		t.Fatalf("reading whatsapp_numbers.go: %v", err)
	}

	body := string(src)

	fromRequest := regexp.MustCompile(`c\.(Param|QueryParam|FormValue)\(\s*"[^"]*(?i:session)[^"]*"\s*\)`)
	if found := fromRequest.FindAllString(body, -1); len(found) > 0 {
		t.Errorf("a number handler reads a session id from the request (%s)", strings.Join(found, ", "))
	}

	if regexp.MustCompile(`(?i)SessionID\s+\*?string\s+` + "`" + `json:"[a-z_]+"`).MatchString(body) {
		t.Error("a request struct binds a gateway session id from JSON")
	}

	for _, name := range []string{
		"GetMyNumberQR", "StartMyNumber", "RenameMyNumber", "SetMyDefaultNumber",
		"LogoutMyNumber", "DeleteMyNumber", "TestMyNumber",
	} {
		at := strings.Index(body, "func (h *WhatsAppHandler) "+name+"(")
		if at < 0 {
			t.Errorf("%s not found", name)

			continue
		}

		end := strings.Index(body[at+1:], "\nfunc ")
		if end < 0 {
			end = len(body) - at - 1
		}

		fn := body[at : at+1+end]

		if !strings.Contains(fn, "h.numberFromRequest(c)") {
			t.Errorf("%s does not resolve its number with numberFromRequest, so it could act on another "+
				"account's number", name)
		}

		if !strings.Contains(fn[:min(len(fn), 240)], "h.accountManager(c)") {
			t.Errorf("%s does not check accountManager first", name)
		}
	}
}
