package composer

import (
	"fmt"
	"strings"
)

// imageFor resolves the featured image from the application's own flyer assets.
// One flyer exists per content pillar in Flyier/png, uploaded once to the site's
// own CDN; nothing is fetched from the internet and no image API is called.
//
// Returns: url, alt, caption, title, slug.
func imageFor(in Input, subject string) (string, string, string, string, string) {
	p := in.Pillar
	base := strings.TrimRight(in.CDNBase, "/")
	url := p.FlyerURL
	if url == "" {
		// Fall back to a deterministic path derived from the pillar number.
		url = fmt.Sprintf("/blog-flyers/%02d-%s.png", p.Number, Slugify(p.Title))
	}
	if !strings.HasPrefix(url, "http") && base != "" {
		url = base + url
	}

	// Alt text describes the image itself, then ties it to the article subject.
	// Use the pillar title as written: lower1 only lowercases the first word, which
	// turned "Digital Marketing Strategy Foundations" into "digital Marketing...".
	alt := fmt.Sprintf("Nepal Fillings illustrated cover for %s, the pillar covering %s",
		p.Title, lower1(subject))
	if len(alt) > 125 {
		alt = trimTo(alt, 125)
	}
	caption := fmt.Sprintf("Part of the %s series.", lower1(p.Title))
	title := fmt.Sprintf("%s — %s", p.Title, subject)
	slug := fmt.Sprintf("%02d-%s", p.Number, Slugify(p.Title))
	return url, alt, caption, trimTo(title, 90), slug
}
