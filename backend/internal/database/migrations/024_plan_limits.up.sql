-- Plan limits configuration stored as account setting
INSERT INTO app_account_settings (key, value) VALUES
('plan_limits', '{
    "Free": {
        "max_subscribers": 500,
        "monthly_emails": 12000,
        "user_seats": 1,
        "features": ["email", "telegram"],
        "landing_pages": 10,
        "automations": true,
        "templates": true,
        "analytics": "basic",
        "support": "email"
    },
    "Growing Business": {
        "max_subscribers": 50000,
        "monthly_emails": -1,
        "user_seats": 3,
        "features": ["email", "telegram", "whatsapp"],
        "landing_pages": -1,
        "automations": true,
        "templates": true,
        "dynamic_emails": true,
        "ab_testing": true,
        "analytics": "advanced",
        "support": "email_24x7"
    },
    "Advanced": {
        "max_subscribers": 200000,
        "monthly_emails": -1,
        "user_seats": -1,
        "features": ["email", "telegram", "whatsapp", "messenger", "sms"],
        "landing_pages": -1,
        "automations": true,
        "templates": true,
        "dynamic_emails": true,
        "ab_testing": true,
        "custom_html": true,
        "ai_assistant": true,
        "analytics": "full",
        "support": "live_chat_24x7"
    },
    "Enterprise": {
        "max_subscribers": -1,
        "monthly_emails": -1,
        "user_seats": -1,
        "features": ["email", "telegram", "whatsapp", "messenger", "sms"],
        "landing_pages": -1,
        "automations": true,
        "templates": true,
        "dynamic_emails": true,
        "ab_testing": true,
        "custom_html": true,
        "ai_assistant": true,
        "dedicated_ip": true,
        "analytics": "full",
        "support": "dedicated_manager"
    }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add monthly_email_count tracking to accounts
ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS monthly_email_count INTEGER DEFAULT 0;
ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS email_count_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
