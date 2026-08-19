-- Remove stripe_live_enabled column
--
-- payment_mode is the authoritative source of the active runtime mode.
-- Vault secret existence is the authoritative source of credential configuration.
-- stripe_live_enabled duplicated both and could drift out of sync.
--
-- stripe_test_enabled is NOT removed (pre-existing, out of scope for this correction).

ALTER TABLE payment_settings
  DROP COLUMN IF EXISTS stripe_live_enabled;
