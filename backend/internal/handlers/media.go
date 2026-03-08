package handlers

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type MediaHandler struct {
	lm *listmonk.Client
}

func NewMediaHandler(lm *listmonk.Client) *MediaHandler {
	return &MediaHandler{lm: lm}
}

func (h *MediaHandler) List(c echo.Context) error {
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
	id := c.Param("id")
	data, statusCode, err := h.lm.Get(fmt.Sprintf("/media/%s", id), nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *MediaHandler) Upload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "No file provided")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Failed to read uploaded file")
	}
	defer src.Close()

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
	id := c.Param("id")
	data, statusCode, err := h.lm.Delete(fmt.Sprintf("/media/%s", id))
	if err != nil {
		return response.InternalError(c, "Failed to delete media from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

// UploadFromURL downloads a file from a URL and uploads it to Listmonk media storage.
func (h *MediaHandler) UploadFromURL(c echo.Context) error {
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

	// Extract filename
	filename := extractFilenameFromURL(req.URL, resp)

	// Limit download size (10MB)
	limitedReader := io.LimitReader(resp.Body, 10*1024*1024)

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
