ALTER TABLE messenger_contacts DROP COLUMN IF EXISTS recurring_token;
ALTER TABLE messenger_contacts DROP COLUMN IF EXISTS recurring_frequency;
ALTER TABLE messenger_contacts DROP COLUMN IF EXISTS recurring_token_expires_at;
