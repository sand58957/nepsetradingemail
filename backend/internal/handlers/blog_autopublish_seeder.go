package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/lib/pq"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/anthropic"
)

// Topic-seeder thresholds. Kept high enough that a 25-post/day account has
// at least a day of buffer between seeding runs, but low enough that we
// regenerate before the queue empties.
const (
	seedThreshold = 10 // refill once pending drops to/below this
	seedBatchSize = 20 // how many new topics to generate per refill
	seedMaxTokens = 4000
)

// seededTopic mirrors the JSON shape we ask Gemini to return.
type seededTopic struct {
	Topic              string   `json:"topic"`
	PrimaryKeyword     string   `json:"primary_keyword"`
	SecondaryKeywords  []string `json:"secondary_keywords"`
	Priority           int      `json:"priority"`
}

// seedTopicsIfNeeded inserts new topic ideas into blog_autopublish_queue
// when pending count falls below seedThreshold. No-op otherwise.
func (h *BlogAutoPublishHandler) seedTopicsIfNeeded(settings *AutoPublishSettings, apiKey string) {
	var pending int
	if err := h.db.Get(&pending, `
		SELECT COUNT(*) FROM blog_autopublish_queue
		WHERE account_id = $1 AND status = 'pending'`, settings.AccountID); err != nil {
		return
	}
	if pending > seedThreshold {
		return
	}

	// Pull recent post titles to steer Gemini away from duplicates.
	var recentTitles []string
	h.db.Select(&recentTitles, `
		SELECT title FROM blog_posts
		WHERE account_id = $1
		ORDER BY id DESC
		LIMIT 50`, settings.AccountID)

	// Also pull any still-pending topics so we don't double-suggest them.
	var pendingTopics []string
	h.db.Select(&pendingTopics, `
		SELECT topic FROM blog_autopublish_queue
		WHERE account_id = $1 AND status IN ('pending', 'processing')`, settings.AccountID)

	avoid := append([]string{}, recentTitles...)
	avoid = append(avoid, pendingTopics...)

	topics, tokens, err := h.generateSeedTopics(settings, apiKey, avoid)
	if err != nil {
		log.Printf("ERROR: auto-publish seeder: gemini call failed for account %d: %v", settings.AccountID, err)
		h.db.Exec(`INSERT INTO blog_autopublish_logs (account_id, action, status, message, tokens_used)
			VALUES ($1, 'seed', 'error', $2, $3)`, settings.AccountID, err.Error(), tokens)
		return
	}

	inserted := 0
	for _, t := range topics {
		if strings.TrimSpace(t.Topic) == "" {
			continue
		}
		priority := t.Priority
		if priority < 0 || priority > 10 {
			priority = 0
		}
		_, err := h.db.Exec(`
			INSERT INTO blog_autopublish_queue
				(account_id, topic, primary_keyword, secondary_keywords, priority, status)
			VALUES ($1, $2, $3, $4, $5, 'pending')`,
			settings.AccountID,
			t.Topic,
			t.PrimaryKeyword,
			pq.Array(t.SecondaryKeywords),
			priority,
		)
		if err != nil {
			log.Printf("WARN: auto-publish seeder: insert failed for '%s': %v", t.Topic, err)
			continue
		}
		inserted++
	}

	msg := fmt.Sprintf("Seeded %d new topics (queue was at %d pending)", inserted, pending)
	log.Printf("INFO: auto-publish seeder: account %d — %s", settings.AccountID, msg)
	h.db.Exec(`INSERT INTO blog_autopublish_logs (account_id, action, status, message, tokens_used)
		VALUES ($1, 'seed', 'success', $2, $3)`, settings.AccountID, msg, tokens)
}

// generateSeedTopics asks Gemini for blog topic ideas tailored to the
// account's site context and target audience.
func (h *BlogAutoPublishHandler) generateSeedTopics(settings *AutoPublishSettings, apiKey string, avoidTitles []string) ([]seededTopic, int, error) {
	client := anthropic.NewClient(apiKey, settings.AnthropicModel)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	avoidBlock := ""
	if len(avoidTitles) > 0 {
		// Cap to keep prompt small.
		if len(avoidTitles) > 60 {
			avoidTitles = avoidTitles[:60]
		}
		avoidBlock = "\n\nDo NOT propose topics that overlap meaningfully with these existing/queued posts:\n- " +
			strings.Join(avoidTitles, "\n- ")
	}

	systemPrompt := "You are an SEO content strategist generating fresh, non-duplicate blog topic ideas. " +
		"Always reply with a single JSON array — no prose, no markdown, no code fences. " +
		"Each array element must be an object with keys: topic (string, ≤100 chars, written as a compelling headline), " +
		"primary_keyword (string, 2-4 words), secondary_keywords (array of 3 strings), priority (integer 0-10)."

	userPrompt := fmt.Sprintf(
		"Site context: %s\n"+
			"Target audience: %s\n"+
			"Content tone: %s\n\n"+
			"Generate exactly %d distinct blog topic ideas. Mix evergreen how-tos, comparisons, "+
			"timely industry takes, and case studies. Vary the angle so titles don't all sound alike.%s",
		settings.SiteContext,
		settings.TargetAudience,
		settings.ContentTone,
		seedBatchSize,
		avoidBlock,
	)

	resp, err := client.Generate(ctx, systemPrompt, userPrompt, seedMaxTokens)
	if err != nil {
		return nil, 0, err
	}

	tokens := resp.TotalTokens
	if tokens == 0 {
		tokens = resp.Usage.InputTokens + resp.Usage.OutputTokens
	}

	raw := strings.TrimSpace(resp.Text)
	// Gemini sometimes wraps JSON in ```json fences despite instructions.
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var topics []seededTopic
	if err := json.Unmarshal([]byte(raw), &topics); err != nil {
		return nil, tokens, fmt.Errorf("parse topics JSON: %w (raw: %q)", err, truncate(raw, 200))
	}
	return topics, tokens, nil
}
