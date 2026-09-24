-- Several WhatsApp numbers per account.
--
-- An account could link exactly one number: wa_settings held its gateway session,
-- its phone and its link state, and every send read those columns. That is one
-- number for support, sales and every brand an account runs, and when WhatsApp
-- unlinks it the account cannot send at all until someone scans a new code.
--
-- Numbers now live in their own table, one row per linked number, with one of
-- them marked as the account's default. wa_settings keeps its columns as a mirror
-- of that default number, so the public API and the settings screen keep reading
-- what they always read.
--
-- A number is addressed by this table's own id, never by the gateway session id:
-- session ids are guessable across tenants, account-scoped row ids are not.

CREATE TABLE IF NOT EXISTS wa_numbers (
	id                SERIAL PRIMARY KEY,
	account_id        INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
	-- The gateway session this number is linked through. Empty between creating
	-- the row and the gateway accepting it.
	openwa_session_id TEXT NOT NULL DEFAULT '',
	-- What the account calls this number, e.g. "Support" or "Sales".
	label             TEXT NOT NULL DEFAULT '',
	linked_phone      TEXT NOT NULL DEFAULT '',
	session_status    TEXT NOT NULL DEFAULT '',
	is_default        BOOLEAN NOT NULL DEFAULT false,
	-- The campaign hold after an unlink, per number (see migrations 031 and 032).
	unlinked_at       TIMESTAMPTZ,
	unlinked_phone    TEXT NOT NULL DEFAULT '',
	created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One gateway session belongs to one number, and one account has one default.
CREATE UNIQUE INDEX IF NOT EXISTS wa_numbers_session_idx
	ON wa_numbers (openwa_session_id) WHERE openwa_session_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS wa_numbers_one_default_idx
	ON wa_numbers (account_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS wa_numbers_account_idx ON wa_numbers (account_id);

-- Carry across the one number each account already had. Written so re-running the
-- migration, which happens on every boot, adds nothing a second time.
INSERT INTO wa_numbers (account_id, openwa_session_id, label, linked_phone, session_status, is_default,
	unlinked_at, unlinked_phone, created_at)
SELECT s.account_id, s.openwa_session_id, '', s.linked_phone, s.session_status, true,
	s.unlinked_at, s.unlinked_phone, s.created_at
FROM wa_settings s
WHERE s.openwa_session_id <> ''
  AND NOT EXISTS (SELECT 1 FROM wa_numbers n WHERE n.openwa_session_id = s.openwa_session_id);

-- Which number a campaign sends from, and whether it spreads its messages over
-- every linked number instead. Spreading does not send faster: the gap between
-- messages is unchanged, so each number carries a share of the same run.
ALTER TABLE wa_campaigns
	ADD COLUMN IF NOT EXISTS wa_number_id INT REFERENCES wa_numbers(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS rotate_numbers BOOLEAN NOT NULL DEFAULT false;

-- Which number each message actually went out from, so a number's own sending
-- history survives the campaign being edited or a number being removed.
ALTER TABLE wa_campaign_messages
	ADD COLUMN IF NOT EXISTS wa_number_id INT REFERENCES wa_numbers(id) ON DELETE SET NULL;

COMMENT ON TABLE wa_numbers IS
	'WhatsApp numbers an account can send from. wa_settings mirrors the row marked is_default.';
COMMENT ON COLUMN wa_campaigns.rotate_numbers IS
	'Spread this campaign over every linked number, at the same overall pace, rather than sending it all from one.';
