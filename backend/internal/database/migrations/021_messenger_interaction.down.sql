DROP INDEX IF EXISTS idx_messenger_contacts_last_interaction;
ALTER TABLE messenger_contacts DROP COLUMN IF EXISTS last_interaction_at;
