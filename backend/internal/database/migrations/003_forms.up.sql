CREATE TABLE IF NOT EXISTS app_forms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    list_ids JSONB NOT NULL DEFAULT '[]',
    fields JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_forms_is_active ON app_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_app_forms_created_at ON app_forms(created_at);
