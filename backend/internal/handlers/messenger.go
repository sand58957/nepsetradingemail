package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/messenger"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// MessengerHandler manages all Facebook Messenger marketing endpoints.
type MessengerHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

// NewMessengerHandler creates a new Messenger handler.
func NewMessengerHandler(db *sqlx.DB, cfg *config.Config) *MessengerHandler {
	return &MessengerHandler{db: db, cfg: cfg}
}

// ============================================================
// Models
// ============================================================

type MessengerSettings struct {
	ID              int       `json:"id" db:"id"`
	AccountID       int       `json:"account_id" db:"account_id"`
	PageID          string    `json:"page_id" db:"page_id"`
	PageAccessToken string    `json:"page_access_token" db:"page_access_token"`
	AppID           string    `json:"app_id" db:"app_id"`
	AppSecret       string    `json:"app_secret" db:"app_secret"`
	VerifyToken     string    `json:"verify_token" db:"verify_token"`
	WebhookSecret   string    `json:"webhook_secret" db:"webhook_secret"`
	SendRate        int       `json:"send_rate" db:"send_rate"`
	IsActive        bool      `json:"is_active" db:"is_active"`
	OptInKeyword    string    `json:"opt_in_keyword" db:"opt_in_keyword"`
	WelcomeMessage  string    `json:"welcome_message" db:"welcome_message"`
	KeywordPrompt   string    `json:"keyword_prompt" db:"keyword_prompt"`
	QRCodeURL       string    `json:"qr_code_url" db:"qr_code_url"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type MessengerContact struct {
	ID         int             `json:"id" db:"id"`
	AccountID  int             `json:"account_id" db:"account_id"`
	PSID       string          `json:"psid" db:"psid"`
	Name       string          `json:"name" db:"name"`
	Email      string          `json:"email" db:"email"`
	ProfilePic string          `json:"profile_pic" db:"profile_pic"`
	OptedIn    bool            `json:"opted_in" db:"opted_in"`
	OptedInAt  *time.Time      `json:"opted_in_at" db:"opted_in_at"`
	OptedOutAt *time.Time      `json:"opted_out_at" db:"opted_out_at"`
	Tags       json.RawMessage `json:"tags" db:"tags"`
	Attributes json.RawMessage `json:"attributes" db:"attributes"`
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at" db:"updated_at"`
}

type MessengerCampaign struct {
	ID             int             `json:"id" db:"id"`
	AccountID      int             `json:"account_id" db:"account_id"`
	Name           string          `json:"name" db:"name"`
	MessageText    string          `json:"message_text" db:"message_text"`
	ImageURL       string          `json:"image_url" db:"image_url"`
	Status         string          `json:"status" db:"status"`
	TargetFilter   json.RawMessage `json:"target_filter" db:"target_filter"`
	TotalTargets   int             `json:"total_targets" db:"total_targets"`
	SentCount      int             `json:"sent_count" db:"sent_count"`
	DeliveredCount int             `json:"delivered_count" db:"delivered_count"`
	FailedCount    int             `json:"failed_count" db:"failed_count"`
	ScheduledAt    *time.Time      `json:"scheduled_at" db:"scheduled_at"`
	StartedAt      *time.Time      `json:"started_at" db:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at" db:"completed_at"`
	CreatedBy      *int            `json:"created_by" db:"created_by"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type MessengerCampaignMessage struct {
	ID          int        `json:"id" db:"id"`
	CampaignID  int        `json:"campaign_id" db:"campaign_id"`
	ContactID   int        `json:"contact_id" db:"contact_id"`
	FBMessageID string     `json:"fb_message_id" db:"fb_message_id"`
	Status      string     `json:"status" db:"status"`
	ErrorReason string     `json:"error_reason" db:"error_reason"`
	SubmittedAt *time.Time `json:"submitted_at" db:"submitted_at"`
	DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
	ReadAt      *time.Time `json:"read_at" db:"read_at"`
	FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// helper to build a Messenger client from account settings
func (h *MessengerHandler) getClient(accountID int) (*messenger.Client, *MessengerSettings, error) {
	var settings MessengerSettings
	err := h.db.Get(&settings, "SELECT * FROM messenger_settings WHERE account_id = $1", accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("Messenger settings not configured")
	}
	if settings.PageAccessToken == "" {
		return nil, nil, fmt.Errorf("Messenger page access token not set")
	}

	client := messenger.NewClient(settings.PageAccessToken, settings.PageID)
	return client, &settings, nil
}

// ============================================================
// Settings Handlers
// ============================================================

// GetSettings returns the Messenger settings for the current account.
func (h *MessengerHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var settings MessengerSettings
	err := h.db.Get(&settings, "SELECT * FROM messenger_settings WHERE account_id = $1", accountID)
	if err != nil {
		return response.Success(c, map[string]interface{}{
			"configured": false,
		})
	}

	// Mask sensitive fields
	masked := settings
	if len(masked.PageAccessToken) > 12 {
		masked.PageAccessToken = strings.Repeat("*", len(masked.PageAccessToken)-12) + masked.PageAccessToken[len(masked.PageAccessToken)-12:]
	}
	if len(masked.AppSecret) > 8 {
		masked.AppSecret = strings.Repeat("*", len(masked.AppSecret)-8) + masked.AppSecret[len(masked.AppSecret)-8:]
	}

	return response.Success(c, map[string]interface{}{
		"configured": true,
		"settings":   masked,
	})
}

// UpdateSettings upserts Messenger settings for the current account.
func (h *MessengerHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		PageID          string `json:"page_id"`
		PageAccessToken string `json:"page_access_token"`
		AppID           string `json:"app_id"`
		AppSecret       string `json:"app_secret"`
		VerifyToken     string `json:"verify_token"`
		SendRate        int    `json:"send_rate"`
		OptInKeyword    string `json:"opt_in_keyword"`
		WelcomeMessage  string `json:"welcome_message"`
		KeywordPrompt   string `json:"keyword_prompt"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.SendRate <= 0 {
		req.SendRate = 10
	}

	// If tokens contain asterisks, they're masked — don't overwrite
	pageAccessToken := req.PageAccessToken
	if strings.Contains(pageAccessToken, "*") {
		pageAccessToken = ""
	}
	appSecret := req.AppSecret
	if strings.Contains(appSecret, "*") {
		appSecret = ""
	}

	// Generate webhook secret if not exists
	var existingSecret string
	h.db.Get(&existingSecret, "SELECT webhook_secret FROM messenger_settings WHERE account_id = $1", accountID)
	if existingSecret == "" {
		existingSecret = fmt.Sprintf("msgr_%d_%d", accountID, time.Now().UnixNano())
	}

	_, err := h.db.Exec(`
		INSERT INTO messenger_settings (account_id, page_id, page_access_token, app_id, app_secret, verify_token, webhook_secret, send_rate, opt_in_keyword, welcome_message, keyword_prompt, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			page_id = EXCLUDED.page_id,
			page_access_token = CASE WHEN EXCLUDED.page_access_token = '' THEN messenger_settings.page_access_token ELSE EXCLUDED.page_access_token END,
			app_id = EXCLUDED.app_id,
			app_secret = CASE WHEN EXCLUDED.app_secret = '' THEN messenger_settings.app_secret ELSE EXCLUDED.app_secret END,
			verify_token = EXCLUDED.verify_token,
			send_rate = EXCLUDED.send_rate,
			opt_in_keyword = EXCLUDED.opt_in_keyword,
			welcome_message = EXCLUDED.welcome_message,
			keyword_prompt = EXCLUDED.keyword_prompt,
			updated_at = NOW()
	`, accountID, req.PageID, pageAccessToken, req.AppID, appSecret, req.VerifyToken, existingSecret, req.SendRate, req.OptInKeyword, req.WelcomeMessage, req.KeywordPrompt)
	if err != nil {
		log.Printf("[messenger] Failed to save settings: %v", err)
		return response.InternalError(c, "Failed to save settings")
	}

	// Get the webhook URL
	var webhookSecret string
	h.db.Get(&webhookSecret, "SELECT webhook_secret FROM messenger_settings WHERE account_id = $1", accountID)

	return response.Success(c, map[string]interface{}{
		"message":     "Messenger settings saved",
		"webhook_url": fmt.Sprintf("/api/webhooks/messenger/%s", webhookSecret),
	})
}

