-- Telegram Marketing Module (Bot API)
-- Per-account config, contacts, campaigns, and message tracking

-- ============================================================
-- 1. telegram_settings — Per-account Telegram Bot config
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_settings (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    bot_token       TEXT NOT NULL DEFAULT '',
    bot_username    TEXT NOT NULL DEFAULT '',
    webhook_secret  TEXT NOT NULL DEFAULT '',
    send_rate       INT NOT NULL DEFAULT 25,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

-- ============================================================
-- 2. telegram_contacts — Telegram contacts (subscribers)
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_contacts (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    chat_id         BIGINT NOT NULL,
    username        TEXT NOT NULL DEFAULT '',
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    name            TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    opted_in        BOOLEAN NOT NULL DEFAULT true,
    opted_in_at     TIMESTAMPTZ,
    opted_out_at    TIMESTAMPTZ,
    tags            JSONB NOT NULL DEFAULT '[]',
    attributes      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_contacts_account ON telegram_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_tg_contacts_chat_id ON telegram_contacts(chat_id);
CREATE INDEX IF NOT EXISTS idx_tg_contacts_opted_in ON telegram_contacts(account_id, opted_in);
CREATE INDEX IF NOT EXISTS idx_tg_contacts_tags ON telegram_contacts USING GIN(tags);

-- ============================================================
-- 3. telegram_campaigns — Telegram campaign definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_campaigns (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    message_text    TEXT NOT NULL DEFAULT '',
    message_type    TEXT NOT NULL DEFAULT 'text',
    media_url       TEXT NOT NULL DEFAULT '',
    buttons         JSONB NOT NULL DEFAULT '[]',
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

CREATE INDEX IF NOT EXISTS idx_tg_campaigns_account ON telegram_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_tg_campaigns_status ON telegram_campaigns(status);

-- ============================================================
-- 4. telegram_campaign_messages — Per-recipient message tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_campaign_messages (
    id              SERIAL PRIMARY KEY,
    campaign_id     INT NOT NULL REFERENCES telegram_campaigns(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES telegram_contacts(id) ON DELETE CASCADE,
    telegram_msg_id BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'queued',
    error_reason    TEXT NOT NULL DEFAULT '',
    submitted_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_messages_campaign ON telegram_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tg_messages_status ON telegram_campaign_messages(status);

-- ============================================================
-- 5. telegram_contact_groups — Named groups for Telegram contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_contact_groups (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT '#0088cc',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tg_contact_groups_account ON telegram_contact_groups(account_id);

-- ============================================================
-- 6. telegram_contact_group_members — Junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_contact_group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INT NOT NULL REFERENCES telegram_contact_groups(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES telegram_contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_group_members_group ON telegram_contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_tg_group_members_contact ON telegram_contact_group_members(contact_id);

-- Add telegram to api_keys channel check
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_channel_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_channel_check CHECK (channel IN ('sms', 'whatsapp', 'email', 'telegram'));

-- Add telegram to api_credits channel check
ALTER TABLE api_credits DROP CONSTRAINT IF EXISTS api_credits_channel_check;
ALTER TABLE api_credits ADD CONSTRAINT api_credits_channel_check CHECK (channel IN ('sms', 'whatsapp', 'email', 'telegram'));
