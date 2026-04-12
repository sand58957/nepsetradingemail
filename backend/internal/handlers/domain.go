package handlers

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/sendgrid"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

const (
	serverIP     = "194.180.176.91"
	dkimSelector = "mail"
	dkimKeyBits  = 2048
)

// dnsResolver uses Google public DNS to avoid Docker internal DNS caching issues
var dnsResolver = &net.Resolver{
	PreferGo: true,
	Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		d := net.Dialer{Timeout: 10 * time.Second}
		return d.DialContext(ctx, "udp", "8.8.8.8:53")
	},
}

var domainNameRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)

// DnsRecordResult represents the result of verifying a single DNS record.
type DnsRecordResult struct {
	RecordType string `json:"record_type"`
	Expected   string `json:"expected"`
	Found      string `json:"found"`
	Status     string `json:"status"` // "pass" or "fail"
}

// VerifyDomainResponse is the response for domain verification.
type VerifyDomainResponse struct {
	Domain    string            `json:"domain"`
	AllPassed bool              `json:"all_passed"`
	Records   []DnsRecordResult `json:"records"`
	CheckedAt string            `json:"checked_at"`
}

// DomainHandler manages per-account domains with DKIM key generation, SendGrid, and DNS verification.
type DomainHandler struct {
	db         *sqlx.DB
	dkimKeyDir string
	sg         *sendgrid.Client
}

// NewDomainHandler creates a new DomainHandler.
func NewDomainHandler(db *sqlx.DB, sendgridAPIKey string) *DomainHandler {
	dir := os.Getenv("DKIM_KEYS_DIR")
	if dir == "" {
		dir = "/opt/dkim-keys"
	}

	var sgClient *sendgrid.Client
	if sendgridAPIKey != "" {
		sgClient = sendgrid.NewClient(sendgridAPIKey)
		log.Println("INFO: SendGrid domain authentication enabled")
	} else {
		log.Println("WARNING: SENDGRID_API_KEY not set — SendGrid domain auth disabled")
	}

	return &DomainHandler{db: db, dkimKeyDir: dir, sg: sgClient}
}

// --------------------------------------------------------------------------
// DKIM key generation
// --------------------------------------------------------------------------

func generateDKIMKeyPair() (privateKeyPEM string, publicKeyBase64 string, err error) {
	key, err := rsa.GenerateKey(rand.Reader, dkimKeyBits)
	if err != nil {
		return "", "", fmt.Errorf("generate RSA key: %w", err)
	}

	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privBytes,
	})

	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return "", "", fmt.Errorf("marshal public key: %w", err)
	}

	pubB64 := base64.StdEncoding.EncodeToString(pubBytes)

	return string(privPEM), pubB64, nil
}

// --------------------------------------------------------------------------
// Verification hash
// --------------------------------------------------------------------------

func domainVerificationHash(domain string) string {
	var hash int32 = 0
	for i := 0; i < len(domain); i++ {
		hash = (hash << 5) - hash + int32(domain[i])
	}

	var abs int64
	if hash < 0 {
		abs = -int64(hash)
	} else {
		abs = int64(hash)
	}

	hex := fmt.Sprintf("%08x", abs)

	runes := []rune(hex)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}

	return hex + string(runes) + hex + "cfa4334fc1"
}

// --------------------------------------------------------------------------
// DKIM key file management
// --------------------------------------------------------------------------

func (h *DomainHandler) writeDKIMKeyFile(domain, privateKeyPEM string) error {
	if h.dkimKeyDir == "" {
		return nil
	}

	if err := os.MkdirAll(h.dkimKeyDir, 0755); err != nil {
		return fmt.Errorf("create DKIM key dir: %w", err)
	}

	keyPath := filepath.Join(h.dkimKeyDir, domain+".private")

	if err := os.WriteFile(keyPath, []byte(privateKeyPEM), 0644); err != nil {
		return fmt.Errorf("write DKIM key: %w", err)
	}

	log.Printf("INFO: Wrote DKIM key file %s", keyPath)

	return nil
}

func (h *DomainHandler) removeDKIMKeyFile(domain string) {
	if h.dkimKeyDir == "" {
		return
	}

	keyPath := filepath.Join(h.dkimKeyDir, domain+".private")

	if err := os.Remove(keyPath); err != nil && !os.IsNotExist(err) {
		log.Printf("WARNING: Failed to remove DKIM key file %s: %v", keyPath, err)
	}
}

