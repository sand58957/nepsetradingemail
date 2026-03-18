-- Rollback migration 020
DROP TABLE IF EXISTS otp_rate_limits;
DROP TABLE IF EXISTS otp_codes;
DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE app_users DROP COLUMN IF EXISTS auth_provider;
ALTER TABLE app_users DROP COLUMN IF EXISTS google_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS phone;
ALTER TABLE app_users ALTER COLUMN password_hash SET NOT NULL;
