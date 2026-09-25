DROP INDEX IF EXISTS wa_campaigns_resume_idx;
ALTER TABLE wa_campaigns DROP COLUMN IF EXISTS resume_at, DROP COLUMN IF EXISTS resume_batch;