// TestConnection verifies the Messenger page access token is valid.
func (h *MessengerHandler) TestConnection(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	client, _, err := h.getClient(accountID)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	page, err := client.TestConnection()
	if err != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Connection failed: %v", err))
	}

	return response.Success(c, map[string]interface{}{
		"connected": true,
		"page_id":   page.ID,
		"page_name": page.Name,
	})
}

// UploadQR uploads a QR code image to Bunny CDN and saves the URL in settings.
func (h *MessengerHandler) UploadQR(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file uploaded")
	}

	contentType := file.Header.Get("Content-Type")
	if contentType != "image/png" && contentType != "image/jpeg" && contentType != "image/webp" {
		return response.BadRequest(c, "Only PNG, JPEG, and WebP images are allowed")
	}

	if file.Size > 5*1024*1024 {
		return response.BadRequest(c, "File too large (max 5MB)")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read file")
	}
	defer src.Close()

	fileData, err := io.ReadAll(src)
	if err != nil {
		return response.InternalError(c, "Failed to read file data")
	}

	timestamp := time.Now().UnixMilli()
	safeName := strings.ReplaceAll(file.Filename, " ", "-")
	storagePath := fmt.Sprintf("messenger-qr/%d-%s", timestamp, safeName)
	storageURL := fmt.Sprintf("%s/%s/%s", h.cfg.BunnyCDNStorageURL, h.cfg.BunnyCDNStorageZone, storagePath)

	req, err := http.NewRequest("PUT", storageURL, bytes.NewReader(fileData))
	if err != nil {
		return response.InternalError(c, "Failed to create upload request")
	}
	req.Header.Set("AccessKey", h.cfg.BunnyCDNStorageKey)
	req.Header.Set("Content-Type", contentType)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return response.InternalError(c, "Failed to upload to CDN")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[messenger] Bunny CDN upload failed: %d %s", resp.StatusCode, string(body))
		return response.InternalError(c, "CDN upload failed")
	}

	cdnURL := fmt.Sprintf("%s/%s", h.cfg.BunnyCDNPullURL, storagePath)

	_, err = h.db.Exec(`
		INSERT INTO messenger_settings (account_id, qr_code_url, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			qr_code_url = EXCLUDED.qr_code_url,
			updated_at = NOW()
	`, accountID, cdnURL)
	if err != nil {
		log.Printf("[messenger] Failed to save QR URL: %v", err)
		return response.InternalError(c, "Failed to save QR code URL")
	}

	return response.Success(c, map[string]string{"url": cdnURL})
}

// DeleteQR removes the QR code URL from settings.
func (h *MessengerHandler) DeleteQR(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	_, err := h.db.Exec(`UPDATE messenger_settings SET qr_code_url = '', updated_at = NOW() WHERE account_id = $1`, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to remove QR code")
	}

	return response.SuccessWithMessage(c, "QR code removed", nil)
}

// GenerateKeyword generates a random opt-in keyword and saves it.
func (h *MessengerHandler) GenerateKeyword(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	// Generate a random 8-character alphanumeric code
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 8)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return response.InternalError(c, "Failed to generate random code")
		}
		code[i] = chars[n.Int64()]
	}
	keyword := string(code)

	_, err := h.db.Exec(`
		INSERT INTO messenger_settings (account_id, opt_in_keyword, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			opt_in_keyword = EXCLUDED.opt_in_keyword,
			updated_at = NOW()
	`, accountID, keyword)
	if err != nil {
		log.Printf("[messenger] Failed to save generated keyword: %v", err)
		return response.InternalError(c, "Failed to save keyword")
	}

	return response.Success(c, map[string]string{"keyword": keyword})
}

// ============================================================
// Webhook Handlers
// ============================================================

// WebhookVerify handles the Facebook webhook verification (GET request).
func (h *MessengerHandler) WebhookVerify(c echo.Context) error {
	accountID := c.Param("account_id")

	var settings MessengerSettings
	err := h.db.Get(&settings, "SELECT * FROM messenger_settings WHERE account_id = $1", accountID)
	if err != nil {
		return c.String(http.StatusForbidden, "Invalid account")
	}

	mode := c.QueryParam("hub.mode")
	token := c.QueryParam("hub.verify_token")
	challenge := c.QueryParam("hub.challenge")

	if mode == "subscribe" && token == settings.VerifyToken {
		log.Printf("[messenger] Webhook verified for account %d", settings.AccountID)
		return c.String(http.StatusOK, challenge)
	}

	return c.String(http.StatusForbidden, "Verification failed")
}

