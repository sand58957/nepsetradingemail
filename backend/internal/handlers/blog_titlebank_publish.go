package handlers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/composer"
)

// validationError marks a failure that should not be retried blindly.
type validationError struct{ reason string }

func (e validationError) Error() string { return "validation failed: " + e.reason }

// validateArticle is the pre-publish gate (spec §15). Anything missing here means
// the post is not written and the title is not consumed.
func validateArticle(a composer.Article, t *composer.BankTitle, author composer.Author, cat *composer.Category) error {
	switch {
	case strings.TrimSpace(a.Title) == "":
		return validationError{"title is empty"}
	case t.ID == 0:
		return validationError{"title did not come from the internal database"}
	case author.ID == 0:
		return validationError{"author is not a permitted internal author"}
	case cat == nil || cat.ID == 0:
		return validationError{"category is not an existing internal category"}
	case strings.TrimSpace(a.HTML) == "":
		return validationError{"article body is empty"}
	case a.WordCount < 350:
		return validationError{fmt.Sprintf("article too thin (%d words)", a.WordCount)}
	case a.MetaTitle == "" || a.MetaDescription == "" || a.CanonicalURL == "" || a.PrimaryKeyword == "":
		return validationError{"required SEO fields are missing"}
	case a.Slug == "":
		return validationError{"slug is empty"}
	case a.FeaturedImageURL == "" || a.FeaturedImageAlt == "":
		return validationError{"featured image or alt text missing"}
	case len(a.FAQs) < 3:
		return validationError{"insufficient FAQ coverage for answer engines"}
	}
	// Every internal link must be site-relative; an absolute URL would mean an
	// external destination slipped into the body.
	for _, l := range a.InternalLinks {
		if !strings.HasPrefix(l.URL, "/") {
			return validationError{"internal link points outside the application: " + l.URL}
		}
	}
	for _, part := range strings.Split(a.HTML, `href="`)[1:] {
		i := strings.Index(part, `"`)
		if i < 0 || !strings.HasPrefix(part[:i], "/") {
			return validationError{"article body contains a non-internal link"}
		}
	}
	return nil
}

