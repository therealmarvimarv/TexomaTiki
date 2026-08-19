-- Bootstrap Part 1: Extensions + Core Tables (users, properties, photo_sections,
-- photo_section_features, property_images, highlights, amenity_categories, amenities,
-- property_amenities, sleeping_arrangements, reviews, neighborhood_highlights, contact_info)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (admin accounts — legacy table, Supabase auth.users is the primary auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Authenticated users can read users') THEN
    CREATE POLICY "Authenticated users can read users" ON users FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Authenticated users can update own record') THEN
    CREATE POLICY "Authenticated users can update own record" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
  END IF;
END $$;

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location text NOT NULL,
  max_guests integer NOT NULL,
  bedrooms integer NOT NULL,
  beds integer NOT NULL,
  bathrooms integer NOT NULL,
  rating numeric(3,2) DEFAULT 0,
  review_count integer DEFAULT 0,
  description text NOT NULL,
  host_name text NOT NULL,
  host_years_hosting integer NOT NULL,
  host_response_rate integer NOT NULL,
  neighborhood_text text NOT NULL,
  house_rules text NOT NULL,
  cancellation_policy text NOT NULL,
  safety_notes text NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  base_price numeric(10,2) NOT NULL,
  cleaning_fee numeric(10,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL,
  deposit_percentage integer DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  display_price_mode text NOT NULL DEFAULT 'base' CHECK (display_price_mode IN ('base', 'average')),
  min_nights integer NOT NULL DEFAULT 1,
  max_nights integer NOT NULL DEFAULT 0,
  min_notice_days integer NOT NULL DEFAULT 1,
  max_advance_days integer NOT NULL DEFAULT 180,
  show_local_recommendations boolean NOT NULL DEFAULT true,
  show_faq boolean NOT NULL DEFAULT true,
  show_guest_info boolean NOT NULL DEFAULT true,
  calendar_export_token text,
  calendar_export_token_created_at timestamptz,
  CONSTRAINT properties_calendar_export_token_key UNIQUE (calendar_export_token)
);
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Anyone can read active properties') THEN
    CREATE POLICY "Anyone can read active properties" ON properties FOR SELECT USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Authenticated users can insert properties') THEN
    CREATE POLICY "Authenticated users can insert properties" ON properties FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Authenticated users can update properties') THEN
    CREATE POLICY "Authenticated users can update properties" ON properties FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Authenticated users can delete properties') THEN
    CREATE POLICY "Authenticated users can delete properties" ON properties FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Photo sections
CREATE TABLE IF NOT EXISTS photo_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, slug)
);
ALTER TABLE photo_sections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_sections' AND policyname = 'Public can read photo sections') THEN
    CREATE POLICY "Public can read photo sections" ON photo_sections FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_sections' AND policyname = 'Authenticated can insert photo sections') THEN
    CREATE POLICY "Authenticated can insert photo sections" ON photo_sections FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_sections' AND policyname = 'Authenticated can update photo sections') THEN
    CREATE POLICY "Authenticated can update photo sections" ON photo_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_sections' AND policyname = 'Authenticated can delete photo sections') THEN
    CREATE POLICY "Authenticated can delete photo sections" ON photo_sections FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Photo section features
CREATE TABLE IF NOT EXISTS photo_section_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES photo_sections(id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE photo_section_features ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_section_features' AND policyname = 'Public can read photo section features') THEN
    CREATE POLICY "Public can read photo section features" ON photo_section_features FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_section_features' AND policyname = 'Authenticated can insert photo section features') THEN
    CREATE POLICY "Authenticated can insert photo section features" ON photo_section_features FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_section_features' AND policyname = 'Authenticated can update photo section features') THEN
    CREATE POLICY "Authenticated can update photo section features" ON photo_section_features FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_section_features' AND policyname = 'Authenticated can delete photo section features') THEN
    CREATE POLICY "Authenticated can delete photo section features" ON photo_section_features FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Property images
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  section_id uuid REFERENCES photo_sections(id) ON DELETE SET NULL,
  storage_path text,
  source text NOT NULL DEFAULT 'url'
);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_images' AND policyname = 'Anyone can read property images') THEN
    CREATE POLICY "Anyone can read property images" ON property_images FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_images' AND policyname = 'Authenticated users can manage property images') THEN
    CREATE POLICY "Authenticated users can manage property images" ON property_images FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_images' AND policyname = 'Authenticated users can update property images') THEN
    CREATE POLICY "Authenticated users can update property images" ON property_images FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_images' AND policyname = 'Authenticated users can delete property images') THEN
    CREATE POLICY "Authenticated users can delete property images" ON property_images FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Highlights
CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  icon text NOT NULL,
  text text NOT NULL,
  sort_order integer NOT NULL,
  subtitle text
);
CREATE INDEX IF NOT EXISTS idx_highlights_property_id ON highlights(property_id);
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'highlights' AND policyname = 'Anyone can read highlights') THEN
    CREATE POLICY "Anyone can read highlights" ON highlights FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'highlights' AND policyname = 'Authenticated users can insert highlights') THEN
    CREATE POLICY "Authenticated users can insert highlights" ON highlights FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'highlights' AND policyname = 'Authenticated users can update highlights') THEN
    CREATE POLICY "Authenticated users can update highlights" ON highlights FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'highlights' AND policyname = 'Authenticated users can delete highlights') THEN
    CREATE POLICY "Authenticated users can delete highlights" ON highlights FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Amenity categories
