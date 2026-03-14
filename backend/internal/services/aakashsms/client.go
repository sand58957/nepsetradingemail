package aakashsms

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const BaseURL = "https://sms.aakashsms.com/sms"

// Client wraps the Aakash SMS API.
type Client struct {
	baseURL    string
	authToken  string
	httpClient *http.Client
}

// NewClient creates an Aakash SMS API client.
func NewClient(authToken string) *Client {
	return &Client{
		baseURL:   BaseURL,
		authToken: authToken,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendResponse is the response from the send SMS API.
type SendResponse struct {
	Error   bool     `json:"error"`
	Message string   `json:"message"`
	Data    SendData `json:"data"`
}

// SendData holds the valid and invalid message results.
// Aakash SMS returns {"valid":[],"invalid":[]} on success but [] on error,
// so we need custom unmarshal to handle both cases.
type SendData struct {
	Valid   []MessageResult `json:"valid"`
	Invalid []MessageResult `json:"invalid"`
}

func (d *SendData) UnmarshalJSON(b []byte) error {
	// If it's an empty array (error response), leave fields as nil
	if len(b) > 0 && b[0] == '[' {
		return nil
	}
	// Otherwise unmarshal as object
	type Alias SendData
	var a Alias
	if err := json.Unmarshal(b, &a); err != nil {
		return err
	}
	*d = SendData(a)
	return nil
}

// MessageResult represents the result for a single message recipient.
type MessageResult struct {
	ID        string `json:"id"`
	Mobile    string `json:"mobile"`
	Text      string `json:"text"`
	Credit    int    `json:"credit"`
	Network   string `json:"network"`
	Status    string `json:"status"`
	Shortcode string `json:"shortcode"`
}

// BalanceResponse is the response from the credit balance API.
type BalanceResponse struct {
	AvailableCredit int `json:"available_credit"`
	TotalSMSSent    int `json:"total_sms_sent"`
	ResponseCode    int `json:"response_code"`
}

// ReportResponse is the response from the delivery reports API.
type ReportResponse struct {
	Error     bool             `json:"error"`
	TotalPage int              `json:"total_page"`
	Data      []DeliveryReport `json:"data"`
}

// DeliveryReport represents a single delivery report entry.
type DeliveryReport struct {
	ID         int    `json:"id"`
	Receiver   string `json:"receiver"`
	Network    string `json:"network"`
	Message    string `json:"message"`
	APICredit  string `json:"api_credit"`
	DeliveryAt string `json:"delivery_at"`
}

// doFormRequest sends a form-urlencoded POST request to the Aakash SMS API.
// The auth_token is always included as a form parameter.
func (c *Client) doFormRequest(endpoint string, formData url.Values) ([]byte, int, error) {
	// Always include auth_token in form data
	formData.Set("auth_token", c.authToken)

	reqURL := fmt.Sprintf("%s%s", c.baseURL, endpoint)
	req, err := http.NewRequest(http.MethodPost, reqURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("aakashsms request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

// SendSMS sends an SMS to a single phone number.
func (c *Client) SendSMS(to, text string) (*SendResponse, error) {
	formData := url.Values{
		"to":   {to},
		"text": {text},
	}

	body, statusCode, err := c.doFormRequest("/v3/send", formData)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		return nil, fmt.Errorf("aakashsms error (%d): %s", statusCode, string(body))
	}

	var result SendResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Error {
		return &result, fmt.Errorf("aakashsms error: %s", result.Message)
	}

	return &result, nil
}

// SendBulkSMS sends an SMS to multiple phone numbers (comma-separated).
func (c *Client) SendBulkSMS(numbers []string, text string) (*SendResponse, error) {
	to := strings.Join(numbers, ",")
	return c.SendSMS(to, text)
}

// GetBalance fetches the current credit balance.
func (c *Client) GetBalance() (*BalanceResponse, error) {
	formData := url.Values{}

	body, statusCode, err := c.doFormRequest("/v1/credit", formData)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		return nil, fmt.Errorf("aakashsms error (%d): %s", statusCode, string(body))
	}

	var result BalanceResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse balance response: %w", err)
	}

	return &result, nil
}

// GetDeliveryReports fetches delivery reports with pagination.
func (c *Client) GetDeliveryReports(page int) (*ReportResponse, error) {
	formData := url.Values{
		"page": {fmt.Sprintf("%d", page)},
	}

	body, statusCode, err := c.doFormRequest("/v1/report/api", formData)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		return nil, fmt.Errorf("aakashsms error (%d): %s", statusCode, string(body))
	}

	var result ReportResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse report response: %w", err)
	}

	return &result, nil
}

// TestConnection verifies the auth token is valid by sending a test request.
// Uses the send endpoint with an obviously invalid number to verify auth without
// actually sending an SMS. A valid token returns {"error":false,...} or
// {"error":true,"message":"..."} quickly, while an invalid token hangs or errors.
func (c *Client) TestConnection() error {
	// Use a short timeout for connection test
	origTimeout := c.httpClient.Timeout
	c.httpClient.Timeout = 5 * time.Second
	defer func() { c.httpClient.Timeout = origTimeout }()

	// Try the send endpoint with invalid number — valid tokens respond quickly
	formData := url.Values{
		"to":   {"0000000000"},
		"text": {"connection_test"},
	}

	body, _, err := c.doFormRequest("/v3/send", formData)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	// Parse response — any JSON response means the API accepted our auth token
	var result SendResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("unexpected API response")
	}

	// If the API says "The requested ip is not valid", the token is valid but IP isn't whitelisted
	if result.Error && strings.Contains(result.Message, "ip is not valid") {
		return fmt.Errorf("API token is valid but your server IP is not whitelisted in Aakash SMS")
	}

	// Any valid JSON response means auth token works
	return nil
}
