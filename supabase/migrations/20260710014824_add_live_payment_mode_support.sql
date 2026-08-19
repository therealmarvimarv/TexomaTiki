/*
# Add Live Payment Mode Support

## Summary
Extends the payment system from 2 modes (manual, stripe_test) to 4 modes
(test_manual, test_stripe, live_manual, live_stripe). This allows property
owners to configure Stripe live credentials and accept real payments.

## Changes to payment_settings table
- Updated `payment_mode` CHECK constraint to accept 4 values:
  'test_manual', 'test_stripe', 'live_manual', 'live_stripe'
- Migrated existing rows: 'manual' -> 'test_manual', 'stripe_test' -> 'test_stripe'
- Added `stripe_live_enabled` boolean (default false) — parallel to stripe_test_enabled
- Added `stripe_test_publishable_key` text (default '') — test publishable key (not secret, safe for table)
- Added `stripe_live_publishable_key` text (default '') — live publishable key (not secret, safe for table)

## Vault Helper Updates
- Updated `payment_settings_secret_preview` to detect `sk_live_` prefix
  (previously only detected `sk_test_` and `whsec_`)

## Vault Secret Names (no schema changes needed — vault helpers are name-based)
- Test secret key:     `stripe_test_secret_key` (existing, unchanged)
- Test webhook secret: `stripe_webhook_secret` (existing, kept as-is)
- Live secret key:     `stripe_live_secret_key` (new — stored via existing upsert helper)
- Live webhook secret: `stripe_live_webhook_secret` (new — stored via existing upsert helper)

## Security
- No RLS policy changes — existing policies remain valid
- Vault helpers remain restricted to service_role only
- Publishable keys are safe to store in the table (they are not secret)
- Secret keys and webhook secrets remain in vault only, never in the table
*/

-- ── Step 1: Add new columns ──────────────────────────────────────────────────
ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS stripe_live_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS stripe_test_publishable_key text NOT NULL DEFAULT '';

ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS stripe_live_publishable_key text NOT NULL DEFAULT '';

-- ── Step 2: Drop old CHECK constraint BEFORE migrating values ──────────────────
-- The old constraint only allows ('manual', 'stripe_test') so we must drop it
-- before updating rows to the new values.
ALTER TABLE payment_settings DROP CONSTRAINT IF EXISTS payment_settings_payment_mode_check;

-- ── Step 3: Migrate existing payment_mode values ─────────────────────────────
-- 'manual' -> 'test_manual', 'stripe_test' -> 'test_stripe'
UPDATE payment_settings SET payment_mode = 'test_manual' WHERE payment_mode = 'manual';
UPDATE payment_settings SET payment_mode = 'test_stripe' WHERE payment_mode = 'stripe_test';

-- ── Step 4: Add new CHECK constraint ───────────────────────────────────────────
ALTER TABLE payment_settings
  ADD CONSTRAINT payment_settings_payment_mode_check
  CHECK (payment_mode IN ('test_manual', 'test_stripe', 'live_manual', 'live_stripe'));

-- ── Step 5: Update secret_preview function to detect sk_live_ prefix ──────────
CREATE OR REPLACE FUNCTION payment_settings_secret_preview(
  p_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE
  val    text;
  prefix text;
  last4  text;
BEGIN
  SELECT decrypted_secret INTO val
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  IF val IS NULL OR length(val) < 8 THEN
    RETURN NULL;
  END IF;

  -- Detect prefix
  IF val LIKE 'sk_test_%' THEN
    prefix := 'sk_test_';
  ELSIF val LIKE 'sk_live_%' THEN
    prefix := 'sk_live_';
  ELSIF val LIKE 'whsec_%' THEN
    prefix := 'whsec_';
  ELSE
    prefix := '';
  END IF;

  last4 := right(val, 4);
  RETURN prefix || '••••••' || last4;
END;
$$;

-- Re-apply grants (function was recreated)
REVOKE ALL ON FUNCTION payment_settings_secret_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION payment_settings_secret_preview(text) TO authenticated, service_role;