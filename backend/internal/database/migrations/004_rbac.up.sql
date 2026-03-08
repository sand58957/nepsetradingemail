-- Role-Based Access Control migration
-- Enforce valid roles and change default from 'admin' to 'subscriber'

-- Add CHECK constraint to enforce valid roles
ALTER TABLE app_users
  ADD CONSTRAINT chk_app_users_role
  CHECK (role IN ('admin', 'user', 'subscriber'));

-- Change the default role from 'admin' to 'subscriber'
ALTER TABLE app_users
  ALTER COLUMN role SET DEFAULT 'subscriber';

-- Add index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Add subscriber-specific preferences column
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
