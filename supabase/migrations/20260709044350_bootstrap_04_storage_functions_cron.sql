-- Bootstrap Part 4: Storage bucket, utility functions, pg_cron jobs

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('property-photos', 'property-photos', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'property_photos_insert_auth') THEN
    CREATE POLICY "property_photos_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-photos');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'property_photos_delete_auth') THEN
    CREATE POLICY "property_photos_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-photos');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'property_photos_select_public') THEN
    CREATE POLICY "property_photos_select_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'property-photos');
  END IF;
END $$;

-- Utility functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_payment_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE bookings SET status = 'expired', payment_status = 'expired', updated_at = now()
  WHERE status = 'pending_payment' AND payment_status = 'pending'
    AND payment_expires_at IS NOT NULL AND payment_expires_at < now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION auto_archive_old_bookings()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE bookings SET archived_at = now(), archive_reason = 'auto_30_days_after_checkout'
  WHERE archived_at IS NULL AND check_out < current_date - interval '30 days'
    AND status IN ('confirmed', 'cancelled', 'declined', 'expired', 'payment_failed', 'refunded');
$$;

CREATE OR REPLACE FUNCTION cleanup_old_inquiries()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM inquiries WHERE status = 'archived' AND created_at < now() - interval '90 days';
$$;

-- pg_cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres;

SELECT cron.unschedule('cleanup-expired-pending-payments') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-pending-payments');
SELECT cron.schedule('cleanup-expired-pending-payments', '*/5 * * * *', 'SELECT public.cleanup_expired_pending_payment_bookings();');

SELECT cron.unschedule('auto-archive-old-bookings') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-archive-old-bookings');
SELECT cron.schedule('auto-archive-old-bookings', '30 3 * * *', 'SELECT auto_archive_old_bookings()');

SELECT cron.unschedule('cleanup-old-inquiries') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-inquiries');
SELECT cron.schedule('cleanup-old-inquiries', '0 3 * * *', 'SELECT cleanup_old_inquiries()');
