-- Drop store_scheduler_secret with explicit signature
DROP FUNCTION IF EXISTS public.store_scheduler_secret(text, text, text);