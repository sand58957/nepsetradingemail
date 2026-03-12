-- WhatsApp Marketing Module
-- Per-account Gupshup configuration, contacts, templates, campaigns, and message tracking

-- ============================================================
-- 1. wa_settings — Per-account Gupshup WhatsApp API config
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_settings (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    gupshup_app_id  TEXT NOT NULL DEFAULT '',
    gupshup_api_key TEXT NOT NULL DEFAULT '',
    source_phone    TEXT NOT NULL DEFAULT '',
    app_name        TEXT NOT NULL DEFAULT '',
    waba_id         TEXT NOT NULL DEFAULT '',
    webhook_secret  TEXT NOT NULL DEFAULT '',
    send_rate       INT NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

-- ============================================================
-- 2. wa_contacts — Self-managed WhatsApp contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_contacts (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    phone           TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    opted_in        BOOLEAN NOT NULL DEFAULT true,
    opted_in_at     TIMESTAMPTZ,
    opted_out_at    TIMESTAMPTZ,
    tags            JSONB NOT NULL DEFAULT '[]',
    attributes      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_account ON wa_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON wa_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_opted_in ON wa_contacts(account_id, opted_in);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_tags ON wa_contacts USING GIN(tags);

-- ============================================================
-- 3. wa_templates — Cached WhatsApp message templates
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_templates (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    gupshup_id      TEXT NOT NULL DEFAULT '',
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'MARKETING',
    language        TEXT NOT NULL DEFAULT 'en',
    status          TEXT NOT NULL DEFAULT 'pending',
    header_type     TEXT NOT NULL DEFAULT '',
    header_text     TEXT NOT NULL DEFAULT '',
    body_text       TEXT NOT NULL DEFAULT '',
    footer_text     TEXT NOT NULL DEFAULT '',
    button_type     TEXT NOT NULL DEFAULT '',
    buttons         JSONB NOT NULL DEFAULT '[]',
    sample_values   JSONB NOT NULL DEFAULT '[]',
    synced_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_account ON wa_templates(account_id);

-- ============================================================
-- 4. wa_campaigns — WhatsApp campaign definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_campaigns (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    template_id     INT REFERENCES wa_templates(id),
    status          TEXT NOT NULL DEFAULT 'draft',
    target_filter   JSONB NOT NULL DEFAULT '{}',
    template_params JSONB NOT NULL DEFAULT '[]',
    total_targets   INT NOT NULL DEFAULT 0,
    sent_count      INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    read_count      INT NOT NULL DEFAULT 0,
    failed_count    INT NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_by      INT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_account ON wa_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status ON wa_campaigns(status);

-- ============================================================
-- 5. wa_campaign_messages — Per-recipient message tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_campaign_messages (
    id              SERIAL PRIMARY KEY,
    campaign_id     INT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES wa_contacts(id) ON DELETE CASCADE,
    gupshup_msg_id  TEXT NOT NULL DEFAULT '',
    wa_msg_id       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'queued',
    error_reason    TEXT NOT NULL DEFAULT '',
    submitted_at    TIMESTAMPTZ,
    enqueued_at     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_campaign ON wa_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_gupshup ON wa_campaign_messages(gupshup_msg_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON wa_campaign_messages(status);
