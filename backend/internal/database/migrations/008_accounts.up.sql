-- Accounts table
CREATE TABLE IF NOT EXISTS app_accounts (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    logo_url    TEXT NOT NULL DEFAULT '',
    plan        TEXT NOT NULL DEFAULT 'Free',
    domain      TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Account members join table (many-to-many: users <-> accounts)
CREATE TABLE IF NOT EXISTS app_account_members (
    id          SERIAL PRIMARY KEY,
    account_id  INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_account_members_user_id ON app_account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_app_account_members_account_id ON app_account_members(account_id);

-- Add current_account_id to app_users
ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS current_account_id INT REFERENCES app_accounts(id) ON DELETE SET NULL;

-- Data migration: Create a default account for each existing admin/user (only if they don't have one)
DO $$
DECLARE
    u RECORD;
    new_account_id INT;
BEGIN
    FOR u IN
        SELECT au.id, au.name, au.email
        FROM app_users au
        WHERE au.role IN ('admin', 'user')
          AND (au.current_account_id IS NULL)
          AND NOT EXISTS (SELECT 1 FROM app_account_members am WHERE am.user_id = au.id)
    LOOP
        INSERT INTO app_accounts (name, plan, created_at, updated_at)
        VALUES (COALESCE(NULLIF(u.name, ''), u.email) || '''s Account', 'Free', NOW(), NOW())
        RETURNING id INTO new_account_id;

        INSERT INTO app_account_members (account_id, user_id, role)
        VALUES (new_account_id, u.id, 'owner')
        ON CONFLICT (account_id, user_id) DO NOTHING;

        UPDATE app_users SET current_account_id = new_account_id WHERE id = u.id;
    END LOOP;
END $$;