// WebhookReceive handles incoming Messenger webhook events (POST request).
func (h *MessengerHandler) WebhookReceive(c echo.Context) error {
	accountID := c.Param("account_id")

	var settings MessengerSettings
	err := h.db.Get(&settings, "SELECT * FROM messenger_settings WHERE account_id = $1", accountID)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]string{"status": "ignored"})
	}

	// Parse the webhook body
	body, _ := io.ReadAll(c.Request().Body)

	// Forward webhook to external URL (api.nepsetrading.com) in background
	go func(rawBody []byte, headers http.Header) {
		forwardURL := "https://api.nepsetrading.com/api/facebook/webhook"
		req, err := http.NewRequest("POST", forwardURL, bytes.NewReader(rawBody))
		if err != nil {
			log.Printf("[messenger] Forward: failed to create request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if sig := headers.Get("X-Hub-Signature-256"); sig != "" {
			req.Header.Set("X-Hub-Signature-256", sig)
		}
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[messenger] Forward: failed to send: %v", err)
			return
		}
		defer resp.Body.Close()
		log.Printf("[messenger] Forward: sent to %s, status=%d", forwardURL, resp.StatusCode)
	}(body, c.Request().Header.Clone())

	// Verify signature if app_secret is set
	if settings.AppSecret != "" {
		signature := c.Request().Header.Get("X-Hub-Signature-256")
		if signature != "" {
			mac := hmac.New(sha256.New, []byte(settings.AppSecret))
			mac.Write(body)
			expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
			if !hmac.Equal([]byte(signature), []byte(expected)) {
				log.Printf("[messenger] Invalid signature for account %d", settings.AccountID)
				return c.JSON(http.StatusOK, map[string]string{"status": "invalid_signature"})
			}
		}
	}

	var webhook struct {
		Object string `json:"object"`
		Entry  []struct {
			ID        string `json:"id"`
			Time      int64  `json:"time"`
			Messaging []struct {
				Sender    struct {
					ID string `json:"id"`
				} `json:"sender"`
				Recipient struct {
					ID string `json:"id"`
				} `json:"recipient"`
				Timestamp int64               `json:"timestamp"`
				Message   *struct {
					MID  string `json:"mid"`
					Text string `json:"text"`
				} `json:"message"`
				Delivery *struct {
					MIDs      []string `json:"mids"`
					Watermark int64    `json:"watermark"`
				} `json:"delivery"`
				Read *struct {
					Watermark int64 `json:"watermark"`
				} `json:"read"`
				Postback *struct {
					Title   string `json:"title"`
					Payload string `json:"payload"`
				} `json:"postback"`
				Optin *struct {
					Ref string `json:"ref"`
				} `json:"optin"`
			} `json:"messaging"`
		} `json:"entry"`
	}

	if err := json.Unmarshal(body, &webhook); err != nil {
		log.Printf("[messenger] Failed to parse webhook: %v", err)
		return c.JSON(http.StatusOK, map[string]string{"status": "parse_error"})
	}

	log.Printf("[messenger] Webhook received: object=%s, entries=%d, body_len=%d", webhook.Object, len(webhook.Entry), len(body))

	if webhook.Object != "page" {
		log.Printf("[messenger] Skipping: object is '%s', not 'page'", webhook.Object)
		return c.JSON(http.StatusOK, map[string]string{"status": "not_page"})
	}

	client := messenger.NewClient(settings.PageAccessToken, settings.PageID)

	for _, entry := range webhook.Entry {
		log.Printf("[messenger] Entry: id=%s, messaging_count=%d", entry.ID, len(entry.Messaging))
		for _, event := range entry.Messaging {
			senderID := event.Sender.ID
			log.Printf("[messenger] Event: sender=%s, has_message=%v, has_delivery=%v, has_read=%v, has_postback=%v", senderID, event.Message != nil, event.Delivery != nil, event.Read != nil, event.Postback != nil)
			if event.Message != nil {
				log.Printf("[messenger] Message text: '%s'", event.Message.Text)
			}

			// Skip messages from our own page
			if senderID == settings.PageID {
				log.Printf("[messenger] Skipping: sender is our page (%s)", settings.PageID)
				continue
			}

			// Handle incoming message — auto-subscribe contact
			if event.Message != nil {
				h.handleIncomingMessage(settings.AccountID, senderID, event.Message.Text, client)
			}

			// Handle postback
			if event.Postback != nil {
				h.handlePostback(settings.AccountID, senderID, event.Postback.Payload, client)
			}

			// Handle opt-in
			if event.Optin != nil {
				h.handleOptin(settings.AccountID, senderID, event.Optin.Ref, client)
			}

			// Handle delivery receipts
			if event.Delivery != nil {
				for _, mid := range event.Delivery.MIDs {
					h.db.Exec(`
						UPDATE messenger_campaign_messages SET status = 'delivered', delivered_at = NOW()
						WHERE fb_message_id = $1 AND status = 'submitted'
					`, mid)
				}
			}

			// Handle read receipts
			if event.Read != nil {
				// Update all delivered messages to read for this contact
				var contactID int
				h.db.Get(&contactID, "SELECT id FROM messenger_contacts WHERE account_id = $1 AND psid = $2", settings.AccountID, senderID)
				if contactID > 0 {
					h.db.Exec(`
						UPDATE messenger_campaign_messages SET status = 'read', read_at = NOW()
						WHERE contact_id = $1 AND status = 'delivered'
					`, contactID)
				}
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MessengerHandler) handleIncomingMessage(accountID int, psid, text string, client *messenger.Client) {
	now := time.Now()
	lower := strings.ToLower(strings.TrimSpace(text))

	// Get settings for opt-in keyword
	var settings MessengerSettings
	h.db.Get(&settings, "SELECT * FROM messenger_settings WHERE account_id = $1", accountID)

	optInKeyword := strings.ToLower(strings.TrimSpace(settings.OptInKeyword))

	// Check if contact exists
	var exists bool
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM messenger_contacts WHERE account_id = $1 AND psid = $2)", accountID, psid)

	if !exists {
		// If opt-in keyword is set, only add contact when they send the keyword
		if optInKeyword != "" {
			if lower == optInKeyword {
				// Keyword matches — subscribe the contact
				name := ""
				profilePic := ""
				if profile, err := client.GetUserProfile(psid); err == nil {
					name = strings.TrimSpace(profile.FirstName + " " + profile.LastName)
					profilePic = profile.ProfilePic
				}

				h.db.Exec(`
					INSERT INTO messenger_contacts (account_id, psid, name, profile_pic, opted_in, opted_in_at)
					VALUES ($1, $2, $3, $4, true, $5)
					ON CONFLICT (account_id, psid) DO NOTHING
				`, accountID, psid, name, profilePic, now)

				log.Printf("[messenger] New contact subscribed via keyword: %s (%s) for account %d", name, psid, accountID)

				// Send welcome message
				welcomeMsg := settings.WelcomeMessage
				if welcomeMsg == "" {
					welcomeMsg = "You have been successfully subscribed! Send STOP to unsubscribe."
				}
				client.SendTextMessage(psid, welcomeMsg)
			} else {
				// Wrong keyword — send prompt
				promptMsg := settings.KeywordPrompt
				if promptMsg == "" {
					promptMsg = fmt.Sprintf("Welcome! To subscribe, please send the keyword: %s", settings.OptInKeyword)
				}
				client.SendTextMessage(psid, promptMsg)
			}
			return
		}

		// No keyword set — auto-subscribe (original behavior)
		name := ""
		profilePic := ""
		if profile, err := client.GetUserProfile(psid); err == nil {
			name = strings.TrimSpace(profile.FirstName + " " + profile.LastName)
			profilePic = profile.ProfilePic
		}

		h.db.Exec(`
			INSERT INTO messenger_contacts (account_id, psid, name, profile_pic, opted_in, opted_in_at)
			VALUES ($1, $2, $3, $4, true, $5)
			ON CONFLICT (account_id, psid) DO NOTHING
		`, accountID, psid, name, profilePic, now)

		log.Printf("[messenger] New contact subscribed: %s (%s) for account %d", name, psid, accountID)

		if settings.WelcomeMessage != "" {
			client.SendTextMessage(psid, settings.WelcomeMessage)
		}
	}

	// Handle stop/unsubscribe commands
	if lower == "stop" || lower == "unsubscribe" {
		h.db.Exec(`
			UPDATE messenger_contacts SET opted_in = false, opted_out_at = $1, updated_at = NOW()
			WHERE account_id = $2 AND psid = $3
		`, now, accountID, psid)
		log.Printf("[messenger] Contact unsubscribed: %s for account %d", psid, accountID)
		client.SendTextMessage(psid, "You have been unsubscribed. Send START to re-subscribe.")
	}

	// Handle start/subscribe commands (re-subscribe or keyword-based subscribe for existing opted-out contacts)
	if lower == "start" || lower == "subscribe" || (optInKeyword != "" && lower == optInKeyword) {
		h.db.Exec(`
			UPDATE messenger_contacts SET opted_in = true, opted_in_at = $1, opted_out_at = NULL, updated_at = NOW()
			WHERE account_id = $2 AND psid = $3
		`, now, accountID, psid)
		log.Printf("[messenger] Contact re-subscribed: %s for account %d", psid, accountID)

		// Send welcome message on re-subscribe
		welcomeMsg := settings.WelcomeMessage
		if welcomeMsg == "" {
			welcomeMsg = "You have been successfully subscribed! Send STOP to unsubscribe."
		}
		client.SendTextMessage(psid, welcomeMsg)
	}
}

func (h *MessengerHandler) handlePostback(accountID int, psid, payload string, client *messenger.Client) {
	lower := strings.ToLower(payload)
	if lower == "get_started" || lower == "subscribe" {
		now := time.Now()
		name := ""
		profilePic := ""
		if profile, err := client.GetUserProfile(psid); err == nil {
			name = strings.TrimSpace(profile.FirstName + " " + profile.LastName)
			profilePic = profile.ProfilePic
		}

		h.db.Exec(`
			INSERT INTO messenger_contacts (account_id, psid, name, profile_pic, opted_in, opted_in_at)
			VALUES ($1, $2, $3, $4, true, $5)
			ON CONFLICT (account_id, psid) DO UPDATE SET opted_in = true, opted_in_at = $5, opted_out_at = NULL, updated_at = NOW()
		`, accountID, psid, name, profilePic, now)
	}
}

func (h *MessengerHandler) handleOptin(accountID int, psid, ref string, client *messenger.Client) {
	now := time.Now()
	name := ""
	profilePic := ""
	if profile, err := client.GetUserProfile(psid); err == nil {
		name = strings.TrimSpace(profile.FirstName + " " + profile.LastName)
		profilePic = profile.ProfilePic
	}

	h.db.Exec(`
		INSERT INTO messenger_contacts (account_id, psid, name, profile_pic, opted_in, opted_in_at)
		VALUES ($1, $2, $3, $4, true, $5)
		ON CONFLICT (account_id, psid) DO UPDATE SET opted_in = true, opted_in_at = $5, opted_out_at = NULL, updated_at = NOW()
	`, accountID, psid, name, profilePic, now)
}

// ============================================================
// Contact Handlers
// ============================================================

// ListContacts returns a paginated list of Messenger contacts.
func (h *MessengerHandler) ListContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	query := c.QueryParam("query")
	tag := c.QueryParam("tag")
	optedIn := c.QueryParam("opted_in")

	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if query != "" {
		where += fmt.Sprintf(" AND (psid ILIKE $%d OR name ILIKE $%d OR email ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}
	if tag != "" {
		where += fmt.Sprintf(" AND tags @> $%d::jsonb", argIdx)
		tagJSON, _ := json.Marshal([]string{tag})
		args = append(args, string(tagJSON))
		argIdx++
	}
	if optedIn == "true" {
		where += " AND opted_in = true"
	} else if optedIn == "false" {
		where += " AND opted_in = false"
	}

	var total int
	h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM messenger_contacts WHERE %s", where), args...)

	args = append(args, perPage, offset)
	var contacts []MessengerContact
	err := h.db.Select(&contacts, fmt.Sprintf("SELECT * FROM messenger_contacts WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argIdx, argIdx+1), args...)
	if err != nil {
		log.Printf("[messenger] Failed to fetch contacts: %v", err)
		return response.InternalError(c, "Failed to fetch contacts")
	}

	if contacts == nil {
		contacts = []MessengerContact{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"results":  contacts,
			"total":    total,
			"page":     page,
			"per_page": perPage,
		},
	})
}

// CreateContact adds a new Messenger contact manually.
func (h *MessengerHandler) CreateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		PSID       string          `json:"psid"`
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
		GroupIDs   []int           `json:"group_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.PSID == "" {
		return response.BadRequest(c, "PSID (Page-Scoped ID) is required")
	}

	tags := req.Tags
	if tags == nil {
		tags = json.RawMessage("[]")
	}
	attrs := req.Attributes
	if attrs == nil {
		attrs = json.RawMessage("{}")
	}

	now := time.Now()
	var contact MessengerContact
	err := h.db.Get(&contact, `
		INSERT INTO messenger_contacts (account_id, psid, name, email, opted_in, opted_in_at, tags, attributes)
		VALUES ($1, $2, $3, $4, true, $5, $6, $7)
		ON CONFLICT (account_id, psid) DO UPDATE SET
			name = EXCLUDED.name,
			email = EXCLUDED.email,
			tags = EXCLUDED.tags,
			attributes = EXCLUDED.attributes,
			updated_at = NOW()
		RETURNING *
	`, accountID, req.PSID, req.Name, req.Email, now, tags, attrs)
	if err != nil {
		log.Printf("[messenger] Failed to create contact: %v", err)
		return response.InternalError(c, "Failed to create contact")
	}

	for _, gid := range req.GroupIDs {
		h.db.Exec(`
			INSERT INTO messenger_contact_group_members (group_id, contact_id)
			SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM messenger_contact_groups WHERE id = $1 AND account_id = $3)
			ON CONFLICT DO NOTHING
		`, gid, contact.ID, accountID)
	}

	return response.Created(c, contact)
}

// UpdateContact updates an existing Messenger contact.
func (h *MessengerHandler) UpdateContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Name       string          `json:"name"`
		Email      string          `json:"email"`
		OptedIn    *bool           `json:"opted_in"`
		Tags       json.RawMessage `json:"tags"`
		Attributes json.RawMessage `json:"attributes"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var exists bool
	h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM messenger_contacts WHERE id = $1 AND account_id = $2)", id, accountID)
	if !exists {
		return response.NotFound(c, "Contact not found")
	}

	tags := req.Tags
	if tags == nil {
		tags = json.RawMessage("[]")
	}
	attrs := req.Attributes
	if attrs == nil {
		attrs = json.RawMessage("{}")
	}

	optedIn := true
	if req.OptedIn != nil {
		optedIn = *req.OptedIn
	}

	_, err2 := h.db.Exec(`
		UPDATE messenger_contacts SET name = $1, email = $2, opted_in = $3, tags = $4, attributes = $5, updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.Email, optedIn, tags, attrs, id, accountID)
	if err2 != nil {
		log.Printf("[messenger] Failed to update contact: %v", err2)
		return response.InternalError(c, "Failed to update contact")
	}

	return response.SuccessWithMessage(c, "Contact updated", nil)
}

// DeleteContact removes a Messenger contact.
func (h *MessengerHandler) DeleteContact(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec("DELETE FROM messenger_contacts WHERE id = $1 AND account_id = $2", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete contact")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Contact not found")
	}

	return response.SuccessWithMessage(c, "Contact deleted", nil)
}

// ImportContacts parses a CSV file and bulk inserts Messenger contacts.
func (h *MessengerHandler) ImportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "CSV file is required")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to open file")
	}
	defer src.Close()

	reader := csv.NewReader(src)
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return response.BadRequest(c, "Failed to read CSV header")
	}

	colMap := map[string]int{}
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	psidIdx, hasPSID := colMap["psid"]
	if !hasPSID {
		return response.BadRequest(c, "CSV must have a 'psid' column")
	}
	nameIdx, hasName := colMap["name"]
	emailIdx, hasEmail := colMap["email"]
	tagsIdx, hasTags := colMap["tags"]

	var groupIDs []int
	if gids := c.FormValue("group_ids"); gids != "" {
		json.Unmarshal([]byte(gids), &groupIDs)
	}

	imported := 0
	skipped := 0
	now := time.Now()
	var importedContactIDs []int

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			skipped++
			continue
		}

		psid := strings.TrimSpace(record[psidIdx])
		if psid == "" {
			skipped++
			continue
		}

		name := ""
		if hasName && nameIdx < len(record) {
			name = strings.TrimSpace(record[nameIdx])
		}
		email := ""
		if hasEmail && emailIdx < len(record) {
			email = strings.TrimSpace(record[emailIdx])
		}
		tags := "[]"
		if hasTags && tagsIdx < len(record) {
			tagStr := strings.TrimSpace(record[tagsIdx])
			if tagStr != "" {
				parts := strings.Split(tagStr, ",")
				for i := range parts {
					parts[i] = strings.TrimSpace(parts[i])
				}
				tagJSON, _ := json.Marshal(parts)
				tags = string(tagJSON)
			}
		}

		var contactID int
		err2 := h.db.Get(&contactID, `
			INSERT INTO messenger_contacts (account_id, psid, name, email, opted_in, opted_in_at, tags)
			VALUES ($1, $2, $3, $4, true, $5, $6::jsonb)
			ON CONFLICT (account_id, psid) DO UPDATE SET updated_at = NOW()
			RETURNING id
		`, accountID, psid, name, email, now, tags)
		if err2 != nil {
			log.Printf("[messenger] Import row error: %v", err2)
			skipped++
			continue
		}
		imported++
		if len(groupIDs) > 0 {
			importedContactIDs = append(importedContactIDs, contactID)
		}
	}

	for _, gid := range groupIDs {
		for _, cid := range importedContactIDs {
			h.db.Exec(`
				INSERT INTO messenger_contact_group_members (group_id, contact_id)
				SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM messenger_contact_groups WHERE id = $1 AND account_id = $3)
				ON CONFLICT DO NOTHING
			`, gid, cid, accountID)
		}
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
	})
}

// ExportContacts exports all Messenger contacts as a CSV file.
func (h *MessengerHandler) ExportContacts(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var contacts []MessengerContact
	if err := h.db.Select(&contacts, "SELECT * FROM messenger_contacts WHERE account_id = $1 ORDER BY created_at DESC", accountID); err != nil {
		return response.InternalError(c, "Failed to fetch contacts")
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=messenger_contacts.csv")

	writer := csv.NewWriter(c.Response().Writer)
	writer.Write([]string{"psid", "name", "email", "tags", "opted_in", "created_at"})

	for _, ct := range contacts {
		optedIn := "true"
		if !ct.OptedIn {
			optedIn = "false"
		}
		writer.Write([]string{
			ct.PSID,
			ct.Name,
			ct.Email,
			string(ct.Tags),
			optedIn,
			ct.CreatedAt.Format(time.RFC3339),
		})
	}

	writer.Flush()
	return nil
}

// ============================================================
// Contact Tags & Stats
// ============================================================

// ListContactTags returns all unique tags across Messenger contacts.
func (h *MessengerHandler) ListContactTags(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type TagRow struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tags []TagRow
	h.db.Select(&tags, `
		SELECT tag, COUNT(*) as count
		FROM messenger_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`, accountID)

	if tags == nil {
		tags = []TagRow{}
	}

	return response.Success(c, tags)
}

// CreateContactTag adds a tag to multiple contacts.
func (h *MessengerHandler) CreateContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Tag        string `json:"tag"`
		ContactIDs []int  `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Tag == "" {
		return response.BadRequest(c, "Tag name is required")
	}

	tag := strings.TrimSpace(strings.ToLower(req.Tag))
	updated := 0

	if len(req.ContactIDs) > 0 {
		for _, cid := range req.ContactIDs {
			result, err := h.db.Exec(`
				UPDATE messenger_contacts
				SET tags = CASE
					WHEN NOT tags @> to_jsonb($1::text) THEN tags || to_jsonb($1::text)
					ELSE tags
				END,
				updated_at = NOW()
				WHERE id = $2 AND account_id = $3
			`, tag, cid, accountID)
			if err == nil {
				if n, _ := result.RowsAffected(); n > 0 {
					updated++
				}
			}
		}
	}

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"updated": updated,
	})
}

