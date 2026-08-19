/*
  # Add payment_settings_delete_secret vault helper

  ## Summary
  The existing clear-keys behavior writes an empty string to vault, which leaves
  the vault row present. payment_settings_secret_exists then incorrectly returns
  true for a "cleared" secret.

  This migration adds a delete helper so clear-keys operations fully remove the
  vault entry. Grants are service_role only, matching the other secret helpers.
*/

CREATE OR REPLACE FUNCTION payment_settings_delete_secret(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, extensions
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
END;
$$;

REVOKE ALL ON FUNCTION payment_settings_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_delete_secret(text) TO service_role;
