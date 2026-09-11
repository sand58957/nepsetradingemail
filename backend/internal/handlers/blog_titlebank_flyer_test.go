package handlers

import "testing"

// Posts used to share one flyer per pillar -- a pillar's hundred posts all
// carried the same picture. Selection must spread across the flyers instead,
// and must not hand consecutive posts the same one.
func TestFlyerSelectionSpreadsAcrossFlyers(t *testing.T) {
	const flyers = 50
	// Titles shaped like the ones in the bank: the first hundred all belong to
	// one pillar, which is exactly the case that used to repeat.
	var titles []string
	for _, stem := range []string{
		"What Is %s? A Beginner's Guide", "How to Improve %s Without More Budget",
		"Advanced %s: Techniques Experienced Teams Use", "%s at Scale: What Changes",
		"Getting Started With %s", "Beyond the Basics: Sophisticated %s Tactics",
	} {
		for _, subj := range []string{
			"Channel Mix", "Marketing Budget", "Customer Journey Map", "Marketing Roadmap",
			"Quarterly Planning", "Competitive Positioning", "Brand Messaging",
			"Marketing OKRs", "Attribution Model", "Campaign Briefs",
			"Audience Research", "Media Planning", "Creative Testing", "Budget Pacing",
			"Performance Reviews", "Growth Loops", "Retention Metrics",
		} {
			titles = append(titles, stem+subj)
		}
	}

	seen := map[int]int{}
	var prev = -1
	consecutive := 0
	for _, title := range titles {
		i := flyerIndexFor(title, flyers)
		if i < 0 || i >= flyers {
			t.Fatalf("index %d out of range for %d flyers", i, flyers)
		}
		seen[i]++
		if i == prev {
			consecutive++
		}
		prev = i
	}

	// With 102 titles over 50 flyers, a sound spread touches most of them.
	if len(seen) < 35 {
		t.Errorf("only %d of %d flyers used across %d titles; selection is clustering",
			len(seen), flyers, len(titles))
	}
	// Back-to-back repeats are what the user actually sees.
	if consecutive > 3 {
		t.Errorf("%d consecutive posts reused the previous flyer", consecutive)
	}
	// No single flyer should dominate.
	for i, n := range seen {
		if n > len(titles)/6 {
			t.Errorf("flyer %d used %d times out of %d; too concentrated", i, n, len(titles))
		}
	}
}

func TestFlyerSelectionIsStableForATitle(t *testing.T) {
	const title = "How to Set Up Attribution Model Correctly the First Time"
	first := flyerIndexFor(title, 50)
	for i := 0; i < 100; i++ {
		if got := flyerIndexFor(title, 50); got != first {
			t.Fatalf("same title chose flyer %d then %d; covers would churn", first, got)
		}
	}
}

func TestFlyerSelectionHandlesNoFlyers(t *testing.T) {
	if got := flyerIndexFor("anything", 0); got != 0 {
		t.Errorf("index for zero flyers = %d, want 0", got)
	}
}
