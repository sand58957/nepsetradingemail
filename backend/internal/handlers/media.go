package handlers

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// validateMediaID validates that the path param is a numeric ID
func validateMediaID(c echo.Context) (string, error) {
	id := c.Param("id")
	if _, err := strconv.Atoi(id); err != nil {
		return "", response.BadRequest(c, "Invalid media ID")
	}
	return id, nil
}

type MediaHandler struct {
	lm *listmonk.Client
}

func NewMediaHandler(lm *listmonk.Client) *MediaHandler {
	return &MediaHandler{lm: lm}
}

func (h *MediaHandler) List(c echo.Context) error {
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

	data, statusCode, err := h.lm.Get("/media", params)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Get(c echo.Context) error {
	if !isAdmin(c) {
		return response.NotFound(c, "Media not found")
	}

	id, err := validateMediaID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get(fmt.Sprintf("/media/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// allowedMediaTypes maps allowed MIME type prefixes to their categories.
var allowedMediaTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"image/svg+xml":   true,
	"application/pdf": true,
	"video/mp4":       true,
	"video/webm":      true,
}

// maxUploadSize is 10MB
const maxUploadSize = 10 * 1024 * 1024

func (h *MediaHandler) Upload(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	// Validate file size
	if file.Size > maxUploadSize {
		return response.BadRequest(c, "File too large. Maximum size is 10MB")
	}

	// Validate content type
	contentType := file.Header.Get("Content-Type")
	if !allowedMediaTypes[contentType] {
		return response.BadRequest(c, "File type not allowed. Accepted: JPEG, PNG, GIF, WebP, SVG, PDF, MP4, WebM")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

	// Verify content type by reading first 512 bytes (sniff)
	header := make([]byte, 512)
	n, _ := src.Read(header)
	if n > 0 {
		detected := http.DetectContentType(header[:n])
		// Allow if detected type matches or is a generic octet-stream (for SVG/PDF which may not sniff correctly)
		if !allowedMediaTypes[detected] && detected != "application/octet-stream" && detected != "text/xml; charset=utf-8" && detected != "text/plain; charset=utf-8" {
			return response.BadRequest(c, "File content does not match declared type")
		}
		// Reset reader to beginning
		src.Close()
		src, err = file.Open()
		if err != nil {
			return response.InternalError(c, "Failed to read uploaded file")
		}
		defer src.Close()
	}

	data, statusCode, err := h.lm.PostMultipart("/media", "file", file.Filename, src, nil)
	if err != nil {
		return response.InternalError(c, "Failed to upload media to Listmonk")
	}

	if statusCode >= 200 && statusCode < 300 {
		return c.JSONBlob(http.StatusCreated, data)
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Delete(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	id, err := validateMediaID(c)
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/media/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// UploadFromURL downloads a file from a URL and uploads it to Listmonk media storage.
func (h *MediaHandler) UploadFromURL(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}

	var req models.ImportFromURLRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.URL == "" {
		return response.BadRequest(c, "URL is required")
	}

	// Validate URL
	parsedURL, err := url.Parse(req.URL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return response.BadRequest(c, "Invalid URL — must start with http:// or https://")
	}

	// Block private/internal IP ranges to prevent SSRF
	host := parsedURL.Hostname()
	blockedPrefixes := []string{"127.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
		"172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.",
		"172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.", "169.254.", "0."}
	for _, prefix := range blockedPrefixes {
		if strings.HasPrefix(host, prefix) {
			return response.BadRequest(c, "URL points to a private network address")
		}
	}
	if host == "localhost" || host == "::1" || host == "" {
		return response.BadRequest(c, "URL points to a private network address")
	}

	// Download the file
	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Get(req.URL)
	if err != nil {
		return response.BadRequest(c, "Failed to download file from URL")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return response.BadRequest(c, fmt.Sprintf("URL returned status %d", resp.StatusCode))
	}

	// Validate content type from response
	ct := resp.Header.Get("Content-Type")
	// Extract base MIME type (strip params like charset)
	if idx := strings.Index(ct, ";"); idx != -1 {
		ct = strings.TrimSpace(ct[:idx])
	}
	if ct != "" && !allowedMediaTypes[ct] {
		return response.BadRequest(c, "URL points to a file type that is not allowed. Accepted: JPEG, PNG, GIF, WebP, SVG, PDF, MP4, WebM")
	}

	// Extract filename
	filename := extractFilenameFromURL(req.URL, resp)

	// Limit download size (10MB)
	limitedReader := io.LimitReader(resp.Body, maxUploadSize)

	// Forward to Listmonk as multipart upload
	data, statusCode, err := h.lm.PostMultipart("/media", "file", filename, limitedReader, nil)
	if err != nil {
		return response.InternalError(c, "Failed to upload to media storage")
	}

	if statusCode >= 200 && statusCode < 300 {
		return c.JSONBlob(http.StatusCreated, data)
	}

	return c.JSONBlob(statusCode, data)
}

// extractFilenameFromURL tries to get a meaningful filename from URL or response headers.
func extractFilenameFromURL(rawURL string, resp *http.Response) string {
	// Try Content-Disposition header first
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		if _, params, err := mime.ParseMediaType(cd); err == nil {
			if fn, ok := params["filename"]; ok && fn != "" {
				return fn
			}
		}
	}

	// Try URL path
	parsedURL, err := url.Parse(rawURL)
	if err == nil {
		base := path.Base(parsedURL.Path)
		if base != "" && base != "." && base != "/" {
			return base
		}
	}

	// Fallback: generate from content type
	ct := resp.Header.Get("Content-Type")
	ext := ".bin"
	if strings.HasPrefix(ct, "image/jpeg") {
		ext = ".jpg"
	} else if strings.HasPrefix(ct, "image/png") {
		ext = ".png"
	} else if strings.HasPrefix(ct, "image/gif") {
		ext = ".gif"
	} else if strings.HasPrefix(ct, "image/svg") {
		ext = ".svg"
	} else if strings.HasPrefix(ct, "image/webp") {
		ext = ".webp"
	} else if strings.HasPrefix(ct, "application/pdf") {
		ext = ".pdf"
	}

	return "imported-file" + ext
}
