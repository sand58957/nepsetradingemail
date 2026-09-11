package composer

import (
	"fmt"
	"html"
	"strings"
)

// Input is everything the composer is allowed to read. There is no other source.
type Input struct {
	Title    BankTitle
	Pillar   Pillar
	Category *Category
	Author   Author
	Related  []RelatedPost
	BaseURL  string
	CDNBase  string // where the pillar flyer is served from
}

type builder struct {
	sb  strings.Builder
	toc []TOCEntry
	n   int
}

func (b *builder) h2(text string) {
	b.n++
	id := fmt.Sprintf("s%d-%s", b.n, Slugify(text))
	b.toc = append(b.toc, TOCEntry{ID: id, Text: text, Level: 2})
	fmt.Fprintf(&b.sb, "<h2 id=\"%s\">%s</h2>\n", id, html.EscapeString(text))
}
func (b *builder) h3(text string) {
	fmt.Fprintf(&b.sb, "<h3>%s</h3>\n", html.EscapeString(text))
}
func (b *builder) p(text string) {
	if strings.TrimSpace(text) == "" {
		return
	}
	fmt.Fprintf(&b.sb, "<p>%s</p>\n", text)
}
func (b *builder) ul(items []string) {
	if len(items) == 0 {
		return
	}
	b.sb.WriteString("<ul>\n")
	for _, it := range items {
		fmt.Fprintf(&b.sb, "  <li>%s</li>\n", it)
	}
	b.sb.WriteString("</ul>\n")
}
func (b *builder) ol(items []string) {
	if len(items) == 0 {
		return
	}
	b.sb.WriteString("<ol>\n")
	for _, it := range items {
		fmt.Fprintf(&b.sb, "  <li>%s</li>\n", it)
	}
	b.sb.WriteString("</ol>\n")
}
func (b *builder) table(head []string, rows [][]string) {
	if len(rows) == 0 {
		return
	}
	b.sb.WriteString("<div class=\"table-wrap\"><table>\n<thead><tr>")
	for _, h := range head {
		fmt.Fprintf(&b.sb, "<th>%s</th>", html.EscapeString(h))
	}
	b.sb.WriteString("</tr></thead>\n<tbody>\n")
	for _, r := range rows {
		b.sb.WriteString("<tr>")
		for _, c := range r {
			fmt.Fprintf(&b.sb, "<td>%s</td>", c)
		}
		b.sb.WriteString("</tr>\n")
	}
	b.sb.WriteString("</tbody>\n</table></div>\n")
}

// properNouns keeps brand and acronym casing intact when a phrase is used
// mid-sentence. Without this, "WhatsApp Marketing" became "whatsApp Marketing".
var properNouns = []string{"WhatsApp", "Telegram", "Messenger", "Facebook", "Instagram",
	"Google", "Meta", "Nepal", "Kathmandu", "SMS", "API", "SEO", "AEO", "GEO", "AIO",
	"AI", "ROI", "CRM", "B2B", "B2C", "SaaS", "GA4", "DKIM", "SPF", "DMARC", "E-E-A-T",
	"QR", "CMS", "PPC", "LLM", "D2C", "NPS", "TCPA", "GDPR"}

// lower1 lowercases the first letter only when doing so is safe: a word that
// carries internal capitals (WhatsApp, GA4) or is a known proper noun is left alone.
func lower1(s string) string {
	if s == "" {
		return s
	}
	first := strings.SplitN(s, " ", 2)[0]
	trimmed := strings.Trim(first, ".,:;")
	for _, pn := range properNouns {
		if strings.EqualFold(trimmed, pn) {
			return s
		}
	}
	// Internal capitals after position 0 signal a brand: WhatsApp, YouTube, PageSpeed.
	for i := 1; i < len(trimmed); i++ {
		if trimmed[i] >= 'A' && trimmed[i] <= 'Z' {
			return s
		}
	}
	return strings.ToLower(s[:1]) + s[1:]
}

// upper1 capitalises a phrase for use as a heading or sentence opener.
func upper1(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func esc(s string) string { return html.EscapeString(s) }

// link renders an internal anchor; url must come from the verified registry.
func link(label, url string) string {
	return fmt.Sprintf("<a href=\"%s\">%s</a>", esc(url), esc(label))
}