// uniqueSlug appends a numeric suffix only if the base slug is already taken.
func (h *TitleBankHandler) uniqueSlug(base string) (string, error) {
	slug := base
	for i := 2; i <= 12; i++ {
		var n int
		if err := h.db.Get(&n, `SELECT COUNT(*) FROM blog_posts WHERE slug = $1`, slug); err != nil {
			return "", err
		}
		if n == 0 {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
	return "", validationError{"could not derive a unique slug"}
}

// PublishNext runs exactly one publishing cycle. It returns ErrNoTitles when the
// internal database is exhausted, so the scheduler stops instead of inventing work.
func (h *TitleBankHandler) PublishNext(ctx context.Context, accountID int) (postID int, err error) {
	started := time.Now()
	s, err := h.loadSettings(accountID)
	if err != nil {
		return 0, fmt.Errorf("loading settings: %w", err)
	}

	t, err := h.claimNextTitle(accountID)
	if err != nil {
		if err == ErrNoTitles {
			_, _ = h.db.Exec(`UPDATE blog_title_bank_settings
				SET is_enabled = FALSE, exhausted_notice = $1, updated_at = NOW() WHERE account_id = $2`,
				ErrNoTitles.Error(), accountID)
		}
		return 0, err
	}
	// From here on, any failure must release the title rather than consume it.
	defer func() {
		if err != nil {
			h.releaseTitle(t, s.MaxAttempts, err)
			h.writeLog(t, nil, nil, 0, "failed", started, err, "")
		}
	}()

	p, err := h.loadPillar(t.PillarID)
	if err != nil {
		return 0, fmt.Errorf("loading pillar: %w", err)
	}
	cat := h.loadCategory(p.CategoryID)
	author, err := h.nextAuthor(s)
	if err != nil {
		return 0, err
	}

	// Spread the artwork across every pillar's flyer rather than always using
	// this post's own -- one flyer per pillar meant a pillar's hundred posts
	// all carried the same picture.
	flyerPillar := p
	if fp, ferr := h.flyerPillarFor(t.Title); ferr != nil {
		log.Printf("WARN: titlebank: flyer choice fell back to own pillar: %v", ferr)
	} else {
		flyerPillar = fp
	}
	imgURL, _ := h.ensureFlyerUploaded(ctx, flyerPillar)
	p.FlyerURL = imgURL

	art := composer.Compose(composer.Input{
		Title: *t, Pillar: *p, Category: cat, Author: author,
		Related: h.relatedPosts(p.ID, 3),
		BaseURL: s.SiteBaseURL, CDNBase: h.cfg.R2PublicBaseURL,
	})

	if art.Slug, err = h.uniqueSlug(art.Slug); err != nil {
		return 0, err
	}
	art.CanonicalURL = strings.TrimRight(s.SiteBaseURL, "/") + composer.PostURL(art.Slug)

	// The flyer has its own pillar's name printed on the artwork, so describe
	// what the picture actually shows rather than what the article is about.
	art.FeaturedImageAlt = flyerAlt(flyerPillar.Title)

	if err = validateArticle(art, t, author, cat); err != nil {
		return 0, err
	}

	// Duplicate guard: same canonical URL must not already exist.
	var dupes int
	if err = h.db.Get(&dupes, `SELECT COUNT(*) FROM blog_posts WHERE canonical_url = $1`, art.CanonicalURL); err != nil {
		return 0, err
	}
	if dupes > 0 {
		return 0, validationError{"canonical URL already exists"}
	}

	schema := buildArticleSchema(art, author, s.SiteBaseURL)
	err = h.db.QueryRow(`
		INSERT INTO blog_posts (account_id, author_id, category_id, title, slug, content_html, excerpt,
			featured_image_url, featured_image_alt, status, meta_title, meta_description, canonical_url,
			primary_keyword, secondary_keywords, quick_answer, schema_type, schema_json,
			entity_tags, table_of_contents, key_points,
			seo_score, readability_score, word_count, reading_time_min, published_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW(),NOW())
		RETURNING id`,
		accountID, author.ID, cat.ID, art.Title, art.Slug, art.HTML, art.Excerpt,
		art.FeaturedImageURL, art.FeaturedImageAlt, art.MetaTitle, art.MetaDescription, art.CanonicalURL,
		art.PrimaryKeyword, pq.Array(art.SecondaryKeywords), art.QuickAnswer, art.SchemaType, schema,
		jsonOrEmpty(art.EntityTags), jsonOrEmpty(art.TOC), jsonOrEmpty(art.KeyPoints),
		art.SEOScore, art.ReadabilityScore, art.WordCount, art.ReadingTimeMin,
	).Scan(&postID)
	if err != nil {
		return 0, fmt.Errorf("inserting post: %w", err)
	}

	// FAQ rows power the on-page FAQ block and FAQPage schema.
	for i, f := range art.FAQs {
		if _, e := h.db.Exec(`INSERT INTO blog_post_faqs (post_id, question, answer, sort_order)
			VALUES ($1,$2,$3,$4)`, postID, f.Question, f.Answer, i); e != nil {
			log.Printf("WARN: titlebank: FAQ insert for post %d: %v", postID, e)
			break
		}
	}

	if _, err = h.db.Exec(`UPDATE blog_title_bank
		SET status='published', post_id=$1, post_slug=$2, generated_at=NOW(), published_at=NOW(),
		    error_message='', locked_at=NULL, updated_at=NOW() WHERE id=$3`, postID, art.Slug, t.ID); err != nil {
		return postID, fmt.Errorf("marking title published: %w", err)
	}

	// Rotation advances only now that a post actually exists.
	if _, e := h.db.Exec(`UPDATE blog_title_bank_settings
		SET last_author_id=$1, last_published_at=NOW(), updated_at=NOW() WHERE account_id=$2`,
		author.ID, accountID); e != nil {
		log.Printf("WARN: titlebank: advancing author rotation: %v", e)
	}

	idxStatus := h.submitToIndexNow(ctx, s, art.CanonicalURL)
	h.writeLog(t, &postID, &author.ID, art.WordCount, "published", started, nil, idxStatus)
	log.Printf("INFO: titlebank: published post %d '%s' by %s (%d words, %dms)",
		postID, art.Title, author.Name, art.WordCount, time.Since(started).Milliseconds())
	return postID, nil
}

func (h *TitleBankHandler) writeLog(t *composer.BankTitle, postID, authorID *int, words int,
	status string, started time.Time, cause error, idxStatus string) {
	_, err := h.db.Exec(`
		INSERT INTO blog_publish_log (title_id, title, pillar_id, author_id, status, scheduled_at,
			generated_at, published_at, post_id, word_count, duration_ms, indexnow_status, error_message)
		VALUES ($1,$2,$3,$4,$5,$6,NOW(),CASE WHEN $5='published' THEN NOW() END,$7,$8,$9,$10,$11)`,
		t.ID, t.Title, t.PillarID, authorID, status, started, postID, words,
		time.Since(started).Milliseconds(), idxStatus, truncErr(cause))
	if err != nil {
		log.Printf("WARN: titlebank: writing publish log: %v", err)
	}
}

// flyerAlt describes the flyer for screen readers and image search. The flyer
// is a branded graphic for one content pillar, which is not always the pillar
// the article belongs to, so it names the pillar shown on the image.
func flyerAlt(pillarTitle string) string {
	alt := "Nepal Fillings digital marketing flyer for " + strings.TrimSpace(pillarTitle)
	if len(alt) > 125 {
		alt = strings.TrimRight(alt[:124], " ,.;:-")
	}
	return alt
}
