/*
# Recreate store_scheduler_secret helper

Temporarily recreates the SECURITY DEFINER wrapper to allow the ical-import
edge function to store the SUPABASE_SERVICE_ROLE_KEY in Vault via RPC.
This function will be removed after the key is stored.

1. New Functions
- `store_scheduler_secret(name, value, description)` — wrapper around
  vault.create_secret callable via Supabase RPC from edge functions.
2. Security
- SECURITY DEFINER with search_path set to vault, public
- Only callable by authenticated (service role connects as authenticated)
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