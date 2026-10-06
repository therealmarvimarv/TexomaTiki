/*
# Create WebP migration rollback backup table

1. Purpose
   - Creates a one-time backup table `property_images_backup_webp_migration`
   - Snapshots all current `property_images` rows before any JPEG-to-WebP conversion
   - Stores original `url` and `storage_path` so they can be restored if rollback is needed
2. New Tables
   - `property_images_backup_webp_migration`
     - `id` (uuid, references property_images.id, NOT primary key here — allows duplicate snapshots)
     - `property_id` (uuid)
     - `url` (text — original URL at time of backup)
     - `storage_path` (text — original storage path at time of backup)
     - `section_id` (uuid, nullable)
     - `sort_order` (integer)
     - `source` (text)
     - `created_at` (timestamptz — original row creation time)
     - `backed_up_at` (timestamptz — when this backup row was created)
3. Security
   - No RLS needed on backup table — it is a migration utility table accessed only via service role
   - No anon/authenticated policies needed
4. Data Population
   - Immediately populates with all current property_images rows
5. Important Notes
   - This table is a rollback safety net. Original JPEG files in storage are also preserved.
   - The backup is idempotent — re-running will not duplicate rows (uses ON CONFLICT DO NOTHING)
*/

CREATE TABLE IF NOT EXISTS property_images_backup_webp_migration (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  url text NOT NULL,
  storage_path text,
  section_id uuid,
  sort_order integer NOT NULL,
  source text NOT NULL,
  created_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO property_images_backup_webp_migration
  (id, property_id, url, storage_path, section_id, sort_order, source, created_at, backed_up_at)
SELECT
  id, property_id, url, storage_path, section_id, sort_order, source, created_at, now()
FROM property_images
ON CONFLICT DO NOTHING;
