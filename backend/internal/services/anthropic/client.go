package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const apiURL = "https://api.anthropic.com/v1/messages"
const apiVersion = "2023-06-01"

// Client wraps the Anthropic Messages API.
type Client struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewClient creates a new Anthropic API client.
func NewClient(apiKey, model string) *Client {
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}
	return &Client{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

// Message represents a conversation message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Request is the API request body.
type Request struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []Message `json:"messages"`
}

// ContentBlock is a single content block in the response.
type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Usage tracks token consumption.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Response is the API response.
type Response struct {
	ID      string         `json:"id"`
	Type    string         `json:"type"`
	Role    string         `json:"role"`
	Content []ContentBlock `json:"content"`
	Usage   Usage          `json:"usage"`
}

// ErrorResponse represents an API error.
type ErrorResponse struct {
	Type  string `json:"type"`
	Error struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// Generate sends a message to the Anthropic API and returns the response.
func (c *Client) Generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int) (*Response, error) {
	if maxTokens == 0 {
		maxTokens = 8192
	}

	reqBody := Request{
		Model:     c.model,
		MaxTokens: maxTokens,
		System:    systemPrompt,
		Messages: []Message{
			{Role: "user", Content: userPrompt},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", apiVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if jsonErr := json.Unmarshal(body, &errResp); jsonErr == nil && errResp.Error.Message != "" {
			return nil, fmt.Errorf("anthropic API error (%d): %s - %s", resp.StatusCode, errResp.Error.Type, errResp.Error.Message)
		}
		return nil, fmt.Errorf("anthropic API error (%d): %s", resp.StatusCode, string(body))
	}

	var result Response
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// GetTextContent extracts the text from the first content block.
func (r *Response) GetTextContent() string {
	if len(r.Content) > 0 && r.Content[0].Type == "text" {
		return r.Content[0].Text
	}
	return ""
}

// TotalTokens returns total tokens used.
func (r *Response) TotalTokens() int {
	return r.Usage.InputTokens + r.Usage.OutputTokens
}
