-- System-level SendGrid config, editable from the super admin UI.
-- Falls back to SENDGRID_API_KEY env var when api_key is empty.
INSERT INTO app_account_settings (key, value) VALUES
('sendgrid_config', '{
    "api_key": "",
    "updated_by": "",
    "updated_at": ""
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
