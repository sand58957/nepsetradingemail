package handlers

import (
	"context"
	"log"
	"time"
)

// Campaigns that pause at a number's daily allowance carry on by themselves
// (migration 034).
//
// The gateway's allowance is what keeps a freshly linked number from being
// unlinked, so a campaign still stops when it is reached. What changes is that
// nobody has to come back and press Continue: the campaign records when the
// allowance renews and a background check starts it again then.

// The part of the day, Nepal time, in which a paused campaign may start again on
// its own. The gateway renews allowances at midnight UTC, 5:45 in the morning in
// Nepal; nobody wants a marketing message at that hour.
const (
	autoResumeFromHour  = 9  // 9 AM
	autoResumeUntilHour = 20 // 8 PM
)

// autoResumeAt picks when a campaign paused by the allowance carries on: a couple
// of minutes after the gateway says it may send again, moved to 9 AM Nepal time
// if that falls in the night. With no retry time from the gateway, it tries again
// in an hour.
func autoResumeAt(now time.Time, retryAfter time.Duration) time.Time {
	at := now.Add(time.Hour)
	if retryAfter > 0 {
		at = now.Add(retryAfter + 2*time.Minute)
	}

	local := at.In(nepalZone)

	switch {
	case local.Hour() < autoResumeFromHour:
		return time.Date(local.Year(), local.Month(), local.Day(), autoResumeFromHour, 0, 0, 0, nepalZone)
	case local.Hour() >= autoResumeUntilHour:
		next := local.AddDate(0, 0, 1)

		return time.Date(next.Year(), next.Month(), next.Day(), autoResumeFromHour, 0, 0, 0, nepalZone)
	default:
		return at
	}
}

// StartAutoResume checks every interval for campaigns due to carry on. Call it
// once at startup; it runs until ctx is cancelled.
func (h *WhatsAppHandler) StartAutoResume(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.resumeDueCampaigns()
		}
	}
}

// resumeDueCampaigns starts every campaign whose time to carry on has come.
//
// Claiming is one UPDATE, so a campaign is started once even if an operator
// presses Continue at the same moment: SendCampaign claims from 'paused' too,
// and only one of the two can move it to 'sending'.
func (h *WhatsAppHandler) resumeDueCampaigns() {
	var due []struct {
		ID          int  `db:"id"`
		AccountID   int  `db:"account_id"`
		TemplateID  *int `db:"template_id"`
		ResumeBatch int  `db:"resume_batch"`
	}

	if err := h.db.Select(&due, `
		UPDATE wa_campaigns SET status = 'sending', pause_reason = '', resume_at = NULL, updated_at = NOW()
		WHERE status = 'paused' AND resume_at IS NOT NULL AND resume_at <= NOW()
		RETURNING id, account_id, template_id, resume_batch
	`); err != nil {
		log.Printf("[whatsapp] auto-resume: looking for campaigns due: %v", err)

		return
	}

	for _, campaign := range due {
		var tmpl WATemplate

		if campaign.TemplateID == nil || h.db.Get(&tmpl, `SELECT * FROM wa_templates WHERE id = $1`, *campaign.TemplateID) != nil {
			h.db.Exec(`UPDATE wa_campaigns SET status = 'paused', pause_reason = $2, updated_at = NOW() WHERE id = $1`,
				campaign.ID, pauseReasonTemplate)
			log.Printf("[whatsapp] auto-resume: campaign %d has no readable template, left paused", campaign.ID)

			continue
		}

		// A continuous run ignores the batch size and takes everyone left. A batch
		// run carries on with what was left of its phase; 50 is only a fallback
		// for a row paused before this was recorded.
		batch := campaign.ResumeBatch
		if batch <= 0 {
			batch = 50
		}

		log.Printf("[whatsapp] auto-resume: carrying on with campaign %d", campaign.ID)

		go h.executeCampaignSend(campaign.ID, campaign.AccountID, batch, tmpl)
	}
}