CREATE TABLE IF NOT EXISTS amenity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL
);
ALTER TABLE amenity_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenity_categories' AND policyname = 'Anyone can read amenity categories') THEN
    CREATE POLICY "Anyone can read amenity categories" ON amenity_categories FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenity_categories' AND policyname = 'Authenticated users can insert amenity categories') THEN
    CREATE POLICY "Authenticated users can insert amenity categories" ON amenity_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenity_categories' AND policyname = 'Authenticated users can update amenity categories') THEN
    CREATE POLICY "Authenticated users can update amenity categories" ON amenity_categories FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenity_categories' AND policyname = 'Authenticated users can delete amenity categories') THEN
    CREATE POLICY "Authenticated users can delete amenity categories" ON amenity_categories FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Amenities
CREATE TABLE IF NOT EXISTS amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES amenity_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_amenities_category_id ON amenities(category_id);
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenities' AND policyname = 'Anyone can read amenities') THEN
    CREATE POLICY "Anyone can read amenities" ON amenities FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenities' AND policyname = 'Authenticated users can insert amenities') THEN
    CREATE POLICY "Authenticated users can insert amenities" ON amenities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenities' AND policyname = 'Authenticated users can update amenities') THEN
    CREATE POLICY "Authenticated users can update amenities" ON amenities FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'amenities' AND policyname = 'Authenticated users can delete amenities') THEN
    CREATE POLICY "Authenticated users can delete amenities" ON amenities FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Property amenities (join)
CREATE TABLE IF NOT EXISTS property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  UNIQUE(property_id, amenity_id)
);
CREATE INDEX IF NOT EXISTS idx_property_amenities_property_id ON property_amenities(property_id);
CREATE INDEX IF NOT EXISTS idx_property_amenities_amenity_id ON property_amenities(amenity_id);
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_amenities' AND policyname = 'Anyone can read property amenities') THEN
    CREATE POLICY "Anyone can read property amenities" ON property_amenities FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_amenities' AND policyname = 'Authenticated users can insert property amenities') THEN
    CREATE POLICY "Authenticated users can insert property amenities" ON property_amenities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_amenities' AND policyname = 'Authenticated users can delete property amenities') THEN
    CREATE POLICY "Authenticated users can delete property amenities" ON property_amenities FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Sleeping arrangements
CREATE TABLE IF NOT EXISTS sleeping_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  bed_type text NOT NULL,
  image_url text,
  sort_order integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sleeping_arrangements_property_id ON sleeping_arrangements(property_id);
ALTER TABLE sleeping_arrangements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleeping_arrangements' AND policyname = 'Anyone can read sleeping arrangements') THEN
    CREATE POLICY "Anyone can read sleeping arrangements" ON sleeping_arrangements FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleeping_arrangements' AND policyname = 'Authenticated users can insert sleeping arrangements') THEN
    CREATE POLICY "Authenticated users can insert sleeping arrangements" ON sleeping_arrangements FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleeping_arrangements' AND policyname = 'Authenticated users can update sleeping arrangements') THEN
    CREATE POLICY "Authenticated users can update sleeping arrangements" ON sleeping_arrangements FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleeping_arrangements' AND policyname = 'Authenticated users can delete sleeping arrangements') THEN
    CREATE POLICY "Authenticated users can delete sleeping arrangements" ON sleeping_arrangements FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_avatar text,
  date timestamptz NOT NULL,
  comment text NOT NULL,
  cleanliness integer NOT NULL,
  accuracy integer NOT NULL,
  check_in integer NOT NULL,
  communication integer NOT NULL,
  location integer NOT NULL,
  value integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON reviews(property_id);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can read reviews') THEN
    CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Authenticated users can insert reviews') THEN
    CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Authenticated users can update reviews') THEN
    CREATE POLICY "Authenticated users can update reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Authenticated users can delete reviews') THEN
    CREATE POLICY "Authenticated users can delete reviews" ON reviews FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Neighborhood highlights
CREATE TABLE IF NOT EXISTS neighborhood_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  distance text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'essentials',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE neighborhood_highlights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'neighborhood_highlights' AND policyname = 'Public can read neighborhood highlights') THEN
    CREATE POLICY "Public can read neighborhood highlights" ON neighborhood_highlights FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'neighborhood_highlights' AND policyname = 'Authenticated users can insert neighborhood highlights') THEN
    CREATE POLICY "Authenticated users can insert neighborhood highlights" ON neighborhood_highlights FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'neighborhood_highlights' AND policyname = 'Authenticated users can update neighborhood highlights') THEN
    CREATE POLICY "Authenticated users can update neighborhood highlights" ON neighborhood_highlights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'neighborhood_highlights' AND policyname = 'Authenticated users can delete neighborhood highlights') THEN
    CREATE POLICY "Authenticated users can delete neighborhood highlights" ON neighborhood_highlights FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Contact info
CREATE TABLE IF NOT EXISTS contact_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  response_time text NOT NULL DEFAULT 'Usually within a few hours',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_info' AND policyname = 'Public can read contact info') THEN
    CREATE POLICY "Public can read contact info" ON contact_info FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_info' AND policyname = 'Authenticated users can insert contact info') THEN
    CREATE POLICY "Authenticated users can insert contact info" ON contact_info FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_info' AND policyname = 'Authenticated users can update contact info') THEN
    CREATE POLICY "Authenticated users can update contact info" ON contact_info FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_info' AND policyname = 'Authenticated users can delete contact info') THEN
    CREATE POLICY "Authenticated users can delete contact info" ON contact_info FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
