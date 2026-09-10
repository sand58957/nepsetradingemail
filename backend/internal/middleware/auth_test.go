package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

const testSecret = "test-jwt-secret"

func signToken(t *testing.T, claims JWTClaims, method jwt.SigningMethod, secret interface{}) string {
	t.Helper()
	tok := jwt.NewWithClaims(method, claims)
	s, err := tok.SignedString(secret)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}
	return s
}

func accessClaims() JWTClaims {
	return JWTClaims{
		UserID: 7, Email: "u@example.com", Role: "admin", AccountID: 3, Type: "access",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
}

// run sends a request through JWTAuth and reports the resulting status.
func run(t *testing.T, authHeader string) (int, echo.Context) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	h := JWTAuth(testSecret)(func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})
	if err := h(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}
	return rec.Code, c
}

func TestJWTAuthAcceptsValidAccessToken(t *testing.T) {
	tok := signToken(t, accessClaims(), jwt.SigningMethodHS256, []byte(testSecret))

	status, c := run(t, "Bearer "+tok)
	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}
	if got := GetUserID(c); got != 7 {
		t.Errorf("GetUserID = %d, want 7", got)
	}
	if got := GetUserRole(c); got != "admin" {
		t.Errorf("GetUserRole = %q, want admin", got)
	}
	if got := GetAccountID(c); got != 3 {
		t.Errorf("GetAccountID = %d, want 3", got)
	}
}

func TestJWTAuthRejectsBadHeaders(t *testing.T) {
	tok := signToken(t, accessClaims(), jwt.SigningMethodHS256, []byte(testSecret))

	for name, header := range map[string]string{
		"missing":      "",
		"no scheme":    tok,
		"wrong scheme": "Basic " + tok,
		"empty token":  "Bearer ",
	} {
		t.Run(name, func(t *testing.T) {
			if status, _ := run(t, header); status != http.StatusUnauthorized {
				t.Errorf("expected 401 for %q, got %d", name, status)
			}
		})
	}
}

func TestJWTAuthRejectsWrongSecret(t *testing.T) {
	tok := signToken(t, accessClaims(), jwt.SigningMethodHS256, []byte("someone-elses-secret"))

	if status, _ := run(t, "Bearer "+tok); status != http.StatusUnauthorized {
		t.Errorf("expected 401 for token signed with a different secret, got %d", status)
	}
}

func TestJWTAuthRejectsExpiredToken(t *testing.T) {
	claims := accessClaims()
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute))
	tok := signToken(t, claims, jwt.SigningMethodHS256, []byte(testSecret))

	if status, _ := run(t, "Bearer "+tok); status != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", status)
	}
}

// A refresh token must not be usable as an access token.
func TestJWTAuthRejectsNonAccessTokenType(t *testing.T) {
	claims := accessClaims()
	claims.Type = "refresh"
	tok := signToken(t, claims, jwt.SigningMethodHS256, []byte(testSecret))

	if status, _ := run(t, "Bearer "+tok); status != http.StatusUnauthorized {
		t.Errorf("expected 401 for refresh token, got %d", status)
	}
}

// The middleware pins HMAC, so an unsigned "alg: none" token must be refused.
func TestJWTAuthRejectsAlgNone(t *testing.T) {
	tok := signToken(t, accessClaims(), jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType)

	if status, _ := run(t, "Bearer "+tok); status != http.StatusUnauthorized {
		t.Errorf("expected 401 for alg=none token, got %d", status)
	}
}

func TestGettersReturnZeroValuesWhenUnset(t *testing.T) {
	c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())

	if GetUserID(c) != 0 || GetAccountID(c) != 0 {
		t.Error("expected 0 IDs on a context with no claims")
	}
	if GetUserEmail(c) != "" || GetUserRole(c) != "" {
		t.Error("expected empty strings on a context with no claims")
	}
}
