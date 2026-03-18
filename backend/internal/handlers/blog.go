package handlers

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// BlogHandler manages all Blog CMS endpoints.
type BlogHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

// NewBlogHandler creates a new Blog handler.
func NewBlogHandler(db *sqlx.DB, cfg *config.Config) *BlogHandler {
	return &BlogHandler{db: db, cfg: cfg}
}

// ============================================================
// Models
// ============================================================

type BlogAuthor struct {
	ID          int             `json:"id" db:"id"`
	AccountID   int             `json:"account_id" db:"account_id"`
	Name        string          `json:"name" db:"name"`
	Slug        string          `json:"slug" db:"slug"`
	Email       string          `json:"email" db:"email"`
	Bio         string          `json:"bio" db:"bio"`
	AvatarURL   string          `json:"avatar_url" db:"avatar_url"`
	Expertise   pq.StringArray  `json:"expertise" db:"expertise"`
	Credentials string          `json:"credentials" db:"credentials"`
	SocialLinks json.RawMessage `json:"social_links" db:"social_links"`
	EEATScore   int             `json:"eeat_score" db:"eeat_score"`
	IsActive    bool            `json:"is_active" db:"is_active"`
	PostCount   int             `json:"post_count,omitempty" db:"post_count"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

type BlogCategory struct {
	ID          int       `json:"id" db:"id"`
	AccountID   int       `json:"account_id" db:"account_id"`
	Name        string    `json:"name" db:"name"`
	Slug        string    `json:"slug" db:"slug"`
	Description string    `json:"description" db:"description"`
	ParentID    *int      `json:"parent_id" db:"parent_id"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	PostCount   int       `json:"post_count,omitempty" db:"post_count"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type BlogTag struct {
	ID        int       `json:"id" db:"id"`
	AccountID int       `json:"account_id" db:"account_id"`
	Name      string    `json:"name" db:"name"`
	Slug      string    `json:"slug" db:"slug"`
	PostCount int       `json:"post_count,omitempty" db:"post_count"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type BlogPost struct {
	ID               int              `json:"id" db:"id"`
	AccountID        int              `json:"account_id" db:"account_id"`
	AuthorID         *int             `json:"author_id" db:"author_id"`
	CategoryID       *int             `json:"category_id" db:"category_id"`
	Title            string           `json:"title" db:"title"`
	Slug             string           `json:"slug" db:"slug"`
	Content          json.RawMessage  `json:"content" db:"content"`
	ContentHTML      string           `json:"content_html" db:"content_html"`
	Excerpt          string           `json:"excerpt" db:"excerpt"`
	FeaturedImageURL string           `json:"featured_image_url" db:"featured_image_url"`
	FeaturedImageAlt string           `json:"featured_image_alt" db:"featured_image_alt"`
	Status           string           `json:"status" db:"status"`
	MetaTitle        string           `json:"meta_title" db:"meta_title"`
	MetaDescription  string           `json:"meta_description" db:"meta_description"`
	CanonicalURL     string           `json:"canonical_url" db:"canonical_url"`
	PrimaryKeyword   string           `json:"primary_keyword" db:"primary_keyword"`
	SecondaryKeywords pq.StringArray  `json:"secondary_keywords" db:"secondary_keywords"`
	QuickAnswer      string           `json:"quick_answer" db:"quick_answer"`
	SchemaType       string           `json:"schema_type" db:"schema_type"`
	SchemaJSON       json.RawMessage  `json:"schema_json" db:"schema_json"`
	EntityTags       json.RawMessage  `json:"entity_tags" db:"entity_tags"`
	SourceCitations  json.RawMessage  `json:"source_citations" db:"source_citations"`
	TableOfContents  json.RawMessage  `json:"table_of_contents" db:"table_of_contents"`
	KeyPoints        json.RawMessage  `json:"key_points" db:"key_points"`
	SEOScore         int              `json:"seo_score" db:"seo_score"`
	ReadabilityScore int              `json:"readability_score" db:"readability_score"`
	WordCount        int              `json:"word_count" db:"word_count"`
	ReadingTimeMin   int              `json:"reading_time_min" db:"reading_time_min"`
	PublishedAt      *time.Time       `json:"published_at" db:"published_at"`
	ScheduledAt      *time.Time       `json:"scheduled_at" db:"scheduled_at"`
	ViewCount        int              `json:"view_count" db:"view_count"`
	CreatedBy        *int             `json:"created_by" db:"created_by"`
	CreatedAt        time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at" db:"updated_at"`
	// Joined fields
	AuthorName   string `json:"author_name,omitempty" db:"author_name"`
	CategoryName string `json:"category_name,omitempty" db:"category_name"`
}

type BlogPostFAQ struct {
	ID        int       `json:"id" db:"id"`
	PostID    int       `json:"post_id" db:"post_id"`
	Question  string    `json:"question" db:"question"`
	Answer    string    `json:"answer" db:"answer"`
	SortOrder int       `json:"sort_order" db:"sort_order"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type BlogSettings struct {
	ID              int       `json:"id" db:"id"`
	AccountID       int       `json:"account_id" db:"account_id"`
	BlogTitle       string    `json:"blog_title" db:"blog_title"`
	BlogDescription string    `json:"blog_description" db:"blog_description"`
	PostsPerPage    int       `json:"posts_per_page" db:"posts_per_page"`
	RobotsTxt       string    `json:"robots_txt" db:"robots_txt"`
	CustomHeadTags  string    `json:"custom_head_tags" db:"custom_head_tags"`
	DefaultOGImage  string    `json:"default_og_image" db:"default_og_image"`
	SitemapEnabled  bool      `json:"sitemap_enabled" db:"sitemap_enabled"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// ============================================================
// Helpers
// ============================================================

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

func getPaginationParams(c echo.Context) (int, int, int) {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return page, perPage, offset
}

// ============================================================
// Authors CRUD
// ============================================================

func (h *BlogHandler) ListAuthors(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var authors []BlogAuthor
	err := h.db.Select(&authors, `
		SELECT a.*, COALESCE(pc.cnt, 0) AS post_count
		FROM blog_authors a
		LEFT JOIN (SELECT author_id, COUNT(*) AS cnt FROM blog_posts WHERE account_id = $1 GROUP BY author_id) pc ON pc.author_id = a.id
		WHERE a.account_id = $1
		ORDER BY a.name ASC
	`, accountID)
	if err != nil {
		log.Printf("Error listing blog authors: %v", err)
		return response.InternalError(c, "Failed to list authors")
	}
	if authors == nil {
		authors = []BlogAuthor{}
	}
	return response.Success(c, authors)
}

func (h *BlogHandler) GetAuthor(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var author BlogAuthor
	err := h.db.Get(&author, `SELECT * FROM blog_authors WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Author not found")
	}
	return response.Success(c, author)
}

func (h *BlogHandler) CreateAuthor(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Name        string          `json:"name"`
		Email       string          `json:"email"`
		Bio         string          `json:"bio"`
		AvatarURL   string          `json:"avatar_url"`
		Expertise   []string        `json:"expertise"`
		Credentials string          `json:"credentials"`
		SocialLinks json.RawMessage `json:"social_links"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	slug := slugify(req.Name)
	if req.SocialLinks == nil {
		req.SocialLinks = json.RawMessage(`{}`)
	}
	if req.Expertise == nil {
		req.Expertise = []string{}
	}

	var author BlogAuthor
	err := h.db.QueryRowx(`
		INSERT INTO blog_authors (account_id, name, slug, email, bio, avatar_url, expertise, credentials, social_links)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING *
	`, accountID, req.Name, slug, req.Email, req.Bio, req.AvatarURL, pq.Array(req.Expertise), req.Credentials, req.SocialLinks).StructScan(&author)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			return response.BadRequest(c, "Author with this name already exists")
		}
		log.Printf("Error creating blog author: %v", err)
		return response.InternalError(c, "Failed to create author")
	}
	return response.Created(c, author)
}

func (h *BlogHandler) UpdateAuthor(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Name        string          `json:"name"`
		Email       string          `json:"email"`
		Bio         string          `json:"bio"`
		AvatarURL   string          `json:"avatar_url"`
		Expertise   []string        `json:"expertise"`
		Credentials string          `json:"credentials"`
		SocialLinks json.RawMessage `json:"social_links"`
		IsActive    *bool           `json:"is_active"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	slug := slugify(req.Name)
	if req.SocialLinks == nil {
		req.SocialLinks = json.RawMessage(`{}`)
	}
	if req.Expertise == nil {
		req.Expertise = []string{}
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var author BlogAuthor
	err := h.db.QueryRowx(`
		UPDATE blog_authors SET name=$1, slug=$2, email=$3, bio=$4, avatar_url=$5, expertise=$6, credentials=$7, social_links=$8, is_active=$9, updated_at=NOW()
		WHERE id=$10 AND account_id=$11
		RETURNING *
	`, req.Name, slug, req.Email, req.Bio, req.AvatarURL, pq.Array(req.Expertise), req.Credentials, req.SocialLinks, isActive, id, accountID).StructScan(&author)
	if err != nil {
		log.Printf("Error updating blog author: %v", err)
		return response.InternalError(c, "Failed to update author")
	}
	return response.Success(c, author)
}

func (h *BlogHandler) DeleteAuthor(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec(`DELETE FROM blog_authors WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		log.Printf("Error deleting blog author: %v", err)
		return response.InternalError(c, "Failed to delete author")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Author not found")
	}
	return response.SuccessWithMessage(c, "Author deleted", nil)
}

