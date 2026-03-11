-- Per-account domain management with auto-generated DKIM keys
CREATE TABLE IF NOT EXISTS app_domains (
    id                SERIAL PRIMARY KEY,
    account_id        INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    domain            TEXT NOT NULL,
    type              TEXT NOT NULL DEFAULT 'sending' CHECK (type IN ('sending', 'site')),
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    dkim_private_key  TEXT NOT NULL DEFAULT '',
    dkim_public_key   TEXT NOT NULL DEFAULT '',
    dkim_selector     TEXT NOT NULL DEFAULT 'mail',
    verification_hash TEXT NOT NULL DEFAULT '',
    domain_alignment  BOOLEAN NOT NULL DEFAULT false,
    ssl               BOOLEAN NOT NULL DEFAULT false,
    site              TEXT NOT NULL DEFAULT '',
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, domain, type)
);

CREATE INDEX IF NOT EXISTS idx_app_domains_account_id ON app_domains(account_id);
CREATE INDEX IF NOT EXISTS idx_app_domains_domain ON app_domains(domain);
CREATE INDEX IF NOT EXISTS idx_app_domains_status ON app_domains(status);
