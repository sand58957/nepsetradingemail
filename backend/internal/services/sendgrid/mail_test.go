package sendgrid

import "testing"

func TestMaskEmailHidesTheAddress(t *testing.T) {
	cases := map[string]string{
		"binaykhatri1@gmail.com": "b***@gmail.com",
		"a@x.com":                "a***@x.com",
		"no-at-sign":             "***",
		"@gmail.com":             "***",
		"":                       "***",
	}

	for in, want := range cases {
		if got := maskEmail(in); got != want {
			t.Errorf("maskEmail(%q) = %q, want %q", in, got, want)
		}
	}
}
