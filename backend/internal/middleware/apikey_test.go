package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestExtractPrefix(t *testing.T) {
	cases := []struct {
		name string
		key  string
		want string
	}{
		{"live key", "nf_sms_a8f3Kx9mRESTOFTHEKEY", "nf_sms_a8f3Kx9m"},
		{"test key", "nf_test_sms_a8f3Kx9mRESTOFTHEKEY", "nf_test_sms_a8f3Kx9m"},
		{"random part shorter than 8", "nf_sms_abc", "nf_sms_abc"},
		{"too few segments", "nf_sms", ""},
		{"test with too few segments", "nf_test_sms", ""},
		{"empty", "", ""},
		{"no random part", "nf_sms_", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := extractPrefix(tc.key); got != tc.want {
				t.Errorf("extractPrefix(%q) = %q, want %q", tc.key, got, tc.want)
			}
		})
	}
}

// Two keys sharing a prefix must not collide: the prefix is only a lookup
// handle, the full-key hash is what actually authenticates.
func TestExtractPrefixIsStableForSharedPrefixes(t *testing.T) {
	a := extractPrefix("nf_sms_a8f3Kx9mAAAAAAAA")
	b := extractPrefix("nf_sms_a8f3Kx9mBBBBBBBB")

	if a != b {
		t.Fatalf("keys sharing a prefix should extract the same prefix: %q vs %q", a, b)
	}
	if a != "nf_sms_a8f3Kx9m" {
		t.Errorf("unexpected prefix %q", a)
	}
}

func TestRedactKeyHidesSecret(t *testing.T) {
	key := "nf_sms_a8f3Kx9mSUPERSECRETTAIL"

	got := redactKey(key)
	if strings.Contains(got, "SUPERSECRETTAIL") {
		t.Errorf("redactKey leaked the secret tail: %q", got)
	}
	if !strings.HasPrefix(got, "nf_sms_a8f3") {
		t.Errorf("redactKey should keep a short prefix for correlation, got %q", got)
	}
}

func TestRedactKeyShortInput(t *testing.T) {
	// Short values are returned as-is; they are too small to be a real key.
	if got := redactKey("nf_sms"); got != "nf_sms" {
		t.Errorf("redactKey(%q) = %q, want unchanged", "nf_sms", got)
	}
}

func TestRequireRole(t *testing.T) {
	cases := []struct {
		name     string
		role     string
		allowed  []string
		wantCode int
	}{
		{"exact match", "admin", []string{"admin"}, http.StatusOK},
		{"one of several", "user", []string{"superadmin", "admin", "user"}, http.StatusOK},
		{"not allowed", "user", []string{"admin"}, http.StatusForbidden},
		{"no role on context", "", []string{"admin"}, http.StatusForbidden},
		{"empty allowlist denies", "admin", nil, http.StatusForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			c := e.NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())
			if tc.role != "" {
				c.Set("user_role", tc.role)
			}

			h := RequireRole(tc.allowed...)(func(c echo.Context) error {
				return c.NoContent(http.StatusOK)
			})
			if err := h(c); err != nil {
				e.HTTPErrorHandler(err, c)
			}

			if got := c.Response().Status; got != tc.wantCode {
				t.Errorf("status = %d, want %d", got, tc.wantCode)
			}
		})
	}
}
