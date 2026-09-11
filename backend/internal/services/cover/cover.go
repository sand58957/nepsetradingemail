// Package cover renders the featured image for a blog post.
//
// Every post gets its own cover, drawn here from local assets only: no image
// API, no stock photo service, no network access of any kind. The previous
// approach shipped one flyer per pillar, so the hundred posts inside a pillar
// all shared a single image; and because the pillar's name is printed on the
// flyer artwork, the images could not simply be shuffled between pillars
// without putting the wrong title on the picture.
//
// The layout follows the existing Nepal Fillings flyers: a deep navy frame, a
// red DIGITAL / MARKETING badge, a category tag, a network graphic, and a white
// bar carrying the title. What varies per post is the artwork and the title,
// both derived from a seed seeded by the post's own slug, so the same post
// always renders the same cover.
package cover

import (
	"fmt"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// Cover dimensions. 1200x630 is the size of the existing flyers and the aspect
// ratio Open Graph and Twitter summary cards expect.
const (
	Width  = 1200
	Height = 630
)

// Brand palette, sampled from the existing flyer artwork.
var (
	navy      = color.RGBA{0x15, 0x47, 0xA0, 0xFF}
	navyDeep  = color.RGBA{0x07, 0x17, 0x44, 0xFF}
	brandRed  = color.RGBA{0xD3, 0x1E, 0x25, 0xFF}
	white     = color.RGBA{0xFF, 0xFF, 0xFF, 0xFF}
	titleInk  = color.RGBA{0x10, 0x21, 0x40, 0xFF}
	brandMint = color.RGBA{0x1F, 0xB6, 0x7A, 0xFF}
)

// Input is everything the renderer needs. All of it comes from the post itself.
type Input struct {
	Title       string // the post's own title, printed on the cover
	PillarTitle string // used for the category tag
	PillarSlug  string // used for the category tag when set
	Slug        string // seeds the artwork, so a post's cover is stable
}

// Render draws the cover and writes it to dir as <slug>.png, returning the file
// name. The directory is created if it does not exist.
func Render(in Input, dir string) (string, error) {
	img, err := Draw(in)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("cover: create %s: %w", dir, err)
	}
	name := in.Slug + ".png"
	// Write to a temp file and rename, so a reader (nginx) never sees a
	// half-written PNG if this is regenerated while the site is serving it.
	tmp, err := os.CreateTemp(dir, ".cover-*.png")
	if err != nil {
		return "", fmt.Errorf("cover: temp file: %w", err)
	}
	defer os.Remove(tmp.Name())
	if err := png.Encode(tmp, img); err != nil {
		tmp.Close()
		return "", fmt.Errorf("cover: encode: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return "", fmt.Errorf("cover: close: %w", err)
	}
	if err := os.Chmod(tmp.Name(), 0o644); err != nil {
		return "", fmt.Errorf("cover: chmod: %w", err)
	}
	final := filepath.Join(dir, name)
	if err := os.Rename(tmp.Name(), final); err != nil {
		return "", fmt.Errorf("cover: rename: %w", err)
	}
	return name, nil
}

// Draw composes the cover image in memory.
func Draw(in Input) (image.Image, error) {
	faces, err := loadFaces()
	if err != nil {
		return nil, err
	}
	rng := rand.New(rand.NewSource(seedOf(in.Slug)))

	img := image.NewRGBA(image.Rect(0, 0, Width, Height))

	// The white title bar sits across the bottom; the artwork fills the rest.
	const barTop = 470
	drawGradient(img, image.Rect(0, 0, Width, barTop), rng)
	drawGlow(img, image.Rect(0, 0, Width, barTop), rng)
	drawNetwork(img, image.Rect(0, 0, Width, barTop), rng)
	drawVignette(img, image.Rect(0, 0, Width, barTop))

	fill(img, image.Rect(0, barTop, Width, Height), white)
	// A thin red rule separates the artwork from the title bar.
	fill(img, image.Rect(0, barTop, Width, barTop+6), brandRed)

	drawBadge(img, faces)
	drawTag(img, faces, tagText(in), barTop)
	if err := drawTitle(img, faces, in.Title, barTop); err != nil {
		return nil, err
	}
	drawMark(img, barTop)
	drawFrame(img)
	return img, nil
}

// seedOf derives a stable seed from the post slug, so re-rendering a post
// reproduces its cover exactly rather than shuffling the site's images.
func seedOf(slug string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(slug))
	return int64(h.Sum64() & 0x7FFFFFFFFFFFFFFF)
}

type faceSet struct {
	badge  font.Face
	tag    font.Face
	title  font.Face
	titleS font.Face
}

