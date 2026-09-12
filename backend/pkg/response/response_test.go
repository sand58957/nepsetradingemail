package response

import "testing"

// The blog index decides whether to render pagination links from total_pages.
// The field did not exist, so it was always zero and 1,381 of 1,393 posts had
// no internal link pointing at them.
func TestTotalPages(t *testing.T) {
	cases := []struct {
		total, perPage, want int
	}{
		{1393, 12, 117}, // the live blog: must be > 1 so links render
		{12, 12, 1},
		{13, 12, 2},
		{0, 12, 0},
		{5, 0, 0},   // guard against divide-by-zero
		{-1, 12, 0}, // nonsense input must not produce a negative page count
	}
	for _, c := range cases {
		if got := TotalPages(c.total, c.perPage); got != c.want {
			t.Errorf("TotalPages(%d, %d) = %d, want %d", c.total, c.perPage, got, c.want)
		}
	}
}
