package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type DnsVerificationHandler struct {
	db *sqlx.DB
}

func NewDnsVerificationHandler(db *sqlx.DB) *DnsVerificationHandler {
	return &DnsVerificationHandler{db: db}
}

type VerifyDomainRequest struct {
	Domain string `json:"domain"`
}

type DnsRecordResult struct {
	RecordType string `json:"record_type"`
	Expected   string `json:"expected"`
	Found      string `json:"found"`
	Status     string `json:"status"`
}

type VerifyDomainResponse struct {
	Domain    string            `json:"domain"`
	AllPassed bool              `json:"all_passed"`
	Records   []DnsRecordResult `json:"records"`
	CheckedAt string            `json:"checked_at"`
}

// domainRegex validates basic domain name format
var domainRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)

// generateVerificationHash replicates the JS hash from DomainVerificationDialog.tsx
// The JS uses signed 32-bit integer arithmetic: hash = (hash << 5) - hash + char; hash |= 0
// Domain names are ASCII, so byte iteration matches JS charCodeAt behavior.
func generateVerificationHash(domain string) string {
	var hash int32 = 0
	for i := 0; i < len(domain); i++ {
		hash = (hash << 5) - hash + int32(domain[i])
	}

	// Use integer abs to avoid float64 precision issues
	var absHash int64
	if hash < 0 {
		absHash = -int64(hash)
	} else {
		absHash = int64(hash)
	}

	hex := fmt.Sprintf("%08x", absHash)

	// Reverse the hex string
	runes := []rune(hex)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	reversed := string(runes)

	return hex + reversed + hex + "cfa4334fc1"
}

func (h *DnsVerificationHandler) VerifyDomain(c echo.Context) error {
	var req VerifyDomainRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	domain := strings.TrimSpace(req.Domain)
	if domain == "" {
		return response.BadRequest(c, "Domain is required")
	}

	// Validate domain format
	if len(domain) > 253 || !domainRegex.MatchString(domain) {
		return response.BadRequest(c, "Invalid domain format")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	records := make([]DnsRecordResult, 0, 3)

	// 1. Check CNAME (DKIM)
	cnameResult := checkCNAME(ctx, domain)
	records = append(records, cnameResult)

	// 2. Lookup TXT records once and use for both SPF and verification checks
	resolver := net.Resolver{}
	txtRecords, txtErr := resolver.LookupTXT(ctx, domain)

	// 3. Check TXT (SPF)
	spfResult := checkSPF(txtRecords, txtErr)
	records = append(records, spfResult)

	// 4. Check TXT (Verification)
	verifyHash := generateVerificationHash(domain)
	verifyResult := checkVerification(txtRecords, txtErr, verifyHash)
	records = append(records, verifyResult)

	allPassed := cnameResult.Status == "pass" && spfResult.Status == "pass" && verifyResult.Status == "pass"

	// If all passed, update domain status in database
	if allPassed {
		if err := h.updateDomainStatus(domain, "verified"); err != nil {
			log.Printf("WARNING: DNS verification passed for %s but failed to update DB: %v", domain, err)
		}
	}

	return response.Success(c, VerifyDomainResponse{
		Domain:    domain,
		AllPassed: allPassed,
		Records:   records,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func checkCNAME(ctx context.Context, domain string) DnsRecordResult {
	lookupName := "litesrv._domainkey." + domain
	expected := "litesrv._domainkey.mlsend.com"

	resolver := net.Resolver{}
	cname, err := resolver.LookupCNAME(ctx, lookupName)
	if err != nil {
		return DnsRecordResult{
			RecordType: "CNAME_DKIM",
			Expected:   expected,
			Found:      "",
			Status:     "fail",
		}
	}

	// Strip trailing dot from DNS response
	cname = strings.TrimSuffix(cname, ".")

	// LookupCNAME returns the lookup name itself when no CNAME exists — treat as not found
	if strings.EqualFold(cname, lookupName) {
		return DnsRecordResult{
			RecordType: "CNAME_DKIM",
			Expected:   expected,
			Found:      "",
			Status:     "fail",
		}
	}

	status := "fail"
	if strings.EqualFold(cname, expected) {
		status = "pass"
	}

	return DnsRecordResult{
		RecordType: "CNAME_DKIM",
		Expected:   expected,
		Found:      cname,
		Status:     status,
	}
}

// checkSPF checks pre-fetched TXT records for SPF include
func checkSPF(txtRecords []string, lookupErr error) DnsRecordResult {
	expected := "include:_spf.mlsend.com"

	if lookupErr != nil {
		return DnsRecordResult{
			RecordType: "TXT_SPF",
			Expected:   expected,
			Found:      "",
			Status:     "fail",
		}
	}

	var found string
	status := "fail"
	for _, txt := range txtRecords {
		if strings.Contains(txt, "include:_spf.mlsend.com") {
			found = txt
			status = "pass"
			break
		}
		// Track SPF records even if they don't match
		if strings.HasPrefix(txt, "v=spf1") && found == "" {
			found = txt
		}
	}

	return DnsRecordResult{
		RecordType: "TXT_SPF",
		Expected:   expected,
		Found:      found,
		Status:     status,
	}
}

// checkVerification checks pre-fetched TXT records for domain verification hash
func checkVerification(txtRecords []string, lookupErr error, hash string) DnsRecordResult {
	expected := "nepsefilling-domain-verification=" + hash

	if lookupErr != nil {
		return DnsRecordResult{
			RecordType: "TXT_VERIFY",
			Expected:   expected,
			Found:      "",
			Status:     "fail",
		}
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

	return DnsRecordResult{
		RecordType: "TXT_VERIFY",
		Expected:   expected,
		Found:      found,
		Status:     status,
	}
}

// updateDomainStatus updates the sending domain status in account_settings JSONB.
// Uses raw JSON manipulation to preserve unknown fields in the domain objects.
func (h *DnsVerificationHandler) updateDomainStatus(domain, status string) error {
	var valueJSON json.RawMessage
	err := h.db.Get(&valueJSON, "SELECT value FROM app_account_settings WHERE key = 'domains'")
	if err != nil {
		return fmt.Errorf("failed to read domains config: %w", err)
	}

	// Parse into a generic structure to preserve all fields
	var domainsConfig map[string]json.RawMessage
	if err := json.Unmarshal(valueJSON, &domainsConfig); err != nil {
		return fmt.Errorf("failed to unmarshal domains config: %w", err)
	}

	sendingRaw, ok := domainsConfig["sending_domains"]
	if !ok {
		return fmt.Errorf("sending_domains not found in config")
	}

	var sendingDomains []map[string]interface{}
	if err := json.Unmarshal(sendingRaw, &sendingDomains); err != nil {
		return fmt.Errorf("failed to unmarshal sending_domains: %w", err)
	}

	updated := false
	for i := range sendingDomains {
		if d, _ := sendingDomains[i]["domain"].(string); d == domain {
			sendingDomains[i]["status"] = status
			updated = true
			break
		}
	}

	if !updated {
		return fmt.Errorf("domain %s not found in sending_domains", domain)
	}

	newSending, err := json.Marshal(sendingDomains)
	if err != nil {
		return fmt.Errorf("failed to marshal updated sending_domains: %w", err)
	}
	domainsConfig["sending_domains"] = newSending

	newValue, err := json.Marshal(domainsConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal updated domains config: %w", err)
	}

	_, err = h.db.Exec(
		"UPDATE app_account_settings SET value = $1, updated_at = NOW() WHERE key = 'domains'",
		newValue,
	)
	if err != nil {
		return fmt.Errorf("failed to update domains in database: %w", err)
	}

	return nil
}