// DeleteContactTag removes a tag from all contacts.
func (h *MessengerHandler) DeleteContactTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	tag := c.Param("tag")

	if tag == "" {
		return response.BadRequest(c, "Tag is required")
	}

	result, err := h.db.Exec(`
		UPDATE messenger_contacts
		SET tags = tags - $1, updated_at = NOW()
		WHERE account_id = $2 AND tags @> to_jsonb($1::text)
	`, tag, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete tag")
	}

	removed, _ := result.RowsAffected()

	return response.Success(c, map[string]interface{}{
		"tag":     tag,
		"removed": removed,
	})
}

// GetContactStats returns contact statistics.
func (h *MessengerHandler) GetContactStats(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts int `json:"total_contacts" db:"total_contacts"`
		OptedIn       int `json:"opted_in" db:"opted_in"`
		OptedOut      int `json:"opted_out" db:"opted_out"`
	}

	h.db.Get(&stats.TotalContacts, "SELECT COUNT(*) FROM messenger_contacts WHERE account_id = $1", accountID)
	h.db.Get(&stats.OptedIn, "SELECT COUNT(*) FROM messenger_contacts WHERE account_id = $1 AND opted_in = true", accountID)
	h.db.Get(&stats.OptedOut, "SELECT COUNT(*) FROM messenger_contacts WHERE account_id = $1 AND opted_in = false", accountID)

	type TagStat struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}
	var tagStats []TagStat
	h.db.Select(&tagStats, `
		SELECT tag, COUNT(*) as count
		FROM messenger_contacts, jsonb_array_elements_text(tags) AS tag
		WHERE account_id = $1
		GROUP BY tag ORDER BY count DESC LIMIT 20
	`, accountID)
	if tagStats == nil {
		tagStats = []TagStat{}
	}

	var recentCount int
	h.db.Get(&recentCount, "SELECT COUNT(*) FROM messenger_contacts WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days'", accountID)

	return response.Success(c, map[string]interface{}{
		"total_contacts": stats.TotalContacts,
		"opted_in":       stats.OptedIn,
		"opted_out":      stats.OptedOut,
		"tags":           tagStats,
		"recent_30d":     recentCount,
	})
}

