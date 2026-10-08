package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/jmoiron/sqlx"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/sendgrid"
)

// fakeSendGrid is the SendGrid account behind a newly saved key. It knows only
// the domain setups in auths and answers "not found" for any other id, the way
// SendGrid answers for ids that belong to another account.
type fakeSendGrid struct {
	mu      sync.Mutex
	auths   map[int]sendgrid.DomainAuthResponse
	nextID  int
	created []string
	deleted []int
	forbid  bool // a key without the domain authentication permission
	flaky   bool // looking a single setup up fails, as in a SendGrid outage
}

func newFakeSendGrid(t *testing.T, auths ...sendgrid.DomainAuthResponse) *fakeSendGrid {
	t.Helper()

	f := &fakeSendGrid{auths: map[int]sendgrid.DomainAuthResponse{}, nextID: 900}
	for _, a := range auths {
		f.auths[a.ID] = a
	}

	srv := httptest.NewServer(f)
	restore := sendgrid.OverrideAPIBaseForTest(srv.URL)

	t.Cleanup(func() {
		restore()
		srv.Close()
	})

	return f
}

func sendGridSetup(id int, domain string, valid bool) sendgrid.DomainAuthResponse {
	return sendgrid.DomainAuthResponse{
		ID:     id,
		Domain: domain,
		Valid:  valid,
		DNS: sendgrid.DomainAuthDNS{
			MailCNAME: sendgrid.DNSRecord{Host: fmt.Sprintf("em%d.%s", id, domain), Data: fmt.Sprintf("u%d.wl.sendgrid.net", id)},
			DKIM1:     sendgrid.DNSRecord{Host: "s1._domainkey." + domain, Data: fmt.Sprintf("s1.domainkey.u%d.wl.sendgrid.net", id)},
			DKIM2:     sendgrid.DNSRecord{Host: "s2._domainkey." + domain, Data: fmt.Sprintf("s2.domainkey.u%d.wl.sendgrid.net", id)},
		},
	}
}

func (f *fakeSendGrid) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.forbid {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"errors":[{"field":null,"message":"access forbidden"}]}`))

		return
	}

	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/whitelabel/domains"), "/")

	if rest == "" && r.Method == http.MethodGet {
		// The whole account, unfiltered: the client must pick the domain out.
		all := make([]sendgrid.DomainAuthResponse, 0, len(f.auths))
		for _, a := range f.auths {
			all = append(all, a)
		}

		sort.Slice(all, func(i, j int) bool { return all[i].ID < all[j].ID })
		json.NewEncoder(w).Encode(all)

		return
	}

	if rest == "" && r.Method == http.MethodPost {
		var req struct {
			Domain string `json:"domain"`
		}

		json.NewDecoder(r.Body).Decode(&req)

		f.nextID++
		f.auths[f.nextID] = sendGridSetup(f.nextID, req.Domain, false)
		f.created = append(f.created, req.Domain)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(f.auths[f.nextID])

		return
	}

	parts := strings.Split(rest, "/")
	id, _ := strconv.Atoi(parts[0])

	if f.flaky && r.Method == http.MethodGet {
		w.WriteHeader(http.StatusInternalServerError)

		return
	}

	auth, ok := f.auths[id]
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"errors":[{"field":null,"message":"authenticated domain not found"}]}`))

		return
	}

	switch {
	case len(parts) == 2 && parts[1] == "validate":
		var v sendgrid.ValidationResult
		v.ID, v.Valid = id, auth.Valid
		v.ValidationResults.DKIM1.Valid = auth.Valid
		v.ValidationResults.DKIM2.Valid = auth.Valid
		v.ValidationResults.MailCNAME.Valid = auth.Valid
		json.NewEncoder(w).Encode(v)
	case r.Method == http.MethodDelete:
		delete(f.auths, id)
		f.deleted = append(f.deleted, id)
		w.WriteHeader(http.StatusNoContent)
	default:
		json.NewEncoder(w).Encode(auth)
	}
}

