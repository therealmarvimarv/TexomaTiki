/*
# Create verify_ical_scheduler_token SECURITY DEFINER function

## Purpose
Replaces the scheduler_config table lookup with a Vault-based token verifier.
The Edge Function calls this RPC to authenticate scheduled cron requests.

## Security
- SECURITY DEFINER: runs with elevated privileges to access vault.decrypted_secrets
- Restricted search_path to prevent injection
- Returns boolean only — never exposes the secret
- Only executable by service_role (authenticated)
*/

CREATE OR REPLACE FUNCTION public.verify_ical_scheduler_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'edge_service_role_key'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RETURN false;
  END IF;

  -- Strip newlines as safety net before comparison
  v_secret := replace(replace(v_secret, chr(10), ''), chr(13), '');

  RETURN (p_token = v_secret);
END;
$$;

-- Grant only to authenticated (service_role uses authenticated role)
GRANT EXECUTE ON FUNCTION public.verify_ical_scheduler_token(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_ical_scheduler_token(text) FROM anon, public;