package handlers

import "testing"

// A UTF-8 byte-order mark is invisible in every editor but makes the first
// header cell compare unequal to its own name, so a CSV that plainly has a
// phone column gets rejected for not having one. This was the reported failure.
func TestNormaliseCSVHeaderStripsBOM(t *testing.T) {
	colMap, names := normaliseCSVHeader([]string{"\ufeffphone", "Name", " EMAIL ", `"tags"`})

	for _, want := range []string{"phone", "name", "email", "tags"} {
		if _, ok := colMap[want]; !ok {
			t.Errorf("column %q not found; header read as %v", want, names)
		}
	}

	if names[0] != "phone" {
		t.Errorf("first column normalised to %q, want %q", names[0], "phone")
	}
}

func TestSniffDelimiter(t *testing.T) {
	cases := []struct {
		line string
		want rune
	}{
		{"phone,name,email", ','},
		{"phone;name;email", ';'},    // Excel in many European locales
		{"phone\tname\temail", '\t'}, // tab-separated export
		{"phone", ','},               // single column: comma is a safe default
	}

	for _, c := range cases {
		if got := sniffDelimiter([]byte(c.line)); got != c.want {
			t.Errorf("sniffDelimiter(%q) = %q, want %q", c.line, got, c.want)
		}
	}
}

// Duplicate headers must not shadow the first occurrence, which is the one the
// row values line up with.
func TestNormaliseCSVHeaderKeepsFirstOfDuplicates(t *testing.T) {
	colMap, _ := normaliseCSVHeader([]string{"phone", "name", "phone"})

	if colMap["phone"] != 0 {
		t.Errorf("duplicate 'phone' resolved to index %d, want 0", colMap["phone"])
	}
}
