-- Track last user interaction for 24h messaging window
ALTER TABLE messenger_contacts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP;

-- Index for quick lookups when determining messaging window
CREATE INDEX IF NOT EXISTS idx_messenger_contacts_last_interaction ON messenger_contacts(account_id, last_interaction_at);
