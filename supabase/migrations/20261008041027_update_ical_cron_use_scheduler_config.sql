/*
# Update run_scheduled_ical_import to use scheduler_config table

The cron function now reads the scheduler token from the scheduler_config
table instead of Vault. This avoids libcurl header issues with special
characters in the service role key. The hex token has no special characters
and works cleanly in HTTP headers.

Also updates the ical-import edge function to verify_jwt = false so the
Supabase gateway passes the cron request through to the function, which
performs its own auth check using the scheduler token.
*/

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
