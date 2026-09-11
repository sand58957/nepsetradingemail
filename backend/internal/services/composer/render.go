package composer

import (
	"fmt"
	"strings"
)

// Compose builds a complete article from internal data only.
func Compose(in Input) Article {
	p, t := in.Pillar, in.Title
	subject := t.SubjectEntity
	if subject == "" {
		subject = p.PrimaryKeyword
	}
	subjLow := lower1(subject)
	aud := p.TargetAudience
	if aud == "" {
		aud = "marketing teams"
	}
	links := buildInternalLinks(p, in.Category, in.Author, in.Related)
	b := &builder{}

	// --- Intro + direct answer (AEO: answer first) ---------------------------
	quick := quickAnswer(t.ContentType, subject, p)
	b.p(fmt.Sprintf("%s sits inside %s. This guide stays within what that pillar covers: %s",
		esc(upper1(subject)), esc(p.Title), esc(lower1(p.Description))))
	b.sb.WriteString(fmt.Sprintf("<div class=\"quick-answer\"><strong>Short answer:</strong> %s</div>\n", esc(quick)))
	b.p(fmt.Sprintf("Written for %s. The search intent behind this topic is %s, so the sections below move from definition to action rather than padding the page.",
		esc(lower1(aud)), esc(strings.ToLower(p.PrimaryIntent))))

	// --- Body sections -------------------------------------------------------
	subs := p.Subtopics
	if len(subs) == 0 {
		subs = []string{subject}
	}
	for i, sec := range planFor(t.ContentType) {
		head := upper1(fill(sec.Heading, subject))
		b.h2(head)
		writeSection(b, sec.Kind, subject, subjLow, p, subs, i, links, in)
	}

	// --- FAQ (AEO) -----------------------------------------------------------
	faqs := buildFAQs(subject, t.ContentType, p)
	b.h2("Frequently asked questions")
	for _, f := range faqs {
		b.h3(f.Question)
		b.p(esc(f.Answer))
	}

	// --- Related reading (internal linking) ---------------------------------
	if len(links) > 0 {
		b.h2("Related reading")
		var items []string
		for _, l := range links {
			items = append(items, link(l.Label, l.URL))
		}
		b.ul(items)
	}

	// --- Conclusion + CTA ----------------------------------------------------
	b.h2("Where to take this next")
	b.p(fmt.Sprintf("The practical test for %s is whether it changes a decision you make this month. If it does not, the work is probably better spent elsewhere in %s.",
		esc(subjLow), esc(lower1(p.Title))))
	if u := Route("platform"); u != "" {
		b.p(fmt.Sprintf("If you want to put this into practice across email, WhatsApp, SMS, Telegram and Messenger from one place, see the %s.",
			link("Nepal Fillings platform", u)))
	}

	htmlOut := b.sb.String()
	words := countWords(htmlOut)
	slug := Slugify(t.Title)
	canon := strings.TrimRight(in.BaseURL, "/") + PostURL(slug)

	art := Article{
		Title:             t.Title,
		Slug:              slug,
		HTML:              htmlOut,
		Excerpt:           trimTo(quick, 190),
		QuickAnswer:       quick,
		MetaTitle:         metaTitle(t.Title),
		MetaDescription:   metaDescription(quick, subject, p),
		CanonicalURL:      canon,
		BreadcrumbTitle:   trimTo(subject, 60),
		OGTitle:           trimTo(t.Title, 88),
		OGDescription:     trimTo(quick, 195),
		PrimaryKeyword:    p.PrimaryKeyword,
		SecondaryKeywords: dedupeStrings(append([]string{subject}, p.SecondaryKeywords...)),
		EntityTags:        dedupeStrings(append([]string{p.Title, subject, p.PrimaryKeyword}, p.Subtopics...)),
		SearchIntent:      p.PrimaryIntent,
		FAQs:              faqs,
		TOC:               b.toc,
		KeyPoints:         keyPoints(subject, p, t.ContentType),
		InternalLinks:     links,
		SchemaType:        "Article",
		WordCount:         words,
		ReadingTimeMin:    maxInt(1, (words+199)/200),
	}
	art.FeaturedImageURL, art.FeaturedImageAlt, art.FeaturedImageCap, art.ImageTitle, art.ImageSlug = imageFor(in, subject)
	art.SEOScore = scoreSEO(art)
	art.ReadabilityScore = scoreReadability(art, words)
	return art
}

