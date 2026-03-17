-- Facebook Messenger Marketing Module
-- Per-account config, contacts, campaigns, and message tracking

-- ============================================================
-- 1. messenger_settings — Per-account Messenger config
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_settings (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    page_id         TEXT NOT NULL DEFAULT '',
    page_access_token TEXT NOT NULL DEFAULT '',
    app_id          TEXT NOT NULL DEFAULT '',
    app_secret      TEXT NOT NULL DEFAULT '',
    verify_token    TEXT NOT NULL DEFAULT '',
    webhook_secret  TEXT NOT NULL DEFAULT '',
    send_rate       INT NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

-- ============================================================
-- 2. messenger_contacts — Messenger contacts (PSID-based)
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_contacts (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    psid            TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    profile_pic     TEXT NOT NULL DEFAULT '',
    opted_in        BOOLEAN NOT NULL DEFAULT true,
    opted_in_at     TIMESTAMPTZ,
    opted_out_at    TIMESTAMPTZ,
    tags            JSONB NOT NULL DEFAULT '[]',
    attributes      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, psid)
);

CREATE INDEX IF NOT EXISTS idx_messenger_contacts_account ON messenger_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_messenger_contacts_psid ON messenger_contacts(psid);
CREATE INDEX IF NOT EXISTS idx_messenger_contacts_opted_in ON messenger_contacts(account_id, opted_in);
CREATE INDEX IF NOT EXISTS idx_messenger_contacts_tags ON messenger_contacts USING GIN(tags);

-- ============================================================
-- 3. messenger_campaigns — Messenger campaign definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_campaigns (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    message_text    TEXT NOT NULL DEFAULT '',
    image_url       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    target_filter   JSONB NOT NULL DEFAULT '{}',
    total_targets   INT NOT NULL DEFAULT 0,
    sent_count      INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count    INT NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_by      INT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messenger_campaigns_account ON messenger_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_messenger_campaigns_status ON messenger_campaigns(status);

-- ============================================================
-- 4. messenger_campaign_messages — Per-recipient message tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_campaign_messages (
    id              SERIAL PRIMARY KEY,
    campaign_id     INT NOT NULL REFERENCES messenger_campaigns(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES messenger_contacts(id) ON DELETE CASCADE,
    fb_message_id   TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'queued',
    error_reason    TEXT NOT NULL DEFAULT '',
    submitted_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_campaign ON messenger_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_fb ON messenger_campaign_messages(fb_message_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_status ON messenger_campaign_messages(status);

-- ============================================================
-- 5. messenger_contact_groups — Contact groups
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_contact_groups (
    id          SERIAL PRIMARY KEY,
    account_id  INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#1976d2',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

-- ============================================================
-- 6. messenger_contact_group_members — Group membership
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_contact_group_members (
    id          SERIAL PRIMARY KEY,
    group_id    INT NOT NULL REFERENCES messenger_contact_groups(id) ON DELETE CASCADE,
    contact_id  INT NOT NULL REFERENCES messenger_contacts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);