// ============================================================
// Campaign Handlers
// ============================================================

// ListCampaigns returns a paginated list of Messenger campaigns.
func (h *MessengerHandler) ListCampaigns(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	status := c.QueryParam("status")
	query := strings.TrimSpace(c.QueryParam("query"))

	where := "account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if query != "" {
		where += fmt.Sprintf(" AND name ILIKE $%d", argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}

	var total int
	h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM messenger_campaigns WHERE %s", where), args...)

	args = append(args, perPage, offset)
	var campaigns []MessengerCampaign
	err := h.db.Select(&campaigns, fmt.Sprintf(
		"SELECT * FROM messenger_campaigns WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	), args...)
	if err != nil {
		log.Printf("[messenger] Failed to fetch campaigns: %v", err)
		return response.InternalError(c, "Failed to fetch campaigns")
	}

	if campaigns == nil {
		campaigns = []MessengerCampaign{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"results":  campaigns,
			"total":    total,
			"page":     page,
			"per_page": perPage,
		},
	})
}

// GetCampaign returns a single Messenger campaign with details.
func (h *MessengerHandler) GetCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign MessengerCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM messenger_campaign_messages WHERE campaign_id = $1
		GROUP BY status
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}

	type RecipientRow struct {
		ID          int        `json:"id" db:"id"`
		ContactID   int        `json:"contact_id" db:"contact_id"`
		PSID        string     `json:"psid" db:"psid"`
		ContactName string     `json:"contact_name" db:"contact_name"`
		Status      string     `json:"status" db:"status"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		SubmittedAt *time.Time `json:"submitted_at" db:"submitted_at"`
		DeliveredAt *time.Time `json:"delivered_at" db:"delivered_at"`
		ReadAt      *time.Time `json:"read_at" db:"read_at"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	}
	var recipients []RecipientRow
	h.db.Select(&recipients, `
		SELECT mcm.id, mcm.contact_id, mc.psid, mc.name AS contact_name,
		       mcm.status, mcm.error_reason,
		       mcm.submitted_at, mcm.delivered_at, mcm.read_at, mcm.failed_at, mcm.created_at
		FROM messenger_campaign_messages mcm
		JOIN messenger_contacts mc ON mc.id = mcm.contact_id
		WHERE mcm.campaign_id = $1
		ORDER BY mcm.created_at DESC
		LIMIT 500
	`, id)

	if recipients == nil {
		recipients = []RecipientRow{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"recipients":       recipients,
	})
}