func loadFaces() (faceSet, error) {
	bold, err := opentype.Parse(gobold.TTF)
	if err != nil {
		return faceSet{}, fmt.Errorf("cover: parse bold font: %w", err)
	}
	reg, err := opentype.Parse(goregular.TTF)
	if err != nil {
		return faceSet{}, fmt.Errorf("cover: parse regular font: %w", err)
	}
	mk := func(f *opentype.Font, size float64) (font.Face, error) {
		return opentype.NewFace(f, &opentype.FaceOptions{
			Size: size, DPI: 72, Hinting: font.HintingFull,
		})
	}
	var fs faceSet
	if fs.badge, err = mk(bold, 30); err != nil {
		return fs, err
	}
	if fs.tag, err = mk(reg, 19); err != nil {
		return fs, err
	}
	if fs.title, err = mk(bold, 46); err != nil {
		return fs, err
	}
	if fs.titleS, err = mk(bold, 35); err != nil {
		return fs, err
	}
	return fs, nil
}

func fill(img *image.RGBA, r image.Rectangle, c color.Color) {
	draw.Draw(img, r, &image.Uniform{c}, image.Point{}, draw.Src)
}

// drawGradient lays down the deep blue ground. The hue shifts a little per post
// so two covers side by side in a feed do not look identical.
func drawGradient(img *image.RGBA, r image.Rectangle, rng *rand.Rand) {
	tint := rng.Float64()*0.5 - 0.2 // -0.2 .. +0.3
	for y := r.Min.Y; y < r.Max.Y; y++ {
		t := float64(y-r.Min.Y) / float64(r.Dy())
		for x := r.Min.X; x < r.Max.X; x++ {
			// Diagonal blend so the light corner moves with the seed.
			d := (t*0.75 + float64(x)/float64(r.Dx())*0.25)
			c := color.RGBA{
				R: lerp8(navyDeep.R, navy.R, d),
				G: lerp8(navyDeep.G, navy.G, d),
				B: clamp8(float64(lerp8(navyDeep.B, navy.B, d)) * (1 + tint*0.35)),
				A: 0xFF,
			}
			img.SetRGBA(x, y, c)
		}
	}
}

// drawNetwork draws the connected-nodes motif the flyers use. Node positions
// come from the seed, so every post gets its own arrangement.
func drawNetwork(img *image.RGBA, r image.Rectangle, rng *rand.Rand) {
	type node struct{ x, y, rad float64 }
	n := 16 + rng.Intn(10)
	nodes := make([]node, 0, n)
	for i := 0; i < n; i++ {
		nodes = append(nodes, node{
			x:   float64(r.Min.X) + rng.Float64()*float64(r.Dx()),
			y:   float64(r.Min.Y) + rng.Float64()*float64(r.Dy()),
			rad: 3 + rng.Float64()*9,
		})
	}
	// Connect each node to its nearest neighbours, which reads as a network
	// rather than as scattered dots.
	for i, a := range nodes {
		for j, b := range nodes {
			if j <= i {
				continue
			}
			d := math.Hypot(a.x-b.x, a.y-b.y)
			if d > 230 {
				continue
			}
			alpha := uint8(70 * (1 - d/230))
			drawLine(img, r, a.x, a.y, b.x, b.y, color.RGBA{0x7F, 0xBF, 0xFF, alpha})
		}
	}
	for _, nd := range nodes {
		drawDisc(img, r, nd.x, nd.y, nd.rad, color.RGBA{0x9A, 0xD0, 0xFF, 0x8C})
		drawDisc(img, r, nd.x, nd.y, nd.rad*0.45, color.RGBA{0xFF, 0xFF, 0xFF, 0xB4})
	}
}

// drawGlow lifts one area of the ground toward a brighter blue, so the artwork
// has a light source instead of reading as a flat panel. Its position comes
// from the seed.
func drawGlow(img *image.RGBA, r image.Rectangle, rng *rand.Rand) {
	gx := float64(r.Min.X) + (0.35+rng.Float64()*0.4)*float64(r.Dx())
	gy := float64(r.Min.Y) + (0.25+rng.Float64()*0.4)*float64(r.Dy())
	rad := float64(r.Dx()) * (0.42 + rng.Float64()*0.15)
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			d := math.Hypot(float64(x)-gx, float64(y)-gy) / rad
			if d >= 1 {
				continue
			}
			f := (1 - d) * (1 - d)
			blend(img, x, y, color.RGBA{0x3E, 0x8B, 0xE6, uint8(95 * f)})
		}
	}
}

// drawVignette darkens the edges so the badge and tag stay legible over any
// arrangement of nodes.
func drawVignette(img *image.RGBA, r image.Rectangle) {
	cx, cy := float64(r.Dx())/2, float64(r.Dy())/2
	maxd := math.Hypot(cx, cy)
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			d := math.Hypot(float64(x)-cx, float64(y)-cy) / maxd
			if d < 0.55 {
				continue
			}
			a := uint8(math.Min(120, (d-0.55)*300))
			blend(img, x, y, color.RGBA{0x03, 0x08, 0x18, a})
		}
	}
}

