package handlers

import (
	"context"
	"log"
	"time"
)

// Nepal timezone offset: UTC+5:45
var nepalOffset = time.FixedZone("NPT", 5*3600+45*60)

// StartAutoPublish runs the auto-publish background job on a ticker.
// Follows the same pattern as StartAutoVerification in domain.go.
func (h *BlogAutoPublishHandler) StartAutoPublish(ctx context.Context, interval time.Duration) {
	log.Printf("INFO: Blog auto-publish cron started (interval: %s)", interval)

	// Cleanup stale "processing" items from previous crashes
	h.db.Exec(`UPDATE blog_autopublish_queue SET status='pending', updated_at=NOW()
		WHERE status='processing' AND updated_at < NOW() - INTERVAL '15 minutes'`)

	// Initial delay before first check
	go func() {
		time.Sleep(60 * time.Second)
		h.runAutoPublishCycle()
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("INFO: Blog auto-publish cron stopped")
			return
		case <-ticker.C:
			h.runAutoPublishCycle()
		}
	}
}

func (h *BlogAutoPublishHandler) runAutoPublishCycle() {
	// Load all enabled accounts
	var accounts []AutoPublishSettings
	err := h.db.Select(&accounts, "SELECT * FROM blog_autopublish_settings WHERE is_enabled = true")
	if err != nil || len(accounts) == 0 {
		return
	}

	for _, settings := range accounts {
		h.processAccountQueue(&settings)
	}
}

func (h *BlogAutoPublishHandler) processAccountQueue(settings *AutoPublishSettings) {
	// Check daily quota: how many posts generated today for this account
	var todayCount int
	h.db.Get(&todayCount, `
		SELECT COUNT(*) FROM blog_autopublish_queue
		WHERE account_id = $1 AND status = 'completed'
		AND processed_at::date = (NOW() AT TIME ZONE 'UTC+5:45')::date`,
		settings.AccountID)

	if todayCount >= settings.PostsPerDay {
		return // Daily quota reached
	}

	// Check preferred hour (Nepal time, within ±1 hour window)
	nepalNow := time.Now().In(nepalOffset)
	currentHour := nepalNow.Hour()
	if abs(currentHour-settings.PreferredHour) > 1 && abs(currentHour-settings.PreferredHour) < 23 {
		return // Not within the preferred time window
	}

	// Resolve API key (prefer Gemini free tier, fallback to Anthropic)
	apiKey := settings.AnthropicAPIKey
	if apiKey == "" {
		apiKey = h.cfg.GeminiAPIKey
	}
	if apiKey == "" {
		apiKey = h.cfg.AnthropicAPIKey
	}
	if apiKey == "" {
		return // No API key available
	}

	// Pick next pending queue item
	var item AutoPublishQueueItem
	err := h.db.Get(&item, `
		SELECT * FROM blog_autopublish_queue
		WHERE account_id = $1 AND status = 'pending'
		AND (scheduled_for IS NULL OR scheduled_for <= NOW())
		ORDER BY priority DESC, created_at ASC
		LIMIT 1`,
		settings.AccountID)
	if err != nil {
		return // No pending items
	}

	// Mark as processing
	h.db.Exec("UPDATE blog_autopublish_queue SET status='processing', updated_at=NOW() WHERE id=$1", item.ID)

	log.Printf("INFO: auto-publish: processing queue item %d '%s' for account %d",
		item.ID, item.Topic[:min(50, len(item.Topic))], item.AccountID)

	// Process the item
	postID, tokens, durationMs, err := h.processQueueItem(&item, settings, apiKey)
	if err != nil {
		log.Printf("ERROR: auto-publish: failed item %d: %v", item.ID, err)

		// Log failure
		h.db.Exec(`INSERT INTO blog_autopublish_logs (account_id, queue_id, action, status, message, tokens_used, duration_ms)
			VALUES ($1, $2, 'generate', 'error', $3, $4, $5)`,
			settings.AccountID, item.ID, err.Error(), tokens, durationMs)

		// Retry logic
		item.RetryCount++
		if item.RetryCount >= item.MaxRetries {
			h.db.Exec("UPDATE blog_autopublish_queue SET status='failed', error_message=$2, retry_count=$3, updated_at=NOW() WHERE id=$1",
				item.ID, err.Error(), item.RetryCount)
			log.Printf("ERROR: auto-publish: item %d failed permanently after %d retries", item.ID, item.RetryCount)
		} else {
			h.db.Exec("UPDATE blog_autopublish_queue SET status='pending', error_message=$2, retry_count=$3, updated_at=NOW() WHERE id=$1",
				item.ID, err.Error(), item.RetryCount)
			log.Printf("INFO: auto-publish: item %d will retry (attempt %d/%d)", item.ID, item.RetryCount, item.MaxRetries)
		}
		return
	}

	log.Printf("INFO: auto-publish: completed item %d → post %d (%d tokens, %dms)",
		item.ID, postID, tokens, durationMs)
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
