package handlers

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
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
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

const (
	serverIP     = "194.180.176.91"
	dkimSelector = "mail"
	dkimKeyBits  = 2048
)

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

// DomainHandler manages per-account domains with DKIM key generation and DNS verification.
type DomainHandler struct {
	db         *sqlx.DB
	dkimKeyDir string
}

// NewDomainHandler creates a new DomainHandler.
// It reads DKIM_KEYS_DIR from environment (default: /opt/dkim-keys).
func NewDomainHandler(db *sqlx.DB) *DomainHandler {
	dir := os.Getenv("DKIM_KEYS_DIR")
	if dir == "" {
		dir = "/opt/dkim-keys"
	}

	return &DomainHandler{db: db, dkimKeyDir: dir}
}

// --------------------------------------------------------------------------
// DKIM key generation
// --------------------------------------------------------------------------

// generateDKIMKeyPair generates an RSA 2048-bit key pair for DKIM signing.
// Returns PEM-encoded private key and base64-encoded DER public key.
func generateDKIMKeyPair() (privateKeyPEM string, publicKeyBase64 string, err error) {
	key, err := rsa.GenerateKey(rand.Reader, dkimKeyBits)
	if err != nil {
		return "", "", fmt.Errorf("generate RSA key: %w", err)
	}

	// Private key → PEM
	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privBytes,
	})

	// Public key → base64 (for DNS TXT p= value)
	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return "", "", fmt.Errorf("marshal public key: %w", err)
	}

	pubB64 := base64.StdEncoding.EncodeToString(pubBytes)

	return string(privPEM), pubB64, nil
}

// --------------------------------------------------------------------------
// Verification hash (matches frontend algorithm for backward compatibility)
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
// DKIM key file management (for Exim4)
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
// SQL helpers (columns to SELECT — never includes dkim_private_key)
// --------------------------------------------------------------------------

const domainSelectCols = `id, account_id, domain, type, status, dkim_public_key, dkim_selector,
	verification_hash, domain_alignment, ssl, site, verified_at, created_at, updated_at`

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

