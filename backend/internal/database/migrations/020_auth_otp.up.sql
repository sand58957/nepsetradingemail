-- Migration 020: Add OTP and Google OAuth authentication support

-- Add phone and google_id to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_id TEXT DEFAULT NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';

-- Make password_hash nullable for OTP/Google users
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;

-- Unique indexes (partial - only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON app_users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON app_users(google_id) WHERE google_id IS NOT NULL;

-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
    attempts INT NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_codes(phone, channel, is_verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_cleanup ON otp_codes(expires_at) WHERE is_verified = false;

-- OTP rate limiting table
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    channel TEXT NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phone, channel)
);
