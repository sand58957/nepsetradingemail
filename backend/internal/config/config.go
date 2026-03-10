package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port             int
	DatabaseURL      string
	RedisURL         string
	ListmonkAPIURL   string
	ListmonkUser     string
	ListmonkPassword string
	JWTSecret        string
	JWTExpiry        int // in hours
	RefreshExpiry    int // in hours
	FrontendURL      string
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
		Port:             port,
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://listmonk:listmonk@localhost:5432/listmonk?sslmode=disable"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/0"),
		ListmonkAPIURL:   getEnv("LISTMONK_API_URL", "http://localhost:9000/api"),
		ListmonkUser:     getEnv("LISTMONK_ADMIN_USER", "admin"),
		ListmonkPassword: getEnv("LISTMONK_ADMIN_PASSWORD", "admin"),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		JWTExpiry:        jwtExpiry,
		RefreshExpiry:    refreshExpiry,
		FrontendURL:      getEnv("FRONTEND_URL", "https://nepalfillings.com"),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
