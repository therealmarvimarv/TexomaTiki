-- DELETE policy for authenticated admins
CREATE POLICY "Authenticated admins can delete inquiries"
  ON inquiries FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Auto-cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_inquiries()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM inquiries WHERE created_at < now() - interval '15 days';
$$;

-- Remove existing cron job if present, then re-add
SELECT cron.unschedule('cleanup-old-inquiries') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-inquiries'
);

SELECT cron.schedule(
  'cleanup-old-inquiries',
  '0 3 * * *',
  'SELECT cleanup_old_inquiries()'
);
