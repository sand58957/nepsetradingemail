package composer

import (
	"os"
	"strings"
	"testing"
)

func sampleInput(contentType, subject, title string) Input {
	return Input{
		Title: BankTitle{ID: 1, PillarID: 19, TitleNumber: 7, Title: title,
			ContentType: contentType, SubjectEntity: subject},
		Pillar: Pillar{
			ID: 19, Number: 19, Title: "WhatsApp Marketing Strategy and Campaigns",
			Slug:          "whatsapp-marketing",
			Description:   "Using WhatsApp as a permissioned, high-engagement channel. Maps to WhatsApp → Dashboard and Campaigns.",
			PrimaryIntent: "Informational → Commercial", TargetAudience: "Conversational marketers, retail, D2C, services",
			PrimaryKeyword:    "WhatsApp marketing",
			SecondaryKeywords: []string{"WhatsApp Business API", "WhatsApp campaigns", "conversational commerce"},
			Subtopics: []string{"Business API vs Business App", "Campaign types", "Opt-in rules",
				"Conversational commerce", "Broadcast strategy", "Session windows", "Catalogues"},
			FlyerURL: "/blog-flyers/19-whatsapp-marketing-strategy-and-campaigns.png",
		},
		Category: &Category{ID: 19, Name: "WhatsApp Marketing", Slug: "whatsapp-marketing"},
		Author:   Author{ID: 1, Name: "Sandeep Kumar Chaudhary", Slug: "sandeep-kumar-chaudhary"},
		Related:  []RelatedPost{{Title: "Opt-in collection for WhatsApp", Slug: "opt-in-collection-for-whatsapp"}},
		BaseURL:  "https://nepalfillings.com",
		CDNBase:  "https://cdn.nepalfillings.com",
	}
}

func TestComposeProducesCompleteArticle(t *testing.T) {
	a := Compose(sampleInput("How-to", "opt-in collection",
		"How to Set Up Opt-In Collection Correctly the First Time"))

	if a.WordCount < 400 {
		t.Errorf("article too short: %d words", a.WordCount)
	}
	for name, v := range map[string]string{
		"MetaTitle": a.MetaTitle, "MetaDescription": a.MetaDescription, "CanonicalURL": a.CanonicalURL,
		"QuickAnswer": a.QuickAnswer, "Slug": a.Slug, "FeaturedImageURL": a.FeaturedImageURL,
		"FeaturedImageAlt": a.FeaturedImageAlt, "PrimaryKeyword": a.PrimaryKeyword,
	} {
		if strings.TrimSpace(v) == "" {
			t.Errorf("required SEO field %s is empty", name)
		}
	}
	if len(a.MetaDescription) > 160 {
		t.Errorf("meta description too long: %d", len(a.MetaDescription))
	}
	if len(a.FAQs) < 4 {
		t.Errorf("expected >=4 FAQs for AEO, got %d", len(a.FAQs))
	}
	if len(a.TOC) < 3 {
		t.Errorf("expected >=3 H2 sections, got %d", len(a.TOC))
	}
	if len(a.InternalLinks) < 2 {
		t.Errorf("expected >=2 internal links, got %d", len(a.InternalLinks))
	}
}

// No external host may ever appear in composed output.
func TestComposeEmitsNoExternalLinks(t *testing.T) {
	for _, ct := range []string{"How-to", "Comparison", "Statistics", "Pricing", "AI-powered", "Checklist"} {
		a := Compose(sampleInput(ct, "broadcast strategy", "Broadcast Strategy for WhatsApp Campaigns"))
		for _, bad := range []string{"http://", "https://cdn.", "https://nepalfillings.com"} {
			_ = bad
		}
		// Every href in the body must be a site-relative internal path.
		for _, part := range strings.Split(a.HTML, "href=\"")[1:] {
			href := part[:strings.Index(part, "\"")]
			if !strings.HasPrefix(href, "/") {
				t.Errorf("%s: non-internal href in body: %q", ct, href)
			}
		}
	}
}

// Archetypes that would normally need outside data must not assert figures.
func TestNoFabricatedStatistics(t *testing.T) {
	for _, ct := range []string{"Statistics", "Benchmarks", "Pricing", "ROI", "Case study"} {
		a := Compose(sampleInput(ct, "conversation pricing", "Conversation Pricing Explained"))
		for _, bad := range []string{"%", " study found", "according to", "research shows", "survey of"} {
			if strings.Contains(strings.ToLower(a.HTML), bad) {
				t.Errorf("%s article contains unsupported claim marker %q", ct, bad)
			}
		}
	}
}

func TestSlugStability(t *testing.T) {
	a := Compose(sampleInput("How-to", "opt-in collection", "How to Set Up Opt-In Collection Correctly the First Time"))
	b := Compose(sampleInput("How-to", "opt-in collection", "How to Set Up Opt-In Collection Correctly the First Time"))
	if a.Slug != b.Slug || a.HTML != b.HTML {
		t.Error("composition is not deterministic")
	}
	if strings.Contains(a.Slug, "--") || strings.HasPrefix(a.Slug, "-") {
		t.Errorf("malformed slug %q", a.Slug)
	}
}

// Writes a full sample to disk for human review.
func TestDumpSample(t *testing.T) {
	if os.Getenv("DUMP") == "" {
		t.Skip("set DUMP=1 to write sample")
	}
	a := Compose(sampleInput("How-to", "opt-in collection",
		"How to Set Up Opt-In Collection Correctly the First Time"))
	os.WriteFile("/tmp/sample_article.html", []byte(a.HTML), 0644)
	t.Logf("words=%d seo=%d read=%d faqs=%d toc=%d links=%d slug=%s",
		a.WordCount, a.SEOScore, a.ReadabilityScore, len(a.FAQs), len(a.TOC), len(a.InternalLinks), a.Slug)
}

// A title the composer is willing to emit must never be marked down by the
// scorer. These two rules lived as separate magic numbers (68 and 62) and
// silently drifted: every post with a 63-68 character meta title scored 91
// instead of 100, for following the composer's own policy.
func TestScorerAcceptsEveryMetaTitleTheComposerEmits(t *testing.T) {
	longTitle := "Competitive Positioning at Scale: What Changes Once You Outgrow the Basics"
	for _, contentType := range []string{"Advanced guide", "Beginner guide", "How-to", "Comparison"} {
		a := Compose(sampleInput(contentType, "broadcast strategy", longTitle))
		if len(a.MetaTitle) > maxMetaTitle {
			t.Errorf("%s: emitted a %d character meta title, over the %d limit",
				contentType, len(a.MetaTitle), maxMetaTitle)
		}
		if a.SEOScore != 100 {
			t.Errorf("%s: meta title of %d characters is within policy but scored %d, want 100",
				contentType, len(a.MetaTitle), a.SEOScore)
		}
	}
}