// --------------------------------------------------------------------------
// SQL helpers
// --------------------------------------------------------------------------

const domainSelectCols = `id, account_id, domain, type, status, dkim_public_key, dkim_selector,
	verification_hash, domain_alignment, ssl, site, sendgrid_domain_id, sendgrid_dns,
	from_email, from_name, verified_at, created_at, updated_at`

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

// List returns all domains for the current account.
func (h *DomainHandler) List(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	var domains []models.Domain

	err := h.db.Select(&domains,
		`SELECT `+domainSelectCols+` FROM app_domains WHERE account_id = $1 ORDER BY created_at`,
		accountID,
	)
	if err != nil {
		log.Printf("ERROR: list domains: %v", err)
		return response.InternalError(c, "Failed to fetch domains")
	}

	if domains == nil {
		domains = []models.Domain{}
	}

	return response.Success(c, domains)
}

// Create adds a new domain with auto-generated DKIM keys, SendGrid auth, and verification hash.
func (h *DomainHandler) Create(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	var req models.CreateDomainRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	domain := strings.TrimSpace(strings.ToLower(req.Domain))
	if domain == "" {
		return response.BadRequest(c, "Domain is required")
	}

	if len(domain) > 253 || !domainNameRegex.MatchString(domain) {
		return response.BadRequest(c, "Invalid domain format")
	}

	domainType := strings.TrimSpace(req.Type)
	if domainType == "" {
		domainType = "sending"
	}

	if domainType != "sending" && domainType != "site" {
		return response.BadRequest(c, "Type must be 'sending' or 'site'")
	}

	// Duplicate check
	var cnt int
	_ = h.db.Get(&cnt, `SELECT COUNT(*) FROM app_domains WHERE account_id = $1 AND domain = $2 AND type = $3`,
		accountID, domain, domainType)
	if cnt > 0 {
		return response.BadRequest(c, "This domain has already been added")
	}

	// Generate verification hash
	verifyHash := domainVerificationHash(domain)

	var privKey, pubKey string
	var sendgridDomainID int
	var sendgridDNSJSON []byte = []byte("{}")
	fromEmail := strings.TrimSpace(req.FromEmail)
	fromName := strings.TrimSpace(req.FromName)

	if domainType == "sending" {
		// Generate local DKIM keys
		var err error
		privKey, pubKey, err = generateDKIMKeyPair()
		if err != nil {
			log.Printf("ERROR: generate DKIM keys for %s: %v", domain, err)
			return response.InternalError(c, "Failed to generate DKIM keys")
		}

		// Create SendGrid domain authentication
		if h.sg != nil {
			sgResp, err := h.sg.AuthenticateDomain(domain)
			if err != nil {
				log.Printf("WARNING: SendGrid domain auth for %s failed: %v (continuing without SendGrid)", domain, err)
			} else {
				sendgridDomainID = sgResp.ID
				sendgridDNSJSON, _ = json.Marshal(sgResp.DNS)
				log.Printf("INFO: SendGrid domain auth created for %s (ID: %d)", domain, sgResp.ID)
			}
		}

		// Default from_email if not provided
		if fromEmail == "" {
			fromEmail = "no-reply@" + domain
		}
	}

	// Insert
	var d models.Domain

	err := h.db.QueryRowx(
		`INSERT INTO app_domains
			(account_id, domain, type, status, dkim_private_key, dkim_public_key, dkim_selector,
			 verification_hash, sendgrid_domain_id, sendgrid_dns, from_email, from_name)
		 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING `+domainSelectCols,
		accountID, domain, domainType, privKey, pubKey, dkimSelector, verifyHash,
		sendgridDomainID, sendgridDNSJSON, fromEmail, fromName,
	).StructScan(&d)
	if err != nil {
		log.Printf("ERROR: insert domain %s: %v", domain, err)
		return response.InternalError(c, "Failed to add domain")
	}

	// Write DKIM private key file
	if domainType == "sending" && privKey != "" {
		if err := h.writeDKIMKeyFile(domain, privKey); err != nil {
			log.Printf("WARNING: write DKIM key file for %s: %v", domain, err)
		}
	}

	return response.Success(c, d)
}

