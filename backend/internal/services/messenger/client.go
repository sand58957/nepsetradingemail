package messenger

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const GraphAPIURL = "https://graph.facebook.com/v21.0"

// Client wraps the Facebook Messenger Platform API.
type Client struct {
	pageAccessToken string
	pageID          string
	httpClient      *http.Client
}

// NewClient creates a Messenger API client.
func NewClient(pageAccessToken, pageID string) *Client {
	return &Client{
		pageAccessToken: pageAccessToken,
		pageID:          pageID,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// SendResponse is the response from the Send API.
type SendResponse struct {
	RecipientID string `json:"recipient_id"`
	MessageID   string `json:"message_id"`
}

// ErrorResponse represents a Facebook API error.
type ErrorResponse struct {
	Error struct {
		Message   string `json:"message"`
		Type      string `json:"type"`
		Code      int    `json:"code"`
		FBTraceID string `json:"fbtrace_id"`
	} `json:"error"`
}

// UserProfile represents a user's profile info.
type UserProfile struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	ProfilePic string `json:"profile_pic"`
}

// SendTextMessage sends a text message to a user by PSID.
func (c *Client) SendTextMessage(psid, text string) (*SendResponse, error) {
	payload := map[string]interface{}{
		"recipient": map[string]string{"id": psid},
		"message":   map[string]string{"text": text},
		"messaging_type": "MESSAGE_TAG",
		"tag": "ACCOUNT_UPDATE",
	}

	return c.sendMessage(payload)
}

// SendImageMessage sends an image message to a user by PSID.
func (c *Client) SendImageMessage(psid, imageURL string) (*SendResponse, error) {
	payload := map[string]interface{}{
		"recipient": map[string]string{"id": psid},
		"message": map[string]interface{}{
			"attachment": map[string]interface{}{
				"type": "image",
				"payload": map[string]string{
					"url":         imageURL,
					"is_reusable": "true",
				},
			},
		},
		"messaging_type": "MESSAGE_TAG",
		"tag": "ACCOUNT_UPDATE",
	}

	return c.sendMessage(payload)
}

// SendTextWithImage sends a text message followed by an image.
func (c *Client) SendTextWithImage(psid, text, imageURL string) (*SendResponse, error) {
	// Send text first
	resp, err := c.SendTextMessage(psid, text)
	if err != nil {
		return nil, err
	}

	// If there's an image, send it too
	if imageURL != "" {
		resp, err = c.SendImageMessage(psid, imageURL)
		if err != nil {
			return resp, err
		}
	}

	return resp, nil
}

func (c *Client) sendMessage(payload map[string]interface{}) (*SendResponse, error) {
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/me/messages?access_token=%s", GraphAPIURL, c.pageAccessToken)

	req, err := http.NewRequest("POST", url, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("messenger API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp ErrorResponse
		json.Unmarshal(respBody, &errResp)
		return nil, fmt.Errorf("messenger API error (%d): %s", errResp.Error.Code, errResp.Error.Message)
	}

	var sendResp SendResponse
	if err := json.Unmarshal(respBody, &sendResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &sendResp, nil
}

// GetUserProfile fetches a user's profile by PSID.
func (c *Client) GetUserProfile(psid string) (*UserProfile, error) {
	url := fmt.Sprintf("%s/%s?fields=first_name,last_name,profile_pic&access_token=%s", GraphAPIURL, psid, c.pageAccessToken)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user profile: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var errResp ErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("profile fetch error (%d): %s", errResp.Error.Code, errResp.Error.Message)
	}

	var profile UserProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("failed to parse profile: %w", err)
	}

	return &profile, nil
}

// TestConnection verifies the page access token is valid by calling /me.
func (c *Client) TestConnection() (*PageInfo, error) {
	url := fmt.Sprintf("%s/me?fields=id,name&access_token=%s", GraphAPIURL, c.pageAccessToken)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var errResp ErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("invalid token: %s", errResp.Error.Message)
	}

	var page PageInfo
	if err := json.Unmarshal(body, &page); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &page, nil
}

// PageInfo represents basic page information.
type PageInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
