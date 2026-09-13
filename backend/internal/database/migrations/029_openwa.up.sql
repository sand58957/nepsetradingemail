-- Replace Gupshup with the self-hosted OpenWA gateway.
--
-- Gupshup fronted Meta's official WhatsApp Business API and was configured with
-- an app id, an API key, a WABA id and a Meta-provisioned sender. OpenWA instead
-- drives a real WhatsApp account that somebody linked by scanning a QR code, so
-- the only per-account identifier that matters is which gateway session belongs
-- to which tenant. The gateway's own URL and key are process configuration, not
-- per-account data, so they live in the environment rather than this table.
--
-- Migrations re-run on every boot in this project, so every statement here is
-- written to be safe to repeat.

ALTER TABLE wa_settings ADD COLUMN IF NOT EXISTS openwa_session_id TEXT NOT NULL DEFAULT '';

-- The phone that answers is now whatever was linked by QR, and the gateway is
-- authoritative for it. Keeping a second copy here would go stale the moment
-- someone re-links, so it is a cache refreshed from the gateway, not a setting.
ALTER TABLE wa_settings ADD COLUMN IF NOT EXISTS linked_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE wa_settings ADD COLUMN IF NOT EXISTS session_status TEXT NOT NULL DEFAULT '';

-- Gupshup-specific columns. Dropped rather than left behind: they held live API
-- credentials for a provider this application no longer talks to, and leaving
-- credentials at rest for a decommissioned integration is its own risk.
ALTER TABLE wa_settings DROP COLUMN IF EXISTS gupshup_app_id;
ALTER TABLE wa_settings DROP COLUMN IF EXISTS gupshup_api_key;
ALTER TABLE wa_settings DROP COLUMN IF EXISTS waba_id;

-- Templates were a Meta construct: pre-approved message formats submitted through
-- Gupshup and reviewed by Meta. An unofficial gateway sends free-form text, so
-- there is nothing to submit and nothing to approve. The table is kept because it
-- still holds the message bodies campaigns were built from, but the fields that
-- only meant something to Meta's review process no longer apply.
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS is_legacy_meta_template BOOLEAN NOT NULL DEFAULT false;
UPDATE wa_templates SET is_legacy_meta_template = true
 WHERE is_legacy_meta_template = false AND created_at < NOW();
