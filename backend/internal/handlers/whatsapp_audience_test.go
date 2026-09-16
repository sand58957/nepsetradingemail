package handlers

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
)

// An empty filter is the create form's "leave empty to send to all opted-in
// contacts", in every shape the form or the database can store it.
func TestParseWAAudienceEmptyMeansEveryone(t *testing.T) {
	for _, raw := range []string{"", "null", "{}", "  {}  ", `{"tags":[],"groups":[]}`, `{"tags":null,"groups":null}`} {
		a, err := parseWAAudience(json.RawMessage(raw))
		if err != nil {
			t.Errorf("parseWAAudience(%q) failed: %v", raw, err)

			continue
		}

		if !a.everyone() {
			t.Errorf("parseWAAudience(%q) = %+v, want everyone", raw, a)
		}
	}
}

func TestParseWAAudienceReadsTagsAndGroups(t *testing.T) {
	a, err := parseWAAudience(json.RawMessage(`{"tags":[" vip ","ktm","vip",""],"groups":[3,"7",3]}`))
	if err != nil {
		t.Fatalf("parseWAAudience failed: %v", err)
	}

	if want := []string{"vip", "ktm"}; !reflect.DeepEqual(a.Tags, want) {
		t.Errorf("tags = %q, want %q (trimmed, blanks and repeats dropped)", a.Tags, want)
	}

	if want := []int{3, 7}; !reflect.DeepEqual(a.Groups, want) {
		t.Errorf("groups = %v, want %v (numeric strings accepted, repeats dropped)", a.Groups, want)
	}
}

// Reading a filter it doesn't understand as "everyone" is how a campaign aimed
// at one group reaches the whole list, so each of these has to be an error.
func TestParseWAAudienceRefusesWhatItCannotRead(t *testing.T) {
	for _, raw := range []string{
		`{"groups":["abc"]}`,
		`{"groups":[0]}`,
		`{"groups":[-2]}`,
		`{"groups":[1.5]}`,
		`{"tags":"vip"}`,
		`{"segment":"customers"}`,
		`[1,2]`,
		`{not json`,
	} {
		if a, err := parseWAAudience(json.RawMessage(raw)); err == nil {
			t.Errorf("parseWAAudience(%q) = %+v with no error; an unreadable audience must be refused, not widened", raw, a)
		}
	}
}

func TestUnreachedWhereWithoutAudienceIsEveryOptedInContact(t *testing.T) {
	where, args := waAudience{}.unreachedWhere()

	if len(args) != 0 {
		t.Errorf("args = %v, want none", args)
	}

	for _, want := range []string{"c.account_id = $1", "c.opted_in = true", "m.campaign_id = $2"} {
		if !strings.Contains(where, want) {
			t.Errorf("condition is missing %q:\n%s", want, where)
		}
	}

	if strings.Contains(where, "c.tags") || strings.Contains(where, "wa_contact_group_members") {
		t.Errorf("an empty audience added a tag or group condition:\n%s", where)
	}
}

// The audience's placeholders have to start after the account ($1) and the
// campaign ($2), and its arguments line up with them.
func TestUnreachedWhereNumbersAudienceArguments(t *testing.T) {
	where, args := waAudience{Tags: []string{"vip"}, Groups: []int{4}}.unreachedWhere()

	for _, want := range []string{"c.tags @> $3::jsonb", "ANY($4::int[])", " OR ", "g.account_id = c.account_id"} {
		if !strings.Contains(where, want) {
			t.Errorf("condition is missing %q:\n%s", want, where)
		}
	}

	if len(args) != 2 || args[0] != `["vip"]` {
		t.Errorf("args = %v, want the tag JSON then the group array", args)
	}

	where, args = waAudience{Groups: []int{4, 9}}.unreachedWhere()
	if !strings.Contains(where, "ANY($3::int[])") || len(args) != 1 {
		t.Errorf("a groups-only audience should use $3 and one argument; got %v:\n%s", args, where)
	}
}

// Every query that decides who a WhatsApp campaign goes to must use the
// audience helper. Five of them were once written out by hand, and none read
// the audience.
func TestWhatsAppRecipientQueriesGoThroughTheAudience(t *testing.T) {
	src, err := os.ReadFile("whatsapp.go")
	if err != nil {
		t.Fatalf("reading whatsapp.go: %v", err)
	}

	body := string(src)

	// The shape of a hand-written "who hasn't this campaign reached" query.
	if strings.Contains(body, "m.contact_id = c.id") {
		t.Error("whatsapp.go has its own unreached-contacts query; use countUnreached or unreachedContacts " +
			"so the campaign's audience is applied")
	}

	for _, call := range []struct {
		name  string
		atMin int
	}{
		{"h.countUnreached(", 5},
		{"h.unreachedContacts(", 1},
	} {
		if n := strings.Count(body, call.name); n < call.atMin {
			t.Errorf("%s is called %d times in whatsapp.go, want at least %d (campaign page, send, end of "+
				"phase, resume, analytics)", call.name, n, call.atMin)
		}
	}

	// Passing an empty audience to the helper is the original bug with extra steps.
	for _, line := range strings.Split(body, "\n") {
		if (strings.Contains(line, "h.countUnreached(") || strings.Contains(line, "h.unreachedContacts(")) &&
			strings.Contains(line, "waAudience{}") {
			t.Errorf("a recipient query is given an empty audience instead of the campaign's own: %s",
				strings.TrimSpace(line))
		}
	}
}

func TestParseConsentCell(t *testing.T) {
	cases := map[string]consentState{
		"yes": consentGiven, "Y": consentGiven, " TRUE ": consentGiven, "1": consentGiven, "opted in": consentGiven,
		"no": consentRefused, "N": consentRefused, "false": consentRefused, "0": consentRefused, "unsubscribed": consentRefused,
		"": consentUnknown, "maybe": consentUnknown, "2": consentUnknown,
	}

	for cell, want := range cases {
		if got := parseConsentCell(cell); got != want {
			t.Errorf("parseConsentCell(%q) = %d, want %d", cell, got, want)
		}
	}
}

func TestConsentConfirmedNeedsAnExplicitYes(t *testing.T) {
	for value, want := range map[string]bool{
		"true": true, "1": true, "on": true, "yes": true,
		"": false, "false": false, "0": false, "off": false, "maybe": false,
	} {
		if got := consentConfirmed(value); got != want {
			t.Errorf("consentConfirmed(%q) = %v, want %v", value, got, want)
		}
	}
}
