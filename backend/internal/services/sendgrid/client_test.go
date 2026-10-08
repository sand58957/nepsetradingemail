package sendgrid

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// After the key is changed to another SendGrid account, the domain ids saved under
// the old one are unknown. That has to be told apart from SendGrid refusing the
// key, which says nothing about where the domain lives.
func TestADomainFromAnotherAccountIsNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/whitelabel/domains/5":
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"errors":[{"message":"authenticated domain not found"}]}`))
		case "/whitelabel/domains/6/validate":
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"errors":[{"field":null,"message":"Authenticated domain not found."}]}`))
		default:
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"errors":[{"field":null,"message":"access forbidden"}]}`))
		}
	}))
	defer srv.Close()
	defer OverrideAPIBaseForTest(srv.URL)()

	c := NewClient("test-key")

	if _, err := c.GetDomainAuth(5); !errors.Is(err, ErrNotFound) {
		t.Errorf("404 looking a domain up: got %v, want ErrNotFound", err)
	}

	if _, err := c.ValidateDomain(6); !errors.Is(err, ErrNotFound) {
		t.Errorf("400 \"not found\" validating: got %v, want ErrNotFound", err)
	}

	if _, err := c.GetDomainAuth(7); err == nil || errors.Is(err, ErrNotFound) {
		t.Errorf("403: got %v, want an error that is not ErrNotFound", err)
	}
}

func TestFindDomainAuthPrefersAValidatedSetup(t *testing.T) {
	var query string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query().Get("domain")

		w.Write([]byte(`[
			{"id": 1, "domain": "other.com", "valid": true},
			{"id": 2, "domain": "Example.com", "valid": false},
			{"id": 3, "domain": "example.com", "valid": true},
			{"id": 4, "domain": "example.com", "valid": false}
		]`))
	}))
	defer srv.Close()
	defer OverrideAPIBaseForTest(srv.URL)()

	c := NewClient("test-key")

	found, err := c.FindDomainAuth("example.com")
	if err != nil || found == nil || found.ID != 3 {
		t.Fatalf("got %+v, %v; want setup 3, the validated one", found, err)
	}

	if query != "example.com" {
		t.Errorf("asked SendGrid for domain %q, want example.com", query)
	}

	if found, err := c.FindDomainAuth("missing.com"); err != nil || found != nil {
		t.Errorf("domain without a setup: got %+v, %v; want nil, nil", found, err)
	}
}
