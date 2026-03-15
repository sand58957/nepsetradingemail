package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const BaseURL = "https://api.telegram.org/bot"

// Client wraps the Telegram Bot API.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient creates a Telegram Bot API client.
func NewClient(token string) *Client {
	return &Client{
		baseURL: BaseURL + token,
		token:   token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// API Response types

type APIResponse struct {
	OK          bool            `json:"ok"`
	Result      json.RawMessage `json:"result,omitempty"`
	Description string          `json:"description,omitempty"`
	ErrorCode   int             `json:"error_code,omitempty"`
}

type User struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
}

type Message struct {
	MessageID int64  `json:"message_id"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text,omitempty"`
	Date      int64  `json:"date"`
}

type Chat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	URL          string `json:"url,omitempty"`
	CallbackData string `json:"callback_data,omitempty"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

type SendMessageRequest struct {
	ChatID      int64                 `json:"chat_id"`
	Text        string                `json:"text"`
	ParseMode   string                `json:"parse_mode,omitempty"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

type SendPhotoRequest struct {
	ChatID      int64                 `json:"chat_id"`
	Photo       string                `json:"photo"`
	Caption     string                `json:"caption,omitempty"`
	ParseMode   string                `json:"parse_mode,omitempty"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

type WebhookInfo struct {
	URL                  string `json:"url"`
	HasCustomCertificate bool   `json:"has_custom_certificate"`
	PendingUpdateCount   int    `json:"pending_update_count"`
}

// doRequest sends a JSON POST request to the Telegram Bot API.
func (c *Client) doRequest(ctx context.Context, method string, payload interface{}) ([]byte, error) {
	var body io.Reader

	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	reqURL := fmt.Sprintf("%s/%s", c.baseURL, method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("telegram request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return respBody, nil
}

// GetMe tests the bot token and returns bot info.
func (c *Client) GetMe() (*User, error) {
	return c.GetMeCtx(context.Background())
}

// GetMeCtx tests the bot token and returns bot info with context.
func (c *Client) GetMeCtx(ctx context.Context) (*User, error) {
	respBody, err := c.doRequest(ctx, "getMe", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return nil, fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	var user User
	if err := json.Unmarshal(apiResp.Result, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	return &user, nil
}

// SendMessage sends a text message to a chat.
func (c *Client) SendMessage(chatID int64, text string, parseMode string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	return c.SendMessageCtx(context.Background(), chatID, text, parseMode, replyMarkup)
}

// SendMessageCtx sends a text message with context.
func (c *Client) SendMessageCtx(ctx context.Context, chatID int64, text string, parseMode string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	req := SendMessageRequest{
		ChatID:      chatID,
		Text:        text,
		ParseMode:   parseMode,
		ReplyMarkup: replyMarkup,
	}

	respBody, err := c.doRequest(ctx, "sendMessage", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return nil, fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	var msg Message
	if err := json.Unmarshal(apiResp.Result, &msg); err != nil {
		return nil, fmt.Errorf("failed to parse message: %w", err)
	}

	return &msg, nil
}

// SendPhoto sends a photo message to a chat.
func (c *Client) SendPhoto(chatID int64, photoURL string, caption string, parseMode string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	req := SendPhotoRequest{
		ChatID:      chatID,
		Photo:       photoURL,
		Caption:     caption,
		ParseMode:   parseMode,
		ReplyMarkup: replyMarkup,
	}

	respBody, err := c.doRequest(context.Background(), "sendPhoto", req)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return nil, fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	var msg Message
	if err := json.Unmarshal(apiResp.Result, &msg); err != nil {
		return nil, fmt.Errorf("failed to parse message: %w", err)
	}

	return &msg, nil
}

// SetWebhook sets the webhook URL for receiving updates.
func (c *Client) SetWebhook(url string, secretToken string) error {
	payload := map[string]interface{}{
		"url":             url,
		"secret_token":    secretToken,
		"allowed_updates": []string{"message", "callback_query", "my_chat_member"},
	}

	respBody, err := c.doRequest(context.Background(), "setWebhook", payload)
	if err != nil {
		return err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	return nil
}

// DeleteWebhook removes the current webhook.
func (c *Client) DeleteWebhook() error {
	respBody, err := c.doRequest(context.Background(), "deleteWebhook", nil)
	if err != nil {
		return err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	return nil
}

// GetWebhookInfo returns current webhook status.
func (c *Client) GetWebhookInfo() (*WebhookInfo, error) {
	respBody, err := c.doRequest(context.Background(), "getWebhookInfo", nil)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.OK {
		return nil, fmt.Errorf("telegram error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	var info WebhookInfo
	if err := json.Unmarshal(apiResp.Result, &info); err != nil {
		return nil, fmt.Errorf("failed to parse webhook info: %w", err)
	}

	return &info, nil
}

// TestConnection verifies the bot token is valid.
func (c *Client) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.GetMeCtx(ctx)
	return err
}
