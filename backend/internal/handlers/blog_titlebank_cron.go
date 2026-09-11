package handlers

import (
	"context"
	"log"
	"sync/atomic"
	"time"
)

// running guards against overlapping cycles. The spec requires that the scheduler
// never publishes two posts simultaneously; this makes that structural rather than
// a matter of timing luck.
var titleBankRunning atomic.Bool

// StartTitleBankPublisher ticks every checkEvery and publishes when the configured
// interval has elapsed. Ticking more often than the publish interval lets an admin
// change the interval (or press "publish now") without restarting the process.
func (h *TitleBankHandler) StartTitleBankPublisher(ctx context.Context, accountID int, checkEvery time.Duration) {
	log.Printf("INFO: titlebank: publisher started (checking every %s)", checkEvery)

	// Any row left mid-flight by a crash goes back into the pool.
	if _, err := h.db.Exec(`UPDATE blog_title_bank
		SET status='available', locked_at=NULL, updated_at=NOW()
		WHERE status='generating' AND locked_at < NOW() - INTERVAL '20 minutes'`); err != nil {
		log.Printf("WARN: titlebank: reclaiming stale rows: %v", err)
	}

	ticker := time.NewTicker(checkEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("INFO: titlebank: publisher stopped")
			return
		case <-ticker.C:
			h.tick(ctx, accountID)
		}
	}
}

func (h *TitleBankHandler) tick(ctx context.Context, accountID int) {
	if !titleBankRunning.CompareAndSwap(false, true) {
		return // a cycle is already in flight
	}
	defer titleBankRunning.Store(false)

	s, err := h.loadSettings(accountID)
	if err != nil {
		return
	}
	if !s.IsEnabled {
		return
	}
	if !h.due(s) {
		return
	}

	if _, err := h.PublishNext(ctx, accountID); err != nil {
		if err == ErrNoTitles {
			log.Printf("INFO: titlebank: %s", ErrNoTitles.Error())
			return
		}
		log.Printf("ERROR: titlebank: publish cycle failed: %v", err)
		return
	}
	// Schedule the next slot from now, so a slow cycle does not compound drift.
	next := time.Now().Add(time.Duration(s.IntervalMinutes) * time.Minute)
	if _, err := h.db.Exec(`UPDATE blog_title_bank_settings SET next_run_at=$1, updated_at=NOW()
	                        WHERE account_id=$2`, next, accountID); err != nil {
		log.Printf("WARN: titlebank: setting next_run_at: %v", err)
	}
}

// due reports whether the configured interval has elapsed. A start_at in the
// future holds publishing until that moment.
func (h *TitleBankHandler) due(s *TitleBankSettings) bool {
	now := time.Now()
	if s.StartAt != nil && now.Before(*s.StartAt) {
		return false
	}
	if s.LastPublishedAt == nil {
		return true
	}
	return now.Sub(*s.LastPublishedAt) >= time.Duration(s.IntervalMinutes)*time.Minute
}
