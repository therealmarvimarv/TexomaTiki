/*
# Create temporary Vault helper functions for edge function secret storage

Creates two SECURITY DEFINER wrapper functions that allow edge functions
to store and check Vault secrets via Supabase RPC. These are needed to
store the service role key in Vault from an edge function context where
the vault schema is not directly accessible.

1. New Functions
- `store_vault_secret(name, value, description)` — stores a secret in Vault
- `check_vault_secret(name)` — checks if a Vault secret exists
2. Security
- SECURITY DEFINER with search_path = vault, public
- Only callable by authenticated (service role)
*/

CREATE OR REPLACE FUNCTION public.store_vault_secret(
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

CREATE OR REPLACE FUNCTION public.check_vault_secret(
  secret_name text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = secret_name);
$$;

GRANT EXECUTE ON FUNCTION public.store_vault_secret(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_vault_secret(text) TO authenticated;
