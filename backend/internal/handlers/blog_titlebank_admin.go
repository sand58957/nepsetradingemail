package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

const titleBankAccountID = 20

// TitleBankStats is the admin dashboard payload (spec §18).
type TitleBankStats struct {
	TotalTitles     int        `json:"total_titles"      db:"total"`
	Published       int        `json:"published"         db:"published"`
	Queued          int        `json:"queued"            db:"queued"`
	Generating      int        `json:"generating"        db:"generating"`
	Remaining       int        `json:"remaining"         db:"remaining"`
	Failed          int        `json:"failed"            db:"failed"`
	Skipped         int        `json:"skipped"           db:"skipped"`
	IsEnabled       bool       `json:"is_enabled"`
	IntervalMinutes int        `json:"publishing_interval_minutes"`
	NextPublication *time.Time `json:"next_publication"`
	LastPublishedAt *time.Time `json:"last_published_at"`
	CurrentAuthor   string     `json:"current_author"`
	NextAuthor      string     `json:"next_author"`
	ExhaustedNotice string     `json:"exhausted_notice"`
	IndexNowEnabled bool       `json:"indexnow_enabled"`
}

func (h *TitleBankHandler) GetStats(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	var s TitleBankStats
	err := h.db.Get(&s, `
		SELECT COUNT(*) AS total,
		       COUNT(*) FILTER (WHERE status='published')  AS published,
		       COUNT(*) FILTER (WHERE status='queued')     AS queued,
		       COUNT(*) FILTER (WHERE status='generating') AS generating,
		       COUNT(*) FILTER (WHERE status='available')  AS remaining,
		       COUNT(*) FILTER (WHERE status='failed')     AS failed,
		       COUNT(*) FILTER (WHERE status='skipped')    AS skipped
		FROM blog_title_bank`)
	if err != nil {
		return response.InternalError(c, "Failed to load title bank stats")
	}

	cfg, err := h.loadSettings(titleBankAccountID)
	if err == nil {
		s.IsEnabled = cfg.IsEnabled
		s.IntervalMinutes = cfg.IntervalMinutes
		s.NextPublication = cfg.NextRunAt
		s.LastPublishedAt = cfg.LastPublishedAt
		s.ExhaustedNotice = cfg.ExhaustedNotice
		s.IndexNowEnabled = cfg.SubmitToIndexNow
		if cfg.LastAuthorID != nil {
			_ = h.db.Get(&s.CurrentAuthor, `SELECT name FROM blog_authors WHERE id=$1`, *cfg.LastAuthorID)
		}
		if a, e := h.nextAuthor(cfg); e == nil {
			s.NextAuthor = a.Name
		}
	}
	return response.Success(c, s)
}

