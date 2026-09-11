package cover

import (
	"bytes"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func in(title, slug string) Input {
	return Input{
		Title: title, PillarTitle: "Digital Marketing Strategy Foundations",
		PillarSlug: "digital-marketing-strategy", Slug: slug,
	}
}

func TestRenderWritesAPNGOfTheRightSize(t *testing.T) {
	dir := t.TempDir()
	name, err := Render(in("What Is Channel Mix?", "what-is-channel-mix"), dir)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if name != "what-is-channel-mix.png" {
		t.Errorf("file name = %q, want the slug", name)
	}
	f, err := os.Open(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if b := img.Bounds(); b.Dx() != Width || b.Dy() != Height {
		t.Errorf("size = %dx%d, want %dx%d", b.Dx(), b.Dy(), Width, Height)
	}
}

// The whole point of generating covers: posts must not all look alike. One
// flyer per pillar meant a pillar's hundred posts shared a single image.
func TestEachPostGetsDistinctArtwork(t *testing.T) {
	seen := map[string]string{}
	for _, s := range []string{
		"what-is-channel-mix", "marketing-roadmap-for-beginners",
		"advanced-quarterly-planning", "competitive-positioning-at-scale",
		"beyond-the-basics-brand-messaging", "how-to-improve-marketing-okrs",
	} {
		img, err := Draw(in("A Title", s))
		if err != nil {
			t.Fatalf("draw %s: %v", s, err)
		}
		var buf bytes.Buffer
		if err := png.Encode(&buf, img); err != nil {
			t.Fatalf("encode %s: %v", s, err)
		}
		key := string(buf.Bytes())
		if prev, dup := seen[key]; dup {
			t.Errorf("%s renders the same image as %s", s, prev)
		}
		seen[key] = s
	}
}

// A post's cover must not change when it is re-rendered, or the site's images
// would churn on every republish.
func TestSameSlugRendersIdenticalBytes(t *testing.T) {
	var out [2]bytes.Buffer
	for i := range out {
		img, err := Draw(in("Stable Title", "stable-slug"))
		if err != nil {
			t.Fatalf("draw: %v", err)
		}
		if err := png.Encode(&out[i], img); err != nil {
			t.Fatalf("encode: %v", err)
		}
	}
	if !bytes.Equal(out[0].Bytes(), out[1].Bytes()) {
		t.Error("two renders of the same slug differ")
	}
}

func TestHandlesTitlesOfAnyLength(t *testing.T) {
	for _, title := range []string{
		"SEO",
		"WhatsApp Broadcast Lists vs Groups: Which Converts Better?",
		"An Extremely Long Title That Keeps Going On And On About Marketing " +
			"Operations And Will Not Fit Inside Two Lines No Matter How Small " +
			"The Type Gets, So It Has To Be Trimmed",
	} {
		if _, err := Draw(in(title, "slug-"+title[:3])); err != nil {
			t.Errorf("title %q: %v", title[:20], err)
		}
	}
}

func TestDrawRejectsAnEmptyTitle(t *testing.T) {
	if _, err := Draw(in("   ", "some-slug")); err == nil {
		t.Error("expected an error for a blank title, got none")
	}
}

// Alt text is read aloud and indexed, and the scorer requires one; keep it
// inside the length search engines display and make it name the post.
func TestAltTextNamesThePostAndStaysShort(t *testing.T) {
	long := strings.Repeat("Very Long Marketing Title ", 8)
	for _, c := range []Input{
		in("What Is Channel Mix?", "s"),
		in(long, "s"),
		{Title: "No Pillar Here", Slug: "s"},
	} {
		alt := AltText(c)
		if len(alt) > 125 {
			t.Errorf("alt text is %d chars, over the 125 limit: %q", len(alt), alt)
		}
		if !strings.Contains(alt, "Nepal Fillings") {
			t.Errorf("alt text does not name the brand: %q", alt)
		}
	}
}
