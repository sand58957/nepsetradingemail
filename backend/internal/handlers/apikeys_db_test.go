package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// apiKeysTestDB is a disposable schema with the public API tables, built from the
// real migrations (see waTestDB for WA_TEST_DSN).
func apiKeysTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	db := waTestDB(t)

	for _, f := range []string{"014_public_api.up.sql", "035_api_key_soft_delete.up.sql", "036_api_key_whatsapp_number.up.sql"} {
		migration, err := os.ReadFile(filepath.Join("..", "database", "migrations", f))
		if err != nil {
			t.Fatalf("reading migration %s: %v", f, err)
		}

		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatalf("applying migration %s: %v", f, err)
		}
	}

	return db
}

// What was reported on 30 September 2026: deleting a WhatsApp key that had ever
// sent a message failed with a 500, because api_messages still refers to it. Now
// it is deleted — gone from the list, unable to authenticate, no longer counted
// toward the limit — and the messages it sent keep their history.
func TestDeletingAKeyThatHasSentMessages(t *testing.T) {
	db := apiKeysTestDB(t)
	h := NewAPIKeyHandler(db)

	var account int
	db.Get(&account, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	db.MustExec(`UPDATE app_accounts SET api_enabled = true WHERE id = $1`, account)

	const rawKey = "nf_whatsapp_a8f3Kx9mRESTOFTHEKEY"

	sum := sha256.Sum256([]byte(rawKey))

	var keyID int
	db.Get(&keyID, `INSERT INTO api_keys (account_id, channel, key_hash, key_prefix, name)
		VALUES ($1, 'whatsapp', $2, 'nf_whatsapp_a8f3Kx9m', 'used key') RETURNING id`,
		account, hex.EncodeToString(sum[:]))
	db.MustExec(`INSERT INTO api_messages (account_id, api_key_id, channel, "to") VALUES ($1, $2, 'whatsapp', '9800000000')`,
		account, keyID)

	code, body := waServe(t, h.DeleteKey, http.MethodDelete, "/", nil, "", account, fmt.Sprint(keyID))
	if code != http.StatusOK {
		t.Fatalf("deleting a key that has sent messages: status %d, body %v", code, body)
	}

	// Gone from the account's list.
	code, body = waServe(t, h.ListKeys, http.MethodGet, "/?channel=whatsapp", nil, "", account, "")
	if keys, _ := body["data"].([]interface{}); code != http.StatusOK || len(keys) != 0 {
		t.Errorf("after deleting, the list shows %v (status %d), want no keys", body["data"], code)
	}

	// The message it sent is still on record.
	var messages int
	db.Get(&messages, `SELECT COUNT(*) FROM api_messages WHERE api_key_id = $1`, keyID)

	if messages != 1 {
		t.Errorf("%d messages left for the deleted key, want its 1 message kept", messages)
	}

	// Deleting it again is "not found", not a second success.
	if code, _ := waServe(t, h.DeleteKey, http.MethodDelete, "/", nil, "", account, fmt.Sprint(keyID)); code != http.StatusNotFound {
		t.Errorf("deleting an already-deleted key: status %d, want 404", code)
	}

	// It can't be switched back on.
	if code, _ := waServe(t, h.ToggleKey, http.MethodPut, "/", nil, "", account, fmt.Sprint(keyID)); code != http.StatusNotFound {
		t.Errorf("toggling a deleted key: status %d, want 404", code)
	}
}

// Deleted keys no longer count toward the limit of five per channel, so an
// account can replace old keys.
func TestDeletedKeysDoNotCountTowardTheLimit(t *testing.T) {
	db := apiKeysTestDB(t)
	h := NewAPIKeyHandler(db)

	var account int
	db.Get(&account, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)

	create := func() int {
		code, _ := waServe(t, h.CreateKey, http.MethodPost, "/", strings.NewReader(`{"channel":"whatsapp","name":"k"}`),
			echo.MIMEApplicationJSON, account, "")

		return code
	}

	for i := 0; i < 5; i++ {
		if code := create(); code != http.StatusOK && code != http.StatusCreated {
			t.Fatalf("creating key %d: status %d", i+1, code)
		}
	}

	if code := create(); code != http.StatusBadRequest {
		t.Fatalf("a sixth key: status %d, want 400 at the limit", code)
	}

	var oldest int
	db.Get(&oldest, `SELECT MIN(id) FROM api_keys WHERE account_id = $1`, account)

	if code, _ := waServe(t, h.DeleteKey, http.MethodDelete, "/", nil, "", account, fmt.Sprint(oldest)); code != http.StatusOK {
		t.Fatalf("deleting a key: status %d", code)
	}

	if code := create(); code != http.StatusOK && code != http.StatusCreated {
		t.Errorf("after deleting one key, creating another: status %d, want it allowed", code)
	}
}

// One account can't delete another account's key.
func TestDeletingAnotherAccountsKeyIsNotFound(t *testing.T) {
	db := apiKeysTestDB(t)
	h := NewAPIKeyHandler(db)

	var mine, theirs, keyID int
	db.Get(&mine, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	db.Get(&theirs, `INSERT INTO app_accounts DEFAULT VALUES RETURNING id`)
	db.Get(&keyID, `INSERT INTO api_keys (account_id, channel, key_hash, key_prefix)
		VALUES ($1, 'sms', 'x', 'nf_sms_zzzzzzzz') RETURNING id`, theirs)

	if code, _ := waServe(t, h.DeleteKey, http.MethodDelete, "/", nil, "", mine, fmt.Sprint(keyID)); code != http.StatusNotFound {
		t.Errorf("deleting another account's key: status %d, want 404", code)
	}

	var deleted bool
	db.Get(&deleted, `SELECT deleted_at IS NOT NULL FROM api_keys WHERE id = $1`, keyID)

	if deleted {
		t.Error("another account's key was deleted")
	}
}