func drawBadge(img *image.RGBA, f faceSet) {
	// Red block reading DIGITAL, then a white block reading MARKETING, the
	// same stacked pair the flyers open with. Both blocks are measured from the
	// text they hold: fixed widths let "MARKETING" run past its white block.
	const padX = 18
	dw := textWidth(f.badge, "DIGITAL")
	fill(img, image.Rect(38, 34, 38+dw+padX*2, 34+52), brandRed)
	drawText(img, f.badge, 38+padX, 34+37, "DIGITAL", white)

	// Three red ticks, then the word, inside one white block.
	const tickW, tickGap = 8, 6
	ticks := tickW*3 + tickGap*2
	mw := textWidth(f.badge, "MARKETING")
	x0 := 74
	fill(img, image.Rect(x0, 92, x0+padX+ticks+14+mw+padX, 92+52), white)
	for i := 0; i < 3; i++ {
		tx := x0 + padX + i*(tickW+tickGap)
		fill(img, image.Rect(tx, 104, tx+tickW, 104+28), brandRed)
	}
	drawText(img, f.badge, x0+padX+ticks+14, 92+37, "MARKETING", brandRed)
}

// tagText is the category strip under the artwork. It names the pillar, which
// is what the printed flyers put there.
func tagText(in Input) string {
	t := in.PillarSlug
	if t == "" {
		t = in.PillarTitle
	}
	t = strings.ToUpper(strings.TrimSpace(t))
	t = strings.ReplaceAll(t, " ", "-")
	if len(t) > 46 {
		t = strings.TrimRight(t[:46], "-")
	}
	return t
}

func drawTag(img *image.RGBA, f faceSet, text string, barTop int) {
	if text == "" {
		return
	}
	w := textWidth(f.tag, text)
	h := 38
	y := barTop - h - 22
	fill(img, image.Rect(38, y, 38+w+36, y+h), brandRed)
	drawText(img, f.tag, 56, y+h-12, text, white)
}

// drawTitle prints the post's own title in the white bar, wrapped to at most
// two lines and stepped down a size if the title is long.
func drawTitle(img *image.RGBA, f faceSet, title string, barTop int) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return fmt.Errorf("cover: empty title")
	}
	const leftPad, rightPad = 56, 150 // room for the mark on the right
	avail := Width - leftPad - rightPad

	face, lineH := f.title, 54
	lines := wrap(face, title, avail, 2)
	if len(lines) == 0 || overflows(face, lines, avail) {
		face, lineH = f.titleS, 42
		lines = wrap(face, title, avail, 2)
	}
	// Still too long to fit two lines: trim the last line with an ellipsis
	// rather than letting it run off the edge.
	if overflows(face, lines, avail) && len(lines) > 0 {
		lines[len(lines)-1] = ellipsize(face, lines[len(lines)-1], avail)
	}

	barH := Height - barTop
	block := len(lines) * lineH
	y := barTop + (barH-block)/2 + int(float64(lineH)*0.72)
	for _, ln := range lines {
		drawText(img, face, leftPad, y, ln, titleInk)
		y += lineH
	}
	return nil
}

// drawMark places the small round brand mark at the right of the title bar.
func drawMark(img *image.RGBA, barTop int) {
	cx, cy := float64(Width-86), float64(barTop+(Height-barTop)/2)
	drawDisc(img, img.Bounds(), cx, cy, 30, brandMint)
	// A simple upward chart stroke inside the disc.
	drawThickLine(img, cx-13, cy+8, cx-3, cy-3, 4, white)
	drawThickLine(img, cx-3, cy-3, cx+5, cy+3, 4, white)
	drawThickLine(img, cx+5, cy+3, cx+14, cy-9, 4, white)
}

func drawFrame(img *image.RGBA) {
	const t = 10
	fill(img, image.Rect(0, 0, Width, t), navyDeep)
	fill(img, image.Rect(0, Height-t, Width, Height), navyDeep)
	fill(img, image.Rect(0, 0, t, Height), navyDeep)
	fill(img, image.Rect(Width-t, 0, Width, Height), navyDeep)
}

// --- text helpers -----------------------------------------------------------

func drawText(img *image.RGBA, face font.Face, x, baseline int, s string, c color.Color) {
	d := &font.Drawer{
		Dst: img, Src: &image.Uniform{c}, Face: face,
		Dot: fixed.Point26_6{X: fixed.I(x), Y: fixed.I(baseline)},
	}
	d.DrawString(s)
}

func textWidth(face font.Face, s string) int {
	return font.MeasureString(face, s).Round()
}

