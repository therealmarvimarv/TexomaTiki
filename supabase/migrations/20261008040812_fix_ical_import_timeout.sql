/*
# Fix run_scheduled_ical_import timeout and header handling

Increase the pg_net timeout from the default 5s to 30s to accommodate
the ical-import edge function which fetches external iCal feeds.
The ical-import function itself has a 15s per-feed fetch timeout,
so 30s gives enough headroom for the overall request.
*/

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
  SELECT secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'ed_service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret ed_service_role_key not found';
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

GRANT EXECUTE ON FUNCTION public.run_scheduled_ical_import() TO authenticated;