// Delete removes a domain belonging to the current account.
func (h *DomainHandler) Delete(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	id := c.Param("id")

	// Get domain details for cleanup
	var domainInfo struct {
		Domain           string `db:"domain"`
		SendgridDomainID int    `db:"sendgrid_domain_id"`
	}

	err := h.db.Get(&domainInfo,
		`SELECT domain, sendgrid_domain_id FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Domain not found")
	}

	_, err = h.db.Exec(`DELETE FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete domain")
	}

	// Delete SendGrid domain auth
	if h.sg != nil && domainInfo.SendgridDomainID > 0 {
		if err := h.sg.DeleteDomainAuth(domainInfo.SendgridDomainID); err != nil {
			log.Printf("WARNING: Failed to delete SendGrid domain auth %d: %v", domainInfo.SendgridDomainID, err)
		}
	}

	// Only remove key file if no other account uses this domain
	var otherCnt int
	_ = h.db.Get(&otherCnt, `SELECT COUNT(*) FROM app_domains WHERE domain = $1`, domainInfo.Domain)
	if otherCnt == 0 {
		h.removeDKIMKeyFile(domainInfo.Domain)
	}

	return response.Success(c, map[string]string{"message": "Domain removed"})
}

// GetDnsRecords returns the DNS records a user must add for a domain.
func (h *DomainHandler) GetDnsRecords(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	id := c.Param("id")

	var d models.Domain

	err := h.db.Get(&d,
		`SELECT `+domainSelectCols+` FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Domain not found")
	}

	var records []models.DnsRecord

	if d.Type == "site" {
		// Site domains only need a TXT verification record
		records = []models.DnsRecord{
			{
				Label: "TXT Record (Domain Verification)",
				Type:  "TXT",
				Name:  "@",
				Value: "nepsefilling-domain-verification=" + d.VerificationHash,
			},
		}
	} else {
		// Sending domains: SendGrid CNAME records + SPF + DMARC + Verification TXT

		// Try to get SendGrid DNS records
		var sgDNS sendgrid.DomainAuthDNS
		if d.SendgridDomainID > 0 && len(d.SendgridDNS) > 2 {
			_ = json.Unmarshal(d.SendgridDNS, &sgDNS)
		}

		// If we have SendGrid DNS records, show CNAME records
		if sgDNS.DKIM1.Host != "" {
			records = append(records, models.DnsRecord{
				Label: "CNAME Record (DKIM 1)",
				Type:  "CNAME",
				Name:  sgDNS.DKIM1.Host,
				Value: sgDNS.DKIM1.Data,
			})
			records = append(records, models.DnsRecord{
				Label: "CNAME Record (DKIM 2)",
				Type:  "CNAME",
				Name:  sgDNS.DKIM2.Host,
				Value: sgDNS.DKIM2.Data,
			})
			records = append(records, models.DnsRecord{
				Label: "CNAME Record (Mail)",
				Type:  "CNAME",
				Name:  sgDNS.MailCNAME.Host,
				Value: sgDNS.MailCNAME.Data,
			})
		} else {
			// Fallback to local DKIM
			records = append(records, models.DnsRecord{
				Label: "TXT Record (DKIM)",
				Type:  "TXT",
				Name:  d.DKIMSelector + "._domainkey",
				Value: "v=DKIM1; k=rsa; p=" + d.DKIMPublicKey,
			})
		}

		// SPF — include sendgrid.net
		records = append(records, models.DnsRecord{
			Label: "TXT Record (SPF)",
			Type:  "TXT",
			Name:  "@",
			Value: "v=spf1 ip4:" + serverIP + " include:sendgrid.net ~all",
		})

		// DMARC
		records = append(records, models.DnsRecord{
			Label: "TXT Record (DMARC)",
			Type:  "TXT",
			Name:  "_dmarc",
			Value: "v=DMARC1; p=none; adkim=r; aspf=r",
		})

		// Verification
		records = append(records, models.DnsRecord{
			Label: "TXT Record (Domain Verification)",
			Type:  "TXT",
			Name:  "@",
			Value: "nepsefilling-domain-verification=" + d.VerificationHash,
		})
	}

	return response.Success(c, models.DnsRecordsResponse{
		DomainID: d.ID,
		Domain:   d.Domain,
		Records:  records,
	})
}

// Verify performs DNS lookups and SendGrid validation to check domain records.
func (h *DomainHandler) Verify(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	id := c.Param("id")

	var d struct {
		ID               int             `db:"id"`
		Domain           string          `db:"domain"`
		Type             string          `db:"type"`
		DKIMPublicKey    string          `db:"dkim_public_key"`
		DKIMSelector     string          `db:"dkim_selector"`
		VerificationHash string          `db:"verification_hash"`
		SendgridDomainID int             `db:"sendgrid_domain_id"`
		SendgridDNS      json.RawMessage `db:"sendgrid_dns"`
	}

	err := h.db.Get(&d,
		`SELECT id, domain, type, dkim_public_key, dkim_selector, verification_hash,
		        sendgrid_domain_id, sendgrid_dns
		 FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Domain not found")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	results := make([]DnsRecordResult, 0, 6)
	var allPassed bool

	if d.Type == "site" {
		// Site domains: only check Verification TXT
		txtRecords, txtErr := dnsResolver.LookupTXT(ctx, d.Domain)
		verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)
		results = append(results, verifyResult)

		allPassed = verifyResult.Status == "pass"
	} else {
		// Sending domains: check via SendGrid API + SPF + DMARC + Verification TXT

		// 1. SendGrid validation (checks DKIM CNAMEs + Mail CNAME)
		sgPassed := false
		if h.sg != nil && d.SendgridDomainID > 0 {
			sgResult, err := h.sg.ValidateDomain(d.SendgridDomainID)
			if err != nil {
				log.Printf("WARNING: SendGrid validate domain %d: %v", d.SendgridDomainID, err)
				results = append(results, DnsRecordResult{
					RecordType: "SENDGRID_DKIM",
					Expected:   "SendGrid CNAME records",
					Found:      fmt.Sprintf("Error: %v", err),
					Status:     "fail",
				})
			} else {
				sgPassed = sgResult.Valid

				// DKIM1
				dkim1Status := "fail"
				if sgResult.ValidationResults.DKIM1.Valid {
					dkim1Status = "pass"
				}
				results = append(results, DnsRecordResult{
					RecordType: "CNAME_DKIM1",
					Expected:   "DKIM CNAME record 1",
					Found:      fmt.Sprintf("valid=%v", sgResult.ValidationResults.DKIM1.Valid),
					Status:     dkim1Status,
				})

				// DKIM2
				dkim2Status := "fail"
				if sgResult.ValidationResults.DKIM2.Valid {
					dkim2Status = "pass"
				}
				results = append(results, DnsRecordResult{
					RecordType: "CNAME_DKIM2",
					Expected:   "DKIM CNAME record 2",
					Found:      fmt.Sprintf("valid=%v", sgResult.ValidationResults.DKIM2.Valid),
					Status:     dkim2Status,
				})

				// Mail CNAME
				mailStatus := "fail"
				if sgResult.ValidationResults.MailCNAME.Valid {
					mailStatus = "pass"
				}
				results = append(results, DnsRecordResult{
					RecordType: "CNAME_MAIL",
					Expected:   "Mail CNAME record",
					Found:      fmt.Sprintf("valid=%v", sgResult.ValidationResults.MailCNAME.Valid),
					Status:     mailStatus,
				})
			}
		} else {
			// Fallback to local DKIM check
			dkimResult := verifyDKIM(ctx, d.Domain, d.DKIMSelector, d.DKIMPublicKey)
			results = append(results, dkimResult)
			sgPassed = dkimResult.Status == "pass"
		}

		// 2. SPF check (includes sendgrid.net)
		txtRecords, txtErr := dnsResolver.LookupTXT(ctx, d.Domain)
		spfResult := verifySPFSendGrid(txtRecords, txtErr)
		results = append(results, spfResult)

		// 3. DMARC check
		dmarcResult := verifyDMARC(ctx, d.Domain)
		results = append(results, dmarcResult)

		// 4. Verification TXT
		verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)
		results = append(results, verifyResult)

		allPassed = sgPassed && spfResult.Status == "pass" && verifyResult.Status == "pass"
	}

	now := time.Now().UTC()

	if allPassed {
		_, _ = h.db.Exec(
			`UPDATE app_domains SET status = 'verified', verified_at = $1, updated_at = $1 WHERE id = $2`,
			now, d.ID)
	} else {
		_, _ = h.db.Exec(
			`UPDATE app_domains SET status = 'failed', updated_at = $1 WHERE id = $2`,
			now, d.ID)
	}

	return response.Success(c, VerifyDomainResponse{
		Domain:    d.Domain,
		AllPassed: allPassed,
		Records:   results,
		CheckedAt: now.Format(time.RFC3339),
	})
}