// CreateCampaign creates a new Messenger campaign in draft status.
func (h *MessengerHandler) CreateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		ImageURL     string          `json:"image_url"`
		TargetFilter json.RawMessage `json:"target_filter"`
		ScheduledAt  *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Campaign name is required")
	}
	if req.MessageText == "" {
		return response.BadRequest(c, "Message text is required")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}

	var campaign MessengerCampaign
	err := h.db.Get(&campaign, `
		INSERT INTO messenger_campaigns (account_id, name, message_text, image_url, target_filter, scheduled_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING *
	`, accountID, req.Name, req.MessageText, req.ImageURL, targetFilter, req.ScheduledAt, userID)
	if err != nil {
		log.Printf("[messenger] Failed to create campaign: %v", err)
		return response.InternalError(c, "Failed to create campaign")
	}

	return response.Created(c, campaign)
}

// UpdateCampaign updates a draft Messenger campaign.
func (h *MessengerHandler) UpdateCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var currentStatus string
	h.db.Get(&currentStatus, "SELECT status FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if currentStatus != "draft" {
		return response.BadRequest(c, "Only draft campaigns can be edited")
	}

	var req struct {
		Name         string          `json:"name"`
		MessageText  string          `json:"message_text"`
		ImageURL     string          `json:"image_url"`
		TargetFilter json.RawMessage `json:"target_filter"`
		ScheduledAt  *time.Time      `json:"scheduled_at"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	targetFilter := req.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}

	_, err2 := h.db.Exec(`
		UPDATE messenger_campaigns SET name = $1, message_text = $2, image_url = $3, target_filter = $4, scheduled_at = $5, updated_at = NOW()
		WHERE id = $6 AND account_id = $7
	`, req.Name, req.MessageText, req.ImageURL, targetFilter, req.ScheduledAt, id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to update campaign")
	}

	return response.SuccessWithMessage(c, "Campaign updated", nil)
}

// DeleteCampaign deletes a Messenger campaign.
func (h *MessengerHandler) DeleteCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	tx, _ := h.db.Beginx()
	tx.Exec("DELETE FROM messenger_campaign_messages WHERE campaign_id = $1", id)
	result, err2 := tx.Exec("DELETE FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		tx.Rollback()
		return response.InternalError(c, "Failed to delete campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		tx.Rollback()
		return response.NotFound(c, "Campaign not found")
	}
	tx.Commit()

	return response.SuccessWithMessage(c, "Campaign deleted", nil)
}

// SendCampaign starts sending a Messenger campaign.
func (h *MessengerHandler) SendCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign MessengerCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.Status != "draft" && campaign.Status != "scheduled" {
		return response.BadRequest(c, "Campaign must be in draft or scheduled status to send")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	_, _, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}

	// Query opted-in contacts matching target filter
	contactQuery := "SELECT * FROM messenger_contacts WHERE account_id = $1 AND opted_in = true"
	contactArgs := []interface{}{accountID}

	var filterGroups []int
	if campaign.TargetFilter != nil && string(campaign.TargetFilter) != "{}" && string(campaign.TargetFilter) != "null" {
		var filter struct {
			Tags   []string `json:"tags"`
			Groups []int    `json:"groups"`
		}
		if jsonErr := json.Unmarshal(campaign.TargetFilter, &filter); jsonErr == nil {
			if len(filter.Tags) > 0 {
				tagJSON, _ := json.Marshal(filter.Tags)
				contactQuery += " AND tags @> $2::jsonb"
				contactArgs = append(contactArgs, string(tagJSON))
			}
			filterGroups = filter.Groups
		}
	}

	var contacts []MessengerContact
	if err := h.db.Select(&contacts, contactQuery, contactArgs...); err != nil {
		return response.InternalError(c, "Failed to fetch target contacts")
	}

	// Include contacts from groups
	if len(filterGroups) > 0 {
		existingIDs := make(map[int]bool)
		for _, c := range contacts {
			existingIDs[c.ID] = true
		}
		for _, gid := range filterGroups {
			var groupContacts []MessengerContact
			h.db.Select(&groupContacts, `
				SELECT mc.* FROM messenger_contacts mc
				JOIN messenger_contact_group_members gm ON gm.contact_id = mc.id
				WHERE mc.account_id = $1 AND mc.opted_in = true AND gm.group_id = $2
			`, accountID, gid)
			for _, gc := range groupContacts {
				if !existingIDs[gc.ID] {
					contacts = append(contacts, gc)
					existingIDs[gc.ID] = true
				}
			}
		}
	}

	if len(contacts) == 0 {
		return response.BadRequest(c, "No opted-in contacts to send to")
	}

	for _, contact := range contacts {
		h.db.Exec(`
			INSERT INTO messenger_campaign_messages (campaign_id, contact_id, status)
			VALUES ($1, $2, 'queued')
		`, campaign.ID, contact.ID)
	}

	now := time.Now()
	h.db.Exec(`
		UPDATE messenger_campaigns SET status = 'sending', total_targets = $1, started_at = $2, updated_at = NOW()
		WHERE id = $3
	`, len(contacts), now, campaign.ID)

	go h.executeCampaignSend(campaign.ID, accountID)

	return response.Success(c, map[string]interface{}{
		"status":        "sending",
		"total_targets": len(contacts),
	})
}

func (h *MessengerHandler) executeCampaignSend(campaignID, accountID int) {
	client, settings, err := h.getClient(accountID)
	if err != nil {
		log.Printf("[messenger] Campaign %d: failed to get client: %v", campaignID, err)
		h.db.Exec("UPDATE messenger_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	var campaign MessengerCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM messenger_campaigns WHERE id = $1", campaignID); err != nil {
		h.db.Exec("UPDATE messenger_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	type QueuedMessage struct {
		MessageID int    `db:"message_id"`
		ContactID int    `db:"contact_id"`
		PSID      string `db:"psid"`
	}
	var queuedMessages []QueuedMessage
	if err := h.db.Select(&queuedMessages, `
		SELECT mcm.id AS message_id, mcm.contact_id, mc.psid
		FROM messenger_campaign_messages mcm
		JOIN messenger_contacts mc ON mc.id = mcm.contact_id
		WHERE mcm.campaign_id = $1 AND mcm.status = 'queued'
		ORDER BY mcm.id ASC
	`, campaignID); err != nil {
		h.db.Exec("UPDATE messenger_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", campaignID)
		return
	}

	sendRate := settings.SendRate
	if sendRate <= 0 {
		sendRate = 10
	}

	ticker := time.NewTicker(time.Second / time.Duration(sendRate))
	defer ticker.Stop()

	var mu sync.Mutex
	sentCount := 0
	failedCount := 0

	for _, qm := range queuedMessages {
		<-ticker.C

		var status string
		h.db.Get(&status, "SELECT status FROM messenger_campaigns WHERE id = $1", campaignID)
		if status == "paused" || status == "cancelled" {
			log.Printf("[messenger] Campaign %d: %s by user", campaignID, status)
			return
		}

		var result *messenger.SendResponse
		var sendErr error

		if campaign.ImageURL != "" {
			result, sendErr = client.SendTextWithImage(qm.PSID, campaign.MessageText, campaign.ImageURL)
		} else {
			result, sendErr = client.SendTextMessage(qm.PSID, campaign.MessageText)
		}

		if sendErr != nil {
			log.Printf("[messenger] Campaign %d: failed to send to %s: %v", campaignID, qm.PSID, sendErr)
			h.db.Exec(`
				UPDATE messenger_campaign_messages SET status = 'failed', error_reason = $1, failed_at = NOW() WHERE id = $2
			`, sendErr.Error(), qm.MessageID)
			mu.Lock()
			failedCount++
			mu.Unlock()
			continue
		}

		fbMsgID := ""
		if result != nil {
			fbMsgID = result.MessageID
		}

		h.db.Exec(`
			UPDATE messenger_campaign_messages
			SET fb_message_id = $1, status = 'submitted', submitted_at = NOW()
			WHERE id = $2
		`, fbMsgID, qm.MessageID)

		mu.Lock()
		sentCount++
		mu.Unlock()

		if (sentCount+failedCount)%50 == 0 {
			mu.Lock()
			h.db.Exec(`
				UPDATE messenger_campaigns SET sent_count = $1, failed_count = $2, updated_at = NOW() WHERE id = $3
			`, sentCount, failedCount, campaignID)
			mu.Unlock()
		}
	}

	h.db.Exec(`
		UPDATE messenger_campaigns SET
			status = 'sent',
			sent_count = $1,
			failed_count = $2,
			completed_at = NOW(),
			updated_at = NOW()
		WHERE id = $3
	`, sentCount, failedCount, campaignID)

	log.Printf("[messenger] Campaign %d: completed. Sent: %d, Failed: %d", campaignID, sentCount, failedCount)
}

// TestCampaign sends a test message using the campaign's content.
func (h *MessengerHandler) TestCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		PSID string `json:"psid"`
	}
	if err := c.Bind(&req); err != nil || req.PSID == "" {
		return response.BadRequest(c, "PSID is required")
	}

	var campaign MessengerCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	if campaign.MessageText == "" {
		return response.BadRequest(c, "Campaign has no message text")
	}

	client, _, clientErr := h.getClient(accountID)
	if clientErr != nil {
		return response.BadRequest(c, clientErr.Error())
	}

	var result *messenger.SendResponse
	var sendErr error

	if campaign.ImageURL != "" {
		result, sendErr = client.SendTextWithImage(req.PSID, campaign.MessageText, campaign.ImageURL)
	} else {
		result, sendErr = client.SendTextMessage(req.PSID, campaign.MessageText)
	}

	if sendErr != nil {
		return response.Error(c, http.StatusBadGateway, fmt.Sprintf("Failed to send test: %v", sendErr))
	}

	msgID := ""
	if result != nil {
		msgID = result.MessageID
	}

	return response.Success(c, map[string]interface{}{
		"message_id": msgID,
		"status":     "submitted",
	})
}

// PauseCampaign pauses a sending campaign.
func (h *MessengerHandler) PauseCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE messenger_campaigns SET status = 'paused', updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'sending'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to pause campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.BadRequest(c, "Campaign is not currently sending")
	}

	return response.SuccessWithMessage(c, "Campaign paused", nil)
}

// ResumeCampaign resumes a paused campaign.
func (h *MessengerHandler) ResumeCampaign(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err := h.db.Exec(`
		UPDATE messenger_campaigns SET status = 'sending', updated_at = NOW()
		WHERE id = $1 AND account_id = $2 AND status = 'paused'
	`, id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to resume campaign")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.BadRequest(c, "Campaign is not currently paused")
	}

	return response.SuccessWithMessage(c, "Campaign resumed", nil)
}

// GetAudienceCount returns the count of opted-in contacts matching a filter.
func (h *MessengerHandler) GetAudienceCount(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var body struct {
		Tags   []string `json:"tags"`
		Groups []int    `json:"groups"`
	}
	c.Bind(&body)

	where := "account_id = $1 AND opted_in = true"
	args := []interface{}{accountID}
	argIdx := 2

	if len(body.Tags) > 0 {
		tagJSON, _ := json.Marshal(body.Tags)
		where += fmt.Sprintf(" AND tags @> $%d::jsonb", argIdx)
		args = append(args, string(tagJSON))
		argIdx++
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM messenger_contacts WHERE %s", where)

	if len(body.Groups) > 0 {
		groupPlaceholders := make([]string, len(body.Groups))
		for i, gid := range body.Groups {
			groupPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, gid)
			argIdx++
		}
		query = fmt.Sprintf(`
			SELECT COUNT(DISTINCT id) FROM (
				SELECT id FROM messenger_contacts WHERE %s
				UNION
				SELECT mc.id FROM messenger_contacts mc
				JOIN messenger_contact_group_members gm ON gm.contact_id = mc.id
				WHERE mc.account_id = $1 AND mc.opted_in = true AND gm.group_id IN (%s)
			) combined
		`, where, strings.Join(groupPlaceholders, ","))
	}

	var count int
	h.db.Get(&count, query, args...)

	return response.Success(c, map[string]interface{}{
		"count": count,
	})
}

// ============================================================
// Analytics Handlers
// ============================================================

// GetOverview returns aggregate Messenger marketing statistics.
func (h *MessengerHandler) GetOverview(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var stats struct {
		TotalContacts  int `json:"total_contacts" db:"total_contacts"`
		OptedIn        int `json:"opted_in" db:"opted_in"`
		TotalCampaigns int `json:"total_campaigns" db:"total_campaigns"`
	}

	var msgStats struct {
		TotalSent      int `json:"total_sent" db:"total_sent"`
		TotalDelivered int `json:"total_delivered" db:"total_delivered"`
		TotalFailed    int `json:"total_failed" db:"total_failed"`
	}

	var recent []MessengerCampaign

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		h.db.Get(&stats, `
			SELECT
				COUNT(*) as total_contacts,
				COUNT(*) FILTER (WHERE opted_in = true) as opted_in,
				0 as total_campaigns
			FROM messenger_contacts WHERE account_id = $1
		`, accountID)
		h.db.Get(&stats.TotalCampaigns, "SELECT COUNT(*) FROM messenger_campaigns WHERE account_id = $1", accountID)
	}()

	go func() {
		defer wg.Done()
		h.db.Get(&msgStats, `
			SELECT
				COALESCE(SUM(sent_count), 0) as total_sent,
				COALESCE(SUM(delivered_count), 0) as total_delivered,
				COALESCE(SUM(failed_count), 0) as total_failed
			FROM messenger_campaigns WHERE account_id = $1
		`, accountID)
	}()

	go func() {
		defer wg.Done()
		h.db.Select(&recent, `
			SELECT * FROM messenger_campaigns WHERE account_id = $1
			ORDER BY created_at DESC LIMIT 5
		`, accountID)
	}()

	wg.Wait()

	if recent == nil {
		recent = []MessengerCampaign{}
	}

	return response.Success(c, map[string]interface{}{
		"contacts":         stats,
		"messages":         msgStats,
		"recent_campaigns": recent,
	})
}

// GetCampaignAnalytics returns detailed analytics for a single campaign.
func (h *MessengerHandler) GetCampaignAnalytics(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var campaign MessengerCampaign
	if err := h.db.Get(&campaign, "SELECT * FROM messenger_campaigns WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Campaign not found")
	}

	var statusBreakdown []struct {
		Status string `json:"status" db:"status"`
		Count  int    `json:"count" db:"count"`
	}
	h.db.Select(&statusBreakdown, `
		SELECT status, COUNT(*) as count
		FROM messenger_campaign_messages WHERE campaign_id = $1
		GROUP BY status ORDER BY count DESC
	`, id)

	var failedMessages []struct {
		PSID        string     `json:"psid" db:"psid"`
		ErrorReason string     `json:"error_reason" db:"error_reason"`
		FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
	}
	h.db.Select(&failedMessages, `
		SELECT mc.psid, mcm.error_reason, mcm.failed_at
		FROM messenger_campaign_messages mcm
		JOIN messenger_contacts mc ON mc.id = mcm.contact_id
		WHERE mcm.campaign_id = $1 AND mcm.status = 'failed'
		ORDER BY mcm.failed_at DESC LIMIT 50
	`, id)

	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status string `json:"status" db:"status"`
			Count  int    `json:"count" db:"count"`
		}{}
	}
	if failedMessages == nil {
		failedMessages = []struct {
			PSID        string     `json:"psid" db:"psid"`
			ErrorReason string     `json:"error_reason" db:"error_reason"`
			FailedAt    *time.Time `json:"failed_at" db:"failed_at"`
		}{}
	}

	return response.Success(c, map[string]interface{}{
		"campaign":         campaign,
		"status_breakdown": statusBreakdown,
		"failed_messages":  failedMessages,
	})
}

// ============================================================
// Contact Group Handlers
// ============================================================

type MessengerContactGroup struct {
	ID          int       `json:"id" db:"id"`
	AccountID   int       `json:"account_id" db:"account_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Color       string    `json:"color" db:"color"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type MessengerContactGroupWithCount struct {
	MessengerContactGroup
	MemberCount int `json:"member_count" db:"member_count"`
}

