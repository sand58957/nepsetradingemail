-- Restore the pre-superadmin role constraint. Fails if superadmin rows exist;
-- demote them first.
ALTER TABLE app_users DROP CONSTRAINT chk_app_users_role;
ALTER TABLE app_users
  ADD CONSTRAINT chk_app_users_role
  CHECK (role IN ('admin', 'user', 'subscriber'));
