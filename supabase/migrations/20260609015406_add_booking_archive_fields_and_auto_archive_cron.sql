-- Archive fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by   uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- Auto-archive function
CREATE OR REPLACE FUNCTION auto_archive_old_bookings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bookings
  SET
    archived_at     = now(),
    archive_reason  = 'auto_30_days_after_checkout'
  WHERE
    archived_at IS NULL
    AND check_out < current_date - interval '30 days'
    AND status IN ('confirmed', 'cancelled', 'declined', 'expired', 'payment_failed', 'refunded');
$$;

-- Schedule daily at 3:30 AM UTC
SELECT cron.schedule(
  'auto-archive-old-bookings',
  '30 3 * * *',
  'SELECT auto_archive_old_bookings()'
);
