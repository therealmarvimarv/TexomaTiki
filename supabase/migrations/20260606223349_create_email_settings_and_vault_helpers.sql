-- ── email_settings table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email_provider   text NOT NULL DEFAULT 'disabled'
                     CHECK (email_provider IN ('disabled', 'smtp', 'resend')),
  smtp_host        text NOT NULL DEFAULT '',
  smtp_port        integer NOT NULL DEFAULT 587,
  smtp_secure      boolean NOT NULL DEFAULT false,
  smtp_from        text NOT NULL DEFAULT '',
  admin_email      text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_email_settings" ON email_settings FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_email_settings" ON email_settings FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_email_settings" ON email_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_email_settings" ON email_settings FOR DELETE
  TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW EXECUTE FUNCTION update_email_settings_updated_at();

-- ── Vault helpers ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION email_settings_upsert_secret(p_name text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(p_value, p_name, 'email setting');
  ELSE
    PERFORM vault.update_secret(existing_id, p_value, p_name, 'email setting');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_upsert_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_upsert_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_get_secret(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_get_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_delete_secret(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_delete_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_secret_exists(p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name);
END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_exists(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION email_settings_secret_exists(text) TO authenticated, service_role;

-- Preview: returns first 3 chars + •••• (safe for username display)
CREATE OR REPLACE FUNCTION email_settings_secret_preview(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
DECLARE val text;
BEGIN
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF val IS NULL OR length(val) < 4 THEN RETURN NULL; END IF;
  RETURN left(val, 3) || '••••';
END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION email_settings_secret_preview(text) TO authenticated, service_role;
