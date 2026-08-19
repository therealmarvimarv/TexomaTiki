/*
  # Create payment_settings table and vault helper functions

  ## Summary
  Adds admin-configurable payment settings so the owner can set payment mode
  and manage Stripe test credentials without touching server environment variables.

  ## New Table: payment_settings
  Stores non-secret payment configuration per property:
  - payment_mode: 'manual' or 'stripe_test'
  - site_url: used as base for Stripe success/cancel URLs
  - checkout_expires_minutes: how long a Stripe checkout session stays live (30–1440)
  - stripe_test_enabled: boolean convenience flag
  - Secret keys (stripe_test_secret_key, stripe_webhook_secret) are stored in
    Supabase Vault only — never in this table.

  ## Vault Helper Functions
  Two SECURITY DEFINER functions callable by service_role edge functions:
  - payment_settings_upsert_secret(name, value): create or update a vault secret
  - payment_settings_get_secret(name): decrypt and return a vault secret value
  Both are restricted to service_role only.

  ## Security
  - RLS enabled on payment_settings; only authenticated (admin) users can read/write
  - Vault functions are SECURITY DEFINER, restricted to service_role
  - anon has no access to payment_settings or vault functions
*/

-- ── payment_settings table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id              uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  payment_mode             text NOT NULL DEFAULT 'manual'
                             CHECK (payment_mode IN ('manual', 'stripe_test')),
  site_url                 text NOT NULL DEFAULT '',
  checkout_expires_minutes integer NOT NULL DEFAULT 30
                             CHECK (checkout_expires_minutes BETWEEN 30 AND 1440),
  stripe_test_enabled      boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read payment settings"
  ON payment_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payment settings"
  ON payment_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment settings"
  ON payment_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW EXECUTE FUNCTION update_payment_settings_updated_at();

-- ── Vault helper: upsert a named secret ───────────────────────────────────────
-- Called by edge functions (service_role) to store Stripe keys in vault.
-- SECURITY DEFINER so the function body runs as postgres (vault owner).
CREATE OR REPLACE FUNCTION payment_settings_upsert_secret(
  p_name  text,
  p_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(p_value, p_name, 'payment setting');
  ELSE
    PERFORM vault.update_secret(existing_id, p_value, p_name, 'payment setting');
  END IF;
END;
$$;

-- Restrict to service_role only
REVOKE ALL ON FUNCTION payment_settings_upsert_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_upsert_secret(text, text) TO service_role;

-- ── Vault helper: get a named secret (decrypted) ──────────────────────────────
-- Called by edge functions (service_role) to retrieve Stripe keys.
CREATE OR REPLACE FUNCTION payment_settings_get_secret(
  p_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE
  result text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION payment_settings_get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_get_secret(text) TO service_role;

-- ── Vault helper: check if a named secret exists (no value returned) ──────────
-- Safe to call from authenticated context — returns boolean only, no secret.
CREATE OR REPLACE FUNCTION payment_settings_secret_exists(
  p_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name);
END;
$$;

REVOKE ALL ON FUNCTION payment_settings_secret_exists(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION payment_settings_secret_exists(text) TO authenticated, service_role;

-- ── Vault helper: get last 4 chars of a named secret (masked preview) ─────────
-- Returns prefix + masked + last4, e.g. "sk_test_••••••1234"
-- Never returns full value.
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
  ELSIF val LIKE 'whsec_%' THEN
    prefix := 'whsec_';
  ELSE
    prefix := '';
  END IF;

  last4 := right(val, 4);
  RETURN prefix || '••••••' || last4;
END;
$$;

REVOKE ALL ON FUNCTION payment_settings_secret_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION payment_settings_secret_preview(text) TO authenticated, service_role;
