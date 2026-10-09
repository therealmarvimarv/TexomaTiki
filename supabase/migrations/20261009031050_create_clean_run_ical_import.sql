/*
# Create clean run_ical_import function and remove store_scheduler_secret helper

1. New Functions
- `public.run_ical_import()` — clean SECURITY DEFINER function that reads the
  service role key from Vault (`edge_service_role_key`) and calls the ical-import
  edge function. Replaces the temporary `run_scheduled_ical_import()` which read
  from the custom `scheduler_config` table.

2. Removed Functions
- `public.store_scheduler_secret(text, text, text)` — temporary helper used once
  to store the service role key in Vault. No longer needed.

3. Security
- `run_ical_import()` is SECURITY DEFINER with search_path = public, vault
- The service role key is read from Vault at execution time — never hardcoded
- The URL is hardcoded to the project URL (same pattern as the working
  `run_automated_emails` cron job)
- No secrets are exposed in the cron command or function source

4. Important Notes
- The existing cron job is NOT modified in this migration. It still calls
  `run_scheduled_ical_import()`. The cron will be cut over in a separate
  migration after the new function is tested.
- `run_scheduled_ical_import()` is NOT removed in this migration. It remains
  as the active scheduler until the cutover is verified.
*/

CREATE OR REPLACE FUNCTION public.run_ical_import()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_service_key text;
  v_request_id bigint;
BEGIN
  SELECT secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'edge_service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret edge_service_role_key not found';
  END IF;

  v_request_id := net.http_post(
    url := 'https://kxytygmulacvwahvnrtm.supabase.co/functions/v1/ical-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_ical_import() TO authenticated;

-- Remove the temporary store_scheduler_secret helper
DROP FUNCTION IF EXISTS public.store_scheduler_secret(text, text, text);