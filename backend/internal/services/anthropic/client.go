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

// Supports both Anthropic Claude and Google Gemini APIs.
// Gemini is used by default (free tier: 250 requests/day, 10 RPM).

// Client wraps an LLM API (Gemini or Anthropic).
type Client struct {
	apiKey     string
	model      string
	provider   string // "gemini" or "anthropic"
	httpClient *http.Client
}

// NewClient creates a new LLM client. Defaults to Gemini.
func NewClient(apiKey, model string) *Client {
	provider := "gemini"

	// Auto-detect provider from model name
	if model == "" {
		model = "gemini-2.5-flash"
	}
	if len(model) > 6 && model[:6] == "claude" {
		provider = "anthropic"
	}

	return &Client{
		apiKey:   apiKey,
		model:    model,
		provider: provider,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

// ============================================================
// Unified Response
// ============================================================

// Usage tracks token consumption.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Response is the unified API response.
type Response struct {
	Text       string
	Usage      Usage
	TotalTokens int
}

// ============================================================
// Gemini API types
// ============================================================

type geminiRequest struct {
	Contents         []geminiContent       `json:"contents"`
	SystemInstruction *geminiContent       `json:"systemInstruction,omitempty"`
	GenerationConfig *geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenerationConfig struct {
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
	Temperature     float64 `json:"temperature,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// ============================================================
// Anthropic API types
// ============================================================

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	ID      string `json:"id"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// ============================================================
// Generate - Unified entry point
// ============================================================

// Generate calls the appropriate LLM API and returns text + usage.
func (c *Client) Generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int) (*Response, error) {
	if c.provider == "gemini" {
		return c.generateGemini(ctx, systemPrompt, userPrompt, maxTokens)
	}
	return c.generateAnthropic(ctx, systemPrompt, userPrompt, maxTokens)
}

// ============================================================
// Gemini Implementation
// ============================================================

func (c *Client) generateGemini(ctx context.Context, systemPrompt, userPrompt string, maxTokens int) (*Response, error) {
	if maxTokens == 0 {
		maxTokens = 8192
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", c.model)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{{Text: userPrompt}},
				Role:  "user",
			},
		},
		GenerationConfig: &geminiGenerationConfig{
			MaxOutputTokens: maxTokens,
			Temperature:     0.7,
		},
	}

	// Add system instruction
	if systemPrompt != "" {
		reqBody.SystemInstruction = &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		}
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Gemini API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error (%d): %s", resp.StatusCode, string(body))
	}

	var result geminiResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if result.Error != nil {
		return nil, fmt.Errorf("Gemini error: %s (%s)", result.Error.Message, result.Error.Status)
	}

	// Extract text from candidates
	text := ""
	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		text = result.Candidates[0].Content.Parts[0].Text
	}

	if text == "" {
		return nil, fmt.Errorf("Gemini returned empty response")
	}

	return &Response{
		Text: text,
		Usage: Usage{
			InputTokens:  result.UsageMetadata.PromptTokenCount,
			OutputTokens: result.UsageMetadata.CandidatesTokenCount,
		},
		TotalTokens: result.UsageMetadata.TotalTokenCount,
	}, nil
}

// ============================================================
// Anthropic Implementation (fallback)
// ============================================================

func (c *Client) generateAnthropic(ctx context.Context, systemPrompt, userPrompt string, maxTokens int) (*Response, error) {
	if maxTokens == 0 {
		maxTokens = 8192
	}

	reqBody := anthropicRequest{
		Model:     c.model,
		MaxTokens: maxTokens,
		System:    systemPrompt,
		Messages: []anthropicMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Anthropic API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Anthropic API error (%d): %s", resp.StatusCode, string(body))
	}

	var result anthropicResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	text := ""
	if len(result.Content) > 0 && result.Content[0].Type == "text" {
		text = result.Content[0].Text
	}

	return &Response{
		Text: text,
		Usage: Usage{
			InputTokens:  result.Usage.InputTokens,
			OutputTokens: result.Usage.OutputTokens,
		},
		TotalTokens: result.Usage.InputTokens + result.Usage.OutputTokens,
	}, nil
}
