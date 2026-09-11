package handlers

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
)

// Runs only when TITLEBANK_TEST_DSN points at a seeded database.
func testDB(t *testing.T) *sqlx.DB {
	t.Helper()
	dsn := os.Getenv("TITLEBANK_TEST_DSN")
	if dsn == "" {
		t.Skip("set TITLEBANK_TEST_DSN to run title-bank integration tests")
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	return db
}

func TestPublishNextEndToEnd(t *testing.T) {
	db := testDB(t)
	defer db.Close()
	h := NewTitleBankHandler(db, &config.Config{})

	var before int
	if err := db.Get(&before, `SELECT COUNT(*) FROM blog_title_bank WHERE status='available'`); err != nil {
		t.Fatal(err)
	}
	if before == 0 {
		t.Skip("no available titles in test database")
	}

	postID, err := h.PublishNext(context.Background(), titleBankAccountID)
	if err != nil {
		t.Fatalf("PublishNext: %v", err)
	}
	if postID == 0 {
		t.Fatal("expected a post id")
	}

	// The post exists, is published, and carries its SEO fields.
	var got struct {
		Title, Slug, Meta, Canon, Img, Alt, QA string
		Words, SEO                             int
		AuthorID, CatID                        int
	}
	err = db.QueryRow(`SELECT title, slug, meta_description, canonical_url, featured_image_url,
	   featured_image_alt, quick_answer, word_count, seo_score, author_id, category_id
	   FROM blog_posts WHERE id=$1 AND status='published'`, postID).
		Scan(&got.Title, &got.Slug, &got.Meta, &got.Canon, &got.Img, &got.Alt, &got.QA,
			&got.Words, &got.SEO, &got.AuthorID, &got.CatID)
	if err != nil {
		t.Fatalf("loading published post: %v", err)
	}
	for name, v := range map[string]string{"title": got.Title, "slug": got.Slug,
		"meta_description": got.Meta, "canonical_url": got.Canon,
		"featured_image_url": got.Img, "featured_image_alt": got.Alt, "quick_answer": got.QA} {
		if strings.TrimSpace(v) == "" {
			t.Errorf("published post has empty %s", name)
		}
	}
	if got.Words < 350 {
		t.Errorf("published post too thin: %d words", got.Words)
	}

	// The title is consumed exactly once and linked back to the post.
	var status string
	var linked int
	if err := db.QueryRow(`SELECT status, COALESCE(post_id,0) FROM blog_title_bank WHERE post_id=$1`, postID).
		Scan(&status, &linked); err != nil {
		t.Fatalf("title row: %v", err)
	}
	if status != "published" || linked != postID {
		t.Errorf("title not marked published: status=%s post_id=%d", status, linked)
	}

	// FAQs were written for answer engines.
	var faqs int
	db.Get(&faqs, `SELECT COUNT(*) FROM blog_post_faqs WHERE post_id=$1`, postID)
	if faqs < 3 {
		t.Errorf("expected >=3 FAQ rows, got %d", faqs)
	}

	// A log line exists.
	var logged int
	db.Get(&logged, `SELECT COUNT(*) FROM blog_publish_log WHERE post_id=$1 AND status='published'`, postID)
	if logged != 1 {
		t.Errorf("expected 1 publish log row, got %d", logged)
	}
	t.Logf("published post %d: %q (%d words, seo %d, %d faqs)", postID, got.Title, got.Words, got.SEO, faqs)
}

// Author must alternate across consecutive successful publishes.
func TestAuthorRotationAlternates(t *testing.T) {
	db := testDB(t)
	defer db.Close()
	h := NewTitleBankHandler(db, &config.Config{})

	var seen []int
	for i := 0; i < 4; i++ {
		id, err := h.PublishNext(context.Background(), titleBankAccountID)
		if err != nil {
			t.Fatalf("cycle %d: %v", i, err)
		}
		var author int
		db.Get(&author, `SELECT author_id FROM blog_posts WHERE id=$1`, id)
		seen = append(seen, author)
	}
	for i := 1; i < len(seen); i++ {
		if seen[i] == seen[i-1] {
			t.Errorf("author did not alternate: %v", seen)
			break
		}
	}
	t.Logf("author sequence: %v", seen)
}

// A title must never be consumed twice.
func TestNoTitlePublishedTwice(t *testing.T) {
	db := testDB(t)
	defer db.Close()
	var dupes int
	if err := db.Get(&dupes, `
		SELECT COUNT(*) FROM (
		  SELECT post_id FROM blog_title_bank WHERE post_id IS NOT NULL
		  GROUP BY post_id HAVING COUNT(*) > 1) x`); err != nil {
		t.Fatal(err)
	}
	if dupes != 0 {
		t.Errorf("%d posts are linked to more than one title", dupes)
	}
	var slugDupes int
	db.Get(&slugDupes, `SELECT COUNT(*) FROM (SELECT slug FROM blog_posts GROUP BY slug HAVING COUNT(*)>1) x`)
	if slugDupes != 0 {
		t.Errorf("%d duplicate post slugs", slugDupes)
	}
}
