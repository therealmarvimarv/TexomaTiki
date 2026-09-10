/*
# Add branded homepage header settings

1. Purpose
   - Adds the small set of durable settings needed for the configurable branded header shown above the homepage photo gallery.
   - Reuses the existing `account_settings` row and the existing `logo_url` field; no new logo upload system or storage bucket is created.

2. New Columns on `account_settings`
   - `header_taglines` (`text[]`, default empty array): up to three curated or custom short tagline phrases.
   - `header_tagline_color` (`text`, default `#0f88bd`): the accent color used for the tagline and first badge.
   - `header_badges` (`text[]`, default empty array): up to four approved badge keys; labels remain controlled by the application.
   - `show_tagline_badges` (`boolean`, default `true`): controls whether the right-side tagline and badge area is shown.

3. Security
   - No new table or storage object is created.
   - Existing `account_settings` row-level security and policies remain unchanged.

4. Compatibility and data safety
   - Existing account rows receive safe defaults and retain all existing values.
   - No existing columns, tables, files, or stored media are removed or renamed.
*/

ALTER TABLE account_settings
  ADD COLUMN IF NOT EXISTS header_taglines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS header_tagline_color text NOT NULL DEFAULT '#0f88bd',
  ADD COLUMN IF NOT EXISTS header_badges text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_tagline_badges boolean NOT NULL DEFAULT true;