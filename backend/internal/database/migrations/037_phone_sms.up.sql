-- Phone SMS (own SIM): a separate copy of SMS Marketing that sends through the
-- customer's own Android phone running the SMSGate app (sms-gate.app), instead
-- of Aakash SMS. Nothing here touches the sms_* tables.

-- ============================================================
-- 1. phone_sms_settings — per-account SMSGate connection and pacing
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_settings (
    id                     SERIAL PRIMARY KEY,
    account_id             INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    server_url             TEXT NOT NULL DEFAULT 'https://api.sms-gate.app/3rdparty/v1',
    username               TEXT NOT NULL DEFAULT '',
    password               TEXT NOT NULL DEFAULT '',
    device_id              TEXT NOT NULL DEFAULT '',  -- '' lets SMSGate pick the phone
    sim_number             INT NOT NULL DEFAULT 0,    -- 0 is the phone's default SIM
    daily_limit            INT NOT NULL DEFAULT 100,
    send_gap_seconds       INT NOT NULL DEFAULT 30,
    webhook_token          TEXT NOT NULL DEFAULT '',
    signing_key            TEXT NOT NULL DEFAULT '',
    webhooks_registered_at TIMESTAMPTZ,
    is_active              BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_sms_settings_webhook_token
    ON phone_sms_settings(webhook_token) WHERE webhook_token <> '';

-- ============================================================
-- 2. phone_sms_contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_contacts (
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

CREATE INDEX IF NOT EXISTS idx_phone_sms_contacts_account ON phone_sms_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_phone_sms_contacts_opted_in ON phone_sms_contacts(account_id, opted_in);
CREATE INDEX IF NOT EXISTS idx_phone_sms_contacts_tags ON phone_sms_contacts USING GIN(tags);

-- ============================================================
-- 3. phone_sms_contact_groups and their members
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_contact_groups (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT '#1976d2',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_phone_sms_contact_groups_account ON phone_sms_contact_groups(account_id);

CREATE TABLE IF NOT EXISTS phone_sms_contact_group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INT NOT NULL REFERENCES phone_sms_contact_groups(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES phone_sms_contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_phone_sms_group_members_contact ON phone_sms_contact_group_members(contact_id);

-- ============================================================
-- 4. phone_sms_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_campaigns (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    message_text    TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    pause_reason    TEXT NOT NULL DEFAULT '',
    resume_at       TIMESTAMPTZ,
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

CREATE INDEX IF NOT EXISTS idx_phone_sms_campaigns_account ON phone_sms_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_phone_sms_campaigns_resume ON phone_sms_campaigns(resume_at) WHERE resume_at IS NOT NULL;

-- ============================================================
-- 5. phone_sms_campaign_messages — one row per recipient
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_campaign_messages (
    id              SERIAL PRIMARY KEY,
    campaign_id     INT NOT NULL REFERENCES phone_sms_campaigns(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES phone_sms_contacts(id) ON DELETE CASCADE,
    gateway_msg_id  TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'queued',
    network         TEXT NOT NULL DEFAULT '',  -- which SIM sent it
    credits         INT NOT NULL DEFAULT 0,
    error_reason    TEXT NOT NULL DEFAULT '',
    submitted_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_sms_messages_campaign ON phone_sms_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_phone_sms_messages_gateway ON phone_sms_campaign_messages(gateway_msg_id) WHERE gateway_msg_id <> '';
CREATE INDEX IF NOT EXISTS idx_phone_sms_messages_submitted ON phone_sms_campaign_messages(submitted_at);

-- ============================================================
-- 6. phone_sms_inbox — replies and other SMS the phone receives
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_sms_inbox (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    contact_id      INT REFERENCES phone_sms_contacts(id) ON DELETE SET NULL,
    phone           TEXT NOT NULL,
    message         TEXT NOT NULL DEFAULT '',
    sim_number      INT NOT NULL DEFAULT 0,
    device_id       TEXT NOT NULL DEFAULT '',
    gateway_msg_id  TEXT NOT NULL DEFAULT '',
    opted_out       BOOLEAN NOT NULL DEFAULT false,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, device_id, gateway_msg_id)
);

CREATE INDEX IF NOT EXISTS idx_phone_sms_inbox_account ON phone_sms_inbox(account_id, received_at DESC);
