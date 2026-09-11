package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/composer"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/r2"
)

// TitleBankHandler publishes the internal content-title database on an interval.
// It reads only from the application's own tables and local flyer assets; no
// external content source is contacted at any point.
type TitleBankHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewTitleBankHandler(db *sqlx.DB, cfg *config.Config) *TitleBankHandler {
	return &TitleBankHandler{db: db, cfg: cfg}
}

// ErrNoTitles signals the bank is exhausted — the caller stops rather than inventing one.
var ErrNoTitles = fmt.Errorf("all database content titles have been published")

type TitleBankSettings struct {
	AccountID        int           `db:"account_id"`
	IsEnabled        bool          `db:"is_enabled"`
	IntervalMinutes  int           `db:"interval_minutes"`
	StartAt          *time.Time    `db:"start_at"`
	LastPublishedAt  *time.Time    `db:"last_published_at"`
	NextRunAt        *time.Time    `db:"next_run_at"`
	LastAuthorID     *int          `db:"last_author_id"`
	AuthorIDs        pq.Int64Array `db:"author_ids"`
	MaxAttempts      int           `db:"max_attempts"`
	SubmitToIndexNow bool          `db:"submit_to_indexnow"`
	IndexNowKey      string        `db:"indexnow_key"`
	SiteBaseURL      string        `db:"site_base_url"`
	ExhaustedNotice  string        `db:"exhausted_notice"`
}

func (h *TitleBankHandler) loadSettings(accountID int) (*TitleBankSettings, error) {
	var s TitleBankSettings
	// Explicit columns: SELECT * breaks the moment a column is added to the table.
	err := h.db.Get(&s, `SELECT account_id, is_enabled, interval_minutes, start_at, last_published_at,
		next_run_at, last_author_id, author_ids, max_attempts, submit_to_indexnow, indexnow_key,
		site_base_url, exhausted_notice
		FROM blog_title_bank_settings WHERE account_id = $1`, accountID)
	return &s, err
}

// claimNextTitle atomically moves exactly one available title into 'generating'.
// The UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED) form means two
// concurrent cycles can never claim the same row, so posts cannot double-publish.
func (h *TitleBankHandler) claimNextTitle(accountID int) (*composer.BankTitle, error) {
	var t composer.BankTitle
	err := h.db.Get(&t, `
		UPDATE blog_title_bank SET status = 'generating', locked_at = NOW(), queued_at = NOW(),
		       attempts = attempts + 1, updated_at = NOW()
		WHERE id = (
			SELECT tb.id FROM blog_title_bank tb
			JOIN blog_pillars p ON p.id = tb.pillar_id
			WHERE tb.status = 'available'
			ORDER BY p.pillar_number, tb.title_number
			LIMIT 1 FOR UPDATE SKIP LOCKED
		)
		RETURNING id, pillar_id, title_number, title, title_key, content_type, subject_entity, status, attempts`)
	if err == sql.ErrNoRows {
		return nil, ErrNoTitles
	}
	return &t, err
}

// releaseTitle returns a title to the pool after a failure. A title is never
// consumed by a failed generation: it goes back to 'available' until max attempts.
func (h *TitleBankHandler) releaseTitle(t *composer.BankTitle, maxAttempts int, cause error) {
	status := "available"
	if t.Attempts >= maxAttempts {
		status = "failed"
	}
	_, err := h.db.Exec(`UPDATE blog_title_bank SET status=$1, error_message=$2, locked_at=NULL, updated_at=NOW()
	                     WHERE id=$3`, status, truncErr(cause), t.ID)
	if err != nil {
		log.Printf("ERROR: titlebank: releasing title %d: %v", t.ID, err)
	}
}

func truncErr(err error) string {
	if err == nil {
		return ""
	}
	s := err.Error()
	if len(s) > 480 {
		s = s[:480]
	}
	return s
}

func (h *TitleBankHandler) loadPillar(id int) (*composer.Pillar, error) {
	var p composer.Pillar
	var sec, sub pq.StringArray
	row := h.db.QueryRowx(`SELECT id, pillar_number, title, slug, description, primary_intent,
		target_audience, seo_note, aeo_note, geo_note, aio_note, primary_keyword,
		secondary_keywords, subtopics, category_id, flyer_filename, flyer_url
		FROM blog_pillars WHERE id = $1`, id)
	if err := row.Scan(&p.ID, &p.Number, &p.Title, &p.Slug, &p.Description, &p.PrimaryIntent,
		&p.TargetAudience, &p.SEONote, &p.AEONote, &p.GEONote, &p.AIONote, &p.PrimaryKeyword,
		&sec, &sub, &p.CategoryID, &p.FlyerFilename, &p.FlyerURL); err != nil {
		return nil, err
	}
	p.SecondaryKeywords, p.Subtopics = sec, sub
	return &p, nil
}

