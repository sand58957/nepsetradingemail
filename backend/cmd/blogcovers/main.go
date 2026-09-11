// Command blogcovers regenerates the featured cover for published title-bank
// posts and points each post at its own image.
//
// It exists for two situations: posts published before covers were generated
// (they all share their pillar's flyer), and a change to the cover design,
// which needs every existing cover redrawn. Rendering is deterministic, so
// running it twice produces the same files.
//
//	blogcovers            # only posts not already on a generated cover
//	blogcovers -all       # redraw every title-bank post
//	blogcovers -dry-run   # report what would change, write nothing
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/composer"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/cover"
)

type post struct {
	ID          int64  `db:"id"`
	Title       string `db:"title"`
	Slug        string `db:"slug"`
	PillarTitle string `db:"pillar_title"`
	ImageURL    string `db:"featured_image_url"`
}

func main() {
	var all, dryRun bool
	flag.BoolVar(&all, "all", false, "redraw covers for every title-bank post")
	flag.BoolVar(&dryRun, "dry-run", false, "report changes without writing")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	siteBase, err := siteBaseURL(db)
	if err != nil {
		log.Fatalf("site base url: %v", err)
	}

	query := `
		SELECT p.id, p.title, p.slug, pl.title AS pillar_title,
		       COALESCE(p.featured_image_url, '') AS featured_image_url
		FROM blog_posts p
		JOIN blog_title_bank t ON t.post_id = p.id
		JOIN blog_pillars pl ON pl.id = t.pillar_id
		ORDER BY p.id`
	var posts []post
	if err := db.Select(&posts, query); err != nil {
		log.Fatalf("select posts: %v", err)
	}

	prefix := strings.TrimRight(siteBase, "/") + "/blog-covers/"
	var done, skipped int
	for _, p := range posts {
		if !all && strings.HasPrefix(p.ImageURL, prefix) {
			skipped++
			continue
		}
		in := cover.Input{
			Title: p.Title, PillarTitle: p.PillarTitle,
			PillarSlug: composer.Slugify(p.PillarTitle), Slug: p.Slug,
		}
		if dryRun {
			fmt.Printf("  would redraw #%d %s\n", p.ID, p.Slug)
			done++
			continue
		}
		name, err := cover.Render(in, cfg.BlogCoverDir)
		if err != nil {
			log.Printf("  FAILED #%d %s: %v", p.ID, p.Slug, err)
			continue
		}
		_, err = db.Exec(
			`UPDATE blog_posts SET featured_image_url = $1, featured_image_alt = $2,
			        updated_at = NOW() WHERE id = $3`,
			prefix+name, cover.AltText(in), p.ID)
		if err != nil {
			log.Printf("  FAILED #%d %s: %v", p.ID, p.Slug, err)
			continue
		}
		fmt.Printf("  #%d %s\n", p.ID, name)
		done++
	}
	fmt.Printf("\n%d cover(s) %s, %d already current\n",
		done, map[bool]string{true: "would be redrawn", false: "written"}[dryRun], skipped)
	if done == 0 && skipped == 0 {
		fmt.Fprintln(os.Stderr, "no title-bank posts found")
	}
}

func siteBaseURL(db *sqlx.DB) (string, error) {
	var base string
	err := db.Get(&base, `SELECT site_base_url FROM blog_title_bank_settings LIMIT 1`)
	return base, err
}
