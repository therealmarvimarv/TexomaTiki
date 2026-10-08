/*
# Restore last-known-working iCal scheduler infrastructure

The aborted cleanup attempt dropped the working scheduler_config table,
run_scheduled_ical_import() function, and ical_scheduler_token Vault secret.
It also created run_ical_import() and edge_service_role_key which are not
part of the working system. This migration restores the working state and
removes the aborted artifacts.

1. Restored Objects
- public.scheduler_config table (with RLS policies)
- ical_scheduler_token row in scheduler_config
- ical_scheduler_token Vault secret
- public.run_scheduled_ical_import() function (reads from scheduler_config)

2. Removed Objects (from aborted attempt)
- public.run_ical_import() function
- vault.secrets row 'edge_service_role_key'

3. Cron job updated to call run_scheduled_ical_import()
*/

-- Remove aborted-attempt artifacts
DROP FUNCTION IF EXISTS public.run_ical_import();
DELETE FROM vault.secrets WHERE name = 'edge_service_role_key';

-- Restore scheduler_config table
CREATE TABLE IF NOT EXISTS public.scheduler_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduler_config_select" ON public.scheduler_config;
CREATE POLICY "scheduler_config_select"
ON public.scheduler_config FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "scheduler_config_insert" ON public.scheduler_config;
CREATE POLICY "scheduler_config_insert"
ON public.scheduler_config FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "scheduler_config_update" ON public.scheduler_config;
CREATE POLICY "scheduler_config_update"
ON public.scheduler_config FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- Restore scheduler token row
INSERT INTO public.scheduler_config (key, value)
VALUES ('ical_scheduler_token', '088325634b046e75305621d6d69389ff9430dde17214a8fb6f72f5baf829a67c')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Restore Vault secret
DELETE FROM vault.secrets WHERE name = 'ical_scheduler_token';
SELECT vault.create_secret(
  '088325634b046e75305621d6d69389ff9430dde17214a8fb6f72f5baf829a67c',
  'ical_scheduler_token',
  'Shared secret for scheduled iCal import cron job authentication'
);

-- Restore run_scheduled_ical_import() function
CREATE OR REPLACE FUNCTION public.run_scheduled_ical_import()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_token
  FROM public.scheduler_config
  WHERE key = 'ical_scheduler_token'
  LIMIT 1;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Scheduler token not found in scheduler_config';
  END IF;

  v_request_id := net.http_post(
    url := 'https://kxytygmulacvwahvnrtm.supabase.co/functions/v1/ical-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_scheduled_ical_import() TO authenticated;

-- Reschedule cron to call the restored function
SELECT cron.unschedule('run_ical_import');
SELECT cron.schedule('run_ical_import', '*/15 * * * *', 'SELECT public.run_scheduled_ical_import();');
