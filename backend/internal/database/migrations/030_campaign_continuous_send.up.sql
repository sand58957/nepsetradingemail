-- Continuous campaign sending.
--
-- Until now a campaign was sent one phase at a time: a run took a fixed batch,
-- then parked the campaign at 'paused' so an operator could start the next one by
-- hand. That was a deliberate brake on an unofficial WhatsApp gateway, but it
-- means reaching a 30,000-contact list needs hundreds of manual runs.
--
-- These two columns let a campaign instead run to completion on its own, spacing
-- messages by a chosen interval. Spreading the same volume over a long period is
-- what keeps the linked number out of trouble, so the interval replaces the batch
-- as the safety control rather than removing it.

ALTER TABLE wa_campaigns
	-- Seconds to wait between two messages. 0 keeps the previous behaviour, which
	-- paces from the account's configured send rate.
	ADD COLUMN IF NOT EXISTS send_interval_seconds INTEGER NOT NULL DEFAULT 0,
	-- When true the run ignores the batch size and continues until every remaining
	-- contact has been attempted, or the operator pauses it.
	ADD COLUMN IF NOT EXISTS continuous BOOLEAN NOT NULL DEFAULT false;

-- A continuous run lasts hours or days, so it will outlive at least one deploy.
-- The resumer started with the server looks for campaigns left mid-flight and
-- picks them up; it needs to know which ones were meant to keep going.
COMMENT ON COLUMN wa_campaigns.continuous IS
	'Run until the contact list is exhausted rather than pausing after one batch. Resumed automatically after a restart.';

COMMENT ON COLUMN wa_campaigns.send_interval_seconds IS
	'Seconds between consecutive messages. 0 falls back to the account send rate.';
