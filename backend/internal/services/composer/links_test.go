package composer

import (
	"strings"
	"testing"
)

// Generated posts used to link a theme's demo pricing page (a USD form-builder with
// a card form behind it) and a redirect hop. Every route must be a clean public URL.
func TestPublicRoutesNeverPointAtTemplatePages(t *testing.T) {
	for key, url := range publicRoutes {
		if strings.HasPrefix(url, "/front-pages/") {
			t.Errorf("route %q = %q; generated posts must not link /front-pages/ URLs", key, url)
		}
	}

	if Route("help-center") != "" {
		t.Error("the help centre is still a theme demo and must not be linked")
	}
}
