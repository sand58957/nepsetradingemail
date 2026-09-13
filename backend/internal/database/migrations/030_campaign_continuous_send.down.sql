ALTER TABLE wa_campaigns
	DROP COLUMN IF EXISTS send_interval_seconds,
	DROP COLUMN IF EXISTS continuous;
