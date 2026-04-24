package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/handlers"
	"github.com/sandeep/nepsetradingemail/backend/internal/server"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/cache"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
)

func runMigrations(db *sqlx.DB) error {
	// Try multiple possible migration paths
	migrationDirs := []string{
		"/migrations",                            // Docker container path
		"internal/database/migrations",           // Local dev (from backend/)
		"../internal/database/migrations",        // Local dev (from cmd/server/)
	}

	for _, dir := range migrationDirs {
		if _, err := os.Stat(dir); err == nil {
			return runMigrationsFromDir(db, dir)
		}
	}

	log.Println("No migration directory found, skipping migrations")
	return nil
}

func runMigrationsFromDir(db *sqlx.DB, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("reading migrations directory %s: %w", dir, err)
	}

	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, f := range files {
		content, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", f, err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			log.Printf("Warning: Migration error (may be ok if tables exist): %s: %v", f, err)
			continue
		}
		log.Printf("Migration applied: %s", f)
	}
	return nil
}

func main() {
	// Load .env file (optional, for local development)
	_ = godotenv.Load()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to PostgreSQL
	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("Connected to PostgreSQL")

	// Log SendGrid API key status
	if cfg.SendGridAPIKey != "" {
		log.Printf("SendGrid API key configured (prefix: %s...)", cfg.SendGridAPIKey[:20])
	} else {
		log.Println("WARNING: SENDGRID_API_KEY is not set — email API will fail")
	}

	// Run database migrations
	if err := runMigrations(db); err != nil {
		log.Printf("Warning: Migration error (may be ok if tables exist): %v", err)
	}

	// Connect to Redis
	redisCache, err := cache.NewRedisCache(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisCache.Close()

	log.Println("Connected to Redis")

	// Initialize Listmonk client
	lmClient := listmonk.NewClient(cfg.ListmonkAPIURL, cfg.ListmonkUser, cfg.ListmonkPassword)
	log.Println("Listmonk client initialized")

	// Create and start server
	srv := server.New(cfg, db, redisCache, lmClient)

	// Start domain auto-verification background job (checks every 5 minutes)
	autoVerifyCtx, autoVerifyCancel := context.WithCancel(context.Background())
	defer autoVerifyCancel()

	domainHandler := handlers.NewDomainHandler(db, cfg.SendGridAPIKey)
	go domainHandler.StartAutoVerification(autoVerifyCtx, 5*time.Minute)

	// Start blog auto-publish background job (checks every 30 minutes)
	autoPublishCtx, autoPublishCancel := context.WithCancel(context.Background())
	defer autoPublishCancel()

	autoPublishHandler := handlers.NewBlogAutoPublishHandler(db, cfg)
	go autoPublishHandler.StartAutoPublish(autoPublishCtx, 30*time.Minute)

	// Start server in a goroutine
	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		log.Printf("Starting server on %s", addr)
		if err := srv.Echo.Start(addr); err != nil {
			log.Printf("Server stopped: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Echo.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
