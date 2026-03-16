-- Add QR code URL to telegram_settings
ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS qr_code_url TEXT NOT NULL DEFAULT '';
