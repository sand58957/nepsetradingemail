package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/lib/pq"
)

// waAudience is who a WhatsApp campaign is addressed to: the groups and tags
// picked on the create form. With neither set it is every opted-in contact,
// which is what that form promises when both are left empty.
//
// Every query that decides who a campaign still has to reach goes through
// unreachedWhere. Those queries used to be written out separately, and none of
// them read target_filter at all, so a campaign aimed at one group messaged the
// account's entire opted-in list, from a linked number that gets restricted for
// exactly that.
type waAudience struct {
	Tags   []string
	Groups []int
}

func (a waAudience) everyone() bool {
	return len(a.Tags) == 0 && len(a.Groups) == 0
}

// parseWAAudience reads a campaign's stored target_filter.
//
// It is strict on purpose. A filter that cannot be read is an error the caller
// refuses to send on, never a reason to fall back to everyone: widening an
// audience is the one mistake here that cannot be taken back.
func parseWAAudience(raw json.RawMessage) (waAudience, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return waAudience{}, nil
	}

	var stored struct {
		Tags   []string          `json:"tags"`
		Groups []json.RawMessage `json:"groups"`
	}

	dec := json.NewDecoder(bytes.NewReader(trimmed))
	// A key this code does not understand is a narrowing it would silently
	// ignore, which is the same as widening the audience.
	dec.DisallowUnknownFields()

	if err := dec.Decode(&stored); err != nil {
		return waAudience{}, fmt.Errorf("the audience filter could not be read: %w", err)
	}

	var a waAudience

	seenTag := make(map[string]bool, len(stored.Tags))
	for _, tag := range stored.Tags {
		tag = strings.TrimSpace(tag)
		if tag == "" || seenTag[tag] {
			continue
		}

		seenTag[tag] = true
		a.Tags = append(a.Tags, tag)
	}

	seenGroup := make(map[int]bool, len(stored.Groups))
	for _, g := range stored.Groups {
		// The form sends numbers. Accept a numeric string as well rather than
		// refusing a filter written by hand or by an older client.
		id, err := strconv.Atoi(strings.Trim(string(g), `"`))
		if err != nil || id <= 0 {
			return waAudience{}, fmt.Errorf("the audience filter names group %s, which is not a group id", g)
		}

		if !seenGroup[id] {
			seenGroup[id] = true
			a.Groups = append(a.Groups, id)
		}
	}

	return a, nil
}

// unreachedWhere is the condition, over wa_contacts aliased c, for the opted-in
// contacts in the audience that the campaign has not messaged yet.
//
// $1 is the account and $2 the campaign. The audience's own arguments follow
// those two and are returned for the caller to append.
//
// Tags and groups widen each other: a contact is in the audience if it carries
// every chosen tag, or belongs to any chosen group.
//
// A contact whose number WhatsApp recently could not resolve is left out: another
// attempt would fail the same way, and each one counts against the sending number
// (whatsapp_link_safety.go).
func (a waAudience) unreachedWhere() (string, []interface{}) {
	where := `c.account_id = $1 AND c.opted_in = true
		AND (c.unreachable_at IS NULL OR c.unreachable_at < NOW() - INTERVAL '` + unreachableSkipSQL + `')
		AND NOT EXISTS (
			SELECT 1 FROM wa_campaign_messages m
			WHERE m.campaign_id = $2 AND m.contact_id = c.id
		)`

	var (
		matches []string
		args    []interface{}
	)

	if len(a.Tags) > 0 {
		tagJSON, _ := json.Marshal(a.Tags)
		args = append(args, string(tagJSON))
		matches = append(matches, fmt.Sprintf("c.tags @> $%d::jsonb", len(args)+2))
	}

	if len(a.Groups) > 0 {
		args = append(args, pq.Array(a.Groups))
		// The group has to belong to the contact's own account, so a group id from
		// another account can never pull anyone in.
		matches = append(matches, fmt.Sprintf(`EXISTS (
			SELECT 1 FROM wa_contact_group_members gm
			JOIN wa_contact_groups g ON g.id = gm.group_id
			WHERE gm.contact_id = c.id AND g.account_id = c.account_id
			  AND gm.group_id = ANY($%d::int[])
		)`, len(args)+2))
	}

	if len(matches) > 0 {
		where += "\n\t\tAND (" + strings.Join(matches, " OR ") + ")"
	}

	return where, args
}

