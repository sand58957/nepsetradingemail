-- ============================================================
-- Public API: API Keys, Credits, Messages
-- Enables third-party businesses to send Email, WhatsApp, SMS
-- via separate API connections with separate credit systems
-- ============================================================

-- API Keys — separate keys per channel (sms, whatsapp, email)
CREATE TABLE IF NOT EXISTS api_keys (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
    key_hash        VARCHAR(64) NOT NULL,
    key_prefix      VARCHAR(30) NOT NULL,
    name            VARCHAR(100) NOT NULL DEFAULT 'Default',
    is_test         BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    rate_limit      INT NOT NULL DEFAULT 60,
    webhook_url     TEXT,
    webhook_secret  VARCHAR(64),
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(key_prefix)
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id, channel);

-- Credits — separate balance per channel per account
CREATE TABLE IF NOT EXISTS api_credits (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
    balance         DECIMAL(12,2) NOT NULL DEFAULT 0,
    reserved        DECIMAL(12,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, channel)
);

-- Credit transaction audit trail
CREATE TABLE IF NOT EXISTS api_credit_transactions (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'deduct', 'refund', 'bonus', 'admin_adjust')),
    amount          DECIMAL(12,2) NOT NULL,
    balance_after   DECIMAL(12,2) NOT NULL,
    message_id      INT,
    description     TEXT,
    admin_user_id   INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_credit_tx_account ON api_credit_transactions(account_id, channel, created_at DESC);

-- API message log — all messages sent via API
CREATE TABLE IF NOT EXISTS api_messages (
    id                  SERIAL PRIMARY KEY,
    account_id          INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    api_key_id          INT NOT NULL REFERENCES api_keys(id),
    channel             VARCHAR(20) NOT NULL,
    "to"                VARCHAR(255) NOT NULL,
    "from"              VARCHAR(255),
    subject             VARCHAR(500),
    content_preview     VARCHAR(200),
    status              VARCHAR(20) NOT NULL DEFAULT 'queued',
    provider_message_id VARCHAR(255),
    credits_charged     DECIMAL(8,2) NOT NULL DEFAULT 0,
    error_code          VARCHAR(50),
    error_message       TEXT,
    webhook_url         TEXT,
    reference           VARCHAR(255),
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_messages_account ON api_messages(account_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_messages_status ON api_messages(status) WHERE status IN ('queued', 'sending');
CREATE INDEX IF NOT EXISTS idx_api_messages_provider ON api_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_api_messages_reference ON api_messages(account_id, reference);

-- Add API enablement flag to accounts
ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN NOT NULL DEFAULT false;
