-- Deleting an API key.
--
-- Deleting ran DELETE FROM api_keys, and api_messages.api_key_id references the
-- key with no ON DELETE rule, so any key that had ever sent a message could not
-- be deleted: the delete failed with a 500 and the key stayed. It also kept
-- counting toward the limit of five keys per channel, so an account whose old
-- keys had all been used could not make a new one.
--
-- A deleted key is now marked, switched off and hidden. It can never
-- authenticate again, and the messages it sent keep pointing at it, so sending
-- and credit history stay intact.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN api_keys.deleted_at IS
	'When the key was deleted. A deleted key is inactive, hidden, and never authenticates; its messages keep their history.';
