package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	_ "github.com/lib/pq"
)

// runAPIKeyAuth sends one request with the given Authorization header through
// APIKeyAuth and reports the status, whether the handler behind it ran, and the
// Retry-After header.
func runAPIKeyAuth(t *testing.T, db *sqlx.DB, authorization string) (int, bool, string) {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/email/send", nil)
	req.Header.Set("Authorization", authorization)

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	reached := false
	handler := APIKeyAuth(db, "email")(func(c echo.Context) error {
		reached = true

		return c.NoContent(http.StatusOK)
	})

	if err := handler(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}

	return rec.Code, reached, rec.Header().Get("Retry-After")
}

// When the database cannot be reached the key cannot be checked, which says
// nothing about the key. This needs no database: it points at a port nothing
// listens on.
func TestAPIKeyAuthAnswers503WhenTheDatabaseIsDown(t *testing.T) {
	db, err := sqlx.Open("postgres", "postgres://u:p@127.0.0.1:1/none?sslmode=disable&connect_timeout=2")
	if err != nil {
		t.Fatalf("opening: %v", err)
	}
	defer db.Close()

	code, reached, retry := runAPIKeyAuth(t, db, "Bearer nf_email_a8f3Kx9mRESTOFTHEKEY")

	if code != http.StatusServiceUnavailable || reached || retry == "" {
		t.Errorf("database down: status %d, handler reached %v, Retry-After %q; want 503 with Retry-After "+
			"and nothing sent — a 401 tells the caller its valid key is wrong", code, reached, retry)
	}
}

// apiKeyTestDB builds the API tables from the real migration in a schema of its
// own inside WA_TEST_DSN, the same disposable database the WhatsApp tests use.
func apiKeyTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	dsn := os.Getenv("WA_TEST_DSN")
	if dsn == "" {
		t.Skip("set WA_TEST_DSN to a disposable Postgres database to run the API key database tests")
	}

	admin, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("connecting to WA_TEST_DSN: %v", err)
	}

	schema := fmt.Sprintf("apikey_test_%d", time.Now().UnixNano())
	admin.MustExec("CREATE SCHEMA " + schema)

	t.Cleanup(func() {
		admin.Exec("DROP SCHEMA " + schema + " CASCADE")
		admin.Close()
	})

	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("WA_TEST_DSN must be a postgres:// URL")
	}

	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()

	db, err := sqlx.Connect("postgres", u.String())
	if err != nil {
		t.Fatalf("connecting with search_path: %v", err)
	}

	t.Cleanup(func() { db.Close() })

	db.MustExec(`CREATE TABLE app_accounts (id SERIAL PRIMARY KEY)`)

	migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", "014_public_api.up.sql"))
	if err != nil {
		t.Fatalf("reading migration: %v", err)
	}

	if _, err := db.Exec(string(migration)); err != nil {
		t.Fatalf("applying migration 014: %v", err)
	}

	return db
}

func TestAPIKeyAuthTellsAMissingKeyFromAMissingDatabase(t *testing.T) {
	db := apiKeyTestDB(t)

	const key = "nf_email_a8f3Kx9mRESTOFTHEKEY"

	sum := sha256.Sum256([]byte(key))

	var account int
	db.Get(&account, `INSERT INTO app_accounts (api_enabled) VALUES (true) RETURNING id`)
	db.MustExec(`INSERT INTO api_keys (account_id, channel, key_hash, key_prefix) VALUES ($1, 'email', $2, $3)`,
		account, hex.EncodeToString(sum[:]), extractPrefix(key))

	if code, reached, _ := runAPIKeyAuth(t, db, "Bearer "+key); code != http.StatusOK || !reached {
		t.Errorf("valid key: status %d, handler reached %v; want it let through", code, reached)
	}

	if code, reached, _ := runAPIKeyAuth(t, db, "Bearer nf_email_zzzzzzzzUNKNOWNKEY"); code != http.StatusUnauthorized || reached {
		t.Errorf("unknown key: status %d, handler reached %v; want 401", code, reached)
	}

	// The key is found but the account cannot be read: still the database, not
	// the account having API access switched off.
	db.MustExec(`ALTER TABLE app_accounts DROP COLUMN api_enabled`)

	if code, reached, retry := runAPIKeyAuth(t, db, "Bearer "+key); code != http.StatusServiceUnavailable || reached || retry == "" {
		t.Errorf("account unreadable: status %d, handler reached %v, Retry-After %q; want 503", code, reached, retry)
	}
}
