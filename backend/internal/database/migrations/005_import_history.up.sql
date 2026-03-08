-- Import History: tracks every import operation
CREATE TABLE IF NOT EXISTS app_import_history (
    id              SERIAL PRIMARY KEY,
    source          VARCHAR(20) NOT NULL DEFAULT 'csv',  -- csv, api, webhook
    filename        VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled
    total           INT NOT NULL DEFAULT 0,
    successful      INT NOT NULL DEFAULT 0,
    failed          INT NOT NULL DEFAULT 0,
    skipped         INT NOT NULL DEFAULT 0,
    list_ids        JSONB NOT NULL DEFAULT '[]',
    field_mapping   JSONB NOT NULL DEFAULT '{}',
    error_log       JSONB NOT NULL DEFAULT '[]',
    summary         JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Import Webhooks: webhook configurations for automated import
CREATE TABLE IF NOT EXISTS app_import_webhooks (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    secret_key      VARCHAR(64) NOT NULL UNIQUE,
    list_ids        JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    trigger_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Suppression List: email blocklist for import filtering
CREATE TABLE IF NOT EXISTS app_suppression_list (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    reason          VARCHAR(255) NOT NULL DEFAULT 'manual',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_history_status ON app_import_history(status);
CREATE INDEX IF NOT EXISTS idx_import_history_source ON app_import_history(source);
CREATE INDEX IF NOT EXISTS idx_import_history_created ON app_import_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suppression_email ON app_suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_import_webhooks_secret ON app_import_webhooks(secret_key);
