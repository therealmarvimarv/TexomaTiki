ALTER TABLE account_settings
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS support_message text,
  ADD COLUMN IF NOT EXISTS support_hours text,
  ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT true;

UPDATE account_settings
SET
  support_message = 'Need help with your website or booking system? Contact support using the information below.',
  support_enabled = true
WHERE support_message IS NULL;
