-- Role-Based Access Control migration
-- Enforce valid roles and change default from 'admin' to 'subscriber'

-- Add CHECK constraint to enforce valid roles.
--
-- Migrations are re-run on every boot, so this has to be idempotent and has to
-- name every role the application supports. Without the DROP it failed each
-- boot ("constraint already exists"); with the DROP but the original three-role
-- list it would drop the wider constraint 027 installed and then fail to
-- re-add it, because superadmin accounts exist. Keep the list complete.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS chk_app_users_role;
ALTER TABLE app_users
  ADD CONSTRAINT chk_app_users_role
  CHECK (role IN ('superadmin', 'admin', 'user', 'subscriber'));

-- Change the default role from 'admin' to 'subscriber'
ALTER TABLE app_users
  ALTER COLUMN role SET DEFAULT 'subscriber';

-- Add index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Add subscriber-specific preferences column
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