func writeSection(b *builder, k sectionKind, subject, subjLow string, p Pillar, subs []string, idx int, links []InternalLink, in Input) {
	pick := func(n int) []string {
		var out []string
		for i := 0; i < n && i < len(subs); i++ {
			out = append(out, subs[(idx*3+i)%len(subs)])
		}
		return dedupeStrings(out)
	}
	switch k {
	case kProse:
		b.p(fmt.Sprintf("%s is easiest to reason about once you separate it from the tooling. The underlying question is what %s should change about how %s run campaigns, not which product is switched on.",
			esc(subject), esc(subjLow), esc(lower1(p.TargetAudience))))
		b.p(fmt.Sprintf("Within %s the parts that carry most of the weight are %s. Those are the levers worth understanding before anything is automated.",
			esc(lower1(p.Title)), esc(joinNatural(pick(3)))))
	case kSteps:
		stepForms := []string{
			"<strong>%s.</strong> Settle what this has to produce before touching any configuration — the required output is what dictates the setup.",
			"<strong>%s.</strong> Write down who owns this and how often it gets reviewed. Unowned steps are where campaigns quietly break.",
			"<strong>%s.</strong> Get this working for a single segment first. A narrow test surfaces problems that a full rollout only hides.",
			"<strong>%s.</strong> Record the state you are starting from, so the change you make next can actually be attributed.",
			"<strong>%s.</strong> Remove anything here that does not feed the outcome you named in step one.",
		}
		var steps []string
		for i, s := range pick(4) {
			steps = append(steps, fmt.Sprintf(stepForms[i%len(stepForms)], esc(s)))
		}
		steps = append(steps, fmt.Sprintf("<strong>Review.</strong> Re-read the result against the original goal for %s and cut whatever does not serve it.", esc(subjLow)))
		b.ol(steps)
	case kBullets:
		bulletForms := []string{
			"<strong>%s</strong> — usually the first thing to check when results stall.",
			"<strong>%s</strong> — cheap to get right early, expensive to retrofit later.",
			"<strong>%s</strong> — the part most often delegated and least often reviewed.",
			"<strong>%s</strong> — where a small change tends to move the result more than expected.",
			"<strong>%s</strong> — worth writing down, because it is the detail teams forget between campaigns.",
		}
		var items []string
		for i, s := range pick(5) {
			items = append(items, fmt.Sprintf(bulletForms[i%len(bulletForms)], esc(s)))
		}
		b.ul(items)
	case kTable:
		rows := [][]string{}
		for _, s := range pick(4) {
			rows = append(rows, []string{esc(s),
				esc("Direct control over " + lower1(s)),
				esc("Needs a clear owner and a review cadence")})
		}
		b.table([]string{"Area", "What it gives you", "What it costs"}, rows)
	case kPitfalls:
		pitfallForms := []string{
			"<strong>Treating %s as a one-off.</strong> It drifts, and the drift stays invisible until performance moves.",
			"<strong>Skipping %s because it is not urgent.</strong> The cost shows up later as variance nobody can explain.",
			"<strong>Copying someone else's %s wholesale.</strong> The settings that suit their audience rarely suit yours.",
			"<strong>Changing %s and something else in the same week.</strong> You lose the ability to attribute the result.",
		}
		var items []string
		for i, s := range pick(4) {
			items = append(items, fmt.Sprintf(pitfallForms[i%len(pitfallForms)], esc(lower1(s))))
		}
		b.ul(items)
	case kMeasureIt:
		b.p(fmt.Sprintf("Published benchmarks for %s vary so widely by audience and sector that borrowing one tends to mislead. Your own account is a better reference, and you already hold the data.", esc(subjLow)))
		b.ol([]string{
			fmt.Sprintf("Pick a single metric that reflects %s rather than general activity.", esc(subjLow)),
			"Take a baseline over a period long enough to cover your normal sending cycle.",
			"Change one variable, hold the rest steady, and let the test run to a stable sample.",
			"Compare against your own baseline, not an industry figure of unknown provenance.",
		})
		b.p("Numbers produced this way describe your audience specifically, which is the only comparison that reliably informs a decision.")
	}
}
