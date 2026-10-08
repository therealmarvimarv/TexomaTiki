/*
# Clean up temporary scheduler helper functions

Removes the temporary helper functions created during the iCal scheduler
fix that are no longer needed. The run_scheduled_ical_import function
now reads directly from the scheduler_config table.
*/

DROP FUNCTION IF EXISTS public.store_scheduler_secret(text, text, text);
DROP FUNCTION IF EXISTS public.scheduler_secret_exists(text);
DROP FUNCTION IF EXISTS public.read_scheduler_secret(text);

-- Also remove the unused Vault secret (was incorrectly stored)
DELETE FROM vault.secrets WHERE name = 'ed_service_role_key';
