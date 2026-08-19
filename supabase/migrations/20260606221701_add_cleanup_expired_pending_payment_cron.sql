-- Cleanup function: marks expired pending_payment bookings as expired.
-- Safe to run repeatedly; only touches status=pending_payment / payment_status=pending
-- where payment_expires_at is in the past.
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_payment_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE bookings
  SET
    status         = 'expired',
    payment_status = 'expired',
    updated_at     = now()
  WHERE
    status             = 'pending_payment'
    AND payment_status = 'pending'
    AND payment_expires_at IS NOT NULL
    AND payment_expires_at < now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Enable pg_cron (no-op if already enabled; Supabase requires cron schema to exist)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage so the scheduler can call the function
GRANT USAGE ON SCHEMA extensions TO postgres;

-- Schedule cleanup every 5 minutes; unschedule first to avoid duplicate on re-run
SELECT cron.unschedule('cleanup-expired-pending-payments')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-pending-payments'
);

SELECT cron.schedule(
  'cleanup-expired-pending-payments',
  '*/5 * * * *',
  'SELECT public.cleanup_expired_pending_payment_bookings();'
);
