ALTER TABLE wa_campaigns DROP COLUMN IF EXISTS pause_reason;
ALTER TABLE wa_settings DROP COLUMN IF EXISTS unlinked_at;
ALTER TABLE wa_contacts DROP COLUMN IF EXISTS unreachable_at;
