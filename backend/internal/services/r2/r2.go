// Package r2 uploads objects to Cloudflare R2 (S3-compatible) and returns their
// public URL served via the bucket's custom domain (cdn.nepalfillings.com).
package r2

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Config holds the R2 credentials and bucket/public-domain settings.
type Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PublicBaseURL   string // e.g. https://cdn.nepalfillings.com
}

// Enabled reports whether R2 is configured.
func (c Config) Enabled() bool {
	return c.AccountID != "" && c.AccessKeyID != "" && c.SecretAccessKey != "" && c.Bucket != ""
}

// Upload PUTs data to the bucket at key and returns the public CDN URL.
func Upload(ctx context.Context, cfg Config, key, contentType string, data []byte) (string, error) {
	if !cfg.Enabled() {
		return "", fmt.Errorf("R2 is not configured")
	}

	endpoint := fmt.Sprintf("%s.r2.cloudflarestorage.com", cfg.AccountID)

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: true,
		Region: "auto", // explicit region skips R2's unsupported bucket-location lookup
	})
	if err != nil {
		return "", fmt.Errorf("r2 client: %w", err)
	}

	key = strings.TrimLeft(key, "/")
	if _, err := client.PutObject(ctx, cfg.Bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType}); err != nil {
		return "", fmt.Errorf("r2 put %s: %w", key, err)
	}

	return fmt.Sprintf("%s/%s", strings.TrimRight(cfg.PublicBaseURL, "/"), key), nil
}
