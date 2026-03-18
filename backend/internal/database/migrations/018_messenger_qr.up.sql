-- Add QR code URL to messenger settings
ALTER TABLE messenger_settings ADD COLUMN IF NOT EXISTS qr_code_url TEXT NOT NULL DEFAULT '';
