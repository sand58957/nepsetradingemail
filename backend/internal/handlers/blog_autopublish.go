package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/anthropic"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type BlogAutoPublishHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewBlogAutoPublishHandler(db *sqlx.DB, cfg *config.Config) *BlogAutoPublishHandler {
	return &BlogAutoPublishHandler{db: db, cfg: cfg}
}

// ============================================================
// Models
// ============================================================

type AutoPublishSettings struct {
	ID                int       `json:"id" db:"id"`
	AccountID         int       `json:"account_id" db:"account_id"`
	IsEnabled         bool      `json:"is_enabled" db:"is_enabled"`
	PostsPerDay       int       `json:"posts_per_day" db:"posts_per_day"`
	PreferredHour     int       `json:"preferred_hour" db:"preferred_hour"`
	DefaultAuthorID   *int      `json:"default_author_id" db:"default_author_id"`
	DefaultCategoryID *int      `json:"default_category_id" db:"default_category_id"`
	AutoPublish       bool      `json:"auto_publish" db:"auto_publish"`
	TargetWordCount   int       `json:"target_word_count" db:"target_word_count"`
	TargetSEOScore    int       `json:"target_seo_score" db:"target_seo_score"`
	ContentTone       string    `json:"content_tone" db:"content_tone"`
	TargetAudience    string    `json:"target_audience" db:"target_audience"`
	SiteContext       string    `json:"site_context" db:"site_context"`
	AnthropicAPIKey   string    `json:"anthropic_api_key" db:"anthropic_api_key"`
	AnthropicModel    string    `json:"anthropic_model" db:"anthropic_model"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type AutoPublishQueueItem struct {
	ID                int            `json:"id" db:"id"`
	AccountID         int            `json:"account_id" db:"account_id"`
	Topic             string         `json:"topic" db:"topic"`
	PrimaryKeyword    string         `json:"primary_keyword" db:"primary_keyword"`
	SecondaryKeywords pq.StringArray `json:"secondary_keywords" db:"secondary_keywords"`
	CategoryID        *int           `json:"category_id" db:"category_id"`
	AuthorID          *int           `json:"author_id" db:"author_id"`
	Priority          int            `json:"priority" db:"priority"`
	Status            string         `json:"status" db:"status"`
	PostID            *int           `json:"post_id" db:"post_id"`
	ErrorMessage      string         `json:"error_message" db:"error_message"`
	RetryCount        int            `json:"retry_count" db:"retry_count"`
	MaxRetries        int            `json:"max_retries" db:"max_retries"`
	ScheduledFor      *time.Time     `json:"scheduled_for" db:"scheduled_for"`
	ProcessedAt       *time.Time     `json:"processed_at" db:"processed_at"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at" db:"updated_at"`
}

