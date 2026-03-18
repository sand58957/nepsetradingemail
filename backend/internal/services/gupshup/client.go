package gupshup

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const BaseURL = "https://api.gupshup.io/wa/api/v1"

// Client wraps the Gupshup WhatsApp Business API.
type Client struct {
	baseURL     string
	apiKey      string
	appName     string
	sourcePhone string
	httpClient  *http.Client
}

// NewClient creates a Gupshup API client.
func NewClient(apiKey, appName, sourcePhone string) *Client {
	return &Client{
		baseURL:     BaseURL,
		apiKey:      apiKey,
		appName:     appName,
		sourcePhone: sourcePhone,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendResponse is the response from the Gupshup send message API.
type SendResponse struct {
	Status    string `json:"status"`
	MessageID string `json:"messageId"`
}

// ErrorResponse is the error response from the Gupshup API.
type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// TemplateInfo represents a template returned from Gupshup.
type TemplateInfo struct {
	ID            string `json:"id"`
	ElementName   string `json:"elementName"`
	Category      string `json:"category"`
	LanguageCode  string `json:"languageCode"`
	Status        string `json:"status"`
	HeaderType    string `json:"templateType,omitempty"`
	Body          string `json:"data,omitempty"`
	Meta          string `json:"meta,omitempty"`
	ModifiedOn    int64  `json:"modifiedOn,omitempty"`
	ContainerMeta string `json:"containerMeta,omitempty"`
}

// doFormRequest sends a form-urlencoded POST request (Gupshup's preferred format).
func (c *Client) doFormRequest(endpoint string, formData url.Values) ([]byte, int, error) {
	reqURL := fmt.Sprintf("%s%s", c.baseURL, endpoint)
	req, err := http.NewRequest(http.MethodPost, reqURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("apikey", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("gupshup request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

// doGetRequest sends a GET request with apikey header.
func (c *Client) doGetRequest(fullURL string) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("gupshup request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

// SendTemplateMessage sends a pre-approved template message to a destination phone number.
// templateJSON should be a JSON string like: {"id":"template_id","params":["param1","param2"]}
func (c *Client) SendTemplateMessage(destination, templateJSON string) (*SendResponse, error) {
	formData := url.Values{
		"channel":     {"whatsapp"},
		"source":      {c.sourcePhone},
		"destination": {destination},
		"src.name":    {c.appName},
		"template":    {templateJSON},
	}

	body, statusCode, err := c.doFormRequest("/template/msg", formData)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		var errResp ErrorResponse
		if jsonErr := json.Unmarshal(body, &errResp); jsonErr == nil && errResp.Message != "" {
			return nil, fmt.Errorf("gupshup error (%d): %s", statusCode, errResp.Message)
		}
		return nil, fmt.Errorf("gupshup error (%d): %s", statusCode, string(body))
	}

	var result SendResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// SendTextMessage sends a session text message (only within 24hr window).
func (c *Client) SendTextMessage(destination, text string) (*SendResponse, error) {
	msgJSON, _ := json.Marshal(map[string]string{
		"type": "text",
		"text": text,
	})

	formData := url.Values{
		"channel":     {"whatsapp"},
		"source":      {c.sourcePhone},
		"destination": {destination},
		"src.name":    {c.appName},
		"message":     {string(msgJSON)},
	}

	body, statusCode, err := c.doFormRequest("/msg", formData)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		var errResp ErrorResponse
		if jsonErr := json.Unmarshal(body, &errResp); jsonErr == nil && errResp.Message != "" {
			return nil, fmt.Errorf("gupshup error (%d): %s", statusCode, errResp.Message)
		}
		return nil, fmt.Errorf("gupshup error (%d): %s", statusCode, string(body))
	}

	var result SendResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// ListTemplates fetches all templates for the configured app from Gupshup.
func (c *Client) ListTemplates(appID string) ([]TemplateInfo, error) {
	fullURL := fmt.Sprintf("https://api.gupshup.io/wa/app/%s/template", appID)
	body, statusCode, err := c.doGetRequest(fullURL)
	if err != nil {
		return nil, err
	}

	if statusCode < 200 || statusCode >= 300 {
		return nil, fmt.Errorf("gupshup error (%d): %s", statusCode, string(body))
	}

	// Gupshup returns: {"status":"success","templates":[...]}
	var resp struct {
		Status    string         `json:"status"`
		Templates []TemplateInfo `json:"templates"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse templates response: %w", err)
	}

	return resp.Templates, nil
}

// CreateTemplateRequest holds the request for creating a template.
type CreateTemplateRequest struct {
	ElementName string `json:"element_name"`
	Language    string `json:"language"`
	Category    string `json:"category"`
	Content     string `json:"content"`
	Example     string `json:"example"`
	Vertical    string `json:"vertical"` // TEXT, IMAGE, VIDEO, DOCUMENT
	Buttons     string `json:"buttons"`  // Optional JSON string for buttons
}

// CreateTemplateResponse holds the response after creating a template.
type CreateTemplateResponse struct {
	Status   string       `json:"status"`
	Template TemplateInfo `json:"template"`
}

// CreateTemplate creates a new message template in Gupshup.
func (c *Client) CreateTemplate(appID string, req CreateTemplateRequest) (*CreateTemplateResponse, error) {
	fullURL := fmt.Sprintf("https://api.gupshup.io/wa/app/%s/template", appID)

	vertical := req.Vertical
	if vertical == "" {
		vertical = "TEXT"
	}
	templateType := vertical

	formData := url.Values{
		"elementName":                  {req.ElementName},
		"languageCode":                 {req.Language},
		"category":                     {req.Category},
		"templateType":                 {templateType},
		"vertical":                     {vertical},
		"content":                      {req.Content},
		"example":                      {req.Example},
		"enableSample":                 {"true"},
		"allowTemplateCategoryChange":  {"true"},
	}

	// For AUTHENTICATION category, add OTP button automatically
	if strings.EqualFold(req.Category, "AUTHENTICATION") {
		otpButtons := `[{"type":"OTP","otp_type":"COPY_CODE","text":"Copy Code"}]`
		formData.Set("buttons", otpButtons)
	}

	// If caller provided custom buttons, use those instead
	if req.Buttons != "" {
		formData.Set("buttons", req.Buttons)
	}

	httpReq, err := http.NewRequest(http.MethodPost, fullURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("apikey", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gupshup request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp ErrorResponse
		if jsonErr := json.Unmarshal(body, &errResp); jsonErr == nil && errResp.Message != "" {
			return nil, fmt.Errorf("gupshup error: %s", errResp.Message)
		}
		return nil, fmt.Errorf("gupshup error (%d): %s", resp.StatusCode, string(body))
	}

	// Check for error status in response body
	var checkStatus struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &checkStatus); err == nil && checkStatus.Status == "error" {
		return nil, fmt.Errorf("gupshup error: %s", checkStatus.Message)
	}

	var result CreateTemplateResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// DeleteTemplate deletes a template from Gupshup.
func (c *Client) DeleteTemplate(appID, elementName string) error {
	fullURL := fmt.Sprintf("https://api.gupshup.io/wa/app/%s/template/%s", appID, elementName)

	req, err := http.NewRequest(http.MethodDelete, fullURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("apikey", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("gupshup request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gupshup error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// TestConnection verifies the API key is valid by fetching templates.
func (c *Client) TestConnection(appID string) error {
	_, err := c.ListTemplates(appID)
	return err
}

// GetWalletBalance fetches the current wallet balance.
func (c *Client) GetWalletBalance() (string, error) {
	fullURL := "https://api.gupshup.io/wa/app/wallet/balance"
	body, statusCode, err := c.doGetRequest(fullURL)
	if err != nil {
		return "", err
	}

	if statusCode < 200 || statusCode >= 300 {
		return "", fmt.Errorf("gupshup error (%d): %s", statusCode, string(body))
	}

	var resp struct {
		Status  string `json:"status"`
		Balance string `json:"balance"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("failed to parse balance: %w", err)
	}

	return resp.Balance, nil
}
