package composer

import (
	"fmt"
	"sort"
	"strings"
)

// publicRoutes are application routes verified to resolve on the live site.
// Nothing outside this map (plus DB-backed taxonomy slugs) is ever linked, so the
// composer cannot emit a fictional internal URL.
//
// Clean URLs only. The /front-pages/ paths were a theme's demo pages (pricing was
// a USD form-builder with a card form behind it) or a redirect hop, and the help
// centre is still a demo, so it isn't linked at all.
var publicRoutes = map[string]string{
	"home":     "/",
	"blog":     "/blog",
	"pricing":  "/pricing",
	"privacy":  "/privacy",
	"terms":    "/terms",
	"platform": "/",
}

// featureAnchors maps a channel keyword to the public page that best explains it.
// These intentionally point at public marketing pages rather than authenticated
// dashboard routes, so a reader who is not signed in never hits a login wall.
var featureAnchors = []struct {
	Match []string
	Label string
	Route string
}{
	{[]string{"email", "subscriber", "newsletter", "deliverability", "automation", "drip"}, "email marketing platform", "platform"},
	{[]string{"whatsapp", "conversation", "template"}, "WhatsApp campaign tools", "platform"},
	{[]string{"sms", "text message", "otp"}, "bulk SMS platform", "platform"},
	{[]string{"telegram", "bot", "channel"}, "Telegram broadcast tools", "platform"},
	{[]string{"messenger", "chatbot"}, "Messenger automation", "platform"},
	{[]string{"blog", "content", "post", "author", "category"}, "blog CMS", "platform"},
	{[]string{"pricing", "cost", "budget", "roi"}, "pricing", "pricing"},
	{[]string{"analytics", "report", "benchmark", "metric"}, "campaign analytics", "platform"},
}

// Route returns a verified public URL, or empty if the key is unknown.
func Route(key string) string { return publicRoutes[key] }

// CategoryURL and AuthorURL take slugs that came from the database, so the target
// taxonomy page is guaranteed to exist.
func CategoryURL(slug string) string { return "/blog/category/" + slug }
func AuthorURL(slug string) string   { return "/blog/author/" + slug }
func PostURL(slug string) string     { return "/blog/" + slug }

// buildInternalLinks assembles a contextual, de-duplicated link set for one article.
// related holds already-published sibling posts from the same pillar.
func buildInternalLinks(p Pillar, cat *Category, author Author, related []RelatedPost) []InternalLink {
	seen := map[string]bool{}
	var out []InternalLink
	add := func(label, url string) {
		if url == "" || seen[url] {
			return
		}
		seen[url] = true
		out = append(out, InternalLink{Label: label, URL: url})
	}

	if cat != nil {
		add(fmt.Sprintf("More %s guides", strings.ToLower(cat.Name)), CategoryURL(cat.Slug))
	}
	for _, r := range related {
		add(r.Title, PostURL(r.Slug))
	}
	add("All articles", Route("blog"))

	// One feature anchor, chosen by what the pillar is actually about.
	hay := strings.ToLower(p.Title + " " + p.PrimaryKeyword + " " + strings.Join(p.Subtopics, " "))
	for _, fa := range featureAnchors {
		matched := false
		for _, m := range fa.Match {
			if strings.Contains(hay, m) {
				matched = true
				break
			}
		}
		if matched {
			add(fa.Label, Route(fa.Route))
			break
		}
	}
	add(fmt.Sprintf("Posts by %s", author.Name), AuthorURL(author.Slug))
	return out
}

// RelatedPost is a previously published sibling used for internal linking.
type RelatedPost struct {
	Title string `db:"title"`
	Slug  string `db:"slug"`
}

// Slugify produces a stable, URL-safe slug from a title.
func Slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 80 {
		if i := strings.LastIndex(out[:80], "-"); i > 40 {
			out = out[:i]
		} else {
			out = out[:80]
		}
	}
	return strings.Trim(out, "-")
}

// dedupeStrings preserves first-seen order and drops empties.
func dedupeStrings(in []string) []string {
	seen := map[string]bool{}
	out := in[:0:0]
	for _, s := range in {
		s = strings.TrimSpace(s)
		k := strings.ToLower(s)
		if s == "" || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, s)
	}
	return out
}

func sortedCopy(in []string) []string {
	out := append([]string(nil), in...)
	sort.Strings(out)
	return out
}
