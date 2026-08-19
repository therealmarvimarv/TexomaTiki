-- Add upload tracking columns
ALTER TABLE property_images
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'url';

-- Create public storage bucket with constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload
CREATE POLICY "property_photos_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos');

-- Authenticated users can delete
CREATE POLICY "property_photos_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos');

-- Public can read (so images are visible on the guest site)
CREATE POLICY "property_photos_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'property-photos');