// Create adds a new domain with auto-generated DKIM keys and verification hash.
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

	// Generate DKIM key pair
	privKey, pubKey, err := generateDKIMKeyPair()
	if err != nil {
		log.Printf("ERROR: generate DKIM keys for %s: %v", domain, err)
		return response.InternalError(c, "Failed to generate DKIM keys")
	}

	// Generate verification hash
	verifyHash := domainVerificationHash(domain)

	// Insert
	var d models.Domain

	err = h.db.QueryRowx(
		`INSERT INTO app_domains
			(account_id, domain, type, status, dkim_private_key, dkim_public_key, dkim_selector, verification_hash)
		 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
		 RETURNING `+domainSelectCols,
		accountID, domain, domainType, privKey, pubKey, dkimSelector, verifyHash,
	).StructScan(&d)
	if err != nil {
		log.Printf("ERROR: insert domain %s: %v", domain, err)
		return response.InternalError(c, "Failed to add domain")
	}

	// Write DKIM private key file for Exim4
	if err := h.writeDKIMKeyFile(domain, privKey); err != nil {
		log.Printf("WARNING: write DKIM key file for %s: %v", domain, err)
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

	// Get domain name for key file cleanup
	var domainName string

	err := h.db.Get(&domainName,
		`SELECT domain FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Domain not found")
	}

	_, err = h.db.Exec(`DELETE FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete domain")
	}

	// Only remove key file if no other account uses this domain
	var otherCnt int
	_ = h.db.Get(&otherCnt, `SELECT COUNT(*) FROM app_domains WHERE domain = $1`, domainName)
	if otherCnt == 0 {
		h.removeDKIMKeyFile(domainName)
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

	records := []models.DnsRecord{
		{
			Label: "TXT Record (DKIM)",
			Type:  "TXT",
			Name:  d.DKIMSelector + "._domainkey",
			Value: "v=DKIM1; k=rsa; p=" + d.DKIMPublicKey,
		},
		{
			Label: "TXT Record (SPF)",
			Type:  "TXT",
			Name:  "@",
			Value: "v=spf1 ip4:" + serverIP + " include:_spf.google.com ~all",
		},
		{
			Label: "TXT Record (Domain Verification)",
			Type:  "TXT",
			Name:  "@",
			Value: "nepsefilling-domain-verification=" + d.VerificationHash,
		},
	}

	return response.Success(c, models.DnsRecordsResponse{
		DomainID: d.ID,
		Domain:   d.Domain,
		Records:  records,
	})
}

// Verify performs live DNS lookups and checks DKIM, SPF, and verification records.
func (h *DomainHandler) Verify(c echo.Context) error {
	accountID := middleware.GetAccountID(c)
	if accountID == 0 {
		return response.BadRequest(c, "No account selected")
	}

	id := c.Param("id")

	// Need public key and verification hash from DB
	var d struct {
		ID               int    `db:"id"`
		Domain           string `db:"domain"`
		DKIMPublicKey    string `db:"dkim_public_key"`
		DKIMSelector     string `db:"dkim_selector"`
		VerificationHash string `db:"verification_hash"`
	}

	err := h.db.Get(&d,
		`SELECT id, domain, dkim_public_key, dkim_selector, verification_hash
		 FROM app_domains WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Domain not found")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	results := make([]DnsRecordResult, 0, 3)

	// 1. DKIM
	dkimResult := verifyDKIM(ctx, d.Domain, d.DKIMSelector, d.DKIMPublicKey)
	results = append(results, dkimResult)

	// 2. Lookup root-domain TXT once for SPF + verification
	resolver := net.Resolver{}
	txtRecords, txtErr := resolver.LookupTXT(ctx, d.Domain)

	// 3. SPF
	spfResult := verifySPF(txtRecords, txtErr)
	results = append(results, spfResult)

	// 4. Verification TXT
	verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)
	results = append(results, verifyResult)

	allPassed := dkimResult.Status == "pass" && spfResult.Status == "pass" && verifyResult.Status == "pass"

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

// --------------------------------------------------------------------------
// Auto-verification background job
// --------------------------------------------------------------------------

// StartAutoVerification starts a background goroutine that periodically checks
// all pending/failed domains and updates their status when DNS records pass.
func (h *DomainHandler) StartAutoVerification(ctx context.Context, interval time.Duration) {
	log.Printf("INFO: Domain auto-verification started (interval: %s)", interval)

	// Run once immediately on startup (with a small delay to let services warm up)
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

// verifyAllPendingDomains checks all pending/failed domains.
func (h *DomainHandler) verifyAllPendingDomains() {
	var domains []struct {
		ID               int    `db:"id"`
		Domain           string `db:"domain"`
		DKIMPublicKey    string `db:"dkim_public_key"`
		DKIMSelector     string `db:"dkim_selector"`
		VerificationHash string `db:"verification_hash"`
		Status           string `db:"status"`
	}

	err := h.db.Select(&domains,
		`SELECT id, domain, dkim_public_key, dkim_selector, verification_hash, status
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

		// Check DKIM
		dkimResult := verifyDKIM(ctx, d.Domain, d.DKIMSelector, d.DKIMPublicKey)

		// Lookup root-domain TXT once for SPF + verification
		resolver := net.Resolver{}
		txtRecords, txtErr := resolver.LookupTXT(ctx, d.Domain)

		// Check SPF
		spfResult := verifySPF(txtRecords, txtErr)

		// Check Verification TXT
		verifyResult := verifyTXT(txtRecords, txtErr, d.VerificationHash)

		cancel()

		allPassed := dkimResult.Status == "pass" && spfResult.Status == "pass" && verifyResult.Status == "pass"
		now := time.Now().UTC()

		if allPassed {
			_, _ = h.db.Exec(
				`UPDATE app_domains SET status = 'verified', verified_at = $1, updated_at = $1 WHERE id = $2`,
				now, d.ID)
			log.Printf("INFO: auto-verify: domain %s VERIFIED", d.Domain)
		} else {
			// Log which checks failed for debugging
			var failedChecks []string
			if dkimResult.Status != "pass" {
				failedChecks = append(failedChecks, "DKIM")
			}
			if spfResult.Status != "pass" {
				failedChecks = append(failedChecks, "SPF")
			}
			if verifyResult.Status != "pass" {
				failedChecks = append(failedChecks, "Verify")
			}

			log.Printf("INFO: auto-verify: domain %s still pending (failed: %s)",
				d.Domain, strings.Join(failedChecks, ", "))
		}
	}
}

// --------------------------------------------------------------------------
// DNS verification helpers
// --------------------------------------------------------------------------

func verifyDKIM(ctx context.Context, domain, selector, expectedPubKey string) DnsRecordResult {
	lookupName := selector + "._domainkey." + domain
	expected := "v=DKIM1"

	resolver := net.Resolver{}
	txtRecords, err := resolver.LookupTXT(ctx, lookupName)

	if err != nil {
		return DnsRecordResult{RecordType: "TXT_DKIM", Expected: expected, Found: "", Status: "fail"}
	}

	var found string
	status := "fail"

	for _, txt := range txtRecords {
		if strings.Contains(txt, "v=DKIM1") {
			found = txt

			// Compare public key: strip whitespace and check if our key is present
			norm := strings.ReplaceAll(txt, " ", "")
			normKey := strings.ReplaceAll(expectedPubKey, " ", "")

			if strings.Contains(norm, "p="+normKey) {
				status = "pass"
			} else if len(normKey) > 60 && strings.Contains(norm, normKey[:60]) {
				// Partial match — DNS might truncate
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