// flyerPillarFor decides which pillar's flyer illustrates a post. Each pillar
// ships exactly one flyer, so using the post's own pillar gave all hundred
// posts inside that pillar the same picture. Choosing across every pillar that
// has a flyer spreads the artwork instead, and hashing the title rather than
// picking at random keeps it stable: a post always gets the same flyer, so
// republishing it does not churn the site's images.
func (h *TitleBankHandler) flyerPillarFor(title string) (*composer.Pillar, error) {
	var ids []int
	if err := h.db.Select(&ids, `SELECT id FROM blog_pillars
		WHERE COALESCE(flyer_url, '') <> '' ORDER BY pillar_number`); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("no pillar has a flyer")
	}
	return h.loadPillar(ids[flyerIndexFor(title, len(ids))])
}

// flyerIndexFor spreads titles over the available flyers. Hashing the title
// rather than drawing at random makes the choice reproducible, so a post keeps
// the same flyer across republishes.
func flyerIndexFor(title string, n int) int {
	if n <= 0 {
		return 0
	}
	sum := fnv.New32a()
	_, _ = sum.Write([]byte(title))
	return int(sum.Sum32() % uint32(n))
}

func (h *TitleBankHandler) loadCategory(id *int) *composer.Category {
	if id == nil {
		return nil
	}
	var c composer.Category
	if err := h.db.Get(&c, `SELECT id, name, slug FROM blog_categories WHERE id=$1`, *id); err != nil {
		return nil
	}
	return &c
}

// nextAuthor rotates strictly on successfully published posts (spec §19): a skip
// or a failure must not advance the rotation.
func (h *TitleBankHandler) nextAuthor(s *TitleBankSettings) (composer.Author, error) {
	var ids []int
	for _, id := range s.AuthorIDs {
		if id > 0 {
			ids = append(ids, int(id))
		}
	}
	if len(ids) == 0 {
		return composer.Author{}, fmt.Errorf("no permitted authors configured")
	}
	next := ids[0]
	if s.LastAuthorID != nil {
		for i, id := range ids {
			if id == *s.LastAuthorID {
				next = ids[(i+1)%len(ids)]
				break
			}
		}
	}
	var a composer.Author
	if err := h.db.Get(&a, `SELECT id, name, slug, COALESCE(bio,'') AS bio FROM blog_authors WHERE id=$1`, next); err != nil {
		return composer.Author{}, fmt.Errorf("loading author %d: %w", next, err)
	}
	return a, nil
}

// relatedPosts finds already-published siblings in the same pillar for internal linking.
func (h *TitleBankHandler) relatedPosts(pillarID, limit int) []composer.RelatedPost {
	var out []composer.RelatedPost
	err := h.db.Select(&out, `
		SELECT p.title, p.slug FROM blog_posts p
		JOIN blog_title_bank tb ON tb.post_id = p.id
		WHERE tb.pillar_id = $1 AND tb.status = 'published' AND p.status = 'published'
		ORDER BY p.published_at DESC LIMIT $2`, pillarID, limit)
	if err != nil {
		return nil
	}
	return out
}

// ensureFlyerUploaded puts the pillar's local flyer on the site's own CDN once.
// The bytes come from the repository's Flyier/png directory; nothing is downloaded.
func (h *TitleBankHandler) ensureFlyerUploaded(ctx context.Context, p *composer.Pillar) (string, error) {
	cfg := r2.Config{
		AccountID: h.cfg.R2AccountID, AccessKeyID: h.cfg.R2AccessKeyID,
		SecretAccessKey: h.cfg.R2SecretAccessKey, Bucket: h.cfg.R2Bucket,
		PublicBaseURL: h.cfg.R2PublicBaseURL,
	}
	key := strings.TrimPrefix(p.FlyerURL, "/")
	if !cfg.Enabled() {
		// No object store configured: serve from the site's own static path.
		return p.FlyerURL, nil
	}
	dir := os.Getenv("BLOG_FLYER_DIR")
	if dir == "" {
		dir = "/app/flyers"
	}
	path := filepath.Join(dir, p.FlyerFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		// Missing local asset is not fatal: fall back to the static path so the
		// post still publishes with a valid image URL.
		log.Printf("WARN: titlebank: flyer %s unreadable (%v), using static path", path, err)
		return p.FlyerURL, nil
	}
	url, err := r2.Upload(ctx, cfg, key, "image/png", data)
	if err != nil {
		log.Printf("WARN: titlebank: flyer upload failed (%v), using static path", err)
		return p.FlyerURL, nil
	}
	return url, nil
}

func jsonOrEmpty(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("[]")
	}
	return b
}
