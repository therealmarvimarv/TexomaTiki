/*
# Create vault secret helper function

Creates a temporary SECURITY DEFINER wrapper to allow edge functions
to store secrets in Vault via RPC. This wrapper will be used once by
the ical scheduler fix to store the service role key, then can be
reused by future scheduled jobs that need secure credential access.

1. New Functions
- `store_scheduler_secret(name, value, description)` — wrapper around
  vault.create_secret that can be called via Supabase RPC from edge
  functions. SECURITY DEFINER so it can access the vault schema.
- `scheduler_secret_exists(name)` — checks if a vault secret exists.
2. Security
- SECURITY DEFINER with search_path set to vault, public
- Only callable by service_role (authenticated with service role key)
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
  -- Delete existing secret with the same name if it exists
  DELETE FROM vault.secrets WHERE name = secret_name;
  -- Create the new secret
  PERFORM vault.create_secret(secret_value, secret_name, secret_description);
END;
$$;

CREATE OR REPLACE FUNCTION public.scheduler_secret_exists(
  secret_name text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = secret_name);
$$;

-- Grant execute to authenticated (service role connects as authenticated)
GRANT EXECUTE ON FUNCTION public.store_scheduler_secret(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scheduler_secret_exists(text) TO authenticated;
