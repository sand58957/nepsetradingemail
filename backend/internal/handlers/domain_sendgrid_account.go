package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/jmoiron/sqlx"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/sendgrid"
)

// A sending domain's SendGrid setup (its domain authentication) belongs to one
// SendGrid account. When the SendGrid key is changed to a different account, the
// ids stored in app_domains point at the old account and the new one answers
// "not found" for them. The functions here move each domain over to the account
// behind the current key.

// relinkMu keeps two relinks from both finding no setup for a domain and both
// creating one.
var relinkMu sync.Mutex

// relinkSendGridDomain points the domain in app_domains row rowID at its setup in
// the SendGrid account behind sg. A setup that already exists there is adopted,
// so DNS records added for that account keep working. Otherwise a new one is
// created and its DNS records stored; created reports that case, in which the
// domain's owner has to add the new CNAME records before SendGrid accepts it.
func relinkSendGridDomain(db *sqlx.DB, sg *sendgrid.Client, rowID int, domain string) (auth *sendgrid.DomainAuthResponse, created bool, err error) {
	relinkMu.Lock()
	defer relinkMu.Unlock()

	auth, err = sg.FindDomainAuth(domain)
	if err != nil {
		return nil, false, err
	}

	if auth == nil {
		auth, err = sg.AuthenticateDomain(domain)
		if err != nil {
			return nil, false, err
		}

		created = true
	}

	dns, err := json.Marshal(auth.DNS)
	if err != nil {
		return nil, false, err
	}

	if _, err := db.Exec(`UPDATE app_domains SET sendgrid_domain_id = $1, sendgrid_dns = $2, updated_at = NOW() WHERE id = $3`,
		auth.ID, dns, rowID); err != nil {
		return nil, false, fmt.Errorf("saving the new SendGrid setup: %w", err)
	}

	how := "adopted the existing setup"
	if created {
		how = "created a new setup; its owner must add the new CNAME records"
	}

	log.Printf("INFO: SendGrid account changed: domain %s (row %d) now uses SendGrid domain %d — %s", domain, rowID, auth.ID, how)

	return auth, created, nil
}

// validateInCurrentAccount handles a domain whose stored SendGrid setup isn't in
// the account behind sg: it relinks the domain and validates the setup it now
// points at. The row it returns tells the domain's owner what happened.
func validateInCurrentAccount(db *sqlx.DB, sg *sendgrid.Client, rowID int, domain string) (*sendgrid.ValidationResult, DnsRecordResult, error) {
	row := DnsRecordResult{
		RecordType: "SENDGRID_ACCOUNT",
		Expected:   "Domain set up in the current SendGrid account",
	}

	auth, created, err := relinkSendGridDomain(db, sg, rowID, domain)
	if err != nil {
		row.Found = fmt.Sprintf("The SendGrid account was changed and this domain could not be set up in the new one: %v", err)
		row.Status = "fail"

		return nil, row, err
	}

	row.Status = "pass"
	row.Found = "The SendGrid account was changed. This domain is now linked to its existing setup in the new account."

	if created {
		row.Found = "The SendGrid account was changed, so this domain was set up again in the new account. " +
			"Replace its old CNAME records with the new ones shown here, then check again."
	}

	result, err := sg.ValidateDomain(auth.ID)

	return result, row, err
}

// relinkAllSendGridDomains moves every sending domain whose SendGrid setup isn't
// in the account behind sg over to that account. It runs after the key is saved
// and when the server starts. Domains still found there are left alone.
//
// It never changes a domain's status. Email campaigns don't send through
// SendGrid, so a domain that needs new CNAME records for SendGrid still works
// for them, and its owner's next Verify shows the records to add.
func relinkAllSendGridDomains(db *sqlx.DB, sg *sendgrid.Client) (relinked, created int) {
	var domains []struct {
		ID               int    `db:"id"`
		Domain           string `db:"domain"`
		SendgridDomainID int    `db:"sendgrid_domain_id"`
	}

	if err := db.Select(&domains, `SELECT id, domain, sendgrid_domain_id FROM app_domains
		WHERE type = 'sending' AND sendgrid_domain_id > 0 ORDER BY id`); err != nil {
		log.Printf("ERROR: SendGrid relink: listing domains: %v", err)

		return 0, 0
	}

	for _, d := range domains {
		current, err := sg.GetDomainAuth(d.SendgridDomainID)
		if err == nil && strings.EqualFold(current.Domain, d.Domain) {
			continue
		}

		if err != nil && !errors.Is(err, sendgrid.ErrNotFound) {
			// The key may lack the domain authentication permission, or SendGrid
			// may be unreachable: either way nothing is known to be wrong.
			log.Printf("WARNING: SendGrid relink: checking domain %s: %v", d.Domain, err)

			continue
		}

		_, isNew, err := relinkSendGridDomain(db, sg, d.ID, d.Domain)
		if err != nil {
			log.Printf("ERROR: SendGrid relink: domain %s: %v", d.Domain, err)

			continue
		}

		relinked++

		if isNew {
			created++
		}
	}

	if relinked > 0 {
		log.Printf("INFO: SendGrid relink: %d domain(s) moved to the current SendGrid account, %d need new CNAME records", relinked, created)
	}

	return relinked, created
}