// wrap breaks s into at most maxLines lines that each fit within width.
func wrap(face font.Face, s string, width, maxLines int) []string {
	words := strings.Fields(s)
	if len(words) == 0 {
		return nil
	}
	var lines []string
	cur := words[0]
	for _, w := range words[1:] {
		try := cur + " " + w
		if textWidth(face, try) <= width {
			cur = try
			continue
		}
		lines = append(lines, cur)
		if len(lines) == maxLines {
			// No room for another line: hand the rest back on the last line so
			// the caller can ellipsize it.
			lines[len(lines)-1] = cur + " " + strings.Join(remaining(words, w), " ")
			return lines
		}
		cur = w
	}
	return append(lines, cur)
}

func remaining(words []string, from string) []string {
	for i, w := range words {
		if w == from {
			return words[i:]
		}
	}
	return nil
}

func overflows(face font.Face, lines []string, width int) bool {
	for _, ln := range lines {
		if textWidth(face, ln) > width {
			return true
		}
	}
	return false
}

func ellipsize(face font.Face, s string, width int) string {
	if textWidth(face, s) <= width {
		return s
	}
	for len(s) > 1 {
		s = s[:len(s)-1]
		if textWidth(face, s+"…") <= width {
			return strings.TrimRight(s, " ,.;:-") + "…"
		}
	}
	return s
}

// --- drawing helpers --------------------------------------------------------

func lerp8(a, b uint8, t float64) uint8 {
	return clamp8(float64(a) + (float64(b)-float64(a))*t)
}

func clamp8(v float64) uint8 {
	if v <= 0 {
		return 0
	}
	if v >= 255 {
		return 255
	}
	return uint8(v)
}

// blend composites a straight-alpha colour over the pixel already there.
func blend(img *image.RGBA, x, y int, c color.RGBA) {
	if !(image.Point{x, y}).In(img.Bounds()) {
		return
	}
	dst := img.RGBAAt(x, y)
	a := float64(c.A) / 255
	img.SetRGBA(x, y, color.RGBA{
		R: clamp8(float64(c.R)*a + float64(dst.R)*(1-a)),
		G: clamp8(float64(c.G)*a + float64(dst.G)*(1-a)),
		B: clamp8(float64(c.B)*a + float64(dst.B)*(1-a)),
		A: 0xFF,
	})
}

func drawDisc(img *image.RGBA, clip image.Rectangle, cx, cy, r float64, c color.RGBA) {
	x0, x1 := int(cx-r-1), int(cx+r+1)
	y0, y1 := int(cy-r-1), int(cy+r+1)
	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			if !(image.Point{x, y}).In(clip) {
				continue
			}
			d := math.Hypot(float64(x)-cx, float64(y)-cy)
			if d > r+0.5 {
				continue
			}
			// Feather the last half pixel so the dots are not stair-stepped.
			cc := c
			if d > r-0.5 {
				cc.A = uint8(float64(c.A) * (r + 0.5 - d))
			}
			blend(img, x, y, cc)
		}
	}
}

func drawLine(img *image.RGBA, clip image.Rectangle, x0, y0, x1, y1 float64, c color.RGBA) {
	steps := int(math.Hypot(x1-x0, y1-y0))
	if steps == 0 {
		return
	}
	for i := 0; i <= steps; i++ {
		t := float64(i) / float64(steps)
		x, y := x0+(x1-x0)*t, y0+(y1-y0)*t
		if (image.Point{int(x), int(y)}).In(clip) {
			blend(img, int(x), int(y), c)
		}
	}
}

func drawThickLine(img *image.RGBA, x0, y0, x1, y1, w float64, c color.RGBA) {
	steps := int(math.Hypot(x1-x0, y1-y0) * 2)
	if steps == 0 {
		return
	}
	for i := 0; i <= steps; i++ {
		t := float64(i) / float64(steps)
		drawDisc(img, img.Bounds(), x0+(x1-x0)*t, y0+(y1-y0)*t, w/2, c)
	}
}

// AltText describes the cover for screen readers and for image search. It
// names what the picture actually shows: the post's own title on the Nepal
// Fillings cover, within its pillar series.
func AltText(in Input) string {
	pillar := strings.TrimSpace(in.PillarTitle)
	alt := fmt.Sprintf("Nepal Fillings cover graphic titled %q", strings.TrimSpace(in.Title))
	if pillar != "" {
		alt += ", from the " + pillar + " series"
	}
	if len(alt) > 125 {
		// Drop the series clause before truncating mid-word.
		alt = fmt.Sprintf("Nepal Fillings cover graphic titled %q", strings.TrimSpace(in.Title))
	}
	if len(alt) > 125 {
		alt = strings.TrimRight(alt[:124], " ,.;:-\"") + "\""
	}
	return alt
}
