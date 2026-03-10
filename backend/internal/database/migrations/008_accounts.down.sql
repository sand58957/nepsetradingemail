ALTER TABLE app_users DROP COLUMN IF EXISTS current_account_id;
DROP TABLE IF EXISTS app_account_members;
DROP TABLE IF EXISTS app_accounts;
