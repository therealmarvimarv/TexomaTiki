-- Register the run_ical_import pg_cron job.
-- This schedules automatic iCal import every 15 minutes, invoking the
-- ical-import Edge Function with the service-role key so it runs the same
-- "sync all enabled sources" path as the manual "Sync All" button.
-- Idempotent: unschedules an existing job of the same name before scheduling.

SELECT cron.unschedule('run_ical_import') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run_ical_import'
);

SELECT cron.schedule(
  'run_ical_import',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/ical-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;$$
);
