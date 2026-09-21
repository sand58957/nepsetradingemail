-- Which number an unlink happened to.
--
-- The campaign hold after an unlink (migration 031) was per account. When an
-- account linked a different number after the old one was unlinked, the new
-- number was held too, and the page told the operator that the number they had
-- just linked "was unlinked". The hold exists to keep the unlinked number from
-- going straight back to sending, so it now applies only while that same number,
-- or no number, is linked.
ALTER TABLE wa_settings
	ADD COLUMN IF NOT EXISTS unlinked_phone TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN wa_settings.unlinked_phone IS
	'The number that was linked when unlinked_at was recorded. The campaign hold applies only while this number, or none, is linked.';
