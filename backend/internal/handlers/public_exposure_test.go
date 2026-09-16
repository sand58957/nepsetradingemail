package handlers

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

// The public post endpoint used to serialise the whole author row, which put the
// lead author's personal email address on every post in the open API. The public
// shape must never carry private or internal author fields.
func TestPublicAuthorShapeHasNoPrivateFields(t *testing.T) {
	forbidden := map[string]bool{"email": true, "id": true, "account_id": true, "eeat_score": true, "is_active": true}

	typ := reflect.TypeOf(PublicBlogAuthor{})
	for i := 0; i < typ.NumField(); i++ {
		name := strings.Split(typ.Field(i).Tag.Get("json"), ",")[0]
		if forbidden[name] {
			t.Errorf("PublicBlogAuthor exposes %q; the public API must not publish it", name)
		}
	}

	author := &BlogAuthor{Name: "A", Slug: "a", Email: "private@example.com", AccountID: 20}
	if got := toPublicAuthor(author); got.Name != "A" || got.Slug != "a" {
		t.Errorf("toPublicAuthor lost the public fields: %+v", got)
	}
}

func handlerSource(t *testing.T, file, start string, length int) string {
	t.Helper()

	src, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("reading %s: %v", file, err)
	}

	body := string(src)

	at := strings.Index(body, start)
	if at < 0 {
		t.Fatalf("%q not found in %s", start, file)
	}

	return body[at:min(at+length, len(body))]
}

// Stored citations are mostly invented report titles pointing at a regulator's
// homepage. Until someone checks them, the public post payload must not carry them.
func TestPublicPostDoesNotPublishCitations(t *testing.T) {
	body := handlerSource(t, "blog.go", "func (h *BlogHandler) PublicGetPost", 4000)

	if !strings.Contains(body, "post.SourceCitations = json.RawMessage(`[]`)") {
		t.Error("PublicGetPost no longer blanks source_citations before responding")
	}

	if !strings.Contains(body, `"author": toPublicAuthor(author)`) {
		t.Error("PublicGetPost returns the author without going through toPublicAuthor")
	}
}

// These settings rows are global, and include provider credentials. Any signed-up
// user could read them all and rewrite site-wide values such as the public
// WhatsApp widget number.
func TestAccountSettingsAreAdminOnly(t *testing.T) {
	src, err := os.ReadFile("../server/routes.go")
	if err != nil {
		t.Fatalf("reading routes.go: %v", err)
	}

	routes := string(src)

	if strings.Contains(routes, `staff.Group("/account-settings")`) ||
		!strings.Contains(routes, `accountSettings := admin.Group("/account-settings")`) {
		t.Error("account-settings routes must be mounted on the admin group")
	}

	list := handlerSource(t, "account_settings.go", "func (h *AccountSettingsHandler) GetAll", 900)
	if !strings.Contains(list, "WHERE key = ANY($1)") {
		t.Error("GetAll must return only the known settings keys, never sendgrid_config")
	}
}
