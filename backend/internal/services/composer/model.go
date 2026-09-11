// Package composer builds blog articles from first-party application data only.
//
// It never contacts an external API, model or website. Every sentence is assembled
// from the internal content-title database (pillar, subtopics, keyword themes,
// category) and from the application's own feature routes. Where the internal data
// does not support a claim, the composer omits the claim rather than inventing it:
// there are no statistics, citations, customer names or case studies in the output
// unless they came from the database.
package composer

import "time"

// Pillar is the internal content pillar a title belongs to.
type Pillar struct {
	ID                int       `db:"id"`
	Number            int       `db:"pillar_number"`
	Title             string    `db:"title"`
	Slug              string    `db:"slug"`
	Description       string    `db:"description"`
	PrimaryIntent     string    `db:"primary_intent"`
	TargetAudience    string    `db:"target_audience"`
	SEONote           string    `db:"seo_note"`
	AEONote           string    `db:"aeo_note"`
	GEONote           string    `db:"geo_note"`
	AIONote           string    `db:"aio_note"`
	PrimaryKeyword    string    `db:"primary_keyword"`
	SecondaryKeywords []string  `db:"secondary_keywords"`
	Subtopics         []string  `db:"subtopics"`
	CategoryID        *int      `db:"category_id"`
	FlyerFilename     string    `db:"flyer_filename"`
	FlyerURL          string    `db:"flyer_url"`
	UpdatedAt         time.Time `db:"updated_at"`
}

// BankTitle is one row of the internal title database.
type BankTitle struct {
	ID            int    `db:"id"`
	PillarID      int    `db:"pillar_id"`
	TitleNumber   int    `db:"title_number"`
	Title         string `db:"title"`
	TitleKey      string `db:"title_key"`
	ContentType   string `db:"content_type"`
	SubjectEntity string `db:"subject_entity"`
	Status        string `db:"status"`
	Attempts      int    `db:"attempts"`
}

// Author is one of the two permitted internal authors.
type Author struct {
	ID      int    `db:"id"`
	Name    string `db:"name"`
	Slug    string `db:"slug"`
	Bio     string `db:"bio"`
	Website string `db:"-"`
}

// Category is an existing internal category; the composer never creates one.
type Category struct {
	ID   int    `db:"id"`
	Name string `db:"name"`
	Slug string `db:"slug"`
}

// FAQ is one answer-engine question/answer pair.
type FAQ struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// TOCEntry mirrors the shape blog_posts.table_of_contents already stores.
type TOCEntry struct {
	ID    string `json:"id"`
	Text  string `json:"text"`
	Level int    `json:"level"`
}

// InternalLink points at a route that exists in the application.
type InternalLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// Article is the complete composed post plus its SEO/AEO/GEO/AIO metadata.
type Article struct {
	Title             string
	Slug              string
	HTML              string
	Excerpt           string
	QuickAnswer       string
	MetaTitle         string
	MetaDescription   string
	CanonicalURL      string
	BreadcrumbTitle   string
	OGTitle           string
	OGDescription     string
	PrimaryKeyword    string
	SecondaryKeywords []string
	EntityTags        []string
	SearchIntent      string
	FAQs              []FAQ
	TOC               []TOCEntry
	KeyPoints         []string
	InternalLinks     []InternalLink
	FeaturedImageURL  string
	FeaturedImageAlt  string
	FeaturedImageCap  string
	ImageTitle        string
	ImageSlug         string
	SchemaType        string
	WordCount         int
	ReadingTimeMin    int
	SEOScore          int
	ReadabilityScore  int
}
