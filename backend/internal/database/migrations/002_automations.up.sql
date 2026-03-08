CREATE TABLE IF NOT EXISTS app_automations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_automation_steps (
    id SERIAL PRIMARY KEY,
    automation_id INTEGER REFERENCES app_automations(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 0,
    step_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_automation_logs (
    id SERIAL PRIMARY KEY,
    automation_id INTEGER REFERENCES app_automations(id) ON DELETE CASCADE,
    step_id INTEGER REFERENCES app_automation_steps(id) ON DELETE SET NULL,
    subscriber_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_automation_steps_automation_id ON app_automation_steps(automation_id);
CREATE INDEX IF NOT EXISTS idx_app_automation_logs_automation_id ON app_automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_app_automation_logs_status ON app_automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_app_automation_logs_created_at ON app_automation_logs(created_at);
