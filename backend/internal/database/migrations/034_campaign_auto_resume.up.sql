-- Campaigns that pause at a number's daily allowance carry on by themselves.
--
-- The WhatsApp gateway gives each number a daily allowance that grows as the
-- link ages (SEND_PACING_WARMUP_SCHEDULE: 20, 40, 80, 160, 320, 640, then 1000 a
-- day). It is what keeps a freshly linked number from being unlinked, so it
-- stays. But a campaign that hit it sat paused until someone came back and
-- pressed Continue, the next day or later.
--
-- A campaign paused by the allowance now records when to carry on and how much
-- of its run was left; a background check starts it again then.

ALTER TABLE wa_campaigns
	-- When to carry on by itself. NULL means it waits for a person.
	ADD COLUMN IF NOT EXISTS resume_at TIMESTAMPTZ,
	-- What was left of a batch run's phase when it paused. 0 means everyone
	-- remaining, which is what a continuous run always takes.
	ADD COLUMN IF NOT EXISTS resume_batch INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS wa_campaigns_resume_idx ON wa_campaigns (resume_at) WHERE resume_at IS NOT NULL;

COMMENT ON COLUMN wa_campaigns.resume_at IS
	'When a campaign paused by a number''s daily allowance carries on by itself. NULL waits for a person.';