// ============================================================
// Categories CRUD
// ============================================================

func (h *BlogHandler) ListCategories(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var categories []BlogCategory
	err := h.db.Select(&categories, `
		SELECT c.*, COALESCE(pc.cnt, 0) AS post_count
		FROM blog_categories c
		LEFT JOIN (SELECT category_id, COUNT(*) AS cnt FROM blog_posts WHERE account_id = $1 GROUP BY category_id) pc ON pc.category_id = c.id
		WHERE c.account_id = $1
		ORDER BY c.sort_order ASC, c.name ASC
	`, accountID)
	if err != nil {
		log.Printf("Error listing blog categories: %v", err)
		return response.InternalError(c, "Failed to list categories")
	}
	if categories == nil {
		categories = []BlogCategory{}
	}
	return response.Success(c, categories)
}

func (h *BlogHandler) CreateCategory(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	slug := slugify(req.Name)
	var cat BlogCategory
	err := h.db.QueryRowx(`
		INSERT INTO blog_categories (account_id, name, slug, description, parent_id, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
	`, accountID, req.Name, slug, req.Description, req.ParentID, req.SortOrder).StructScan(&cat)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			return response.BadRequest(c, "Category with this name already exists")
		}
		log.Printf("Error creating blog category: %v", err)
		return response.InternalError(c, "Failed to create category")
	}
	return response.Created(c, cat)
}