// domainsTestDB is a disposable schema with app_domains built from the real
// migrations (see waTestDB for WA_TEST_DSN).
func domainsTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	db := waTestDB(t)

	for _, f := range []string{"009_domains.up.sql", "011_sendgrid_domains.up.sql"} {
		migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", f))
		if err != nil {
			t.Fatalf("reading migration %s: %v", f, err)
		}

		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatalf("applying migration %s: %v", f, err)
		}
	}

	return db
}

// addDomain stores a domain the way Create left it under the old SendGrid
// account, and returns its row id.
func addDomain(t *testing.T, db *sqlx.DB, domain, kind, status string, sendgridID int) int {
	t.Helper()

	account := waInsertID(t, db, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)

	dns, _ := json.Marshal(sendGridSetup(sendgridID, domain, true).DNS)
	if sendgridID == 0 {
		dns = []byte("{}")
	}

	return waInsertID(t, db, `INSERT INTO app_domains (account_id, domain, type, status, sendgrid_domain_id, sendgrid_dns)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, account, domain, kind, status, sendgridID, dns)
}

type storedDomain struct {
	SendgridDomainID int             `db:"sendgrid_domain_id"`
	SendgridDNS      json.RawMessage `db:"sendgrid_dns"`
	Status           string          `db:"status"`
	AccountID        int             `db:"account_id"`
}

func domainRow(t *testing.T, db *sqlx.DB, id int) storedDomain {
	t.Helper()

	var d storedDomain
	if err := db.Get(&d, `SELECT sendgrid_domain_id, sendgrid_dns, status, account_id FROM app_domains WHERE id = $1`, id); err != nil {
		t.Fatalf("reading domain %d: %v", id, err)
	}

	return d
}

func (d storedDomain) mailHost() string {
	var dns sendgrid.DomainAuthDNS
	_ = json.Unmarshal(d.SendgridDNS, &dns)

	return dns.MailCNAME.Host
}

// The owner changed the SendGrid key to a different SendGrid account on
// 8 October 2026. Every domain id saved under the old account is unknown to the
// new one, so each domain has to be found or set up there again.
func TestANewSendGridAccountTakesOverTheDomains(t *testing.T) {
	db := domainsTestDB(t)

	sg := newFakeSendGrid(t,
		sendGridSetup(500, "nepsetrading.com", false),
		sendGridSetup(501, "nepsetrading.com", true),
		sendGridSetup(700, "edigitalnepal.com", false),
		sendGridSetup(800, "someone-else.com", true),
	)

	alreadySetUp := addDomain(t, db, "nepsetrading.com", "sending", "verified", 11)
	sameAccount := addDomain(t, db, "edigitalnepal.com", "sending", "pending", 700)
	notSetUp := addDomain(t, db, "yatraforfun.com", "sending", "verified", 12)
	sharedFirst := addDomain(t, db, "hostingnepals.com", "sending", "verified", 13)
	sharedSecond := addDomain(t, db, "hostingnepals.com", "sending", "verified", 14)
	idTakenByAnother := addDomain(t, db, "mismatch.com", "sending", "verified", 800)
	noSendGrid := addDomain(t, db, "local-only.com", "sending", "verified", 0)
	site := addDomain(t, db, "site.com", "site", "verified", 0)

	relinked, created := relinkAllSendGridDomains(db, sendgrid.NewClient("test-key"))

	if relinked != 5 || created != 3 {
		t.Errorf("relinked %d, created %d; want 5 moved, 3 of them set up anew", relinked, created)
	}

	if got := strings.Join(sg.created, ","); got != "yatraforfun.com,hostingnepals.com,mismatch.com" {
		t.Errorf("set up in the new account: %s; want each missing domain once, the shared one only once", got)
	}

	if d := domainRow(t, db, alreadySetUp); d.SendgridDomainID != 501 || d.mailHost() != "em501.nepsetrading.com" {
		t.Errorf("domain already set up in the new account: now %d (%s); want the validated setup 501 and its records",
			d.SendgridDomainID, d.mailHost())
	}

	if d := domainRow(t, db, sameAccount); d.SendgridDomainID != 700 {
		t.Errorf("domain the new account knows: now %d; want 700 untouched", d.SendgridDomainID)
	}

	fresh := domainRow(t, db, notSetUp)
	if fresh.SendgridDomainID <= 900 || fresh.mailHost() != fmt.Sprintf("em%d.yatraforfun.com", fresh.SendgridDomainID) {
		t.Errorf("domain new to the account: now %d (%s); want the new setup and its records", fresh.SendgridDomainID, fresh.mailHost())
	}

	if a, b := domainRow(t, db, sharedFirst), domainRow(t, db, sharedSecond); a.SendgridDomainID <= 900 || a.SendgridDomainID != b.SendgridDomainID {
		t.Errorf("one domain in two accounts: now %d and %d; want both on the one new setup", a.SendgridDomainID, b.SendgridDomainID)
	}

	if d := domainRow(t, db, idTakenByAnother); d.SendgridDomainID == 800 {
		t.Errorf("stored id belongs to another domain in the new account: kept 800; want a setup of its own")
	}

	if d := domainRow(t, db, noSendGrid); d.SendgridDomainID != 0 {
		t.Errorf("domain never set up with SendGrid: now %d; want it left alone", d.SendgridDomainID)
	}

	if d := domainRow(t, db, site); d.SendgridDomainID != 0 {
		t.Errorf("site domain: now %d; want it left alone", d.SendgridDomainID)
	}

	// Campaigns don't send through SendGrid, so a domain stays usable for them.
	for _, id := range []int{alreadySetUp, notSetUp, sharedFirst, sharedSecond, idTakenByAnother} {
		if d := domainRow(t, db, id); d.Status != "verified" {
			t.Errorf("domain %d: status %q after the move; want it unchanged", id, d.Status)
		}
	}

	if relinked, created := relinkAllSendGridDomains(db, sendgrid.NewClient("test-key")); relinked != 0 || created != 0 {
		t.Errorf("second run: relinked %d, created %d; want nothing left to move", relinked, created)
	}
}

// A key that can't read domain setups, or SendGrid failing, says nothing about
// where the domains live: nothing may be moved or created.
func TestSendGridRelinkLeavesDomainsAloneWhenTheKeyCannotSeeThem(t *testing.T) {
	for _, tc := range []struct {
		name   string
		forbid bool
		flaky  bool
	}{
		{name: "key without the permission", forbid: true},
		{name: "SendGrid failing", flaky: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := domainsTestDB(t)

			sg := newFakeSendGrid(t)
			sg.forbid, sg.flaky = tc.forbid, tc.flaky

			id := addDomain(t, db, "nepsetrading.com", "sending", "verified", 11)

			if relinked, _ := relinkAllSendGridDomains(db, sendgrid.NewClient("test-key")); relinked != 0 || len(sg.created) != 0 {
				t.Errorf("relinked %d, created %v; want nothing touched", relinked, sg.created)
			}

			if d := domainRow(t, db, id); d.SendgridDomainID != 11 {
				t.Errorf("domain now %d; want 11 kept", d.SendgridDomainID)
			}
		})
	}
}

func verifyRecords(t *testing.T, h *DomainHandler, account, id int) map[string]map[string]interface{} {
	t.Helper()

	code, body := waServe(t, h.Verify, http.MethodPost, "/", nil, "", account, strconv.Itoa(id))
	if code != http.StatusOK {
		t.Fatalf("Verify: status %d, body %v", code, body)
	}

	data, _ := body["data"].(map[string]interface{})
	records, _ := data["records"].([]interface{})

	byType := map[string]map[string]interface{}{}

	for _, r := range records {
		rec, _ := r.(map[string]interface{})
		byType[fmt.Sprint(rec["record_type"])] = rec
	}

	return byType
}

// The owner presses Verify on a domain whose setup was in the old account.
func TestVerifyFollowsADomainIntoTheNewSendGridAccount(t *testing.T) {
	saved := dnsResolver
	dnsResolver = &net.Resolver{PreferGo: true, Dial: func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("no DNS in tests")
	}}

	t.Cleanup(func() { dnsResolver = saved })

	db := domainsTestDB(t)
	h := &DomainHandler{db: db, dkimKeyDir: t.TempDir(), envAPIKey: "test-key"}

	newFakeSendGrid(t, sendGridSetup(501, "nepsetrading.com", true))

	t.Run("set up again", func(t *testing.T) {
		id := addDomain(t, db, "yatraforfun.com", "sending", "verified", 12)
		records := verifyRecords(t, h, domainRow(t, db, id).AccountID, id)

		account := records["SENDGRID_ACCOUNT"]
		if account["status"] != "pass" || !strings.Contains(fmt.Sprint(account["found"]), "Replace its old CNAME records") {
			t.Errorf("account row: %v; want it to tell the owner to add the new records", account)
		}

		if records["CNAME_DKIM1"]["status"] != "fail" {
			t.Errorf("DKIM row: %v; want fail until the new records are added", records["CNAME_DKIM1"])
		}

		if d := domainRow(t, db, id); d.SendgridDomainID <= 900 {
			t.Errorf("domain now %d; want the new setup saved, so its DNS records show", d.SendgridDomainID)
		}
	})

	t.Run("already set up", func(t *testing.T) {
		id := addDomain(t, db, "nepsetrading.com", "sending", "verified", 11)
		records := verifyRecords(t, h, domainRow(t, db, id).AccountID, id)

		account := records["SENDGRID_ACCOUNT"]
		if account["status"] != "pass" || !strings.Contains(fmt.Sprint(account["found"]), "existing setup") {
			t.Errorf("account row: %v; want it linked to the existing setup", account)
		}

		if records["CNAME_DKIM1"]["status"] != "pass" {
			t.Errorf("DKIM row: %v; want pass, the new account's setup is validated", records["CNAME_DKIM1"])
		}
	})

	t.Run("same account", func(t *testing.T) {
		id := addDomain(t, db, "nepsetrading.com", "sending", "verified", 501)
		records := verifyRecords(t, h, domainRow(t, db, id).AccountID, id)

		if _, ok := records["SENDGRID_ACCOUNT"]; ok {
			t.Errorf("domain already in this account: got an account row %v; want none", records["SENDGRID_ACCOUNT"])
		}
	})
}

// After the move one SendGrid setup can serve the same domain in two accounts.
// Removing the domain from one of them must not delete the setup the other uses.
func TestRemovingADomainKeepsASharedSendGridSetup(t *testing.T) {
	db := domainsTestDB(t)
	h := &DomainHandler{db: db, dkimKeyDir: t.TempDir(), envAPIKey: "test-key"}

	sg := newFakeSendGrid(t, sendGridSetup(600, "hostingnepals.com", true))

	first := addDomain(t, db, "hostingnepals.com", "sending", "verified", 600)
	second := addDomain(t, db, "hostingnepals.com", "sending", "verified", 600)

	if code, body := waServe(t, h.Delete, http.MethodDelete, "/", nil, "", domainRow(t, db, first).AccountID, strconv.Itoa(first)); code != http.StatusOK {
		t.Fatalf("Delete first: status %d, body %v", code, body)
	}

	if len(sg.deleted) != 0 {
		t.Errorf("deleted %v while another account still uses it; want it kept", sg.deleted)
	}

	if code, body := waServe(t, h.Delete, http.MethodDelete, "/", nil, "", domainRow(t, db, second).AccountID, strconv.Itoa(second)); code != http.StatusOK {
		t.Fatalf("Delete second: status %d, body %v", code, body)
	}

	if len(sg.deleted) != 1 || sg.deleted[0] != 600 {
		t.Errorf("after the last user removed it: deleted %v; want [600]", sg.deleted)
	}
}
