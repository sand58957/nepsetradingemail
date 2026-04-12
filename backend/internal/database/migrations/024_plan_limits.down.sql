DELETE FROM app_account_settings WHERE key = 'plan_limits';
ALTER TABLE app_accounts DROP COLUMN IF EXISTS monthly_email_count;
ALTER TABLE app_accounts DROP COLUMN IF EXISTS email_count_reset_at;