func (h *BlogHandler) UpdateCategory(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	slug := slugify(req.Name)
	var cat BlogCategory
	err := h.db.QueryRowx(`
		UPDATE blog_categories SET name=$1, slug=$2, description=$3, parent_id=$4, sort_order=$5, updated_at=NOW()
		WHERE id=$6 AND account_id=$7 RETURNING *
	`, req.Name, slug, req.Description, req.ParentID, req.SortOrder, id, accountID).StructScan(&cat)
	if err != nil {
		log.Printf("Error updating blog category: %v", err)
		return response.InternalError(c, "Failed to update category")
	}
	return response.Success(c, cat)
}

func (h *BlogHandler) DeleteCategory(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec(`DELETE FROM blog_categories WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		log.Printf("Error deleting blog category: %v", err)
		return response.InternalError(c, "Failed to delete category")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Category not found")
	}
	return response.SuccessWithMessage(c, "Category deleted", nil)
}

// ============================================================
// Tags CRUD
// ============================================================

func (h *BlogHandler) ListTags(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var tags []BlogTag
	err := h.db.Select(&tags, `
		SELECT t.*, COALESCE(pc.cnt, 0) AS post_count
		FROM blog_tags t
		LEFT JOIN (SELECT tag_id, COUNT(*) AS cnt FROM blog_post_tags pt JOIN blog_posts p ON p.id = pt.post_id WHERE p.account_id = $1 GROUP BY tag_id) pc ON pc.tag_id = t.id
		WHERE t.account_id = $1
		ORDER BY t.name ASC
	`, accountID)
	if err != nil {
		log.Printf("Error listing blog tags: %v", err)
		return response.InternalError(c, "Failed to list tags")
	}
	if tags == nil {
		tags = []BlogTag{}
	}
	return response.Success(c, tags)
}

func (h *BlogHandler) CreateTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	slug := slugify(req.Name)
	var tag BlogTag
	err := h.db.QueryRowx(`
		INSERT INTO blog_tags (account_id, name, slug) VALUES ($1, $2, $3)
		ON CONFLICT (account_id, slug) DO UPDATE SET name = EXCLUDED.name
		RETURNING *
	`, accountID, req.Name, slug).StructScan(&tag)
	if err != nil {
		log.Printf("Error creating blog tag: %v", err)
		return response.InternalError(c, "Failed to create tag")
	}
	return response.Created(c, tag)
}

func (h *BlogHandler) DeleteTag(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec(`DELETE FROM blog_tags WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		log.Printf("Error deleting blog tag: %v", err)
		return response.InternalError(c, "Failed to delete tag")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Tag not found")
	}
	return response.SuccessWithMessage(c, "Tag deleted", nil)
}

// ============================================================
// Posts CRUD
// ============================================================

