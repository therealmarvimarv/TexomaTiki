/*
# Fix run_ical_import cron scheduler — NULL URL

## Problem
The `run_ical_import` cron job was failing with:
  `null value in column "url" of relation "http_request_queue"`

The cron command used `current_setting('app.supabase_url', true)` and
`current_setting('app.service_role_key', true)`, but neither custom GUC
was ever configured — both returned NULL, producing a NULL URL.

## Fix
1. Creates a `run_scheduled_ical_import()` SECURITY DEFINER function that:
   - Hardcodes the project URL (no GUC dependency)
   - Reads the service role key from Vault (`ed_service_role_key`)
   - Calls `net.http_post` to invoke the `ical-import` edge function
2. Unschedules the broken `run_ical_import` cron job
3. Reschedules `run_ical_import` every 15 minutes calling the new function

## Security
- `run_scheduled_ical_import()` is SECURITY DEFINER with search_path = vault, public
- The service role key is read from Vault at execution time — never hardcoded
- The URL is hardcoded to the project URL (same pattern as the working
  `run_automated_emails` cron job)
- No secrets are exposed in the cron command or function source

## Idempotent
- Unschedules before rescheduling
- Uses CREATE OR REPLACE for the function
*/

-- ── Helper: read a Vault secret by name ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.read_scheduler_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT secret FROM vault.decrypted_secrets WHERE name = secret_name LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.read_scheduler_secret(text) TO authenticated;

-- ── Main: invoke ical-import edge function via pg_net ──────────────────────────
CREATE OR REPLACE FUNCTION public.run_scheduled_ical_import()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_service_key text;
  v_request_id bigint;
BEGIN
  -- Read the service role key from Vault
  SELECT secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'ed_service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret ed_service_role_key not found';
  END IF;

  -- POST to the ical-import edge function with service-role auth
  SELECT id INTO v_request_id
  FROM net.http_post(
    url := 'https://kxytygmulacvwahvnrtm.supabase.co/functions/v1/ical-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  );

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_scheduled_ical_import() TO authenticated;

-- ── Replace the broken cron job ────────────────────────────────────────────────
SELECT cron.unschedule('run_ical_import');

SELECT cron.schedule(
  'run_ical_import',
  '*/15 * * * *',
  $$SELECT public.run_scheduled_ical_import();$$
);
