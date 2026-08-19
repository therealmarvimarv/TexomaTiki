-- Authenticated users (admins) must be able to read blocked_dates for the Admin Calendar.
-- The anon SELECT was revoked in migration 20260522012303 but no authenticated SELECT was added.
CREATE POLICY "Authenticated users can read blocked dates"
  ON blocked_dates FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
