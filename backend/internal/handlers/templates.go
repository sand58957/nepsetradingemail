package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type TemplateHandler struct {
	lm  *listmonk.Client
	cfg *config.Config
}

func NewTemplateHandler(lm *listmonk.Client, cfg *config.Config) *TemplateHandler {
	return &TemplateHandler{lm: lm, cfg: cfg}
}

// validateTemplateID validates that the path param is a numeric ID
func validateTemplateID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid template ID")
	}
	return id, nil
}

func (h *TemplateHandler) List(c echo.Context) error {
	// Non-admin users get a fresh/clean view (no shared Listmonk data)
	if !isAdmin(c) {
		return emptyListmonkList(c)
	}

	params := map[string]string{}
	if v := c.QueryParam("page"); v != "" {
		params["page"] = v
	}
	if v := c.QueryParam("per_page"); v != "" {
		params["per_page"] = v
	}

	data, statusCode, err := h.lm.Get("/templates", params)
	if err != nil {
		log.Printf("[templates] Failed to fetch templates: %v", err)
		return response.InternalError(c, "Failed to fetch templates from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Get(c echo.Context) error {
	if !isAdmin(c) {
		return response.NotFound(c, "Template not found")
	}

	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/templates/%s", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to fetch template %s: %v", id, err)
		return response.InternalError(c, "Failed to fetch template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Create(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Post("/templates", payload)
	if err != nil {
		log.Printf("[templates] Failed to create template: %v", err)
		return response.InternalError(c, "Failed to create template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Update(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	var payload map[string]interface{}
	if err := c.Bind(&payload); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/templates/%s", id), payload)
	if err != nil {
		log.Printf("[templates] Failed to update template %s: %v", id, err)
		return response.InternalError(c, "Failed to update template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Delete(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/templates/%s", id))
	if err != nil {
		log.Printf("[templates] Failed to delete template %s: %v", id, err)
		return response.InternalError(c, "Failed to delete template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) Preview(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/templates/%s/preview", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to preview template %s: %v", id, err)
		return response.InternalError(c, "Failed to preview template from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *TemplateHandler) SetDefault(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateTemplateID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Put(fmt.Sprintf("/templates/%s/default", id), nil)
	if err != nil {
		log.Printf("[templates] Failed to set default template %s: %v", id, err)
		return response.InternalError(c, "Failed to set default template in Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// ============================================================
// SendGrid Template Import
// ============================================================

type sendGridTemplate struct {
	ID         string                `json:"id"`
	Name       string                `json:"name"`
	Generation string                `json:"generation"`
	UpdatedAt  string                `json:"updated_at"`
	Versions   []sendGridVersion     `json:"versions"`
}

type sendGridVersion struct {
	ID           string `json:"id"`
	TemplateID   string `json:"template_id"`
	Active       int    `json:"active"`
	Name         string `json:"name"`
	Subject      string `json:"subject"`
	HTMLContent  string `json:"html_content"`
	PlainContent string `json:"plain_content"`
	Editor       string `json:"editor"`
	ThumbnailURL string `json:"thumbnail_url"`
	UpdatedAt    string `json:"updated_at"`
}

type sendGridListResponse struct {
	Result   []sendGridTemplate `json:"result"`
	Metadata struct {
		Count int `json:"count"`
	} `json:"_metadata"`
}

// ListSendGridTemplates lists available SendGrid templates without importing
func (h *TemplateHandler) ListSendGridTemplates(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	apiKey := h.cfg.SendGridAPIKey
	if apiKey == "" {
		return response.BadRequest(c, "SendGrid API key not configured")
	}

	templates, err := fetchSendGridTemplates(apiKey)
	if err != nil {
		log.Printf("[templates] Failed to fetch SendGrid templates: %v", err)
		return response.InternalError(c, "Failed to fetch templates from SendGrid")
	}

	return response.Success(c, templates)
}

// ImportSendGridTemplates fetches templates from SendGrid and imports them into Listmonk
func (h *TemplateHandler) ImportSendGridTemplates(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	apiKey := h.cfg.SendGridAPIKey
	if apiKey == "" {
		return response.BadRequest(c, "SendGrid API key not configured")
	}

	// Optionally filter by template IDs
	var req struct {
		TemplateIDs []string `json:"template_ids"`
	}
	c.Bind(&req)

	// Fetch all SendGrid dynamic templates
	templates, err := fetchSendGridTemplates(apiKey)
	if err != nil {
		log.Printf("[templates] Failed to fetch SendGrid templates: %v", err)
		return response.InternalError(c, "Failed to fetch templates from SendGrid")
	}

	imported := 0
	skipped := 0
	var errors []string

	for _, tpl := range templates {
		// Filter by IDs if specified
		if len(req.TemplateIDs) > 0 {
			found := false
			for _, tid := range req.TemplateIDs {
				if tid == tpl.ID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Find active version (or most recent)
		var bestVersion *sendGridVersion
		for i := range tpl.Versions {
			if tpl.Versions[i].Active == 1 {
				bestVersion = &tpl.Versions[i]
				break
			}
		}
		if bestVersion == nil && len(tpl.Versions) > 0 {
			bestVersion = &tpl.Versions[0]
		}
		if bestVersion == nil {
			skipped++
			continue
		}

		// Fetch full version content (includes html_content)
		versionDetail, err := fetchSendGridVersion(apiKey, tpl.ID, bestVersion.ID)
		if err != nil {
			log.Printf("[templates] Failed to fetch SendGrid version %s/%s: %v", tpl.ID, bestVersion.ID, err)
			errors = append(errors, fmt.Sprintf("Failed to fetch %s: %v", tpl.Name, err))
			continue
		}

		htmlContent := versionDetail.HTMLContent
		if htmlContent == "" {
			skipped++
			continue
		}

		// Create template in Listmonk
		subject := versionDetail.Subject
		if subject == "" {
			subject = tpl.Name
		}

		templateName := fmt.Sprintf("%s (SendGrid)", tpl.Name)

		payload := map[string]interface{}{
			"name":    templateName,
			"type":    "campaign",
			"subject": subject,
			"body":    htmlContent,
		}

		_, statusCode, err := h.lm.Post("/templates", payload)
		if err != nil || statusCode >= 400 {
			log.Printf("[templates] Failed to create Listmonk template '%s': status=%d err=%v", templateName, statusCode, err)
			errors = append(errors, fmt.Sprintf("Failed to import %s", tpl.Name))
			continue
		}

		imported++
		log.Printf("[templates] Imported SendGrid template: %s (version: %s)", tpl.Name, bestVersion.Name)
	}

	return response.Success(c, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
		"errors":   errors,
		"total":    len(templates),
	})
}

// UploadMedia accepts a single image file and uploads it to Bunny CDN storage,
// returning the hosted CDN URL. This avoids base64-inlining images in email HTML.
func (h *TemplateHandler) UploadMedia(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	if file.Size > maxUploadSize {
		return response.BadRequest(c, "File too large. Maximum size is 10MB")
	}

	// Validate image MIME type
	contentType := file.Header.Get("Content-Type")
	allowedTypes := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true,
		"image/webp": true, "image/svg+xml": true, "image/x-icon": true,
	}
	if !allowedTypes[contentType] {
		return response.BadRequest(c, "Only image files are allowed")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

	fileData, err := io.ReadAll(src)
	if err != nil {
		return response.InternalError(c, "Failed to read file data")
	}

	// Generate unique filename with timestamp
	timestamp := time.Now().UnixMilli()
	safeName := strings.ReplaceAll(file.Filename, " ", "-")
	storagePath := fmt.Sprintf("email-images/%d-%s", timestamp, safeName)

	// Upload to Bunny CDN Storage
	storageURL := fmt.Sprintf("%s/%s/%s", h.cfg.BunnyCDNStorageURL, h.cfg.BunnyCDNStorageZone, storagePath)

	req, err := http.NewRequest("PUT", storageURL, bytes.NewReader(fileData))
	if err != nil {
		log.Printf("[templates] Failed to create Bunny CDN request: %v", err)
		return response.InternalError(c, "Failed to upload image")
	}

	req.Header.Set("AccessKey", h.cfg.BunnyCDNStorageKey)
	req.Header.Set("Content-Type", contentType)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[templates] Failed to upload to Bunny CDN: %v", err)
		return response.InternalError(c, "Failed to upload image to CDN")
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[templates] Bunny CDN returned %d: %s", resp.StatusCode, string(body))
		return response.InternalError(c, "CDN upload failed")
	}

	// Return the public CDN URL
	cdnURL := fmt.Sprintf("%s/%s", h.cfg.BunnyCDNPullURL, storagePath)

	return response.Success(c, map[string]string{
		"url":      cdnURL,
		"filename": file.Filename,
	})
}

func fetchSendGridTemplates(apiKey string) ([]sendGridTemplate, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", "https://api.sendgrid.com/v3/templates?generations=dynamic&page_size=200", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("SendGrid API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result sendGridListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse SendGrid response: %w", err)
	}

	return result.Result, nil
}

func fetchSendGridVersion(apiKey, templateID, versionID string) (*sendGridVersion, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	url := fmt.Sprintf("https://api.sendgrid.com/v3/templates/%s/versions/%s", templateID, versionID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("SendGrid API returned status %d: %s", resp.StatusCode, string(body))
	}

	var version sendGridVersion
	if err := json.Unmarshal(body, &version); err != nil {
		return nil, fmt.Errorf("failed to parse version response: %w", err)
	}

	return &version, nil
}
