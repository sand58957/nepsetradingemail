-- Allow the superadmin role. The route layer already treats superadmin as a
-- superset of admin (routes.go RequireRole groups), but the CHECK constraint
-- from 004_rbac made the role unassignable at the DB layer.
ALTER TABLE app_users DROP CONSTRAINT chk_app_users_role;
ALTER TABLE app_users
  ADD CONSTRAINT chk_app_users_role
  CHECK (role IN ('superadmin', 'admin', 'user', 'subscriber'));
