-- Store recurring notification tokens for contacts
ALTER TABLE messenger_contacts ADD COLUMN IF NOT EXISTS recurring_token TEXT;
ALTER TABLE messenger_contacts ADD COLUMN IF NOT EXISTS recurring_frequency TEXT;
ALTER TABLE messenger_contacts ADD COLUMN IF NOT EXISTS recurring_token_expires_at TIMESTAMP;
