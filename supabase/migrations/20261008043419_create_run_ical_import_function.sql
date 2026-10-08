/*
# Create run_ical_import() — standard scheduled iCal sync function

This function replaces the custom run_scheduled_ical_import() wrapper.
It reads the service role key from Vault (edge_service_role_key secret),
strips any embedded newline characters (which break libcurl header parsing),
and calls the ical-import edge function via net.http_post.

SECURITY:
- SECURITY DEFINER with search_path = public, vault
- The service role key is never exposed to non-admin callers
- The function is called by pg_cron on a 15-minute schedule
*/

CREATE OR REPLACE FUNCTION public.run_ical_import()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
  v_clean_key text;
  v_request_id bigint;
BEGIN
  -- Read the service role key from Vault
  SELECT secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'edge_service_role_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Service role key not found in Vault (edge_service_role_key)';
  END IF;

  -- Strip embedded newline characters that break libcurl header parsing
  v_clean_key := replace(replace(v_key, chr(10), ''), chr(13), '');

  -- Call the ical-import edge function
  v_request_id := net.http_post(
    url := 'https://kxytygmulacvwahvnrtm.supabase.co/functions/v1/ical-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_clean_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_ical_import() TO authenticated;