func (h *BlogHandler) ListPosts(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	page, perPage, offset := getPaginationParams(c)

	status := c.QueryParam("status")
	categoryID := c.QueryParam("category_id")
	authorID := c.QueryParam("author_id")
	search := c.QueryParam("search")

	// Build WHERE clause
	where := "p.account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	if status != "" {
		where += fmt.Sprintf(" AND p.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if categoryID != "" {
		where += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		catID, _ := strconv.Atoi(categoryID)
		args = append(args, catID)
		argIdx++
	}
	if authorID != "" {
		where += fmt.Sprintf(" AND p.author_id = $%d", argIdx)
		authID, _ := strconv.Atoi(authorID)
		args = append(args, authID)
		argIdx++
	}
	if search != "" {
		where += fmt.Sprintf(" AND (p.title ILIKE $%d OR p.excerpt ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Count
	var total int
	err := h.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM blog_posts p WHERE %s", where), args...)
	if err != nil {
		log.Printf("Error counting blog posts: %v", err)
		return response.InternalError(c, "Failed to list posts")
	}

	// Select (don't load full content for list view)
	listArgs := append(args, perPage, offset)
	var posts []BlogPost
	err = h.db.Select(&posts, fmt.Sprintf(`
		SELECT p.id, p.account_id, p.author_id, p.category_id, p.title, p.slug, p.excerpt,
		       p.featured_image_url, p.status, p.meta_title, p.primary_keyword,
		       p.seo_score, p.word_count, p.reading_time_min, p.view_count,
		       p.published_at, p.created_at, p.updated_at,
		       COALESCE(a.name, '') AS author_name,
		       COALESCE(cat.name, '') AS category_name
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		LEFT JOIN blog_categories cat ON cat.id = p.category_id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1), listArgs...)
	if err != nil {
		log.Printf("Error listing blog posts: %v", err)
		return response.InternalError(c, "Failed to list posts")
	}
	if posts == nil {
		posts = []BlogPost{}
	}
	return response.Paginated(c, posts, total, page, perPage)
}

func (h *BlogHandler) GetPost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var post BlogPost
	err := h.db.Get(&post, `
		SELECT p.*, COALESCE(a.name, '') AS author_name, COALESCE(cat.name, '') AS category_name
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		LEFT JOIN blog_categories cat ON cat.id = p.category_id
		WHERE p.id = $1 AND p.account_id = $2
	`, id, accountID)
	if err != nil {
		return response.NotFound(c, "Post not found")
	}

	// Get tags
	var tags []BlogTag
	h.db.Select(&tags, `
		SELECT t.* FROM blog_tags t
		JOIN blog_post_tags pt ON pt.tag_id = t.id
		WHERE pt.post_id = $1
		ORDER BY t.name ASC
	`, id)
	if tags == nil {
		tags = []BlogTag{}
	}

	// Get FAQs
	var faqs []BlogPostFAQ
	h.db.Select(&faqs, `SELECT * FROM blog_post_faqs WHERE post_id = $1 ORDER BY sort_order ASC`, id)
	if faqs == nil {
		faqs = []BlogPostFAQ{}
	}

	return response.Success(c, map[string]interface{}{
		"post": post,
		"tags": tags,
		"faqs": faqs,
	})
}

func (h *BlogHandler) CreatePost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	userID := mw.GetUserID(c)

	var req struct {
		Title            string          `json:"title"`
		Content          json.RawMessage `json:"content"`
		ContentHTML      string          `json:"content_html"`
		Excerpt          string          `json:"excerpt"`
		FeaturedImageURL string          `json:"featured_image_url"`
		FeaturedImageAlt string          `json:"featured_image_alt"`
		AuthorID         *int            `json:"author_id"`
		CategoryID       *int            `json:"category_id"`
		Status           string          `json:"status"`
		MetaTitle        string          `json:"meta_title"`
		MetaDescription  string          `json:"meta_description"`
		CanonicalURL     string          `json:"canonical_url"`
		PrimaryKeyword   string          `json:"primary_keyword"`
		SecondaryKeywords []string       `json:"secondary_keywords"`
		QuickAnswer      string          `json:"quick_answer"`
		SchemaType       string          `json:"schema_type"`
		EntityTags       json.RawMessage `json:"entity_tags"`
		SourceCitations  json.RawMessage `json:"source_citations"`
		TableOfContents  json.RawMessage `json:"table_of_contents"`
		KeyPoints        json.RawMessage `json:"key_points"`
		SEOScore         int             `json:"seo_score"`
		ReadabilityScore int             `json:"readability_score"`
		WordCount        int             `json:"word_count"`
		ReadingTimeMin   int             `json:"reading_time_min"`
		TagIDs           []int           `json:"tag_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Title == "" {
		return response.BadRequest(c, "Title is required")
	}

	slug := slugify(req.Title)
	if req.Status == "" {
		req.Status = "draft"
	}
	if req.SchemaType == "" {
		req.SchemaType = "Article"
	}
	if req.Content == nil {
		req.Content = json.RawMessage(`{}`)
	}
	if req.EntityTags == nil {
		req.EntityTags = json.RawMessage(`[]`)
	}
	if req.SourceCitations == nil {
		req.SourceCitations = json.RawMessage(`[]`)
	}
	if req.TableOfContents == nil {
		req.TableOfContents = json.RawMessage(`[]`)
	}
	if req.KeyPoints == nil {
		req.KeyPoints = json.RawMessage(`[]`)
	}
	if req.SecondaryKeywords == nil {
		req.SecondaryKeywords = []string{}
	}

	// Check slug uniqueness, append suffix if needed
	var existing int
	h.db.Get(&existing, `SELECT COUNT(*) FROM blog_posts WHERE account_id = $1 AND slug = $2`, accountID, slug)
	if existing > 0 {
		slug = fmt.Sprintf("%s-%d", slug, time.Now().Unix())
	}

	var publishedAt *time.Time
	if req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}

	var post BlogPost
	err := h.db.QueryRowx(`
		INSERT INTO blog_posts (account_id, author_id, category_id, title, slug, content, content_html, excerpt,
		    featured_image_url, featured_image_alt, status, meta_title, meta_description, canonical_url,
		    primary_keyword, secondary_keywords, quick_answer, schema_type, entity_tags, source_citations,
		    table_of_contents, key_points, seo_score, readability_score, word_count, reading_time_min,
		    published_at, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
		RETURNING *
	`, accountID, req.AuthorID, req.CategoryID, req.Title, slug, req.Content, req.ContentHTML, req.Excerpt,
		req.FeaturedImageURL, req.FeaturedImageAlt, req.Status, req.MetaTitle, req.MetaDescription, req.CanonicalURL,
		req.PrimaryKeyword, pq.Array(req.SecondaryKeywords), req.QuickAnswer, req.SchemaType, req.EntityTags, req.SourceCitations,
		req.TableOfContents, req.KeyPoints, req.SEOScore, req.ReadabilityScore, req.WordCount, req.ReadingTimeMin,
		publishedAt, userID).StructScan(&post)
	if err != nil {
		log.Printf("Error creating blog post: %v", err)
		return response.InternalError(c, "Failed to create post")
	}

	// Insert tags
	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			h.db.Exec(`INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, post.ID, tagID)
		}
	}

	return response.Created(c, post)
}

func (h *BlogHandler) UpdatePost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Title            string          `json:"title"`
		Slug             string          `json:"slug"`
		Content          json.RawMessage `json:"content"`
		ContentHTML      string          `json:"content_html"`
		Excerpt          string          `json:"excerpt"`
		FeaturedImageURL string          `json:"featured_image_url"`
		FeaturedImageAlt string          `json:"featured_image_alt"`
		AuthorID         *int            `json:"author_id"`
		CategoryID       *int            `json:"category_id"`
		Status           string          `json:"status"`
		MetaTitle        string          `json:"meta_title"`
		MetaDescription  string          `json:"meta_description"`
		CanonicalURL     string          `json:"canonical_url"`
		PrimaryKeyword   string          `json:"primary_keyword"`
		SecondaryKeywords []string       `json:"secondary_keywords"`
		QuickAnswer      string          `json:"quick_answer"`
		SchemaType       string          `json:"schema_type"`
		EntityTags       json.RawMessage `json:"entity_tags"`
		SourceCitations  json.RawMessage `json:"source_citations"`
		TableOfContents  json.RawMessage `json:"table_of_contents"`
		KeyPoints        json.RawMessage `json:"key_points"`
		SEOScore         int             `json:"seo_score"`
		ReadabilityScore int             `json:"readability_score"`
		WordCount        int             `json:"word_count"`
		ReadingTimeMin   int             `json:"reading_time_min"`
		TagIDs           []int           `json:"tag_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Slug == "" && req.Title != "" {
		req.Slug = slugify(req.Title)
	}
	if req.Content == nil {
		req.Content = json.RawMessage(`{}`)
	}
	if req.EntityTags == nil {
		req.EntityTags = json.RawMessage(`[]`)
	}
	if req.SourceCitations == nil {
		req.SourceCitations = json.RawMessage(`[]`)
	}
	if req.TableOfContents == nil {
		req.TableOfContents = json.RawMessage(`[]`)
	}
	if req.KeyPoints == nil {
		req.KeyPoints = json.RawMessage(`[]`)
	}
	if req.SecondaryKeywords == nil {
		req.SecondaryKeywords = []string{}
	}

	// Check if transitioning to published
	var currentStatus string
	h.db.Get(&currentStatus, `SELECT status FROM blog_posts WHERE id = $1 AND account_id = $2`, id, accountID)

	publishedUpdate := ""
	if req.Status == "published" && currentStatus != "published" {
		publishedUpdate = ", published_at = NOW()"
	}

	var post BlogPost
	err := h.db.QueryRowx(fmt.Sprintf(`
		UPDATE blog_posts SET title=$1, slug=$2, content=$3, content_html=$4, excerpt=$5,
		    featured_image_url=$6, featured_image_alt=$7, author_id=$8, category_id=$9, status=$10,
		    meta_title=$11, meta_description=$12, canonical_url=$13, primary_keyword=$14, secondary_keywords=$15,
		    quick_answer=$16, schema_type=$17, entity_tags=$18, source_citations=$19,
		    table_of_contents=$20, key_points=$21, seo_score=$22, readability_score=$23,
		    word_count=$24, reading_time_min=$25, updated_at=NOW()%s
		WHERE id=$26 AND account_id=$27
		RETURNING *
	`, publishedUpdate),
		req.Title, req.Slug, req.Content, req.ContentHTML, req.Excerpt,
		req.FeaturedImageURL, req.FeaturedImageAlt, req.AuthorID, req.CategoryID, req.Status,
		req.MetaTitle, req.MetaDescription, req.CanonicalURL, req.PrimaryKeyword, pq.Array(req.SecondaryKeywords),
		req.QuickAnswer, req.SchemaType, req.EntityTags, req.SourceCitations,
		req.TableOfContents, req.KeyPoints, req.SEOScore, req.ReadabilityScore,
		req.WordCount, req.ReadingTimeMin, id, accountID).StructScan(&post)
	if err != nil {
		log.Printf("Error updating blog post: %v", err)
		return response.InternalError(c, "Failed to update post")
	}

	// Update tags
	if req.TagIDs != nil {
		h.db.Exec(`DELETE FROM blog_post_tags WHERE post_id = $1`, id)
		for _, tagID := range req.TagIDs {
			h.db.Exec(`INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, tagID)
		}
	}

	return response.Success(c, post)
}

func (h *BlogHandler) DeletePost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result, err := h.db.Exec(`DELETE FROM blog_posts WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		log.Printf("Error deleting blog post: %v", err)
		return response.InternalError(c, "Failed to delete post")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Post not found")
	}
	return response.SuccessWithMessage(c, "Post deleted", nil)
}

func (h *BlogHandler) PublishPost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var post BlogPost
	err := h.db.QueryRowx(`
		UPDATE blog_posts SET status='published', published_at=NOW(), updated_at=NOW()
		WHERE id=$1 AND account_id=$2 RETURNING *
	`, id, accountID).StructScan(&post)
	if err != nil {
		return response.NotFound(c, "Post not found")
	}
	return response.SuccessWithMessage(c, "Post published", post)
}

func (h *BlogHandler) UnpublishPost(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var post BlogPost
	err := h.db.QueryRowx(`
		UPDATE blog_posts SET status='draft', updated_at=NOW()
		WHERE id=$1 AND account_id=$2 RETURNING *
	`, id, accountID).StructScan(&post)
	if err != nil {
		return response.NotFound(c, "Post not found")
	}
	return response.SuccessWithMessage(c, "Post unpublished", post)
}

// ============================================================
// FAQs (per-post)
// ============================================================

func (h *BlogHandler) ListPostFAQs(c echo.Context) error {
	postID, _ := strconv.Atoi(c.Param("id"))

	var faqs []BlogPostFAQ
	err := h.db.Select(&faqs, `SELECT * FROM blog_post_faqs WHERE post_id = $1 ORDER BY sort_order ASC`, postID)
	if err != nil {
		log.Printf("Error listing post FAQs: %v", err)
		return response.InternalError(c, "Failed to list FAQs")
	}
	if faqs == nil {
		faqs = []BlogPostFAQ{}
	}
	return response.Success(c, faqs)
}

func (h *BlogHandler) CreatePostFAQ(c echo.Context) error {
	postID, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Question  string `json:"question"`
		Answer    string `json:"answer"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Question == "" || req.Answer == "" {
		return response.BadRequest(c, "Question and answer are required")
	}

	var faq BlogPostFAQ
	err := h.db.QueryRowx(`
		INSERT INTO blog_post_faqs (post_id, question, answer, sort_order)
		VALUES ($1, $2, $3, $4) RETURNING *
	`, postID, req.Question, req.Answer, req.SortOrder).StructScan(&faq)
	if err != nil {
		log.Printf("Error creating post FAQ: %v", err)
		return response.InternalError(c, "Failed to create FAQ")
	}
	return response.Created(c, faq)
}

func (h *BlogHandler) UpdatePostFAQ(c echo.Context) error {
	faqID, _ := strconv.Atoi(c.Param("faq_id"))

	var req struct {
		Question  string `json:"question"`
		Answer    string `json:"answer"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var faq BlogPostFAQ
	err := h.db.QueryRowx(`
		UPDATE blog_post_faqs SET question=$1, answer=$2, sort_order=$3 WHERE id=$4 RETURNING *
	`, req.Question, req.Answer, req.SortOrder, faqID).StructScan(&faq)
	if err != nil {
		return response.NotFound(c, "FAQ not found")
	}
	return response.Success(c, faq)
}

func (h *BlogHandler) DeletePostFAQ(c echo.Context) error {
	faqID, _ := strconv.Atoi(c.Param("faq_id"))

	result, err := h.db.Exec(`DELETE FROM blog_post_faqs WHERE id = $1`, faqID)
	if err != nil {
		log.Printf("Error deleting post FAQ: %v", err)
		return response.InternalError(c, "Failed to delete FAQ")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "FAQ not found")
	}
	return response.SuccessWithMessage(c, "FAQ deleted", nil)
}

// ============================================================
// Settings
// ============================================================

func (h *BlogHandler) GetBlogSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var settings BlogSettings
	err := h.db.Get(&settings, `SELECT * FROM blog_settings WHERE account_id = $1`, accountID)
	if err != nil {
		// Create default settings
		err = h.db.QueryRowx(`
			INSERT INTO blog_settings (account_id) VALUES ($1)
			ON CONFLICT (account_id) DO UPDATE SET updated_at = NOW()
			RETURNING *
		`, accountID).StructScan(&settings)
		if err != nil {
			log.Printf("Error creating blog settings: %v", err)
			return response.InternalError(c, "Failed to load settings")
		}
	}
	return response.Success(c, settings)
}

func (h *BlogHandler) UpdateBlogSettings(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var req struct {
		BlogTitle       string `json:"blog_title"`
		BlogDescription string `json:"blog_description"`
		PostsPerPage    int    `json:"posts_per_page"`
		RobotsTxt       string `json:"robots_txt"`
		CustomHeadTags  string `json:"custom_head_tags"`
		DefaultOGImage  string `json:"default_og_image"`
		SitemapEnabled  *bool  `json:"sitemap_enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.PostsPerPage < 1 {
		req.PostsPerPage = 10
	}

	sitemapEnabled := true
	if req.SitemapEnabled != nil {
		sitemapEnabled = *req.SitemapEnabled
	}

	var settings BlogSettings
	err := h.db.QueryRowx(`
		INSERT INTO blog_settings (account_id, blog_title, blog_description, posts_per_page, robots_txt, custom_head_tags, default_og_image, sitemap_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (account_id) DO UPDATE SET
		    blog_title=$2, blog_description=$3, posts_per_page=$4, robots_txt=$5,
		    custom_head_tags=$6, default_og_image=$7, sitemap_enabled=$8, updated_at=NOW()
		RETURNING *
	`, accountID, req.BlogTitle, req.BlogDescription, req.PostsPerPage, req.RobotsTxt, req.CustomHeadTags, req.DefaultOGImage, sitemapEnabled).StructScan(&settings)
	if err != nil {
		log.Printf("Error updating blog settings: %v", err)
		return response.InternalError(c, "Failed to update settings")
	}
	return response.Success(c, settings)
}

// ============================================================
// Dashboard Stats
// ============================================================

func (h *BlogHandler) GetDashboardStats(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	type Stats struct {
		TotalPosts     int `json:"total_posts" db:"total_posts"`
		PublishedPosts int `json:"published_posts" db:"published_posts"`
		DraftPosts     int `json:"draft_posts" db:"draft_posts"`
		TotalViews     int `json:"total_views" db:"total_views"`
		TotalAuthors   int `json:"total_authors" db:"total_authors"`
		TotalCategories int `json:"total_categories" db:"total_categories"`
		AvgSEOScore    int `json:"avg_seo_score" db:"avg_seo_score"`
	}

	var stats Stats
	err := h.db.Get(&stats, `
		SELECT
		    (SELECT COUNT(*) FROM blog_posts WHERE account_id = $1) AS total_posts,
		    (SELECT COUNT(*) FROM blog_posts WHERE account_id = $1 AND status = 'published') AS published_posts,
		    (SELECT COUNT(*) FROM blog_posts WHERE account_id = $1 AND status = 'draft') AS draft_posts,
		    (SELECT COALESCE(SUM(view_count), 0) FROM blog_posts WHERE account_id = $1) AS total_views,
		    (SELECT COUNT(*) FROM blog_authors WHERE account_id = $1) AS total_authors,
		    (SELECT COUNT(*) FROM blog_categories WHERE account_id = $1) AS total_categories,
		    (SELECT COALESCE(AVG(seo_score), 0)::INT FROM blog_posts WHERE account_id = $1) AS avg_seo_score
	`, accountID)
	if err != nil {
		log.Printf("Error getting blog stats: %v", err)
		return response.InternalError(c, "Failed to load stats")
	}

	// Recent posts
	var recentPosts []BlogPost
	h.db.Select(&recentPosts, `
		SELECT p.id, p.title, p.slug, p.status, p.seo_score, p.view_count, p.published_at, p.created_at,
		       COALESCE(a.name, '') AS author_name
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		WHERE p.account_id = $1
		ORDER BY p.created_at DESC LIMIT 5
	`, accountID)
	if recentPosts == nil {
		recentPosts = []BlogPost{}
	}

	return response.Success(c, map[string]interface{}{
		"stats":        stats,
		"recent_posts": recentPosts,
	})
}

// ============================================================
// Public Endpoints (No auth required)
// ============================================================

func (h *BlogHandler) PublicListPosts(c echo.Context) error {
	page, perPage, offset := getPaginationParams(c)
	categorySlug := c.QueryParam("category")
	tagSlug := c.QueryParam("tag")
	authorSlug := c.QueryParam("author")

	where := "p.status = 'published'"
	args := []interface{}{}
	argIdx := 1

	if categorySlug != "" {
		where += fmt.Sprintf(" AND cat.slug = $%d", argIdx)
		args = append(args, categorySlug)
		argIdx++
	}
	if authorSlug != "" {
		where += fmt.Sprintf(" AND a.slug = $%d", argIdx)
		args = append(args, authorSlug)
		argIdx++
	}
	if tagSlug != "" {
		where += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM blog_post_tags pt JOIN blog_tags t ON t.id=pt.tag_id WHERE pt.post_id=p.id AND t.slug=$%d)", argIdx)
		args = append(args, tagSlug)
		argIdx++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	err := h.db.Get(&total, fmt.Sprintf(`
		SELECT COUNT(*)
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		LEFT JOIN blog_categories cat ON cat.id = p.category_id
		WHERE %s
	`, where), countArgs...)
	if err != nil {
		log.Printf("Error counting public posts: %v", err)
		return response.InternalError(c, "Failed to list posts")
	}

	listArgs := append(args, perPage, offset)
	var posts []BlogPost
	err = h.db.Select(&posts, fmt.Sprintf(`
		SELECT p.id, p.account_id, p.title, p.slug, p.excerpt, p.featured_image_url, p.featured_image_alt,
		       p.meta_title, p.meta_description, p.quick_answer, p.primary_keyword,
		       p.seo_score, p.word_count, p.reading_time_min, p.view_count, p.published_at, p.created_at,
		       COALESCE(a.name, '') AS author_name,
		       COALESCE(cat.name, '') AS category_name
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		LEFT JOIN blog_categories cat ON cat.id = p.category_id
		WHERE %s
		ORDER BY p.published_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1), listArgs...)
	if err != nil {
		log.Printf("Error listing public posts: %v", err)
		return response.InternalError(c, "Failed to list posts")
	}
	if posts == nil {
		posts = []BlogPost{}
	}
	return response.Paginated(c, posts, total, page, perPage)
}

func (h *BlogHandler) PublicGetPost(c echo.Context) error {
	slug := c.Param("slug")

	var post BlogPost
	err := h.db.Get(&post, `
		SELECT p.*, COALESCE(a.name, '') AS author_name, COALESCE(cat.name, '') AS category_name
		FROM blog_posts p
		LEFT JOIN blog_authors a ON a.id = p.author_id
		LEFT JOIN blog_categories cat ON cat.id = p.category_id
		WHERE p.slug = $1 AND p.status = 'published'
	`, slug)
	if err != nil {
		return response.NotFound(c, "Post not found")
	}

	// Increment view count
	h.db.Exec(`UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`, post.ID)

	// Get author details
	var author *BlogAuthor
	if post.AuthorID != nil {
		var a BlogAuthor
		if err := h.db.Get(&a, `SELECT * FROM blog_authors WHERE id = $1`, *post.AuthorID); err == nil {
			author = &a
		}
	}

	// Get tags
	var tags []BlogTag
	h.db.Select(&tags, `
		SELECT t.* FROM blog_tags t
		JOIN blog_post_tags pt ON pt.tag_id = t.id
		WHERE pt.post_id = $1 ORDER BY t.name ASC
	`, post.ID)
	if tags == nil {
		tags = []BlogTag{}
	}

	// Get FAQs
	var faqs []BlogPostFAQ
	h.db.Select(&faqs, `SELECT * FROM blog_post_faqs WHERE post_id = $1 ORDER BY sort_order ASC`, post.ID)
	if faqs == nil {
		faqs = []BlogPostFAQ{}
	}

	return response.Success(c, map[string]interface{}{
		"post":   post,
		"author": author,
		"tags":   tags,
		"faqs":   faqs,
	})
}

func (h *BlogHandler) PublicListByCategory(c echo.Context) error {
	c.SetParamNames("category")
	c.QueryParams().Set("category", c.Param("slug"))
	return h.PublicListPosts(c)
}

func (h *BlogHandler) PublicListByAuthor(c echo.Context) error {
	c.QueryParams().Set("author", c.Param("slug"))
	return h.PublicListPosts(c)
}

func (h *BlogHandler) PublicListByTag(c echo.Context) error {
	c.QueryParams().Set("tag", c.Param("slug"))
	return h.PublicListPosts(c)
}

// ============================================================
// Sitemap XML
// ============================================================

type sitemapURL struct {
	XMLName    xml.Name `xml:"url"`
	Loc        string   `xml:"loc"`
	LastMod    string   `xml:"lastmod,omitempty"`
	ChangeFreq string   `xml:"changefreq,omitempty"`
	Priority   string   `xml:"priority,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func (h *BlogHandler) PublicGetSitemap(c echo.Context) error {
	type PostInfo struct {
		Slug      string    `db:"slug"`
		UpdatedAt time.Time `db:"updated_at"`
	}

	var posts []PostInfo
	err := h.db.Select(&posts, `
		SELECT slug, updated_at FROM blog_posts
		WHERE status = 'published'
		ORDER BY published_at DESC
	`)
	if err != nil {
		log.Printf("Error generating sitemap: %v", err)
		return response.InternalError(c, "Failed to generate sitemap")
	}

	baseURL := "https://nepalfillings.com"

	urlset := sitemapURLSet{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
	}

	// Blog index
	urlset.URLs = append(urlset.URLs, sitemapURL{
		Loc:        baseURL + "/blog",
		ChangeFreq: "daily",
		Priority:   "0.8",
	})

	// Individual posts
	for _, p := range posts {
		urlset.URLs = append(urlset.URLs, sitemapURL{
			Loc:        baseURL + "/blog/" + p.Slug,
			LastMod:    p.UpdatedAt.Format("2006-01-02"),
			ChangeFreq: "weekly",
			Priority:   "0.9",
		})
	}

	c.Response().Header().Set("Content-Type", "application/xml")
	output, _ := xml.MarshalIndent(urlset, "", "  ")
	return c.String(http.StatusOK, xml.Header+string(output))
}

func (h *BlogHandler) PublicGetRobotsTxt(c echo.Context) error {
	// Try to get custom robots.txt from any account's blog settings
	var robotsTxt string
	err := h.db.Get(&robotsTxt, `SELECT robots_txt FROM blog_settings ORDER BY id LIMIT 1`)
	if err != nil || robotsTxt == "" {
		robotsTxt = "User-agent: *\nAllow: /blog/\nDisallow: /en/\nSitemap: https://nepalfillings.com/api/public/blog/sitemap.xml"
	}
	c.Response().Header().Set("Content-Type", "text/plain")
	return c.String(http.StatusOK, robotsTxt)
}

// Ensure sql import is used
var _ = sql.ErrNoRows