// countUnreached counts the contacts a campaign still has to reach.
func (h *WhatsAppHandler) countUnreached(accountID, campaignID int, a waAudience) (int, error) {
	where, extra := a.unreachedWhere()

	var n int
	err := h.db.Get(&n, "SELECT COUNT(*) FROM wa_contacts c WHERE "+where,
		append([]interface{}{accountID, campaignID}, extra...)...)

	return n, err
}

// unreachedContacts lists the contacts a campaign still has to reach, oldest
// first. A limit of zero or less returns all of them.
func (h *WhatsAppHandler) unreachedContacts(accountID, campaignID int, a waAudience, limit int) ([]WAContact, error) {
	where, extra := a.unreachedWhere()

	query := "SELECT c.* FROM wa_contacts c WHERE " + where + "\n\t\tORDER BY c.id"
	if limit > 0 {
		query += " LIMIT " + strconv.Itoa(limit)
	}

	var contacts []WAContact
	err := h.db.Select(&contacts, query, append([]interface{}{accountID, campaignID}, extra...)...)

	return contacts, err
}

// noRecipientsMessage explains why a campaign has nobody left to send to.
func noRecipientsMessage(a waAudience, alreadyAttempted int) string {
	switch {
	case a.everyone() && alreadyAttempted == 0:
		return "There are no opted-in contacts to send this campaign to."
	case a.everyone():
		return "Every opted-in contact has already been sent this campaign."
	case alreadyAttempted == 0:
		return "No opted-in contacts are in the chosen groups or have the chosen tags. " +
			"Check the campaign's audience, or opt those contacts in first."
	default:
		return "Every opted-in contact in this campaign's audience has already been sent it."
	}
}

// consentState is what an imported row says about whether the person agreed to
// receive WhatsApp messages.
type consentState int

const (
	// consentUnknown: the file does not say and the uploader did not confirm.
	// The contact is stored but not opted in.
	consentUnknown consentState = iota
	// consentGiven: the row says yes, or the uploader confirmed consent for the
	// whole file.
	consentGiven
	// consentRefused: the row says no.
	consentRefused
)

// consentColumns are the header names an import reads a per-row answer from.
var consentColumns = []string{"opted_in", "opt_in", "optin", "opted in", "opt in", "consent", "whatsapp_opt_in", "subscribed"}

// parseConsentCell reads one row's answer. Anything unrecognised counts as not
// saying, so the uploader's confirmation (or its absence) decides.
func parseConsentCell(value string) consentState {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yes", "y", "true", "1", "opted in", "opted_in", "opt in", "opt-in", "subscribed", "consented":
		return consentGiven
	case "no", "n", "false", "0", "opted out", "opted_out", "opt out", "opt-out", "unsubscribed", "declined":
		return consentRefused
	default:
		return consentUnknown
	}
}

// consentConfirmed reads the uploader's "everyone in this file agreed" box.
func consentConfirmed(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes", "on":
		return true
	default:
		return false
	}
}

// importConflictSQL is what an import does to a contact that already exists,
// by what the row says about consent. Names and emails fill gaps as before.
//
// An import can withdraw consent, but it only grants it to a contact that has
// never had an opt-in or opt-out recorded, such as one imported earlier without
// confirmation. Someone who was opted in and later opted out is never
// re-subscribed by uploading a list that still contains them.
func importConflictSQL(state consentState) string {
	details := `name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE wa_contacts.name END,
				email = CASE WHEN EXCLUDED.email != '' THEN EXCLUDED.email ELSE wa_contacts.email END,
				updated_at = NOW()`

	switch state {
	case consentGiven:
		const neverDecided = `NOT wa_contacts.opted_in AND wa_contacts.opted_in_at IS NULL AND wa_contacts.opted_out_at IS NULL`

		return details + `,
				opted_in = CASE WHEN ` + neverDecided + ` THEN true ELSE wa_contacts.opted_in END,
				opted_in_at = CASE WHEN ` + neverDecided + ` THEN EXCLUDED.opted_in_at ELSE wa_contacts.opted_in_at END`
	case consentRefused:
		return details + `,
				opted_in = false`
	default:
		return details
	}
}
