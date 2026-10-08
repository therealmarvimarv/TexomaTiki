/*
# Cleanup: Remove custom iCal scheduler infrastructure

This migration removes the temporary infrastructure introduced during the
iCal scheduler fix, now replaced by the standard approach:
- scheduler_config table → replaced by Vault secret edge_service_role_key
- run_scheduled_ical_import() function → replaced by run_ical_import()
- ical_scheduler_token Vault secret → replaced by edge_service_role_key
- store_vault_secret / check_vault_secret temp helper RPCs → no longer needed

1. Removed Objects
- public.scheduler_config table (with all RLS policies)
- public.run_scheduled_ical_import() function
- public.store_vault_secret() helper function
- public.check_vault_secret() helper function
- vault.secrets row where name = 'ical_scheduler_token'

2. Important Notes
- public.run_ical_import() remains (the new standard function)
- vault.secrets row 'edge_service_role_key' remains (the service role key)
- The cron job 'run_ical_import' already calls public.run_ical_import()
*/

-- Drop the scheduler_config table (cascades its RLS policies)
DROP TABLE IF EXISTS public.scheduler_config CASCADE;

-- Drop the old scheduler function
DROP FUNCTION IF EXISTS public.run_scheduled_ical_import();

-- Drop the temporary Vault helper functions
DROP FUNCTION IF EXISTS public.store_vault_secret(text, text, text);
DROP FUNCTION IF EXISTS public.check_vault_secret(text);

-- Remove the old scheduler token from Vault
DELETE FROM vault.secrets WHERE name = 'ical_scheduler_token';
