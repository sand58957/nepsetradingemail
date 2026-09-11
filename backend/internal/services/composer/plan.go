package composer

import "strings"

// sectionKind selects how a section body is written.
type sectionKind int

const (
	kProse sectionKind = iota
	kSteps
	kBullets
	kTable     // structural comparison table, never fabricated figures
	kMeasureIt // "derive this from your own data" — used where real numbers are required
	kPitfalls
)

type section struct {
	Heading string
	Kind    sectionKind
}

// plans maps a content type to its section skeleton. Headings are filled with the
// pillar's own subtopics at compose time, so two articles in the same pillar never
// carry the same body.
//
// Types that would normally rest on outside research (Statistics, Benchmarks,
// Case study, Pricing, Trends, Predictions) deliberately use kMeasureIt: rather
// than inventing figures the article explains how the reader derives the number
// from their own account data. That keeps every claim first-party.
var plans = map[string][]section{
	"How-to": {
		{"What you need before you start", kBullets},
		{"%s, step by step", kSteps},
		{"Where this usually goes wrong", kPitfalls},
		{"How to tell it worked", kMeasureIt},
	},
	"Tutorial": {
		{"What this walkthrough covers", kBullets},
		{"Working through %s", kSteps},
		{"Checking your configuration", kBullets},
		{"Common setup errors", kPitfalls},
	},
	"Beginner guide": {
		{"What %s actually means", kProse},
		{"Why it matters for your campaigns", kProse},
		{"The parts worth learning first", kBullets},
		{"Your first week with %s", kSteps},
	},
	"Advanced guide": {
		{"Where the basics stop being enough", kProse},
		{"Techniques that hold up at volume", kBullets},
		{"Trade-offs to weigh", kTable},
		{"Failure modes at scale", kPitfalls},
	},
	"Ultimate guide": {
		{"How %s fits the wider picture", kProse},
		{"The components that matter", kBullets},
		{"Putting it into practice", kSteps},
		{"How the pieces compare", kTable},
		{"Measuring the outcome", kMeasureIt},
	},
	"Checklist": {
		{"How to use this checklist", kProse},
		{"The %s checklist", kTable},
		{"Items teams most often skip", kPitfalls},
	},
	"Template": {
		{"What the template covers", kBullets},
		{"Field-by-field breakdown", kTable},
		{"Adapting it to your team", kSteps},
	},
	"Examples": {
		{"What separates a good %s from an average one", kProse},
		{"Patterns worth copying", kBullets},
		{"Patterns worth avoiding", kPitfalls},
	},
	"Case study": {
		{"The situation", kProse},
		{"What a structured approach looks like", kSteps},
		{"How to run this as an experiment", kMeasureIt},
	},
	"Strategy": {
		{"Deciding what %s is for", kProse},
		{"Sequencing the work", kSteps},
		{"Choosing where not to invest", kBullets},
		{"Reviewing the strategy", kMeasureIt},
	},
	"Best practices": {
		{"Principles that survive platform changes", kBullets},
		{"Applying them to %s", kProse},
		{"Where teams drift", kPitfalls},
	},
	"Mistakes": {
		{"The mistakes that cost the most", kPitfalls},
		{"Why they happen", kProse},
		{"Correcting course", kSteps},
	},
	"Problem/solution": {
		{"Narrowing down the cause", kSteps},
		{"Fixes in order of likelihood", kBullets},
		{"Preventing a repeat", kProse},
	},
	"FAQ": {
		{"Short answers to the common questions", kProse},
		{"Deciding whether %s applies to you", kBullets},
	},
	"Comparison": {
		{"What each option is good at", kTable},
		{"Choosing between them", kBullets},
		{"When the answer is both", kProse},
	},
	"Alternatives": {
		{"When %s is the wrong fit", kProse},
		{"Options worth considering", kTable},
		{"Making the switch", kSteps},
	},
	"Tools": {
		{"What to evaluate", kBullets},
		{"How the categories differ", kTable},
		{"Running a fair trial", kSteps},
	},
	"Pricing": {
		{"What actually drives the cost", kBullets},
		{"Modelling your own spend", kMeasureIt},
		{"Reducing cost without losing reach", kProse},
	},
	"ROI": {
		{"Defining the return", kProse},
		{"Calculating it from your own data", kMeasureIt},
		{"Presenting the case internally", kBullets},
	},
	"Statistics": {
		{"Which numbers are worth tracking", kBullets},
		{"Producing your own figures", kMeasureIt},
		{"Reading the numbers honestly", kProse},
	},
	"Trends": {
		{"What is changing in %s", kProse},
		{"What it means for your plan", kBullets},
		{"Tracking the shift in your own account", kMeasureIt},
	},
	"Predictions": {
		{"What the direction of travel suggests", kProse},
		{"Preparing without over-committing", kBullets},
		{"Signals to watch in your data", kMeasureIt},
	},
	"Benchmarks": {
		{"Why external benchmarks mislead", kProse},
		{"Building an internal baseline", kMeasureIt},
		{"Setting targets from it", kSteps},
	},
	"Industry": {
		{"What is different in this sector", kProse},
		{"Adapting %s to the constraints", kBullets},
		{"Sector-specific pitfalls", kPitfalls},
	},
	"Small business": {
		{"Doing this with limited time", kProse},
		{"The short list", kBullets},
		{"A workable first month", kSteps},
	},
	"Enterprise": {
		{"Coordination, not just execution", kProse},
		{"Governance for %s", kBullets},
		{"Rolling out across teams", kSteps},
	},
	"Local": {
		{"What local intent changes", kProse},
		{"Adapting the approach", kBullets},
		{"Measuring local performance", kMeasureIt},
	},
	"B2B": {
		{"Longer cycles change the job", kProse},
		{"Aligning %s to the buying committee", kBullets},
		{"Connecting activity to pipeline", kMeasureIt},
	},
	"B2C": {
		{"Competing for attention", kProse},
		{"Tactics that scale", kBullets},
		{"Repeat purchase, not one-off", kProse},
	},
	"AI-powered": {
		{"Where AI genuinely helps with %s", kProse},
		{"Where it should not be trusted", kPitfalls},
		{"A workflow with review built in", kSteps},
	},
}

// planFor falls back to a general structure for any unmapped type.
func planFor(contentType string) []section {
	if p, ok := plans[contentType]; ok {
		return p
	}
	return []section{
		{"What %s involves", kProse},
		{"How to approach it", kSteps},
		{"What to watch for", kPitfalls},
	}
}

// fill substitutes the subject entity into a heading that carries a %s slot.
func fill(h, subject string) string {
	if !strings.Contains(h, "%s") {
		return h
	}
	return strings.Replace(h, "%s", subject, 1)
}
