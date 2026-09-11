package composer

import (
	"strings"
	"testing"
)

func TestNoFormatArtefacts(t *testing.T) {
	types := []string{"How-to", "Tutorial", "Beginner guide", "Advanced guide", "Ultimate guide", "Checklist", "Template", "Examples", "Case study", "Strategy", "Best practices", "Mistakes", "Problem/solution", "FAQ", "Comparison", "Alternatives", "Tools", "Pricing", "ROI", "Statistics", "Trends", "Predictions", "Benchmarks", "Industry", "Small business", "Enterprise", "Local", "B2B", "B2C", "AI-powered"}
	for _, ct := range types {
		a := Compose(sampleInput(ct, "broadcast strategy", "Broadcast Strategy Guide"))
		for _, bad := range []string{"%!", "(EXTRA", "%s", "MISSING"} {
			if strings.Contains(a.HTML, bad) {
				t.Errorf("%s: found %q", ct, bad)
			}
		}
	}
}
