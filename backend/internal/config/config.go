package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port                int
	DatabaseURL         string
	RedisURL            string
	ListmonkAPIURL      string
	ListmonkUser        string
	ListmonkPassword    string
	JWTSecret           string
	JWTExpiry           int // in hours
	RefreshExpiry       int // in hours
	FrontendURL         string
	SendGridAPIKey      string
	TelegramBotToken    string
	BunnyCDNStorageURL  string
	BunnyCDNStorageZone string
	BunnyCDNStorageKey  string
	BunnyCDNPullURL     string
	GoogleClientID      string
	GoogleClientSecret  string
	AakashOTPToken      string
	// OpenWA is the self-hosted WhatsApp gateway that replaced Gupshup. It runs
	// on the internal Docker network with no published port, so BaseURL is a
	// service name rather than a public URL.
	OpenWABaseURL     string
	OpenWAAPIKey      string
	GlitchTipDSN      string
	AppEnv            string
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicBaseURL   string
}

func Load() (*Config, error) {
	port, err := strconv.Atoi(getEnv("PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid PORT: %w", err)
	}

	jwtExpiry, err := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRY_HOURS: %w", err)
	}

	refreshExpiry, err := strconv.Atoi(getEnv("REFRESH_EXPIRY_HOURS", "168"))
	if err != nil {
		return nil, fmt.Errorf("invalid REFRESH_EXPIRY_HOURS: %w", err)
	}

	cfg := &Config{
		Port:                port,
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://listmonk:listmonk@localhost:5432/listmonk?sslmode=disable"),
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379/0"),
		ListmonkAPIURL:      getEnv("LISTMONK_API_URL", "http://localhost:9000/api"),
		ListmonkUser:        getEnv("LISTMONK_ADMIN_USER", "admin"),
		ListmonkPassword:    getEnv("LISTMONK_ADMIN_PASSWORD", "admin"),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		JWTExpiry:           jwtExpiry,
		RefreshExpiry:       refreshExpiry,
		FrontendURL:         getEnv("FRONTEND_URL", "https://nepalfillings.com"),
		SendGridAPIKey:      getEnv("SENDGRID_API_KEY", ""),
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", ""),
		BunnyCDNStorageURL:  getEnv("BUNNY_CDN_STORAGE_URL", "https://sg.storage.bunnycdn.com"),
		BunnyCDNStorageZone: getEnv("BUNNY_CDN_STORAGE_ZONE", "nepalfilling"),
		BunnyCDNStorageKey:  getEnv("BUNNY_CDN_STORAGE_KEY", ""),
		BunnyCDNPullURL:     getEnv("BUNNY_CDN_PULL_URL", "https://my-pull-zone-name-nepalfilling.b-cdn.net"),
		GoogleClientID:      getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:  getEnv("GOOGLE_CLIENT_SECRET", ""),
		AakashOTPToken:      getEnv("AAKASH_OTP_TOKEN", ""),
		OpenWABaseURL:       getEnv("OPENWA_BASE_URL", "http://openwa-api:2785"),
		OpenWAAPIKey:        getEnv("OPENWA_API_KEY", ""),
		GlitchTipDSN:        getEnv("GLITCHTIP_DSN", ""),
		AppEnv:              getEnv("APP_ENV", "production"),
		R2AccountID:         getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:       getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:   getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2Bucket:            getEnv("R2_BUCKET", "nepalfillings-images"),
		R2PublicBaseURL:     getEnv("R2_PUBLIC_BASE_URL", "https://cdn.nepalfillings.com"),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	// The defaults above exist so a developer can `go run ./cmd/server` against
	// docker-compose.local.yml without a .env. They are unsafe in production, so
	// refuse to boot rather than silently connecting with admin/admin or to a
	// localhost database that isn't there.
	if cfg.IsProduction() {
		for _, required := range []struct{ name, value string }{
			{"DATABASE_URL", os.Getenv("DATABASE_URL")},
			{"REDIS_URL", os.Getenv("REDIS_URL")},
			{"LISTMONK_API_URL", os.Getenv("LISTMONK_API_URL")},
			{"LISTMONK_ADMIN_PASSWORD", os.Getenv("LISTMONK_ADMIN_PASSWORD")},
		} {
			if required.value == "" {
				return nil, fmt.Errorf("%s environment variable is required when APP_ENV=%s", required.name, cfg.AppEnv)
			}
		}

		if cfg.ListmonkPassword == "admin" {
			return nil, fmt.Errorf("LISTMONK_ADMIN_PASSWORD must not be the default \"admin\" when APP_ENV=%s", cfg.AppEnv)
		}
	}

	return cfg, nil
}

// IsProduction reports whether the app is running with production defaults.
// APP_ENV itself defaults to "production", so anything that isn't an explicit
// development/test/local value is treated as production.
func (c *Config) IsProduction() bool {
	switch c.AppEnv {
	case "development", "dev", "test", "local":
		return false
	default:
		return true
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
