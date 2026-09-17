-- Keeping a linked WhatsApp number linked.
--
-- WhatsApp unlinks a number it thinks is sending spam, and the gateway then
-- deletes the stored login, so the number has to be scanned in again. In
-- September 2026 the main account's number was unlinked twice in thirteen hours,
-- each time about a minute after a campaign started. Three things made that
-- worse: a campaign could be started again straight after an unlink, the send
-- loop marked everyone after the drop as failed (so they were never retried),
-- and the campaign page gave no reason for the pause.

-- Why a campaign stopped on its own, in words for the campaign page. Empty when
-- it is sending, or when a person paused it.
ALTER TABLE wa_campaigns
	ADD COLUMN IF NOT EXISTS pause_reason TEXT NOT NULL DEFAULT '';

-- When this account's number was last unlinked by WhatsApp or from the phone.
-- Campaigns wait a day after it: a number that goes straight back to messaging
-- strangers after an unlink is the pattern that ends in a ban.
ALTER TABLE wa_settings
	ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ;

-- When WhatsApp last refused to resolve this contact's number: it is not on
-- WhatsApp, or WhatsApp will not open a first chat with it from a linked device.
-- Campaigns skip it for a while, since every such attempt counts against the
-- sending number.
ALTER TABLE wa_contacts
	ADD COLUMN IF NOT EXISTS unreachable_at TIMESTAMPTZ;

COMMENT ON COLUMN wa_campaigns.pause_reason IS
	'Why the campaign paused itself, shown on the campaign page. Empty when running or paused by a person.';

COMMENT ON COLUMN wa_settings.unlinked_at IS
	'When the linked number was last unlinked. Campaigns cannot start for 24 hours after it.';

COMMENT ON COLUMN wa_contacts.unreachable_at IS
	'When WhatsApp last could not resolve this number. Campaigns skip the contact for 30 days after it.';
