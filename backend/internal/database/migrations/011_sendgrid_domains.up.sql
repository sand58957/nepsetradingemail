-- Add SendGrid domain authentication fields to app_domains
ALTER TABLE app_domains
    ADD COLUMN IF NOT EXISTS sendgrid_domain_id INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sendgrid_dns JSONB NOT NULL DEFAULT '{}';

-- Add Listmonk sender config per account
ALTER TABLE app_domains
    ADD COLUMN IF NOT EXISTS from_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS from_name TEXT NOT NULL DEFAULT '';
