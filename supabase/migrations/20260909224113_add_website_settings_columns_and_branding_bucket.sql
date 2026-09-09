/*
# Add Website Settings columns and branding storage bucket

1. Schema Changes
   - Add four nullable text columns to `account_settings`:
     - `logo_url` — public URL of the uploaded logo image (stored only, not yet displayed publicly)
     - `favicon_url` — public URL of the uploaded favicon image
     - `seo_title` — homepage <title> override
     - `seo_meta_description` — homepage meta description override

2. Storage
   - Create a new public storage bucket `branding` for logo and favicon uploads.
     - Public read access (anyone can view the logo/favicon).
     - Authenticated users can upload and delete files.
     - 2 MB file size limit.
     - Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml, image/x-icon, image/vnd.microsoft.icon.

3. Security (RLS on storage.objects for the branding bucket)
   - SELECT (public read): TO public USING (bucket_id = 'branding')
   - INSERT (auth upload): TO authenticated WITH CHECK (bucket_id = 'branding')
   - DELETE (auth delete): TO authenticated USING (bucket_id = 'branding')

4. Notes
   - All columns are nullable so existing rows and fresh installs work without changes.
   - No existing data is modified or lost.
   - The `account_settings` table already has RLS enabled; no new table-level policies needed.
*/

-- Add columns to account_settings
ALTER TABLE account_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_meta_description text;

-- Create branding storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding bucket
DROP POLICY IF EXISTS "branding_select_public" ON storage.objects;
CREATE POLICY "branding_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_insert_auth" ON storage.objects;
CREATE POLICY "branding_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_delete_auth" ON storage.objects;
CREATE POLICY "branding_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding');
