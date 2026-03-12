package sendgrid

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const baseURL = "https://api.sendgrid.com/v3"

// Client wraps the SendGrid API for domain authentication.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a SendGrid API client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ---------- Domain Authentication API ----------

// DomainAuthRequest is the payload to create a domain authentication.
type DomainAuthRequest struct {
	Domain            string `json:"domain"`
	Subdomain         string `json:"subdomain,omitempty"`
	AutomaticSecurity bool   `json:"automatic_security"`
	CustomSPF         bool   `json:"custom_spf,omitempty"`
}

// DNSRecord represents a single DNS record from SendGrid.
type DNSRecord struct {
	Host string `json:"host"`
	Type string `json:"type"`
	Data string `json:"data"`
	Valid bool   `json:"valid"`
}

// DomainAuthDNS contains all DNS records for domain authentication.
type DomainAuthDNS struct {
	MailCNAME DNSRecord `json:"mail_cname"`
	DKIM1     DNSRecord `json:"dkim1"`
	DKIM2     DNSRecord `json:"dkim2"`
}

// DomainAuthResponse is the response from creating/getting domain authentication.
type DomainAuthResponse struct {
	ID                int           `json:"id"`
	Domain            string        `json:"domain"`
	Subdomain         string        `json:"subdomain"`
	Valid             bool          `json:"valid"`
	AutomaticSecurity bool          `json:"automatic_security"`
	DNS               DomainAuthDNS `json:"dns"`
}

// ValidationResult is the result of validating a domain.
type ValidationResult struct {
	ID                int  `json:"id"`
	Valid             bool `json:"valid"`
	ValidationResults struct {
		MailCNAME struct {
			Valid  bool   `json:"valid"`
			Reason string `json:"reason"`
		} `json:"mail_cname"`
		DKIM1 struct {
			Valid  bool   `json:"valid"`
			Reason string `json:"reason"`
		} `json:"dkim1"`
		DKIM2 struct {
			Valid  bool   `json:"valid"`
			Reason string `json:"reason"`
		} `json:"dkim2"`
	} `json:"validation_results"`
}

// AuthenticateDomain creates a new domain authentication in SendGrid.
func (c *Client) AuthenticateDomain(domain string) (*DomainAuthResponse, error) {
	payload := DomainAuthRequest{
		Domain:            domain,
		AutomaticSecurity: true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	respBody, statusCode, err := c.doRequest("POST", "/whitelabel/domains", body)
	if err != nil {
		return nil, fmt.Errorf("authenticate domain: %w", err)
	}

	if statusCode >= 400 {
		log.Printf("ERROR: SendGrid authenticate domain response (%d): %s", statusCode, string(respBody))
		return nil, fmt.Errorf("SendGrid API error (status %d): %s", statusCode, string(respBody))
	}

	var result DomainAuthResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// GetDomainAuth retrieves a domain authentication by ID.
func (c *Client) GetDomainAuth(domainID int) (*DomainAuthResponse, error) {
	path := fmt.Sprintf("/whitelabel/domains/%d", domainID)

	respBody, statusCode, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("get domain auth: %w", err)
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("SendGrid API error (status %d): %s", statusCode, string(respBody))
	}

	var result DomainAuthResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// ValidateDomain validates a domain authentication (checks DNS records).
func (c *Client) ValidateDomain(domainID int) (*ValidationResult, error) {
	path := fmt.Sprintf("/whitelabel/domains/%d/validate", domainID)

	respBody, statusCode, err := c.doRequest("POST", path, nil)
	if err != nil {
		return nil, fmt.Errorf("validate domain: %w", err)
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("SendGrid API error (status %d): %s", statusCode, string(respBody))
	}

	var result ValidationResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// DeleteDomainAuth deletes a domain authentication by ID.
func (c *Client) DeleteDomainAuth(domainID int) error {
	path := fmt.Sprintf("/whitelabel/domains/%d", domainID)

	_, statusCode, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("delete domain auth: %w", err)
	}

	if statusCode >= 400 {
		return fmt.Errorf("SendGrid API error (status %d)", statusCode)
	}

	return nil
}

// ListDomainAuths lists all domain authentications.
func (c *Client) ListDomainAuths() ([]DomainAuthResponse, error) {
	respBody, statusCode, err := c.doRequest("GET", "/whitelabel/domains", nil)
	if err != nil {
		return nil, fmt.Errorf("list domain auths: %w", err)
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("SendGrid API error (status %d): %s", statusCode, string(respBody))
	}

	var result []DomainAuthResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return result, nil
}

// ---------- HTTP helper ----------

func (c *Client) doRequest(method, path string, body []byte) ([]byte, int, error) {
	var reqBody io.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, baseURL+path, reqBody)
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	return respBody, resp.StatusCode, nil
}