func (h *MessengerHandler) ListGroups(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var groups []MessengerContactGroupWithCount
	err := h.db.Select(&groups, `
		SELECT g.*, COALESCE(m.cnt, 0) AS member_count
		FROM messenger_contact_groups g
		LEFT JOIN (SELECT group_id, COUNT(*) AS cnt FROM messenger_contact_group_members GROUP BY group_id) m
			ON m.group_id = g.id
		WHERE g.account_id = $1
		ORDER BY g.name ASC
	`, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to fetch groups")
	}
	if groups == nil {
		groups = []MessengerContactGroupWithCount{}
	}

	return response.Success(c, groups)
}

func (h *MessengerHandler) GetGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var group MessengerContactGroup
	if err := h.db.Get(&group, "SELECT * FROM messenger_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var memberCount int
	h.db.Get(&memberCount, "SELECT COUNT(*) FROM messenger_contact_group_members WHERE group_id = $1", id)

	return response.Success(c, map[string]interface{}{
		"group":        group,
		"member_count": memberCount,
	})
}

func (h *MessengerHandler) CreateGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Group name is required")
	}
	if req.Color == "" {
		req.Color = "#1976d2"
	}

	var group MessengerContactGroup
	err := h.db.Get(&group, `
		INSERT INTO messenger_contact_groups (account_id, name, description, color)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`, accountID, req.Name, req.Description, req.Color)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			return response.BadRequest(c, "A group with this name already exists")
		}
		return response.InternalError(c, "Failed to create group")
	}

	return response.Created(c, group)
}