// UpdateSettings backs enable/disable, pause/resume, interval and IndexNow toggles.
func (h *TitleBankHandler) UpdateSettings(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	var req struct {
		IsEnabled        *bool   `json:"is_enabled"`
		IntervalMinutes  *int    `json:"interval_minutes"`
		SubmitToIndexNow *bool   `json:"submit_to_indexnow"`
		IndexNowKey      *string `json:"indexnow_key"`
		SiteBaseURL      *string `json:"site_base_url"`
		MaxAttempts      *int    `json:"max_attempts"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.IntervalMinutes != nil && (*req.IntervalMinutes < 1 || *req.IntervalMinutes > 10080) {
		return response.BadRequest(c, "Interval must be between 1 minute and 7 days")
	}
	if req.MaxAttempts != nil && (*req.MaxAttempts < 1 || *req.MaxAttempts > 10) {
		return response.BadRequest(c, "Max attempts must be between 1 and 10")
	}

	_, err := h.db.Exec(`
		UPDATE blog_title_bank_settings SET
			is_enabled         = COALESCE($1, is_enabled),
			interval_minutes   = COALESCE($2, interval_minutes),
			submit_to_indexnow = COALESCE($3, submit_to_indexnow),
			indexnow_key       = COALESCE($4, indexnow_key),
			site_base_url      = COALESCE($5, site_base_url),
			max_attempts       = COALESCE($6, max_attempts),
			exhausted_notice   = CASE WHEN COALESCE($1, is_enabled) THEN '' ELSE exhausted_notice END,
			updated_at = NOW()
		WHERE account_id = $7`,
		req.IsEnabled, req.IntervalMinutes, req.SubmitToIndexNow, req.IndexNowKey,
		req.SiteBaseURL, req.MaxAttempts, titleBankAccountID)
	if err != nil {
		return response.InternalError(c, "Failed to update settings")
	}
	return h.GetStats(c)
}

// PublishNow runs one cycle immediately, outside the interval.
func (h *TitleBankHandler) PublishNow(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	if !titleBankRunning.CompareAndSwap(false, true) {
		return response.Error(c, http.StatusConflict, "A publishing cycle is already running")
	}
	defer titleBankRunning.Store(false)

	postID, err := h.PublishNext(c.Request().Context(), titleBankAccountID)
	if err != nil {
		if err == ErrNoTitles {
			return response.Error(c, http.StatusConflict, ErrNoTitles.Error())
		}
		return response.InternalError(c, "Publishing failed: "+err.Error())
	}
	return response.SuccessWithMessage(c, "Published", map[string]interface{}{"post_id": postID})
}

// ListTitles powers title usage / remaining / failed views.
func (h *TitleBankHandler) ListTitles(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	status := c.QueryParam("status")
	limit, _ := strconv.Atoi(c.QueryParam("per_page"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}

	type row struct {
		ID          int        `json:"id"            db:"id"`
		Title       string     `json:"title"         db:"title"`
		Pillar      string     `json:"pillar"        db:"pillar"`
		ContentType string     `json:"content_type"  db:"content_type"`
		Status      string     `json:"status"        db:"status"`
		Attempts    int        `json:"attempts"      db:"attempts"`
		PostSlug    string     `json:"post_slug"     db:"post_slug"`
		Error       string     `json:"error_message" db:"error_message"`
		PublishedAt *time.Time `json:"published_at"  db:"published_at"`
	}
	where, args := "WHERE 1=1", []interface{}{}
	if status != "" {
		where += " AND tb.status = $1"
		args = append(args, status)
	}
	var total int
	if err := h.db.Get(&total, "SELECT COUNT(*) FROM blog_title_bank tb "+where, args...); err != nil {
		return response.InternalError(c, "Failed to count titles")
	}
	args = append(args, limit, (page-1)*limit)
	var rows []row
	q := `SELECT tb.id, tb.title, p.title AS pillar, tb.content_type, tb.status, tb.attempts,
	             tb.post_slug, tb.error_message, tb.published_at
	      FROM blog_title_bank tb JOIN blog_pillars p ON p.id = tb.pillar_id ` + where +
		` ORDER BY p.pillar_number, tb.title_number LIMIT $` + strconv.Itoa(len(args)-1) +
		` OFFSET $` + strconv.Itoa(len(args))
	if err := h.db.Select(&rows, q, args...); err != nil {
		return response.InternalError(c, "Failed to list titles")
	}
	if rows == nil {
		rows = []row{}
	}
	return response.Paginated(c, rows, total, page, limit)
}

// History returns the publication log.
func (h *TitleBankHandler) History(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	limit, _ := strconv.Atoi(c.QueryParam("per_page"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	type row struct {
		ID          int        `json:"id"              db:"id"`
		Title       string     `json:"title"           db:"title"`
		Status      string     `json:"status"          db:"status"`
		Author      *string    `json:"author"          db:"author"`
		PostID      *int       `json:"post_id"         db:"post_id"`
		WordCount   int        `json:"word_count"      db:"word_count"`
		DurationMs  int        `json:"duration_ms"     db:"duration_ms"`
		IndexNow    string     `json:"indexnow_status" db:"indexnow_status"`
		Error       string     `json:"error_message"   db:"error_message"`
		PublishedAt *time.Time `json:"published_at"    db:"published_at"`
		CreatedAt   time.Time  `json:"created_at"      db:"created_at"`
	}
	var rows []row
	if err := h.db.Select(&rows, `
		SELECT l.id, l.title, l.status, a.name AS author, l.post_id, l.word_count,
		       l.duration_ms, l.indexnow_status, l.error_message, l.published_at, l.created_at
		FROM blog_publish_log l LEFT JOIN blog_authors a ON a.id = l.author_id
		ORDER BY l.created_at DESC LIMIT $1`, limit); err != nil {
		return response.InternalError(c, "Failed to load publish history")
	}
	if rows == nil {
		rows = []row{}
	}
	return response.Success(c, rows)
}

// SetTitleStatus backs retry, skip and authorised reset.
func (h *TitleBankHandler) SetTitleStatus(c echo.Context) error {
	if !isAdmin(c) {
		return adminOnly(c)
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid title id")
	}
	var req struct {
		Action string `json:"action"` // retry | skip | reset
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var q string
	switch req.Action {
	case "retry":
		// Clear the error and put it back in the pool; attempts reset so a fixed
		// cause gets a fair run.
		q = `UPDATE blog_title_bank SET status='available', attempts=0, error_message='',
		     locked_at=NULL, updated_at=NOW() WHERE id=$1 AND status IN ('failed','skipped')`
	case "skip":
		q = `UPDATE blog_title_bank SET status='skipped', locked_at=NULL, updated_at=NOW()
		     WHERE id=$1 AND status <> 'published'`
	case "reset":
		// Never silently detach a live post: only unpublished rows may be reset.
		q = `UPDATE blog_title_bank SET status='available', attempts=0, error_message='',
		     post_id=NULL, post_slug='', published_at=NULL, locked_at=NULL, updated_at=NOW()
		     WHERE id=$1 AND post_id IS NULL`
	default:
		return response.BadRequest(c, "Action must be retry, skip or reset")
	}
	res, err := h.db.Exec(q, id)
	if err != nil {
		return response.InternalError(c, "Failed to update title status")
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return response.Error(c, http.StatusConflict,
			"Title is not in a state that allows this action (a published title cannot be reset)")
	}
	return response.SuccessWithMessage(c, "Title updated", nil)
}
