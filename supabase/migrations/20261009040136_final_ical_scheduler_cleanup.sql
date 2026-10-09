/*
# Final iCal scheduler cleanup

## Removes (all now redundant):
1. scheduler_config table
2. Vault secret ical_scheduler_token
3. public.run_scheduled_ical_import() function
4. public.store_scheduler_secret() function (no remaining references)

## Preserves:
- Vault secret edge_service_role_key (the working scheduler secret)
- public.run_ical_import() function (the cron entry point)
- public.verify_ical_scheduler_token() function (the new auth verifier)
- run_ical_import cron job
- manual Admin JWT auth (in the edge function)
- all iCal parsing/sync logic
- run_automated_emails cron (untouched)
*/

-- 1. Remove Vault secret ical_scheduler_token
DELETE FROM vault.secrets WHERE name = 'ical_scheduler_token';

-- 2. Remove public.run_scheduled_ical_import()
DROP FUNCTION IF EXISTS public.run_scheduled_ical_import();

-- 3. Remove public.store_scheduler_secret()
DROP FUNCTION IF EXISTS public.store_scheduler_secret();

-- 4. Remove scheduler_config table
DROP TABLE IF EXISTS public.scheduler_config;