func (h *MessengerHandler) UpdateGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Group name is required")
	}

	result, err2 := h.db.Exec(`
		UPDATE messenger_contact_groups SET name = $1, description = $2, color = $3, updated_at = NOW()
		WHERE id = $4 AND account_id = $5
	`, req.Name, req.Description, req.Color, id, accountID)
	if err2 != nil {
		if strings.Contains(err2.Error(), "duplicate key") || strings.Contains(err2.Error(), "unique") {
			return response.BadRequest(c, "A group with this name already exists")
		}
		return response.InternalError(c, "Failed to update group")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Group not found")
	}

	return response.SuccessWithMessage(c, "Group updated", nil)
}

func (h *MessengerHandler) DeleteGroup(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	result, err2 := h.db.Exec("DELETE FROM messenger_contact_groups WHERE id = $1 AND account_id = $2", id, accountID)
	if err2 != nil {
		return response.InternalError(c, "Failed to delete group")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Group not found")
	}

	return response.SuccessWithMessage(c, "Group deleted", nil)
}

func (h *MessengerHandler) ListGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM messenger_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 25
	}
	offset := (page - 1) * perPage

	query := c.QueryParam("query")

	var total int
	var members []MessengerContact

	if query != "" {
		search := "%" + query + "%"
		h.db.Get(&total, `
			SELECT COUNT(*) FROM messenger_contact_group_members gm
			JOIN messenger_contacts mc ON mc.id = gm.contact_id
			WHERE gm.group_id = $1 AND (mc.psid ILIKE $2 OR mc.name ILIKE $2 OR mc.email ILIKE $2)
		`, id, search)
		h.db.Select(&members, `
			SELECT mc.* FROM messenger_contact_group_members gm
			JOIN messenger_contacts mc ON mc.id = gm.contact_id
			WHERE gm.group_id = $1 AND (mc.psid ILIKE $2 OR mc.name ILIKE $2 OR mc.email ILIKE $2)
			ORDER BY mc.name ASC, mc.psid ASC
			LIMIT $3 OFFSET $4
		`, id, search, perPage, offset)
	} else {
		h.db.Get(&total, "SELECT COUNT(*) FROM messenger_contact_group_members WHERE group_id = $1", id)
		h.db.Select(&members, `
			SELECT mc.* FROM messenger_contact_group_members gm
			JOIN messenger_contacts mc ON mc.id = gm.contact_id
			WHERE gm.group_id = $1
			ORDER BY mc.name ASC, mc.psid ASC
			LIMIT $2 OFFSET $3
		`, id, perPage, offset)
	}

	if members == nil {
		members = []MessengerContact{}
	}

	return response.Success(c, map[string]interface{}{
		"results":  members,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

func (h *MessengerHandler) AddGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM messenger_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "contact_ids is required")
	}

	added := 0
	for _, cid := range req.ContactIDs {
		_, insertErr := h.db.Exec(`
			INSERT INTO messenger_contact_group_members (group_id, contact_id)
			VALUES ($1, $2) ON CONFLICT DO NOTHING
		`, id, cid)
		if insertErr == nil {
			added++
		}
	}

	return response.Success(c, map[string]interface{}{
		"added": added,
	})
}

func (h *MessengerHandler) RemoveGroupMembers(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var exists int
	if err := h.db.Get(&exists, "SELECT 1 FROM messenger_contact_groups WHERE id = $1 AND account_id = $2", id, accountID); err != nil {
		return response.NotFound(c, "Group not found")
	}

	var req struct {
		ContactIDs []int `json:"contact_ids"`
	}
	if err := c.Bind(&req); err != nil || len(req.ContactIDs) == 0 {
		return response.BadRequest(c, "contact_ids is required")
	}

	removed := 0
	for _, cid := range req.ContactIDs {
		result, delErr := h.db.Exec("DELETE FROM messenger_contact_group_members WHERE group_id = $1 AND contact_id = $2", id, cid)
		if delErr == nil {
			rows, _ := result.RowsAffected()
			removed += int(rows)
		}
	}

	return response.Success(c, map[string]interface{}{
		"removed": removed,
	})
}
