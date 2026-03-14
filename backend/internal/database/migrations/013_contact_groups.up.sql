-- Contact Groups for SMS and WhatsApp Marketing
-- Reusable named groups of contacts for campaign targeting

-- ============================================================
-- 1. sms_contact_groups — Named groups for SMS contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_contact_groups (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT '#1976d2',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sms_contact_groups_account ON sms_contact_groups(account_id);

-- ============================================================
-- 2. sms_contact_group_members — Junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_contact_group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INT NOT NULL REFERENCES sms_contact_groups(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES sms_contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_group_members_group ON sms_contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sms_group_members_contact ON sms_contact_group_members(contact_id);

-- ============================================================
-- 3. wa_contact_groups — Named groups for WhatsApp contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_contact_groups (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT '#25D366',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wa_contact_groups_account ON wa_contact_groups(account_id);

-- ============================================================
-- 4. wa_contact_group_members — Junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_contact_group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INT NOT NULL REFERENCES wa_contact_groups(id) ON DELETE CASCADE,
    contact_id      INT NOT NULL REFERENCES wa_contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_group_members_group ON wa_contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_wa_group_members_contact ON wa_contact_group_members(contact_id);
