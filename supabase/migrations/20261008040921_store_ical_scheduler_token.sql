/*
# Store iCal scheduler shared secret in Vault

Creates a shared secret token used by the run_ical_import cron job
to authenticate to the ical-import edge function. The edge function
will be updated to accept this token as an alternative to the service
role key for scheduled invocations.

1. Vault Secrets
- `ical_scheduler_token` — a 64-character hex token used exclusively
  by the pg_cron `run_ical_import` job to authenticate to the
  `ical-import` edge function.
2. Security
- Stored in Supabase Vault (encrypted at rest)
- Never exposed in migration source, cron command, or logs
- Only readable by SECURITY DEFINER functions with vault search_path
*/

SELECT vault.create_secret(
  '088325634b046e75305621d6d69389ff9430dde17214a8fb6f72f5baf829a67c',
  'ical_scheduler_token',
  'Shared secret for scheduled iCal import cron job authentication'
);
