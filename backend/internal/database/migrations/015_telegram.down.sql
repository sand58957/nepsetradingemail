DROP TABLE IF EXISTS telegram_contact_group_members;
DROP TABLE IF EXISTS telegram_contact_groups;
DROP TABLE IF EXISTS telegram_campaign_messages;
DROP TABLE IF EXISTS telegram_campaigns;
DROP TABLE IF EXISTS telegram_contacts;
DROP TABLE IF EXISTS telegram_settings;

-- Restore original channel check constraints
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_channel_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_channel_check CHECK (channel IN ('sms', 'whatsapp', 'email'));

ALTER TABLE api_credits DROP CONSTRAINT IF EXISTS api_credits_channel_check;
ALTER TABLE api_credits ADD CONSTRAINT api_credits_channel_check CHECK (channel IN ('sms', 'whatsapp', 'email'));
