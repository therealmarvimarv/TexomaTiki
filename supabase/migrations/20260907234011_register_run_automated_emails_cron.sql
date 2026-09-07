-- Register the missing run_automated_emails pg_cron job.
-- Source of truth: 20260610033952_add_email_automations_tables_and_seed.sql
-- This job was defined in that migration but never landed in the live database.

SELECT cron.unschedule('run_automated_emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run_automated_emails'
);

SELECT cron.schedule(
  'run_automated_emails',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/send-automated-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;$$
);
