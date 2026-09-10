package config

import (
	"strings"
	"testing"
)

// prodEnv is the minimum set of variables a production boot must supply.
func prodEnv(t *testing.T) {
	t.Helper()
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("DATABASE_URL", "postgres://u:p@db:5432/app?sslmode=disable")
	t.Setenv("REDIS_URL", "redis://redis:6379/0")
	t.Setenv("LISTMONK_API_URL", "http://listmonk:9000/api")
	t.Setenv("LISTMONK_ADMIN_PASSWORD", "a-real-password")
}

func TestLoadRequiresJWTSecret(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "")

	if _, err := Load(); err == nil {
		t.Fatal("expected Load to fail without JWT_SECRET, got nil error")
	}
}

func TestLoadUsesDevDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("development boot should succeed on defaults: %v", err)
	}
	if cfg.IsProduction() {
		t.Error("APP_ENV=development should not be treated as production")
	}
	if cfg.ListmonkPassword != "admin" {
		t.Errorf("expected dev default listmonk password %q, got %q", "admin", cfg.ListmonkPassword)
	}
}

func TestLoadProductionRejectsMissingVars(t *testing.T) {
	for _, missing := range []string{"DATABASE_URL", "REDIS_URL", "LISTMONK_API_URL", "LISTMONK_ADMIN_PASSWORD"} {
		t.Run(missing, func(t *testing.T) {
			prodEnv(t)
			t.Setenv(missing, "")

			_, err := Load()
			if err == nil {
				t.Fatalf("expected production boot to fail when %s is unset", missing)
			}
			if !strings.Contains(err.Error(), missing) {
				t.Errorf("error should name %s, got: %v", missing, err)
			}
		})
	}
}

func TestLoadProductionRejectsDefaultListmonkPassword(t *testing.T) {
	prodEnv(t)
	t.Setenv("LISTMONK_ADMIN_PASSWORD", "admin")

	_, err := Load()
	if err == nil {
		t.Fatal("expected production boot to reject the default admin password")
	}
	if !strings.Contains(err.Error(), "LISTMONK_ADMIN_PASSWORD") {
		t.Errorf("error should name LISTMONK_ADMIN_PASSWORD, got: %v", err)
	}
}

func TestLoadProductionSucceedsWhenFullyConfigured(t *testing.T) {
	prodEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("fully configured production boot should succeed: %v", err)
	}
	if !cfg.IsProduction() {
		t.Error("APP_ENV=production should be treated as production")
	}
}

func TestIsProduction(t *testing.T) {
	cases := map[string]bool{
		"production":  true,
		"":            true, // unknown values fail safe to production
		"staging":     true,
		"development": false,
		"dev":         false,
		"test":        false,
		"local":       false,
	}
	for appEnv, want := range cases {
		if got := (&Config{AppEnv: appEnv}).IsProduction(); got != want {
			t.Errorf("IsProduction(%q) = %v, want %v", appEnv, got, want)
		}
	}
}
