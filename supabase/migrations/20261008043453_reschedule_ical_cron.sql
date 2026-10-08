/*
# Reschedule cron job to use run_ical_import()

Unschedule the old cron job that called run_scheduled_ical_import()
and replace it with one that calls the new run_ical_import() function.
*/

SELECT cron.unschedule('run_ical_import');
SELECT cron.schedule('run_ical_import', '*/15 * * * *', 'SELECT public.run_ical_import();');