// UpdateFromEmail updates the sender email/name for a domain.
func (h *DomainHandler) UpdateFromEmail(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	id := c.Param("id")

	var req struct {
		FromEmail string `json:"from_email"`
		FromName  string `json:"from_name"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	_, err := h.db.Exec(
		`UPDATE app_domains SET from_email = $1, from_name = $2, updated_at = NOW()
		 WHERE id = $3 AND account_id = $4`,
		strings.TrimSpace(req.FromEmail), strings.TrimSpace(req.FromName), id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to update sender info")
	}

	return response.Success(c, map[string]string{"message": "Sender info updated"})
}

// --------------------------------------------------------------------------
// Auto-verification background job
// --------------------------------------------------------------------------

func (h *DomainHandler) StartAutoVerification(ctx context.Context, interval time.Duration) {
	log.Printf("INFO: Domain auto-verification started (interval: %s)", interval)

	go func() {
		time.Sleep(30 * time.Second)
		h.verifyAllPendingDomains()
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("INFO: Domain auto-verification stopped")
			return
		case <-ticker.C:
			h.verifyAllPendingDomains()
		}
	}
}

func (h *DomainHandler) verifyAllPendingDomains() {
	var domains []struct {
		ID               int             `db:"id"`
		Domain           string          `db:"domain"`
		Type             string          `db:"type"`
		DKIMPublicKey    string          `db:"dkim_public_key"`
		DKIMSelector     string          `db:"dkim_selector"`
		VerificationHash string          `db:"verification_hash"`
		Status           string          `db:"status"`
		SendgridDomainID int             `db:"sendgrid_domain_id"`
		SendgridDNS      json.RawMessage `db:"sendgrid_dns"`
	}

	err := h.db.Select(&domains,
		`SELECT id, domain, type, dkim_public_key, dkim_selector, verification_hash, status,
		        sendgrid_domain_id, sendgrid_dns
		 FROM app_domains WHERE status IN ('pending', 'failed') ORDER BY id`)
	if err != nil {
		log.Printf("ERROR: auto-verify: failed to fetch pending domains: %v", err)
		return
	}

	if len(domains) == 0 {
		return
	}

	log.Printf("INFO: auto-verify: checking %d pending domain(s)", len(domains))

	for _, d := range domains {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)

		var allPassed bool
		var failedChecks []string

		if d.Type == "site" {
			txtRecords, txtErr := dnsResolver.LookupTXT(ctx, d.Domain)
			verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)

			allPassed = verifyResult.Status == "pass"
			if verifyResult.Status != "pass" {
				failedChecks = append(failedChecks, "Verify")
			}
		} else {
			// SendGrid validation
			sgPassed := false
			if h.sg != nil && d.SendgridDomainID > 0 {
				sgResult, err := h.sg.ValidateDomain(d.SendgridDomainID)
				if err != nil {
					failedChecks = append(failedChecks, "SendGrid")
				} else {
					sgPassed = sgResult.Valid
					if !sgResult.Valid {
						failedChecks = append(failedChecks, "SendGrid-DKIM")
					}
				}
			} else {
				dkimResult := verifyDKIM(ctx, d.Domain, d.DKIMSelector, d.DKIMPublicKey)
				sgPassed = dkimResult.Status == "pass"
				if dkimResult.Status != "pass" {
					failedChecks = append(failedChecks, "DKIM")
				}
			}

			txtRecords, txtErr := dnsResolver.LookupTXT(ctx, d.Domain)
			spfResult := verifySPFSendGrid(txtRecords, txtErr)
			verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)

			allPassed = sgPassed && spfResult.Status == "pass" && verifyResult.Status == "pass"
			if spfResult.Status != "pass" {
				failedChecks = append(failedChecks, "SPF")
			}
			if verifyResult.Status != "pass" {
				failedChecks = append(failedChecks, "Verify")
			}
		}

		cancel()

		now := time.Now().UTC()

		if allPassed {
			_, _ = h.db.Exec(
				`UPDATE app_domains SET status = 'verified', verified_at = $1, updated_at = $1 WHERE id = $2`,
				now, d.ID)
			log.Printf("INFO: auto-verify: domain %s (%s) VERIFIED", d.Domain, d.Type)
		} else {
			log.Printf("INFO: auto-verify: domain %s (%s) still pending (failed: %s)",
				d.Domain, d.Type, strings.Join(failedChecks, ", "))
		}
	}
}

// --------------------------------------------------------------------------
// DNS verification helpers
// --------------------------------------------------------------------------

func verifyARecord(ctx context.Context, domain string) DnsRecordResult {
	expected := serverIP

	ips, err := dnsResolver.LookupIPAddr(ctx, domain)

	if err != nil {
		return DnsRecordResult{RecordType: "A", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, ip := range ips {
		ipStr := ip.IP.String()
		if found == "" {
			found = ipStr
		} else {
			found += ", " + ipStr
		}

		if ipStr == serverIP {
			status = "pass"
		}
	}

	return DnsRecordResult{RecordType: "A", Expected: expected, Found: found, Status: status}
}

func verifyDKIM(ctx context.Context, domain, selector, expectedPubKey string) DnsRecordResult {
	lookupName := selector + "._domainkey." + domain
	expected := "v=DKIM1"

	txtRecords, err := dnsResolver.LookupTXT(ctx, lookupName)

	if err != nil {
		return DnsRecordResult{RecordType: "TXT_DKIM", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.Contains(txt, "v=DKIM1") {
			found = txt

			norm := strings.ReplaceAll(txt, " ", "")
			normKey := strings.ReplaceAll(expectedPubKey, " ", "")

			if strings.Contains(norm, "p="+normKey) {
				status = "pass"
			} else if len(normKey) > 60 && strings.Contains(norm, normKey[:60]) {
				status = "pass"
			}

			break
		}

		if found == "" {
			found = txt
		}
	}

	return DnsRecordResult{RecordType: "TXT_DKIM", Expected: expected, Found: found, Status: status}
}

// verifySPFSendGrid checks SPF includes sendgrid.net or server IP
func verifySPFSendGrid(txtRecords []string, lookupErr error) DnsRecordResult {
	expected := "include:sendgrid.net"

	if lookupErr != nil {
		return DnsRecordResult{RecordType: "TXT_SPF", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.HasPrefix(txt, "v=spf1") {
			found = txt
			if strings.Contains(txt, "sendgrid.net") || strings.Contains(txt, serverIP) {
				status = "pass"
			}

			break
		}
	}

	return DnsRecordResult{RecordType: "TXT_SPF", Expected: expected, Found: found, Status: status}
}

// verifySPF checks SPF includes server IP (legacy)
func verifySPF(txtRecords []string, lookupErr error) DnsRecordResult {
	expected := "ip4:" + serverIP

	if lookupErr != nil {
		return DnsRecordResult{RecordType: "TXT_SPF", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.HasPrefix(txt, "v=spf1") {
			found = txt
			if strings.Contains(txt, serverIP) {
				status = "pass"
			}

			break
		}
	}

	return DnsRecordResult{RecordType: "TXT_SPF", Expected: expected, Found: found, Status: status}
}

// verifyDMARC checks for a DMARC record
func verifyDMARC(ctx context.Context, domain string) DnsRecordResult {
	expected := "v=DMARC1"

	txtRecords, err := dnsResolver.LookupTXT(ctx, "_dmarc."+domain)

	if err != nil {
		return DnsRecordResult{RecordType: "TXT_DMARC", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.Contains(txt, "v=DMARC1") {
			found = txt
			status = "pass"
			break
		}
	}

	return DnsRecordResult{RecordType: "TXT_DMARC", Expected: expected, Found: found, Status: status}
}

func verifyTXT(txtRecords []string, lookupErr error, hash string) DnsRecordResult {
	expected := "nepsefilling-domain-verification=" + hash

	if lookupErr != nil {
		return DnsRecordResult{RecordType: "TXT_VERIFY", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.HasPrefix(txt, "nepsefilling-domain-verification=") {
			found = txt
			if txt == expected {
				status = "pass"
			}

			break
		}
	}

	return DnsRecordResult{RecordType: "TXT_VERIFY", Expected: expected, Found: found, Status: status}
}
