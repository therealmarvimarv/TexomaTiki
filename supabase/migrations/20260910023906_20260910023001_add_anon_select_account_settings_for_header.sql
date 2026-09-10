/*
# Allow public read of account_settings for branded homepage header

1. Purpose
   - The homepage (public, anon key) needs to read the branded header settings (logo_url, header_taglines, header_tagline_color, header_badges, show_tagline_badges) from account_settings.
   - The existing SELECT policy on account_settings is authenticated-only, so anon cannot read these values.
   - This adds a separate SELECT policy for the anon role so the public homepage can render the header without signing in.

2. Security
   - Adds a new SELECT policy "select_account_settings_anon" scoped TO anon.
   - All other CRUD policies on account_settings remain unchanged.
   - No new grants are added; anon already has SELECT grant from the existing table privileges.
*/

DROP POLICY IF EXISTS "select_account_settings_anon" ON account_settings;
CREATE POLICY "select_account_settings_anon"
  ON account_settings FOR SELECT
  TO anon
  USING (true);