type AutoPublishLog struct {
	ID        int       `json:"id" db:"id"`
	AccountID int       `json:"account_id" db:"account_id"`
	QueueID   *int      `json:"queue_id" db:"queue_id"`
	PostID    *int      `json:"post_id" db:"post_id"`
	Action    string    `json:"action" db:"action"`
	Status    string    `json:"status" db:"status"`
	Message   string    `json:"message" db:"message"`
	TokensUsed int     `json:"tokens_used" db:"tokens_used"`
	DurationMs int     `json:"duration_ms" db:"duration_ms"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// ============================================================
// Settings Endpoints
// ============================================================

func (h *BlogAutoPublishHandler) GetSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var settings AutoPublishSettings
	err := h.db.Get(&settings, "SELECT * FROM blog_autopublish_settings WHERE account_id = $1", accountID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return defaults
			return response.Success(c, AutoPublishSettings{
				AccountID:     accountID,
				PostsPerDay:   1,
				PreferredHour: 9,
				TargetWordCount: 2000,
				TargetSEOScore:  95,
				ContentTone:     "professional",
				TargetAudience:  "Nepal business owners and digital marketers",
				SiteContext:      "nepalfillings.com is a Nepal-based digital marketing platform",
				AnthropicModel:   "claude-sonnet-4-20250514",
			})
		}
		return response.InternalError(c, "Failed to fetch settings")
	}

	// Mask API key for security
	if settings.AnthropicAPIKey != "" {
		if len(settings.AnthropicAPIKey) > 8 {
			settings.AnthropicAPIKey = settings.AnthropicAPIKey[:4] + "..." + settings.AnthropicAPIKey[len(settings.AnthropicAPIKey)-4:]
		} else {
			settings.AnthropicAPIKey = "****"
		}
	}

	return response.Success(c, settings)
}

func (h *BlogAutoPublishHandler) UpdateSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req AutoPublishSettings
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request")
	}

	var settings AutoPublishSettings
	err := h.db.QueryRowx(`
		INSERT INTO blog_autopublish_settings (account_id, is_enabled, posts_per_day, preferred_hour,
			default_author_id, default_category_id, auto_publish, target_word_count, target_seo_score,
			content_tone, target_audience, site_context, anthropic_api_key, anthropic_model, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
		ON CONFLICT (account_id) DO UPDATE SET
			is_enabled=$2, posts_per_day=$3, preferred_hour=$4, default_author_id=$5,
			default_category_id=$6, auto_publish=$7, target_word_count=$8, target_seo_score=$9,
			content_tone=$10, target_audience=$11, site_context=$12,
			anthropic_api_key=CASE WHEN $13 = '' OR $13 LIKE '%%...%%' THEN blog_autopublish_settings.anthropic_api_key ELSE $13 END,
			anthropic_model=$14, updated_at=NOW()
		RETURNING *`,
		accountID, req.IsEnabled, req.PostsPerDay, req.PreferredHour,
		req.DefaultAuthorID, req.DefaultCategoryID, req.AutoPublish,
		req.TargetWordCount, req.TargetSEOScore, req.ContentTone,
		req.TargetAudience, req.SiteContext, req.AnthropicAPIKey, req.AnthropicModel,
	).StructScan(&settings)
	if err != nil {
		log.Printf("ERROR: update autopublish settings: %v", err)
		return response.InternalError(c, "Failed to update settings")
	}

	return response.Success(c, settings)
}

// ============================================================
// Queue Endpoints
// ============================================================

func (h *BlogAutoPublishHandler) ListQueue(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	status := c.QueryParam("status")

	var items []AutoPublishQueueItem

	if status != "" {
		h.db.Select(&items, "SELECT * FROM blog_autopublish_queue WHERE account_id = $1 AND status = $2 ORDER BY priority DESC, created_at DESC", accountID, status)
	} else {
		h.db.Select(&items, "SELECT * FROM blog_autopublish_queue WHERE account_id = $1 ORDER BY priority DESC, created_at DESC LIMIT 200", accountID)
	}

	if items == nil {
		items = []AutoPublishQueueItem{}
	}

	return response.Success(c, items)
}

func (h *BlogAutoPublishHandler) AddToQueue(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Topic             string   `json:"topic"`
		PrimaryKeyword    string   `json:"primary_keyword"`
		SecondaryKeywords []string `json:"secondary_keywords"`
		CategoryID        *int     `json:"category_id"`
		AuthorID          *int     `json:"author_id"`
		Priority          int      `json:"priority"`
		ScheduledFor      *string  `json:"scheduled_for"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request")
	}
	if req.Topic == "" {
		return response.BadRequest(c, "Topic is required")
	}

	var scheduledFor *time.Time
	if req.ScheduledFor != nil && *req.ScheduledFor != "" {
		t, err := time.Parse(time.RFC3339, *req.ScheduledFor)
		if err == nil {
			scheduledFor = &t
		}
	}

	var item AutoPublishQueueItem
	err := h.db.QueryRowx(`
		INSERT INTO blog_autopublish_queue (account_id, topic, primary_keyword, secondary_keywords,
			category_id, author_id, priority, scheduled_for)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
		accountID, req.Topic, req.PrimaryKeyword, pq.Array(req.SecondaryKeywords),
		req.CategoryID, req.AuthorID, req.Priority, scheduledFor,
	).StructScan(&item)
	if err != nil {
		log.Printf("ERROR: add to queue: %v", err)
		return response.InternalError(c, "Failed to add to queue")
	}

	return response.Created(c, item)
}

func (h *BlogAutoPublishHandler) BulkAddToQueue(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Items []struct {
			Topic             string   `json:"topic"`
			PrimaryKeyword    string   `json:"primary_keyword"`
			SecondaryKeywords []string `json:"secondary_keywords"`
			CategoryID        *int     `json:"category_id"`
			Priority          int      `json:"priority"`
		} `json:"items"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request")
	}

	added := 0
	for _, item := range req.Items {
		if item.Topic == "" {
			continue
		}
		_, err := h.db.Exec(`
			INSERT INTO blog_autopublish_queue (account_id, topic, primary_keyword, secondary_keywords, category_id, priority)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			accountID, item.Topic, item.PrimaryKeyword, pq.Array(item.SecondaryKeywords), item.CategoryID, item.Priority,
		)
		if err == nil {
			added++
		}
	}

	return response.Success(c, map[string]int{"added": added, "total": len(req.Items)})
}

func (h *BlogAutoPublishHandler) UpdateQueueItem(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Topic             string   `json:"topic"`
		PrimaryKeyword    string   `json:"primary_keyword"`
		SecondaryKeywords []string `json:"secondary_keywords"`
		CategoryID        *int     `json:"category_id"`
		AuthorID          *int     `json:"author_id"`
		Priority          int      `json:"priority"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request")
	}

	var item AutoPublishQueueItem
	err := h.db.QueryRowx(`
		UPDATE blog_autopublish_queue SET topic=$3, primary_keyword=$4, secondary_keywords=$5,
			category_id=$6, author_id=$7, priority=$8, updated_at=NOW()
		WHERE id=$1 AND account_id=$2 AND status='pending' RETURNING *`,
		id, accountID, req.Topic, req.PrimaryKeyword, pq.Array(req.SecondaryKeywords),
		req.CategoryID, req.AuthorID, req.Priority,
	).StructScan(&item)
	if err != nil {
		return response.NotFound(c, "Queue item not found or not editable")
	}

	return response.Success(c, item)
}

func (h *BlogAutoPublishHandler) DeleteQueueItem(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec("DELETE FROM blog_autopublish_queue WHERE id=$1 AND account_id=$2 AND status IN ('pending','failed','cancelled')", id, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Queue item not found or cannot be deleted")
	}

	return response.Success(c, map[string]string{"message": "Deleted"})
}

func (h *BlogAutoPublishHandler) RetryQueueItem(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var item AutoPublishQueueItem
	err := h.db.QueryRowx(`
		UPDATE blog_autopublish_queue SET status='pending', retry_count=0, error_message='', updated_at=NOW()
		WHERE id=$1 AND account_id=$2 AND status='failed' RETURNING *`,
		id, accountID,
	).StructScan(&item)
	if err != nil {
		return response.NotFound(c, "Queue item not found or not retryable")
	}

	return response.Success(c, item)
}

// GenerateNow immediately generates a blog post for a queue item.
func (h *BlogAutoPublishHandler) GenerateNow(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var item AutoPublishQueueItem
	err := h.db.Get(&item, "SELECT * FROM blog_autopublish_queue WHERE id=$1 AND account_id=$2 AND status IN ('pending','failed')", id, accountID)
	if err != nil {
		return response.NotFound(c, "Queue item not found or not processable")
	}

	// Get settings
	var settings AutoPublishSettings
	err = h.db.Get(&settings, "SELECT * FROM blog_autopublish_settings WHERE account_id = $1", accountID)
	if err != nil {
		return response.BadRequest(c, "Auto-publish settings not configured")
	}

	// Resolve API key (prefer Gemini, fallback to Anthropic)
	apiKey := settings.AnthropicAPIKey
	if apiKey == "" {
		apiKey = h.cfg.GeminiAPIKey
	}
	if apiKey == "" {
		apiKey = h.cfg.AnthropicAPIKey
	}
	if apiKey == "" {
		return response.BadRequest(c, "No AI API key configured (set Gemini or Anthropic key)")
	}

	// Mark as processing
	h.db.Exec("UPDATE blog_autopublish_queue SET status='processing', updated_at=NOW() WHERE id=$1", item.ID)

	// Generate
	postID, tokens, duration, err := h.processQueueItem(&item, &settings, apiKey)
	if err != nil {
		// Log failure
		h.db.Exec(`INSERT INTO blog_autopublish_logs (account_id, queue_id, action, status, message, tokens_used, duration_ms)
			VALUES ($1, $2, 'generate', 'error', $3, $4, $5)`,
			accountID, item.ID, err.Error(), tokens, duration)

		h.db.Exec("UPDATE blog_autopublish_queue SET status='failed', error_message=$2, retry_count=retry_count+1, updated_at=NOW() WHERE id=$1",
			item.ID, err.Error())

		return response.Error(c, http.StatusInternalServerError, "Generation failed: "+err.Error())
	}

	return response.Success(c, map[string]interface{}{
		"post_id":    postID,
		"tokens":     tokens,
		"duration_ms": duration,
		"message":    "Blog post generated and published successfully",
	})
}

// ============================================================
// Logs Endpoint
// ============================================================

func (h *BlogAutoPublishHandler) ListLogs(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var logs []AutoPublishLog
	h.db.Select(&logs, "SELECT * FROM blog_autopublish_logs WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100", accountID)

	if logs == nil {
		logs = []AutoPublishLog{}
	}

	return response.Success(c, logs)
}

// ============================================================
// Core Processing Logic (shared by cron and generate-now)
// ============================================================

func (h *BlogAutoPublishHandler) processQueueItem(item *AutoPublishQueueItem, settings *AutoPublishSettings, apiKey string) (int, int, int, error) {
	start := time.Now()

	client := anthropic.NewClient(apiKey, settings.AnthropicModel)

	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
	defer cancel()

	genSettings := anthropic.BlogGeneratorSettings{
		TargetWordCount: settings.TargetWordCount,
		TargetSEOScore:  settings.TargetSEOScore,
		ContentTone:     settings.ContentTone,
		TargetAudience:  settings.TargetAudience,
		SiteContext:     settings.SiteContext,
	}

	post, tokens, err := anthropic.GenerateBlogPost(ctx, client, item.Topic, item.PrimaryKeyword, item.SecondaryKeywords, genSettings)
	durationMs := int(time.Since(start).Milliseconds())
	if err != nil {
		return 0, tokens, durationMs, err
	}

	// Generate slug
	slug := slugify(post.Title)

	// Check slug uniqueness
	var exists int
	h.db.Get(&exists, "SELECT COUNT(*) FROM blog_posts WHERE account_id=$1 AND slug=$2", item.AccountID, slug)
	if exists > 0 {
		slug = slug + "-" + strconv.FormatInt(time.Now().Unix(), 10)
	}

	// Determine author and category
	authorID := item.AuthorID
	if authorID == nil {
		authorID = settings.DefaultAuthorID
	}
	categoryID := item.CategoryID
	if categoryID == nil {
		categoryID = settings.DefaultCategoryID
	}

	// Set status
	status := "draft"
	var publishedAt *time.Time
	if settings.AutoPublish {
		status = "published"
		now := time.Now().UTC()
		publishedAt = &now
	}

	// Marshal JSON fields
	entityTagsJSON, _ := json.Marshal(post.EntityTags)
	citationsJSON, _ := json.Marshal(post.SourceCitations)
	tocJSON, _ := json.Marshal(post.TableOfContents)
	keyPointsJSON, _ := json.Marshal(post.KeyPoints)

	// Featured image
	featuredImage := "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop"

	// Insert blog post
	var postID int
	err = h.db.QueryRow(`
		INSERT INTO blog_posts (account_id, author_id, category_id, title, slug, content_html, excerpt,
			featured_image_url, featured_image_alt, status, meta_title, meta_description,
			primary_keyword, secondary_keywords, quick_answer, schema_type,
			entity_tags, source_citations, table_of_contents, key_points,
			seo_score, readability_score, word_count, reading_time_min,
			published_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW())
		RETURNING id`,
		item.AccountID, authorID, categoryID, post.Title, slug, post.ContentHTML, post.Excerpt,
		featuredImage, post.FeaturedImageAlt, status, post.MetaTitle, post.MetaDescription,
		post.PrimaryKeyword, pq.Array(post.SecondaryKeywords), post.QuickAnswer, post.SchemaType,
		entityTagsJSON, citationsJSON, tocJSON, keyPointsJSON,
		post.SEOScore, post.ReadabilityScore, post.WordCount, post.ReadingTimeMin,
		publishedAt,
	).Scan(&postID)
	if err != nil {
		return 0, tokens, durationMs, fmt.Errorf("failed to insert blog post: %w", err)
	}

	// Insert FAQs
	for i, faq := range post.FAQs {
		h.db.Exec(`INSERT INTO blog_post_faqs (post_id, question, answer, sort_order) VALUES ($1,$2,$3,$4)`,
			postID, faq.Question, faq.Answer, i+1)
	}

	// Update queue item
	h.db.Exec(`UPDATE blog_autopublish_queue SET status='completed', post_id=$2, processed_at=NOW(), updated_at=NOW() WHERE id=$1`,
		item.ID, postID)

	// Log success
	h.db.Exec(`INSERT INTO blog_autopublish_logs (account_id, queue_id, post_id, action, status, message, tokens_used, duration_ms)
		VALUES ($1, $2, $3, 'generate', 'success', $4, $5, $6)`,
		item.AccountID, item.ID, postID,
		fmt.Sprintf("Generated: %s (%d words, %d FAQs)", post.Title, post.WordCount, len(post.FAQs)),
		tokens, durationMs)

	log.Printf("INFO: auto-publish: generated post ID %d '%s' for account %d (%d tokens, %dms)",
		postID, post.Title[:min(50, len(post.Title))], item.AccountID, tokens, durationMs)

	return postID, tokens, durationMs, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Reuse the existing slugify from blog.go (same package)
var _ = strings.TrimSpace // ensure strings import
