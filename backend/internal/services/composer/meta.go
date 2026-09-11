package composer

import (
	"fmt"
	"regexp"
	"strings"
)

var tagRe = regexp.MustCompile(`<[^>]+>`)

func countWords(htmlStr string) int {
	txt := tagRe.ReplaceAllString(htmlStr, " ")
	return len(strings.Fields(txt))
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// trimTo cuts on a word boundary so metadata never ends mid-word.
func trimTo(s string, n int) string {
	s = strings.TrimSpace(tagRe.ReplaceAllString(s, ""))
	if len(s) <= n {
		return s
	}
	cut := s[:n]
	if i := strings.LastIndex(cut, " "); i > n/2 {
		cut = cut[:i]
	}
	return strings.TrimRight(cut, " ,.;:—-") + "…"
}

// maxMetaTitle is the longest meta title the composer emits, and the same bound
// scoreSEO checks. Keep it one constant: while the two were separate literals
// (68 here, 62 in the scorer) every post with a 63-68 character meta title was
// marked down for following this file's own rule.
const maxMetaTitle = 68

// metaTitle returns the bare title. The site layout already appends
// " | Nepal Fillings Blog", so adding branding here double-brands the tag, and
// truncating here puts an ellipsis in the middle of the rendered <title>.
// Only an unusually long title is shortened, and on a word boundary with no
// ellipsis, so the suffix still lands inside a sensible SERP width.
func metaTitle(title string) string {
	if len(title) <= maxMetaTitle {
		return title
	}
	cut := title[:maxMetaTitle]
	if i := strings.LastIndex(cut, " "); i > maxMetaTitle/2 {
		cut = cut[:i]
	}
	return strings.TrimRight(cut, " ,.;:-")
}

func metaDescription(quick, subject string, p Pillar) string {
	d := quick
	if len(d) < 110 {
		d += fmt.Sprintf(" Part of our %s guides.", lower1(p.Title))
	}
	return trimTo(d, 158)
}

// quickAnswer is the answer-first block. It states only what the internal data
// supports: what the subject is, and what deciding about it involves.
func quickAnswer(contentType, subject string, p Pillar) string {
	s := lower1(subject)
	switch contentType {
	case "How-to", "Tutorial":
		return fmt.Sprintf("Work through %s in order: define the outcome first, configure second, then verify against your own baseline. Most failures come from configuring before the outcome is agreed.", s)
	case "Comparison", "Alternatives":
		return fmt.Sprintf("There is no single winner. Choose based on which constraint binds hardest for you — reach, cost, control or speed — because %s changes value depending on which one you are optimising.", s)
	case "Pricing", "ROI":
		return fmt.Sprintf("Cost and return for %s depend on your own volumes, so model them from your account data rather than a published average. The method matters more than any headline figure.", s)
	case "Statistics", "Benchmarks":
		return fmt.Sprintf("Treat outside figures for %s as context, not targets. A baseline measured on your own audience is the only comparison that reliably informs a decision.", s)
	case "Mistakes", "Problem/solution":
		return fmt.Sprintf("Most %s problems trace back to a small number of causes. Work through them in order of likelihood rather than changing several things at once.", s)
	case "FAQ":
		return fmt.Sprintf("The short version: %s is worth the effort when it changes a decision you actually make. If it does not, it is overhead.", s)
	case "Checklist", "Template":
		return fmt.Sprintf("Use the structure below as a pass before you launch. It is designed to catch the %s issues that are expensive to fix afterwards.", s)
	case "AI-powered":
		return fmt.Sprintf("AI helps with %s where the work is repetitive and verifiable, and hurts where judgement or accuracy matters. Keep a human review step on anything published.", s)
	default:
		return fmt.Sprintf("%s matters because it changes how %s plan and measure campaigns. This guide covers what it is, how to apply it, and how to tell whether it worked.",
			strings.ToUpper(subject[:1])+subject[1:], lower1(p.TargetAudience))
	}
}

// buildFAQs produces answer-engine questions grounded in the topic. No figures are
// asserted, because none exist in the internal data.
func buildFAQs(subject, contentType string, p Pillar) []FAQ {
	s := lower1(subject)
	f := []FAQ{
		{fmt.Sprintf("What is %s?", s),
			fmt.Sprintf("%s is one of the working parts of %s. In practice it covers %s, and it is judged by whether it improves a campaign decision rather than by activity alone.",
				strings.ToUpper(subject[:1])+subject[1:], lower1(p.Title), joinNatural(firstN(p.Subtopics, 3)))},
		{fmt.Sprintf("Why does %s matter?", s),
			fmt.Sprintf("It matters to %s because it sits directly on the path between effort and result. Ignoring it usually shows up later as unexplained variance in performance.", lower1(p.TargetAudience))},
		{fmt.Sprintf("How do I get started with %s?", s),
			"Start by writing down the outcome you want and the single metric that would show it. Configure only what serves that metric, then measure against your own baseline before expanding."},
		{fmt.Sprintf("How long does %s take to show results?", s),
			"That depends on your sending frequency and audience size, so the honest answer is to measure it. Take a baseline, change one variable, and let the test run long enough to cover a full cycle."},
	}
	switch contentType {
	case "Pricing", "ROI":
		f = append(f, FAQ{fmt.Sprintf("How much does %s cost?", s),
			"Cost is driven by volume, channel and how much is automated. Model it from your own usage rather than a published average, because averages hide the variables that actually move your bill."})
	case "Comparison", "Alternatives", "Tools":
		f = append(f, FAQ{fmt.Sprintf("Which option is better for %s?", s),
			"Neither is better in the abstract. Decide which constraint binds hardest — budget, reach, control or time — and pick the option that relieves it."})
	case "AI-powered":
		f = append(f, FAQ{fmt.Sprintf("Can AI handle %s on its own?", s),
			"It can handle the repetitive parts well. Anything that gets published should still pass a human review, because accuracy failures are cheap to prevent and expensive to correct."})
	default:
		f = append(f, FAQ{fmt.Sprintf("Do I actually need %s?", s),
			"If it would change a decision you make this month, yes. If it would only produce a report nobody acts on, spend the time elsewhere."})
	}
	return f
}

func keyPoints(subject string, p Pillar, contentType string) []string {
	return dedupeStrings([]string{
		fmt.Sprintf("%s is part of %s", subject, lower1(p.Title)),
		fmt.Sprintf("Written for %s", lower1(p.TargetAudience)),
		fmt.Sprintf("Search intent: %s", lower1(p.PrimaryIntent)),
		fmt.Sprintf("Format: %s", lower1(contentType)),
		"Figures should be measured from your own account, not borrowed",
	})
}

func firstN(xs []string, n int) []string {
	if len(xs) < n {
		n = len(xs)
	}
	return xs[:n]
}

// joinNatural renders a list as "a, b and c".
func joinNatural(xs []string) string {
	xs = dedupeStrings(xs)
	switch len(xs) {
	case 0:
		return ""
	case 1:
		return lower1(xs[0])
	case 2:
		return lower1(xs[0]) + " and " + lower1(xs[1])
	}
	var low []string
	for _, x := range xs {
		low = append(low, lower1(x))
	}
	return strings.Join(low[:len(low)-1], ", ") + " and " + low[len(low)-1]
}

// scoreSEO is a completeness score over the fields the site actually uses.
func scoreSEO(a Article) int {
	score := 0
	checks := []bool{
		a.MetaTitle != "" && len(a.MetaTitle) <= maxMetaTitle,
		a.MetaDescription != "" && len(a.MetaDescription) >= 80 && len(a.MetaDescription) <= 160,
		a.CanonicalURL != "", a.PrimaryKeyword != "", len(a.SecondaryKeywords) >= 3,
		len(a.FAQs) >= 4, len(a.TOC) >= 3, a.QuickAnswer != "",
		a.FeaturedImageURL != "" && a.FeaturedImageAlt != "",
		len(a.InternalLinks) >= 2, a.WordCount >= 500, len(a.EntityTags) >= 5,
	}
	for _, ok := range checks {
		if ok {
			score++
		}
	}
	return score * 100 / len(checks)
}

func scoreReadability(a Article, words int) int {
	if words == 0 {
		return 0
	}
	sentences := maxInt(1, strings.Count(a.HTML, ". ")+strings.Count(a.HTML, ".</p>"))
	avg := float64(words) / float64(sentences)
	switch {
	case avg <= 18:
		return 78
	case avg <= 24:
		return 66
	case avg <= 30:
		return 54
	default:
		return 42
	}
}
