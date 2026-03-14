-- SMS Marketing Module (Aakash SMS)
-- Per-account config, contacts, campaigns, and message tracking

-- ============================================================
-- 1. sms_settings — Per-account Aakash SMS config
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_settings (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    auth_token      TEXT NOT NULL DEFAULT '',
    sender_id       TEXT NOT NULL DEFAULT '',
    send_rate       INT NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

-- ============================================================
-- 2. sms_contacts — SMS contacts (self-managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_contacts (
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

CREATE INDEX IF NOT EXISTS idx_sms_contacts_account ON sms_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_contacts_phone ON sms_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_sms_contacts_opted_in ON sms_contacts(account_id, opted_in);
CREATE INDEX IF NOT EXISTS idx_sms_contacts_tags ON sms_contacts USING GIN(tags);

-- ============================================================
-- 3. sms_campaigns — SMS campaign definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_campaigns (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    message_text    TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    target_filter   JSONB NOT NULL DEFAULT '{}',
    total_targets   INT NOT NULL DEFAULT 0,
    sent_count      INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count    INT NOT NULL DEFAULT 0,
    credits_used    INT NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_by      INT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_account ON sms_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status);

-- ============================================================
-- 4. sms_campaign_messages — Per-recipient message tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_campaign_messages (
    id              SERIAL PRIMARY KEY,
    campaign_id     INT NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES sms_contacts(id) ON DELETE CASCADE,
    aakash_msg_id   TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'queued',
    network         TEXT NOT NULL DEFAULT '',
    credits         INT NOT NULL DEFAULT 0,
    error_reason    TEXT NOT NULL DEFAULT '',
    submitted_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_campaign ON sms_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_aakash ON sms_campaign_messages(aakash_msg_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_campaign_messages(status);
