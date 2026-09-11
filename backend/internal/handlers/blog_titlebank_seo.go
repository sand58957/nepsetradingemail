package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/composer"
)

// buildArticleSchema emits Article + FAQPage JSON-LD from first-party fields only.
func buildArticleSchema(a composer.Article, author composer.Author, baseURL string) []byte {
	base := strings.TrimRight(baseURL, "/")
	now := time.Now().UTC().Format(time.RFC3339)

	var faqEntities []map[string]interface{}
	for _, f := range a.FAQs {
		faqEntities = append(faqEntities, map[string]interface{}{
			"@type": "Question", "name": f.Question,
			"acceptedAnswer": map[string]interface{}{"@type": "Answer", "text": f.Answer},
		})
	}

	graph := []map[string]interface{}{
		{
			"@type": "Article", "@id": a.CanonicalURL + "#article",
			"headline":      a.Title,
			"description":   a.MetaDescription,
			"datePublished": now, "dateModified": now,
			"mainEntityOfPage": map[string]interface{}{"@type": "WebPage", "@id": a.CanonicalURL},
			"author": map[string]interface{}{
				"@type": "Person", "name": author.Name,
				"url": base + composer.AuthorURL(author.Slug),
			},
			"publisher": map[string]interface{}{
				"@type": "Organization", "name": "Nepal Fillings", "url": base,
			},
			"image":          a.FeaturedImageURL,
			"wordCount":      a.WordCount,
			"keywords":       strings.Join(a.SecondaryKeywords, ", "),
			"about":          a.EntityTags,
			"inLanguage":     "en",
			"articleSection": a.BreadcrumbTitle,
		},
		{
			"@type": "BreadcrumbList", "@id": a.CanonicalURL + "#breadcrumb",
			"itemListElement": []map[string]interface{}{
				{"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"},
				{"@type": "ListItem", "position": 2, "name": "Blog", "item": base + composer.Route("blog")},
				{"@type": "ListItem", "position": 3, "name": a.BreadcrumbTitle, "item": a.CanonicalURL},
			},
		},
	}
	if len(faqEntities) > 0 {
		graph = append(graph, map[string]interface{}{
			"@type": "FAQPage", "@id": a.CanonicalURL + "#faq", "mainEntity": faqEntities,
		})
	}

	b, err := json.Marshal(map[string]interface{}{"@context": "https://schema.org", "@graph": graph})
	if err != nil {
		return []byte(`{}`)
	}
	return b
}

// submitToIndexNow notifies Bing (and IndexNow partners) that a URL is live.
//
// This is the one outbound call in the system and it is off by default. It sends
// only a public URL — never article text, database rows or credentials — so it
// does not breach the rule against sending internal data outside the application.
//
// Google is deliberately not pinged: Google retired its sitemap ping endpoint in
// June 2023 and it now returns 404. Google discovers new posts through the
// sitemap referenced in robots.txt and through Search Console.
func (h *TitleBankHandler) submitToIndexNow(ctx context.Context, s *TitleBankSettings, pageURL string) string {
	if !s.SubmitToIndexNow {
		return "disabled"
	}
	if strings.TrimSpace(s.IndexNowKey) == "" {
		return "skipped: no key configured"
	}
	u, err := url.Parse(pageURL)
	if err != nil || u.Host == "" {
		return "skipped: unparseable url"
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"host":        u.Host,
		"key":         s.IndexNowKey,
		"keyLocation": fmt.Sprintf("%s://%s/%s.txt", u.Scheme, u.Host, s.IndexNowKey),
		"urlList":     []string{pageURL},
	})

	reqCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost,
		"https://api.indexnow.org/indexnow", bytes.NewReader(payload))
	if err != nil {
		return "error: " + err.Error()
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		log.Printf("WARN: titlebank: IndexNow submit failed: %v", err)
		return "error: " + err.Error()
	}
	defer resp.Body.Close()
	// 200 accepted, 202 accepted-pending-key-validation. Both are success.
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusAccepted {
		return fmt.Sprintf("submitted (%d)", resp.StatusCode)
	}
	return fmt.Sprintf("rejected (%d)", resp.StatusCode)
}
