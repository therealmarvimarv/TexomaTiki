/*
# Recreate store_scheduler_secret helper for trimmed key storage

Temporarily recreates the helper to allow the ical-import edge function to
store the trimmed SUPABASE_SERVICE_ROLE_KEY in Vault. Will be removed after
verification.
*/

CREATE OR REPLACE FUNCTION public.store_scheduler_secret(
  secret_name text,
  secret_value text,
  secret_description text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = secret_name;
  PERFORM vault.create_secret(secret_value, secret_name, secret_description);
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_scheduler_secret(text, text, text) TO authenticated;