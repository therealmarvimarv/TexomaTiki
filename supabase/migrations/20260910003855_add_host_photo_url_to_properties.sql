/*
# Add host_photo_url column to properties table

1. Changes
- Adds a nullable `host_photo_url` text column to the `properties` table.
- This stores the public URL of an optional host photo uploaded from the admin Property Editor.
- When null, the public homepage falls back to showing the first letter of the host name in the avatar circle.
2. Security
- No new tables. No policy changes needed — the existing properties RLS policies already cover this column.
3. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ to avoid errors on re-run.
- No data is lost; this is purely additive.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'host_photo_url'
  ) THEN
    ALTER TABLE properties ADD COLUMN host_photo_url text;
  END IF;
END $$;