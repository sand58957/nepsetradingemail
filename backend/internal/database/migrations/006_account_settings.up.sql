-- Account Settings: key-value JSONB table for platform-wide settings
CREATE TABLE IF NOT EXISTS app_account_settings (
    id              SERIAL PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,
    value           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_account_settings_key ON app_account_settings(key);

-- Seed default settings rows
INSERT INTO app_account_settings (key, value) VALUES
('company_profile', '{
    "company_name": "",
    "website": "",
    "address": "",
    "city": "",
    "country": "",
    "timezone": "UTC",
    "time_format": "24h",
    "show_branding": true
}'::jsonb),
('brand_defaults', '{
    "sender_name": "",
    "sender_email": "",
    "custom_reply_to": false,
    "reply_to_email": "",
    "add_recipient_name": false,
    "logo_url": "",
    "force_update_logo": false,
    "font_family": "Arial",
    "color_primary": "#009933",
    "color_secondary": "#f5f5f5",
    "color_heading": "#333333",
    "color_text": "#666666",
    "color_border": "#e0e0e0",
    "track_opens": true,
    "google_analytics": false,
    "ga_campaigns": true,
    "ga_automations": false,
    "social_links": [],
    "company_details": "",
    "auto_generate_footer": true,
    "force_update_footer": false,
    "unsubscribe_disclaimer": "",
    "unsubscribe_link_text": "Unsubscribe"
}'::jsonb),
('domains', '{
    "sending_domains": [],
    "site_domains": []
}'::jsonb),
('ecommerce', '{
    "enabled": false,
    "provider": "",
    "api_key": "",
    "store_url": ""
}'::jsonb),
('link_tracking', '{
    "utm_source": "newsletter",
    "utm_medium": "email",
    "utm_campaign": "",
    "utm_term": "",
    "utm_content": ""
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
