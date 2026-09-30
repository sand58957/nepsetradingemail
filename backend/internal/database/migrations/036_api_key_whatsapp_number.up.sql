-- Which WhatsApp number an API key sends from.
--
-- The public WhatsApp API read the account's single session from wa_settings, so
-- once an account could link several numbers (migration 033) only the default
-- one could be reached through the API. A WhatsApp key can now be set to send
-- from any of the account's numbers, and a request can name one in "from".
-- NULL keeps sending from the account's default number.
ALTER TABLE api_keys
	ADD COLUMN IF NOT EXISTS wa_number_id INT REFERENCES wa_numbers(id) ON DELETE SET NULL;

COMMENT ON COLUMN api_keys.wa_number_id IS
	'The WhatsApp number this key sends from. NULL sends from the account''s default number.';
