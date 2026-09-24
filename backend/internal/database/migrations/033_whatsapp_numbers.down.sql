ALTER TABLE wa_campaign_messages DROP COLUMN IF EXISTS wa_number_id;
ALTER TABLE wa_campaigns DROP COLUMN IF EXISTS wa_number_id, DROP COLUMN IF EXISTS rotate_numbers;
DROP TABLE IF EXISTS wa_numbers;
