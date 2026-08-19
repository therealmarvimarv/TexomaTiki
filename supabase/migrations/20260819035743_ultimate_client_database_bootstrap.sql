-- =============================================================================
-- ULTIMATE CLIENT DATABASE BOOTSTRAP
-- Vacation rental app — isolated client database setup
-- Version: 2026-06-25
-- =============================================================================

-- SECTION 0: EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- SECTION 1: CORE TABLES

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

-- SECTION 2: PRICING TABLES

CREATE TABLE IF NOT EXISTS day_of_week_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  rate numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_day_of_week_rates_property_id ON day_of_week_rates(property_id);
ALTER TABLE day_of_week_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'day_of_week_rates' AND policyname = 'Anyone can read day of week rates') THEN
    CREATE POLICY "Anyone can read day of week rates" ON day_of_week_rates FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'day_of_week_rates' AND policyname = 'Authenticated users can insert day of week rates') THEN
    CREATE POLICY "Authenticated users can insert day of week rates" ON day_of_week_rates FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'day_of_week_rates' AND policyname = 'Authenticated users can update day of week rates') THEN
    CREATE POLICY "Authenticated users can update day of week rates" ON day_of_week_rates FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'day_of_week_rates' AND policyname = 'Authenticated users can delete day of week rates') THEN
    CREATE POLICY "Authenticated users can delete day of week rates" ON day_of_week_rates FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS date_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  rate numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, date)
);
CREATE INDEX IF NOT EXISTS idx_date_price_overrides_property_id ON date_price_overrides(property_id);
CREATE INDEX IF NOT EXISTS idx_date_price_overrides_date ON date_price_overrides(date);
ALTER TABLE date_price_overrides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_price_overrides' AND policyname = 'Anyone can read date price overrides') THEN
    CREATE POLICY "Anyone can read date price overrides" ON date_price_overrides FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_price_overrides' AND policyname = 'Authenticated users can insert date price overrides') THEN
    CREATE POLICY "Authenticated users can insert date price overrides" ON date_price_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_price_overrides' AND policyname = 'Authenticated users can update date price overrides') THEN
    CREATE POLICY "Authenticated users can update date price overrides" ON date_price_overrides FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_price_overrides' AND policyname = 'Authenticated users can delete date price overrides') THEN
    CREATE POLICY "Authenticated users can delete date price overrides" ON date_price_overrides FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS date_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  min_nights integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (property_id, date)
);
ALTER TABLE date_availability_overrides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_availability_overrides' AND policyname = 'Public can read date availability overrides') THEN
    CREATE POLICY "Public can read date availability overrides" ON date_availability_overrides FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_availability_overrides' AND policyname = 'Authenticated users can insert date availability overrides') THEN
    CREATE POLICY "Authenticated users can insert date availability overrides" ON date_availability_overrides FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_availability_overrides' AND policyname = 'Authenticated users can update date availability overrides') THEN
    CREATE POLICY "Authenticated users can update date availability overrides" ON date_availability_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'date_availability_overrides' AND policyname = 'Authenticated users can delete date availability overrides') THEN
    CREATE POLICY "Authenticated users can delete date availability overrides" ON date_availability_overrides FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_date_availability_overrides_property_date ON date_availability_overrides(property_id, date);

CREATE TABLE IF NOT EXISTS seasonal_pricing_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  nightly_rate numeric(10,2) NOT NULL CHECK (nightly_rate > 0),
  min_nights integer,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_date_order CHECK (end_date >= start_date)
);
ALTER TABLE seasonal_pricing_presets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seasonal_pricing_presets' AND policyname = 'Authenticated users can select seasonal_pricing_presets') THEN
    CREATE POLICY "Authenticated users can select seasonal_pricing_presets" ON seasonal_pricing_presets FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seasonal_pricing_presets' AND policyname = 'Public can read seasonal pricing presets') THEN
    CREATE POLICY "Public can read seasonal pricing presets" ON seasonal_pricing_presets FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seasonal_pricing_presets' AND policyname = 'Authenticated users can insert seasonal_pricing_presets') THEN
    CREATE POLICY "Authenticated users can insert seasonal_pricing_presets" ON seasonal_pricing_presets FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seasonal_pricing_presets' AND policyname = 'Authenticated users can update seasonal_pricing_presets') THEN
    CREATE POLICY "Authenticated users can update seasonal_pricing_presets" ON seasonal_pricing_presets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seasonal_pricing_presets' AND policyname = 'Authenticated users can delete seasonal_pricing_presets') THEN
    CREATE POLICY "Authenticated users can delete seasonal_pricing_presets" ON seasonal_pricing_presets FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_property ON seasonal_pricing_presets(property_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_dates ON seasonal_pricing_presets(start_date, end_date);

CREATE TABLE IF NOT EXISTS property_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  fee_type text NOT NULL DEFAULT 'per_stay'
    CHECK (fee_type IN ('per_stay', 'per_night', 'per_guest_per_stay', 'per_guest_per_night')),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  applies_after_guests int,
  is_standard boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  apply_to_guest_quote boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_fees_property_id_idx ON property_fees (property_id);
ALTER TABLE property_fees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_fees' AND policyname = 'Public can read property fees') THEN
    CREATE POLICY "Public can read property fees" ON property_fees FOR SELECT TO public USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_fees' AND policyname = 'Authenticated users can insert property fees') THEN
    CREATE POLICY "Authenticated users can insert property fees" ON property_fees FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_fees' AND policyname = 'Authenticated users can update property fees') THEN
    CREATE POLICY "Authenticated users can update property fees" ON property_fees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_fees' AND policyname = 'Authenticated users can delete property fees') THEN
    CREATE POLICY "Authenticated users can delete property fees" ON property_fees FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- SECTION 3: AVAILABILITY + CALENDAR TABLES

CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  booking_id uuid,
  CONSTRAINT blocked_dates_property_id_date_key UNIQUE (property_id, date)
);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_id ON blocked_dates(property_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_date ON blocked_dates (property_id, date);
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE blocked_dates FROM anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Authenticated users can read blocked dates') THEN
    CREATE POLICY "Authenticated users can read blocked dates" ON blocked_dates FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Authenticated users can insert blocked dates') THEN
    CREATE POLICY "Authenticated users can insert blocked dates" ON blocked_dates FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Authenticated users can update blocked dates') THEN
    CREATE POLICY "Authenticated users can update blocked dates" ON blocked_dates FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Authenticated users can delete blocked dates') THEN
    CREATE POLICY "Authenticated users can delete blocked dates" ON blocked_dates FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Service role can insert blocked dates') THEN
    CREATE POLICY "Service role can insert blocked dates" ON blocked_dates FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Service role can update blocked dates') THEN
    CREATE POLICY "Service role can update blocked dates" ON blocked_dates FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocked_dates' AND policyname = 'Service role can delete blocked dates') THEN
    CREATE POLICY "Service role can delete blocked dates" ON blocked_dates FOR DELETE TO service_role USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ical_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  enabled boolean DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  platform text NOT NULL DEFAULT 'other',
  ical_source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ical_sources_property_id ON ical_sources(property_id);
ALTER TABLE ical_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ical_sources' AND policyname = 'Authenticated users can read ical sources') THEN
    CREATE POLICY "Authenticated users can read ical sources" ON ical_sources FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ical_sources' AND policyname = 'Authenticated users can insert ical sources') THEN
    CREATE POLICY "Authenticated users can insert ical sources" ON ical_sources FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ical_sources' AND policyname = 'Authenticated users can update ical sources') THEN
    CREATE POLICY "Authenticated users can update ical sources" ON ical_sources FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ical_sources' AND policyname = 'Authenticated users can delete ical sources') THEN
    CREATE POLICY "Authenticated users can delete ical sources" ON ical_sources FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS owner_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  block_type text NOT NULL DEFAULT 'unavailable'
    CHECK (block_type IN ('owner_stay','maintenance','deep_cleaning','private_hold','unavailable','other')),
  reason text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_block_date_order CHECK (end_date > start_date)
);
ALTER TABLE owner_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE owner_blocks FROM anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'owner_blocks' AND policyname = 'Authenticated users can select owner_blocks') THEN
    CREATE POLICY "Authenticated users can select owner_blocks" ON owner_blocks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'owner_blocks' AND policyname = 'Authenticated users can insert owner_blocks') THEN
    CREATE POLICY "Authenticated users can insert owner_blocks" ON owner_blocks FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'owner_blocks' AND policyname = 'Authenticated users can update owner_blocks') THEN
    CREATE POLICY "Authenticated users can update owner_blocks" ON owner_blocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'owner_blocks' AND policyname = 'Authenticated users can delete owner_blocks') THEN
    CREATE POLICY "Authenticated users can delete owner_blocks" ON owner_blocks FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_owner_blocks_property_id ON owner_blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_owner_blocks_dates ON owner_blocks(start_date, end_date);

-- SECTION 4: BOOKINGS + PAYMENTS

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  check_in timestamptz NOT NULL,
  check_out timestamptz NOT NULL,
  guests integer NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  stripe_payment_intent_id text,
  hold_expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  payment_status text NOT NULL DEFAULT 'unpaid',
  stripe_checkout_session_id text,
  stripe_customer_id text,
  amount_subtotal integer,
  amount_fees integer,
  amount_tax integer,
  amount_total integer,
  currency text NOT NULL DEFAULT 'usd',
  payment_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  declined_at timestamptz,
  pets integer NOT NULL DEFAULT 0,
  special_requests text,
  payment_method text,
  amount_paid integer NOT NULL DEFAULT 0,
  deposit_required integer NOT NULL DEFAULT 0,
  security_deposit integer NOT NULL DEFAULT 0,
  payment_notes text,
  payment_due_at timestamptz,
  refunded_amount integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text
);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_checkout_session_id ON bookings(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_status_checkin ON bookings (property_id, status, check_in);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bookings FROM anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Authenticated users can read all bookings') THEN
    CREATE POLICY "Authenticated users can read all bookings" ON bookings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Authenticated users can update bookings') THEN
    CREATE POLICY "Authenticated users can update bookings" ON bookings FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Authenticated users can delete bookings') THEN
    CREATE POLICY "Authenticated users can delete bookings" ON bookings FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Service role can insert bookings') THEN
    CREATE POLICY "Service role can insert bookings" ON bookings FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Service role can update bookings') THEN
    CREATE POLICY "Service role can update bookings" ON bookings FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP VIEW IF EXISTS public_availability;
CREATE VIEW public_availability WITH (security_invoker = false) AS
  SELECT property_id, date,
    CASE
      WHEN source = 'owner'          THEN 'owner_block'
      WHEN source LIKE 'import:%'    THEN 'blocked'
      ELSE 'booked'
    END AS unavailable_type
  FROM blocked_dates
  UNION ALL
  SELECT property_id, gs::date AS date, 'owner_block' AS unavailable_type
  FROM owner_blocks,
    LATERAL generate_series(start_date::timestamp, (end_date - INTERVAL '1 day')::timestamp, INTERVAL '1 day') gs
  UNION ALL
  SELECT b.property_id, gs::date AS date,
    CASE WHEN b.status = 'pending_review' THEN 'pending' ELSE 'booked' END AS unavailable_type
  FROM bookings b,
    LATERAL generate_series(b.check_in::date::timestamp, b.check_out::date::timestamp - interval '1 day', interval '1 day') gs
  WHERE b.status IN ('confirmed', 'pending_review')
  UNION ALL
  SELECT b.property_id, gs::date AS date, 'pending_payment' AS unavailable_type
  FROM bookings b,
    LATERAL generate_series(b.check_in::date::timestamp, b.check_out::date::timestamp - interval '1 day', interval '1 day') gs
  WHERE b.status = 'pending_payment'
    AND b.payment_expires_at IS NOT NULL
    AND b.payment_expires_at > now();
ALTER VIEW public_availability OWNER TO postgres;
REVOKE ALL ON public_availability FROM anon, authenticated;
GRANT SELECT ON public_availability TO anon, authenticated;

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  event_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_booking_id ON payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_events' AND policyname = 'Authenticated admins can read payment events') THEN
    CREATE POLICY "Authenticated admins can read payment events" ON payment_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_events' AND policyname = 'Service role can insert payment events') THEN
    CREATE POLICY "Service role can insert payment events" ON payment_events FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_events' AND policyname = 'Service role can update payment events') THEN
    CREATE POLICY "Service role can update payment events" ON payment_events FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  payment_mode text NOT NULL DEFAULT 'test_manual' CHECK (payment_mode IN ('test_manual', 'test_stripe', 'live_manual', 'live_stripe')),
  site_url text NOT NULL DEFAULT '',
  checkout_expires_minutes integer NOT NULL DEFAULT 30 CHECK (checkout_expires_minutes BETWEEN 30 AND 1440),
  stripe_test_enabled boolean NOT NULL DEFAULT false,
  stripe_test_publishable_key text NOT NULL DEFAULT '',
  stripe_live_publishable_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_settings' AND policyname = 'Authenticated users can read payment settings') THEN
    CREATE POLICY "Authenticated users can read payment settings" ON payment_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_settings' AND policyname = 'Authenticated users can insert payment settings') THEN
    CREATE POLICY "Authenticated users can insert payment settings" ON payment_settings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_settings' AND policyname = 'Authenticated users can update payment settings') THEN
    CREATE POLICY "Authenticated users can update payment settings" ON payment_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION payment_settings_upsert_secret(p_name text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF existing_id IS NULL THEN PERFORM vault.create_secret(p_value, p_name, 'payment setting');
  ELSE PERFORM vault.update_secret(existing_id, p_value, p_name, 'payment setting'); END IF;
END;
$$;
REVOKE ALL ON FUNCTION payment_settings_upsert_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_upsert_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION payment_settings_get_secret(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION payment_settings_get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_get_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION payment_settings_secret_exists(p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name); END;
$$;
REVOKE ALL ON FUNCTION payment_settings_secret_exists(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION payment_settings_secret_exists(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION payment_settings_secret_preview(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE val text; prefix text; last4 text;
BEGIN
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF val IS NULL OR length(val) < 8 THEN RETURN NULL; END IF;
  IF val LIKE 'sk_test_%' THEN prefix := 'sk_test_';
  ELSIF val LIKE 'sk_live_%' THEN prefix := 'sk_live_';
  ELSIF val LIKE 'whsec_%' THEN prefix := 'whsec_';
  ELSE prefix := ''; END IF;
  last4 := right(val, 4);
  RETURN prefix || '••••••' || last4;
END;
$$;
REVOKE ALL ON FUNCTION payment_settings_secret_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_secret_preview(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION payment_settings_delete_secret(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN DELETE FROM vault.secrets WHERE name = p_name; END;
$$;
REVOKE ALL ON FUNCTION payment_settings_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_delete_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION update_payment_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_settings_updated_at') THEN
    CREATE TRIGGER trg_payment_settings_updated_at
      BEFORE UPDATE ON payment_settings
      FOR EACH ROW EXECUTE FUNCTION update_payment_settings_updated_at();
  END IF;
END $$;

-- SECTION 5: INQUIRIES

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Public can insert inquiries') THEN
    CREATE POLICY "Public can insert inquiries" ON inquiries FOR INSERT TO public WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can read inquiries') THEN
    CREATE POLICY "Authenticated admins can read inquiries" ON inquiries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can update inquiry status') THEN
    CREATE POLICY "Authenticated admins can update inquiry status" ON inquiries FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can delete inquiries') THEN
    CREATE POLICY "Authenticated admins can delete inquiries" ON inquiries FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- SECTION 6: NOTIFICATION LOGS

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type text NOT NULL DEFAULT '',
  related_id uuid NULL,
  channel text NOT NULL DEFAULT 'email',
  provider text NOT NULL DEFAULT 'disabled',
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'skipped',
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  template_key text NOT NULL DEFAULT ''
);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Authenticated users can read notification logs') THEN
    CREATE POLICY "Authenticated users can read notification logs" ON notification_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS notification_logs_created_at_idx ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_related_idx ON notification_logs (related_type, related_id);
CREATE INDEX IF NOT EXISTS notification_logs_status_idx ON notification_logs (status);

-- SECTION 7: OWNER OPERATIONS TABLES

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  task_date date NOT NULL,
  checkout_date date NOT NULL,
  assigned_to text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed','scheduled','in_progress','completed','skipped')),
  notes text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can select cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can select cleaning_tasks" ON cleaning_tasks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can insert cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can insert cleaning_tasks" ON cleaning_tasks FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can update cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can update cleaning_tasks" ON cleaning_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can delete cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can delete cleaning_tasks" ON cleaning_tasks FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Service role can insert cleaning_tasks') THEN
    CREATE POLICY "Service role can insert cleaning_tasks" ON cleaning_tasks FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_property_id ON cleaning_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_booking_id ON cleaning_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_task_date ON cleaning_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_status ON cleaning_tasks(status);

CREATE TABLE IF NOT EXISTS maintenance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','archived')),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('repair','cleaning','supplies','inspection','guest_reported','general')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE maintenance_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can select maintenance_notes') THEN
    CREATE POLICY "Authenticated users can select maintenance_notes" ON maintenance_notes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can insert maintenance_notes') THEN
    CREATE POLICY "Authenticated users can insert maintenance_notes" ON maintenance_notes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can update maintenance_notes') THEN
    CREATE POLICY "Authenticated users can update maintenance_notes" ON maintenance_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can delete maintenance_notes') THEN
    CREATE POLICY "Authenticated users can delete maintenance_notes" ON maintenance_notes FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_property_id ON maintenance_notes(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_status ON maintenance_notes(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_priority ON maintenance_notes(priority);

CREATE TABLE IF NOT EXISTS booking_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_internal_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can select booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can select booking_internal_notes" ON booking_internal_notes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can insert booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can insert booking_internal_notes" ON booking_internal_notes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can update booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can update booking_internal_notes" ON booking_internal_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can delete booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can delete booking_internal_notes" ON booking_internal_notes FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_booking_internal_notes_booking_id ON booking_internal_notes(booking_id);

-- SECTION 8: GUEST EXPERIENCE TABLES

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Public can read active faqs') THEN
    CREATE POLICY "Public can read active faqs" ON faqs FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can insert faqs') THEN
    CREATE POLICY "Admins can insert faqs" ON faqs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can update faqs') THEN
    CREATE POLICY "Admins can update faqs" ON faqs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can delete faqs') THEN
    CREATE POLICY "Admins can delete faqs" ON faqs FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS faqs_property_id_idx ON faqs(property_id);

CREATE TABLE IF NOT EXISTS house_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Shield',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE house_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Public can read active house_rules') THEN
    CREATE POLICY "Public can read active house_rules" ON house_rules FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can insert house_rules') THEN
    CREATE POLICY "Admins can insert house_rules" ON house_rules FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can update house_rules') THEN
    CREATE POLICY "Admins can update house_rules" ON house_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can delete house_rules') THEN
    CREATE POLICY "Admins can delete house_rules" ON house_rules FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS house_rules_property_id_idx ON house_rules(property_id);

CREATE TABLE IF NOT EXISTS property_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, policy_type)
);
ALTER TABLE property_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Public can read active property_policies') THEN
    CREATE POLICY "Public can read active property_policies" ON property_policies FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can insert property_policies') THEN
    CREATE POLICY "Admins can insert property_policies" ON property_policies FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can update property_policies') THEN
    CREATE POLICY "Admins can update property_policies" ON property_policies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can delete property_policies') THEN
    CREATE POLICY "Admins can delete property_policies" ON property_policies FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS property_policies_property_id_type_idx ON property_policies(property_id, policy_type);

CREATE TABLE IF NOT EXISTS local_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  description text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  distance_label text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE local_recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Public can read active local_recommendations') THEN
    CREATE POLICY "Public can read active local_recommendations" ON local_recommendations FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can insert local_recommendations') THEN
    CREATE POLICY "Admins can insert local_recommendations" ON local_recommendations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can update local_recommendations') THEN
    CREATE POLICY "Admins can update local_recommendations" ON local_recommendations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can delete local_recommendations') THEN
    CREATE POLICY "Admins can delete local_recommendations" ON local_recommendations FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS local_recommendations_property_id_idx ON local_recommendations(property_id);

-- SECTION 9: EMAIL SETTINGS + TEMPLATES + AUTOMATIONS + ACCOUNT SETTINGS

CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email_provider text NOT NULL DEFAULT 'disabled'
    CHECK (email_provider IN ('disabled', 'smtp', 'resend')),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_from text NOT NULL DEFAULT '',
  admin_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_select_email_settings') THEN
    CREATE POLICY "auth_select_email_settings" ON email_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_insert_email_settings') THEN
    CREATE POLICY "auth_insert_email_settings" ON email_settings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_update_email_settings') THEN
    CREATE POLICY "auth_update_email_settings" ON email_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_delete_email_settings') THEN
    CREATE POLICY "auth_delete_email_settings" ON email_settings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_email_settings_updated_at') THEN
    CREATE TRIGGER trg_email_settings_updated_at
      BEFORE UPDATE ON email_settings
      FOR EACH ROW EXECUTE FUNCTION update_email_settings_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION email_settings_upsert_secret(p_name text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF existing_id IS NULL THEN PERFORM vault.create_secret(p_value, p_name, 'email setting');
  ELSE PERFORM vault.update_secret(existing_id, p_value, p_name, 'email setting'); END IF;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_upsert_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_upsert_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_get_secret(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_get_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_delete_secret(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN DELETE FROM vault.secrets WHERE name = p_name; END;
$$;
REVOKE ALL ON FUNCTION email_settings_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_delete_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_secret_exists(p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name); END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_secret_exists(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_secret_preview(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE val text;
BEGIN
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF val IS NULL OR length(val) < 4 THEN RETURN NULL; END IF;
  RETURN left(val, 3) || '••••';
END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_secret_preview(text) TO service_role;

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, template_key)
);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'anon_no_access_email_templates') THEN
    CREATE POLICY "anon_no_access_email_templates" ON email_templates FOR ALL TO anon USING (false);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_select_email_templates') THEN
    CREATE POLICY "auth_select_email_templates" ON email_templates FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_update_email_templates') THEN
    CREATE POLICY "auth_update_email_templates" ON email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_insert_custom_email_templates') THEN
    CREATE POLICY "auth_insert_custom_email_templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (is_system = false);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_delete_custom_email_templates') THEN
    CREATE POLICY "auth_delete_custom_email_templates" ON email_templates FOR DELETE TO authenticated USING (is_system = false);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  name text NOT NULL DEFAULT '',
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  template_key text,
  recipient_type text NOT NULL DEFAULT 'guest'
    CHECK (recipient_type IN ('guest', 'admin', 'both')),
  trigger_type text NOT NULL
    CHECK (trigger_type IN (
      'booking_request_received', 'booking_request_approved', 'booking_request_declined',
      'booking_confirmed', 'booking_cancelled', 'inquiry_received',
      'before_check_in', 'day_of_check_in', 'after_check_in',
      'before_check_out', 'day_of_check_out', 'after_check_out'
    )),
  offset_days integer NOT NULL DEFAULT 0,
  send_time time,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'select_email_automations') THEN
    CREATE POLICY "select_email_automations" ON email_automations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'insert_email_automations') THEN
    CREATE POLICY "insert_email_automations" ON email_automations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'update_email_automations') THEN
    CREATE POLICY "update_email_automations" ON email_automations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'delete_email_automations') THEN
    CREATE POLICY "delete_email_automations" ON email_automations FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS email_automations_property_template_key_unique
  ON email_automations(property_id, template_key) WHERE template_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_automation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  recipient_email text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, booking_id)
);
ALTER TABLE email_automation_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'select_email_automation_sends') THEN
    CREATE POLICY "select_email_automation_sends" ON email_automation_sends FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'service_insert_email_automation_sends') THEN
    CREATE POLICY "service_insert_email_automation_sends" ON email_automation_sends FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'service_update_email_automation_sends') THEN
    CREATE POLICY "service_update_email_automation_sends" ON email_automation_sends FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid REFERENCES auth.users(id),
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'Owner/Admin',
  owner_name text,
  owner_email text,
  owner_phone text,
  business_name text,
  business_address text,
  support_email text,
  support_phone text,
  support_message text,
  support_hours text,
  support_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  currency text NOT NULL DEFAULT 'USD',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  account_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  property_address text,
  check_in_time text,
  check_out_time text,
  suggested_door_code text,
  listing_name text,
  listing_address text,
  listing_city text,
  listing_state text,
  listing_zip text,
  listing_country text,
  listing_manager_name text,
  listing_manager_role text,
  manager_email text,
  manager_phone text,
  primary_guest_contact_name text,
  primary_guest_contact_email text,
  primary_guest_contact_phone text,
  UNIQUE (property_id)
);
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'select_account_settings') THEN
    CREATE POLICY "select_account_settings" ON account_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'insert_account_settings') THEN
    CREATE POLICY "insert_account_settings" ON account_settings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'update_account_settings') THEN
    CREATE POLICY "update_account_settings" ON account_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'delete_account_settings') THEN
    CREATE POLICY "delete_account_settings" ON account_settings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- SECTION 10: STORAGE BUCKET

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

-- SECTION 11: UTILITY FUNCTIONS

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

-- SECTION 12: PG_CRON JOBS

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres;

SELECT cron.unschedule('cleanup-expired-pending-payments') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-pending-payments');
SELECT cron.schedule('cleanup-expired-pending-payments', '*/5 * * * *', 'SELECT public.cleanup_expired_pending_payment_bookings();');

SELECT cron.unschedule('auto-archive-old-bookings') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-archive-old-bookings');
SELECT cron.schedule('auto-archive-old-bookings', '30 3 * * *', 'SELECT auto_archive_old_bookings()');

SELECT cron.unschedule('cleanup-old-inquiries') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-inquiries');
SELECT cron.schedule('cleanup-old-inquiries', '0 3 * * *', 'SELECT cleanup_old_inquiries()');

-- SECTION 13: SEED — PROPERTY RECORD

INSERT INTO properties (
  id, title, location, max_guests, bedrooms, beds, bathrooms,
  rating, review_count, description, host_name, host_years_hosting,
  host_response_rate, neighborhood_text, house_rules, cancellation_policy,
  safety_notes, latitude, longitude, base_price, cleaning_fee, tax_rate,
  deposit_percentage, is_active
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Tiki Cottage Lake Texoma – Hot Tub & Fun',
  'Gordonville, Texas, United States',
  6, 3, 3, 2, 4.79, 126,
  'Welcome to Tiki Paradise; a tropical rural oasis located a quick drive to Cedar Mills Marina on Lake Texoma!

We partner with great people who do fishing tours, sunset cruises, rent golf carts and water toys! Off-season mid-term available.

Unique & charming; fully equipped for you to indulge in indoor comfort, & outdoor entertainment.

Escape the hustle and bustle of the city to Tiki Paradise that includes a hot tub and amazing backyard! For the fire pit feel free to bring some wood.

The space
3 Bedrooms | 2 Bathrooms | Sleeps 6

BEDROOMS (3)
- Master Room #1 : King bed
- Bedroom #2 : Queen bed
- Bedroom #3 : Queen bed
* Plush bedding
* Bedside tables, lamps, closets

BACKYARD
- Hot Tub
- Tiki Bar
- Grill
- Fire Pit
- Hammock
*Backyard is NOT fully fenced and will not enclose pet*

KITCHEN
- Appliances : fridge, microwave, stove, oven, freezer
- Cooking essentials and dining utensils provided (mixology tools also)
- 4 top Breakfast bar
- Tiki bar seats 4

LIVING ROOM
- Cozy couch
- Love Seat
- Armchairs
- Smart TV

LAUNDRY
- On site
- Washer + Dryer
- Detergent provided

PARKING
- Driveway
- Street front parking also available

SECURITY
- 2 cameras outside (front & back)

AREA
- Rural, but all modern amenities are available. If there is anything you need let us know!

PROXIMITY
- Megastar Casino : (3 miles)
- Cedar Mills Petting Zoo: (1.5 miles)
- Dollar Tree: (3 miles), limited but will have food for prep, snacks, firewood and nick-nacks.
- Gas station: (< 1 mile) has limited food some too and firewood.
- Pelicans Landing Restaurant : (1.5 miles)
- Kitchen 377 (Casino Restaurant): (3 miles)
- Twisted Anchor Grill and Patio: (15 miles)
- "The Bar" Bar : (3 miles)
- Place to Swim and Fish: Cedar Mills Marina : (1.5 miles)
- Juniper Point Public Use Area : (1 mile)
- Cross Timbers Hiking Trail : (2 miles)

*Grocery, Eatery''s, Gas stations all within 2-3 miles of the home.

Guest access
Convenient self-check-in via Smart lock code.
4pm check-in time.

The home is entirely private and to yourself.
- No shared spaces.

Parking
- Driveway

Other things to note
HOT TUB
- 3-4 people at a time MAX
- Make sure to rinse and do not leave overly dirty. Any damage or exceeding dirty water may result additional charges.

PETS
- Each pet has a $60 pet fee
- Must pick up after your pet or we have a $20 per bag fee
- NO pets on furniture or an additional cleaning fee will be submitted.
*Backyard is NOT fully fenced and will not enclose pet*

HOUSE RULES
By booking and confirming your reservation you agree to the following Strict House Rules:
- NO Party''s; zero tolerance
- NO Smoking inside
- Please DO NOT FLUSH anything but TOILET PAPER. We are on septic and any clogging guests will be responsible.
- MAX 6 overnight guests
- MAX 10 guests total on site at any time

Failure to comply with house rules will result in fees, cancellation with no refund, and possible removal of your Airbnb account.',
  'Edwin', 5, 100,
  'Sherwood Shores is a small, quiet lakeside community on Lake Texoma, perfect for those seeking a peaceful getaway. The area offers easy access to water activities, fishing, and boating. Local marinas and restaurants are just a short drive away.',
  'Check-in after 4:00 PM. Checkout before 10:00 AM. Maximum 6 guests. No smoking inside. Pets allowed with prior approval. No parties or events. Respect quiet hours (10 PM - 8 AM).',
  'Free cancellation for 48 hours after booking. Cancel up to 7 days before check-in for a full refund. Cancel within 7 days for a 50% refund. No refund for cancellations within 48 hours of check-in.',
  'Carbon monoxide detector installed. Smoke detector installed. Fire extinguisher available. First aid kit provided. Hot tub safety cover included. Lake access requires supervision for children.',
  33.8523, -96.4919, 175, 75, 0.0825, 20, true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, updated_at = now();

-- SECTION 14: SEED — PROPERTY IMAGES

DELETE FROM property_images WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND section_id IS NULL;
INSERT INTO property_images (property_id, url, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800', 2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800', 3),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1358912/pexels-photo-1358912.jpeg?auto=compress&cs=tinysrgb&w=800', 4)
ON CONFLICT DO NOTHING;

-- SECTION 15: SEED — HIGHLIGHTS

DELETE FROM highlights WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO highlights (property_id, icon, text, subtitle, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'door-open', 'Self check-in', 'Check yourself in with the smartlock.', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'bed', 'Comfy bed for better sleep', 'The room-darkening shades and extra bedding are loved by guests.', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'monitor', 'Dedicated workspace', 'A room with wifi that''s well-suited for working.', 2);

-- SECTION 16: SEED — SLEEPING ARRANGEMENTS

DELETE FROM sleeping_arrangements WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO sleeping_arrangements (property_id, room_name, bed_type, image_url, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 1', 'Queen bed', 'https://images.pexels.com/photos/1454806/pexels-photo-1454806.jpeg?auto=compress&cs=tinysrgb&w=800', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 2', 'Queen bed', 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 3', 'Full bed', 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800', 2);

-- SECTION 17: SEED — REVIEWS

DELETE FROM reviews WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO reviews (property_id, guest_name, guest_avatar, date, comment, cleanliness, accuracy, check_in, communication, location, value) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sarah', '', '2024-02-15', 'Amazing place! The hot tub was absolutely perfect after spending the day on the lake. Edwin was a great host and very responsive. The cottage had everything we needed and more. Highly recommend!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Michael', '', '2024-02-01', 'Perfect getaway spot! Clean, comfortable, and the location is ideal for lake activities. The kitchen was well-equipped and we loved the outdoor space. Will definitely be back!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Jennifer', '', '2024-01-20', 'We had an incredible time at Tiki Cottage! The property exceeded our expectations. Beautiful views, comfortable beds, and the hot tub was a huge hit with everyone. Great communication from the host.', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'David', '', '2024-01-10', 'Lovely cottage with great amenities. Very clean and well-maintained. Only minor issue was the wifi was a bit slow, but overall a fantastic stay. Would recommend to anyone looking for a peaceful lake retreat.', 5, 5, 5, 5, 4, 4),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Amanda', '', '2023-12-28', 'This was the perfect place for our family vacation! The kids loved being so close to the lake, and the adults appreciated the hot tub and comfortable living spaces. Everything was exactly as described. Thank you Edwin!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Robert', '', '2023-12-15', 'Outstanding property! We celebrated our anniversary here and it was perfect. The cottage is beautifully decorated, spotlessly clean, and the hot tub under the stars was so romantic. Can''t wait to return!', 5, 5, 5, 5, 5, 5);

-- SECTION 18: SEED — AMENITIES

DELETE FROM property_amenities WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM amenities;
DELETE FROM amenity_categories;

INSERT INTO amenity_categories (id, name, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Kitchen and dining', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Bathroom', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Bedroom and laundry', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Entertainment', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Heating and cooling', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Home safety', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Internet and office', 7),
  ('c1000000-0000-0000-0000-000000000008', 'Outdoor', 8),
  ('c1000000-0000-0000-0000-000000000009', 'Parking and facilities', 9),
  ('c1000000-0000-0000-0000-000000000010', 'Pets', 10);

INSERT INTO amenities (id, category_id, name, icon) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Kitchen', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Refrigerator', 'refrigerator'),
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Microwave', 'microwave'),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Cooking basics', 'chef-hat'),
  ('a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Dishes and silverware', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'Dishwasher', 'droplets'),
  ('a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001', 'Coffee maker', 'coffee'),
  ('a1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', 'Dining table', 'table-2'),
  ('a1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001', 'Toaster', 'zap'),
  ('a1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 'Blender', 'blend'),
  ('a1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'Wine glasses', 'wine'),
  ('a1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000002', 'Hair dryer', 'wind'),
  ('a1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000002', 'Shampoo', 'droplet'),
  ('a1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000002', 'Hot water', 'droplets'),
  ('a1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000002', 'Shower gel', 'droplet'),
  ('a1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000002', 'Body soap', 'sparkles'),
  ('a1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000002', 'Conditioner', 'droplet'),
  ('a1000000-0000-0000-0000-000000000018', 'c1000000-0000-0000-0000-000000000002', 'Towels', 'layers'),
  ('a1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000003', 'Free washer – In unit', 'washing-machine'),
  ('a1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000003', 'Dryer', 'wind'),
  ('a1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000003', 'Hangers', 'minus'),
  ('a1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000003', 'Bed linens', 'bed'),
  ('a1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000003', 'Extra pillows and blankets', 'bed'),
  ('a1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000003', 'Iron', 'shirt'),
  ('a1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000003', 'Drying rack', 'layout-grid'),
  ('a1000000-0000-0000-0000-000000000026', 'c1000000-0000-0000-0000-000000000003', 'Laundry detergent', 'droplets'),
  ('a1000000-0000-0000-0000-000000000027', 'c1000000-0000-0000-0000-000000000004', '55 inch HDTV with Roku', 'tv'),
  ('a1000000-0000-0000-0000-000000000028', 'c1000000-0000-0000-0000-000000000004', 'Board games', 'gamepad-2'),
  ('a1000000-0000-0000-0000-000000000029', 'c1000000-0000-0000-0000-000000000004', 'Books', 'book-open'),
  ('a1000000-0000-0000-0000-000000000030', 'c1000000-0000-0000-0000-000000000004', 'Sound system', 'music'),
  ('a1000000-0000-0000-0000-000000000031', 'c1000000-0000-0000-0000-000000000004', 'Kayaks', 'waves'),
  ('a1000000-0000-0000-0000-000000000032', 'c1000000-0000-0000-0000-000000000005', 'Air conditioning', 'wind'),
  ('a1000000-0000-0000-0000-000000000033', 'c1000000-0000-0000-0000-000000000005', 'Heating', 'flame'),
  ('a1000000-0000-0000-0000-000000000034', 'c1000000-0000-0000-0000-000000000005', 'Ceiling fan', 'fan'),
  ('a1000000-0000-0000-0000-000000000035', 'c1000000-0000-0000-0000-000000000005', 'Portable fans', 'fan'),
  ('a1000000-0000-0000-0000-000000000036', 'c1000000-0000-0000-0000-000000000005', 'Fireplace', 'flame'),
  ('a1000000-0000-0000-0000-000000000037', 'c1000000-0000-0000-0000-000000000006', 'Exterior security cameras on property', 'camera'),
  ('a1000000-0000-0000-0000-000000000038', 'c1000000-0000-0000-0000-000000000006', 'Smoke alarm', 'bell'),
  ('a1000000-0000-0000-0000-000000000039', 'c1000000-0000-0000-0000-000000000006', 'Carbon monoxide alarm', 'bell-off'),
  ('a1000000-0000-0000-0000-000000000040', 'c1000000-0000-0000-0000-000000000006', 'Fire extinguisher', 'fire-extinguisher'),
  ('a1000000-0000-0000-0000-000000000041', 'c1000000-0000-0000-0000-000000000006', 'First aid kit', 'cross'),
  ('a1000000-0000-0000-0000-000000000042', 'c1000000-0000-0000-0000-000000000006', 'Lockbox', 'lock'),
  ('a1000000-0000-0000-0000-000000000043', 'c1000000-0000-0000-0000-000000000007', 'Wifi', 'wifi'),
  ('a1000000-0000-0000-0000-000000000044', 'c1000000-0000-0000-0000-000000000007', 'Dedicated workspace', 'monitor'),
  ('a1000000-0000-0000-0000-000000000045', 'c1000000-0000-0000-0000-000000000007', 'Printer', 'printer'),
  ('a1000000-0000-0000-0000-000000000046', 'c1000000-0000-0000-0000-000000000008', 'Private hot tub – available all year', 'waves'),
  ('a1000000-0000-0000-0000-000000000047', 'c1000000-0000-0000-0000-000000000008', 'BBQ grill', 'flame'),
  ('a1000000-0000-0000-0000-000000000048', 'c1000000-0000-0000-0000-000000000008', 'Outdoor furniture', 'armchair'),
  ('a1000000-0000-0000-0000-000000000049', 'c1000000-0000-0000-0000-000000000008', 'Outdoor dining area', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000050', 'c1000000-0000-0000-0000-000000000008', 'Lake access', 'waves'),
  ('a1000000-0000-0000-0000-000000000051', 'c1000000-0000-0000-0000-000000000008', 'Fire pit', 'flame'),
  ('a1000000-0000-0000-0000-000000000052', 'c1000000-0000-0000-0000-000000000008', 'Patio', 'door-open'),
  ('a1000000-0000-0000-0000-000000000053', 'c1000000-0000-0000-0000-000000000008', 'Sun loungers', 'armchair'),
  ('a1000000-0000-0000-0000-000000000054', 'c1000000-0000-0000-0000-000000000009', 'Free parking on premises', 'car'),
  ('a1000000-0000-0000-0000-000000000055', 'c1000000-0000-0000-0000-000000000009', 'Private entrance', 'door-open'),
  ('a1000000-0000-0000-0000-000000000056', 'c1000000-0000-0000-0000-000000000009', 'EV charger', 'zap'),
  ('a1000000-0000-0000-0000-000000000057', 'c1000000-0000-0000-0000-000000000010', 'Pets allowed', 'dog'),
  ('a1000000-0000-0000-0000-000000000058', 'c1000000-0000-0000-0000-000000000010', 'Pet bowls', 'circle'),
  ('a1000000-0000-0000-0000-000000000059', 'c1000000-0000-0000-0000-000000000010', 'Pet bed', 'bed'),
  ('a1000000-0000-0000-0000-000000000060', 'c1000000-0000-0000-0000-000000000010', 'Dog leash', 'link');

INSERT INTO property_amenities (property_id, amenity_id)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id FROM amenities;

-- SECTION 19: SEED — NEIGHBORHOOD HIGHLIGHTS + CONTACT INFO

DELETE FROM neighborhood_highlights WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO neighborhood_highlights (property_id, name, distance, category, sort_order)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.name, v.distance, v.category, v.sort_order
FROM (VALUES
  ('Cedar Mills Marina',              '1.5 miles', 'swim',          1),
  ('Juniper Point Public Use Area',   '1 mile',    'swim',          2),
  ('Cross Timbers Hiking Trail',      '2 miles',   'outdoor',       3),
  ('Cedar Mills Petting Zoo',         '1.5 miles', 'outdoor',       4),
  ('Gas Station',                     '< 1 mile',  'essentials',    5),
  ('Dollar Tree',                     '3 miles',   'essentials',    6),
  ('Pelicans Landing Restaurant',     '1.5 miles', 'dining',        7),
  ('Marshall''s Cafe/Restaurant',     '3 miles',   'dining',        8),
  ('Kitchen 377 (Casino Restaurant)', '3 miles',   'dining',        9),
  ('Twisted Anchor Grill and Patio',  '15 miles',  'dining',       10),
  ('"The Bar"',                       '3 miles',   'dining',       11),
  ('Megastar Casino',                 '3 miles',   'entertainment',12)
) AS v(name, distance, category, sort_order);

INSERT INTO contact_info (property_id, email, phone, response_time)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'hello@tikicottage.com', '+1 (555) 123-4567', 'Usually within a few hours')
ON CONFLICT (property_id) DO NOTHING;

-- SECTION 20: SEED — PHOTO SECTIONS + SECTIONED PHOTOS

DELETE FROM property_images WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND section_id IS NOT NULL;
DELETE FROM photo_sections WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

WITH inserted_sections AS (
  INSERT INTO photo_sections (property_id, title, slug, sort_order)
  VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Living Room',       'section-living-room',  1),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Kitchen',      'section-kitchen',       2),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 1',         'section-bedroom-1',     3),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 2',         'section-bedroom-2',     4),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 3',         'section-bedroom-3',     5),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Bathroom 1',   'section-bathroom-1',    6),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Bathroom 2',   'section-bathroom-2',    7),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Workspace',         'section-workspace',     8),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Backyard',          'section-backyard',      9),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Patio',             'section-patio',        10),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Exterior',          'section-exterior',     11),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Additional Photos', 'section-additional',   12)
  ON CONFLICT (property_id, slug) DO NOTHING
  RETURNING id, slug
)
INSERT INTO photo_section_features (section_id, feature, sort_order)
SELECT s.id, f.feature, f.sort_order FROM inserted_sections s
JOIN (VALUES
  ('section-living-room', 'Air conditioning', 1), ('section-living-room', 'Board games', 2),
  ('section-living-room', 'Heating', 3), ('section-living-room', 'Ceiling fan', 4), ('section-living-room', 'TV', 5),
  ('section-kitchen', 'Baking sheet', 1), ('section-kitchen', 'Barbecue utensils', 2),
  ('section-kitchen', 'Coffee', 3), ('section-kitchen', 'Coffee maker', 4), ('section-kitchen', 'Cooking basics', 5),
  ('section-kitchen', 'Dishes and silverware', 6), ('section-kitchen', 'Hot water kettle', 7),
  ('section-kitchen', 'Microwave', 8), ('section-kitchen', 'Refrigerator', 9), ('section-kitchen', 'Oven', 10),
  ('section-kitchen', 'Stove', 11), ('section-kitchen', 'Toaster', 12), ('section-kitchen', 'Wine glasses', 13), ('section-kitchen', 'Blender', 14),
  ('section-bedroom-1', 'Queen bed', 1), ('section-bedroom-1', 'Air conditioning', 2),
  ('section-bedroom-1', 'Bed linens', 3), ('section-bedroom-1', 'Ceiling fan', 4),
  ('section-bedroom-1', 'Extra pillows and blankets', 5), ('section-bedroom-1', 'Heating', 6), ('section-bedroom-1', 'Room-darkening shades', 7),
  ('section-bedroom-2', 'Queen bed', 1), ('section-bedroom-2', 'Air conditioning', 2),
  ('section-bedroom-2', 'Bed linens', 3), ('section-bedroom-2', 'Ceiling fan', 4),
  ('section-bedroom-2', 'Extra pillows and blankets', 5), ('section-bedroom-2', 'Hangers', 6),
  ('section-bedroom-2', 'Room-darkening shades', 7), ('section-bedroom-2', 'Heating', 8),
  ('section-bedroom-3', 'King bed', 1), ('section-bedroom-3', 'Air conditioning', 2),
  ('section-bedroom-3', 'Bed linens', 3), ('section-bedroom-3', 'Ceiling fan', 4),
  ('section-bedroom-3', 'Extra pillows and blankets', 5), ('section-bedroom-3', 'Hangers', 6),
  ('section-bedroom-3', 'Heating', 7), ('section-bedroom-3', 'Room-darkening shades', 8),
  ('section-bathroom-1', 'Air conditioning', 1), ('section-bathroom-1', 'Bathtub', 2),
  ('section-bathroom-1', 'Hair dryer', 3), ('section-bathroom-1', 'Heating', 4), ('section-bathroom-1', 'Hot water', 5),
  ('section-bathroom-2', 'Air conditioning', 1), ('section-bathroom-2', 'Hair dryer', 2), ('section-bathroom-2', 'Hot water', 3),
  ('section-workspace', 'Air conditioning', 1),
  ('section-backyard', 'BBQ grill', 1), ('section-backyard', 'Fire pit', 2), ('section-backyard', 'Hammock', 3),
  ('section-backyard', 'Hot tub', 4), ('section-backyard', 'Outdoor furniture', 5), ('section-backyard', 'Sun loungers', 6)
) AS f(slug, feature, sort_order) ON s.slug = f.slug
ON CONFLICT DO NOTHING;

DO $$
DECLARE pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; sid uuid;
BEGIN
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-living-room' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2631746/pexels-photo-2631746.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-kitchen' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/3935350/pexels-photo-3935350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1599791/pexels-photo-1599791.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1329711/pexels-photo-1329711.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/3773907/pexels-photo-3773907.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2946901/pexels-photo-2946901.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-3' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1454804/pexels-photo-1454804.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2507016/pexels-photo-2507016.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1910472/pexels-photo-1910472.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-workspace' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1181360/pexels-photo-1181360.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-backyard' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2373098/pexels-photo-2373098.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1588880/pexels-photo-1588880.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2132180/pexels-photo-2132180.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1480162/pexels-photo-1480162.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-patio' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-exterior' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-additional' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1430677/pexels-photo-1430677.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2346046/pexels-photo-2346046.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1268558/pexels-photo-1268558.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
END $$;

-- SECTION 21: SEED — FAQs, HOUSE RULES, POLICIES, LOCAL RECOMMENDATIONS

DELETE FROM faqs WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM house_rules WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM local_recommendations WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

DO $$
DECLARE prop_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO faqs (property_id, question, answer, category, sort_order) VALUES
  (prop_id, 'How do I book Tiki Cottage?', 'Select your check-in and check-out dates, enter the number of guests and pets, then click "Reserve." You will be directed to a secure payment page to complete your booking.', 'Booking', 10),
  (prop_id, 'When is my booking confirmed?', 'Your booking is confirmed once your payment is successfully processed. You will receive a confirmation email with your booking details shortly after payment.', 'Booking', 20),
  (prop_id, 'Can I modify my booking after it is confirmed?', 'Please contact the host directly to request changes to your reservation. Modifications are subject to availability and the host''s approval.', 'Booking', 30),
  (prop_id, 'What payment methods are accepted?', 'We accept all major credit and debit cards through our secure Stripe checkout. Card details are never stored on our servers.', 'Payments', 10),
  (prop_id, 'Is my payment secure?', 'Yes. All payments are processed through Stripe, a PCI-compliant payment provider. Your card information is encrypted and handled securely.', 'Payments', 20),
  (prop_id, 'When will I be charged?', 'Your card is charged in full at the time of booking. No payment is held in reserve — the full amount is collected when you complete checkout.', 'Payments', 30),
  (prop_id, 'What time is check-in?', 'Check-in is at 4:00 PM. Early check-in may be available depending on prior bookings — please contact the host to inquire.', 'Check-in / Check-out', 10),
  (prop_id, 'What time is check-out?', 'Check-out is at 11:00 AM. Late check-out may be available depending on upcoming reservations — please contact the host to ask.', 'Check-in / Check-out', 20),
  (prop_id, 'How do I access the property?', 'Detailed access instructions including directions and entry information will be sent to your email after your booking is confirmed. Do not share this information.', 'Check-in / Check-out', 30),
  (prop_id, 'Is parking available?', 'Yes, parking is available on the property. Specific parking details will be included in your arrival instructions.', 'Check-in / Check-out', 40),
  (prop_id, 'Are pets allowed?', 'Pets may be allowed depending on the booking. Please add any pets to your booking request and review the pet policy for details on fees and restrictions.', 'Pets', 10),
  (prop_id, 'Is there a pet fee?', 'A pet fee may apply. The exact fee will be shown during booking if pets are included in your reservation.', 'Pets', 20),
  (prop_id, 'What is the cancellation policy?', 'Cancellation terms depend on the timing of your cancellation relative to your check-in date. Please contact the host as soon as possible if you need to cancel.', 'Cancellations', 10),
  (prop_id, 'What happens if I need to cancel last minute?', 'Late cancellations may not be eligible for a refund. Please review the cancellation policy and reach out to the host promptly if your plans change.', 'Cancellations', 20),
  (prop_id, 'Is the property family-friendly?', 'Yes, Tiki Cottage is family-friendly and suitable for guests of all ages. Please note house rules regarding supervision of children near the water.', 'House Rules', 10),
  (prop_id, 'Is smoking allowed?', 'Smoking is not permitted anywhere inside the property. Designated outdoor areas may be available — please ask the host.', 'House Rules', 20),
  (prop_id, 'How close is the cottage to local attractions?', 'Tiki Cottage is conveniently located near Lake Texoma with easy access to marinas, parks, dining, and outdoor activities. See the Local Recommendations section for nearby places.', 'Local Area', 10),
  (prop_id, 'Is the property near the water?', 'Yes, Tiki Cottage is near Lake Texoma. Please review water safety guidelines and supervise children near the water at all times.', 'Local Area', 20);

INSERT INTO house_rules (property_id, title, description, icon, sort_order) VALUES
  (prop_id, 'No smoking indoors', 'Smoking is not permitted anywhere inside the property. Please smoke outdoors and dispose of materials properly.', 'Cigarette', 10),
  (prop_id, 'No parties or events', 'Parties, large gatherings, and events are not permitted. Please keep the number of guests to the reserved amount.', 'PartyPopper', 20),
  (prop_id, 'Quiet hours', 'Please observe quiet hours from 10 PM to 8 AM out of respect for neighbors.', 'Moon', 30),
  (prop_id, 'Pets must follow pet policy', 'If pets are included in your booking, please follow the pet policy rules including cleanup and furniture guidelines.', 'PawPrint', 40),
  (prop_id, 'Respect the property', 'Please treat the property with care. Guests are responsible for any damages caused during their stay.', 'Shield', 50),
  (prop_id, 'No unauthorized guests', 'Only guests listed in the booking may stay overnight. Visitors must be approved in advance.', 'Users', 60),
  (prop_id, 'Check-in and check-out times', 'Please arrive no earlier than your check-in time and depart by check-out time to allow the property to be prepared for the next guest.', 'Clock', 70),
  (prop_id, 'Leave it clean', 'Please leave the property in a tidy condition. Take out trash, do the dishes, and remove all personal belongings before departing.', 'Sparkles', 80);

INSERT INTO property_policies (property_id, policy_type, title, content, metadata) VALUES
  (prop_id, 'cancellation', 'Cancellation Policy', 'Cancellation terms vary depending on the timing of your request relative to your check-in date. Please contact the host as soon as possible if you need to cancel or change your stay. Late cancellations may not be eligible for a full refund. In the event of severe weather or emergency, please reach out directly and we will do our best to work with you.', '{"contact_instruction": "Contact the host directly to discuss your cancellation."}'),
  (prop_id, 'check_in_out', 'Check-In & Check-Out', 'Check-in is at 4:00 PM and check-out is at 11:00 AM. Early check-in or late check-out may be available depending on surrounding reservations — please contact the host in advance to request. Detailed access instructions will be sent to your email after your booking is confirmed.', '{"check_in_time": "4:00 PM", "check_out_time": "11:00 AM", "early_checkin_note": "Early check-in may be available on request.", "late_checkout_note": "Late check-out may be available on request.", "access_note": "Access instructions will be sent after booking confirmation. Do not share them.", "parking_note": "Parking is available on the property. Details in your arrival instructions."}'),
  (prop_id, 'pet', 'Pet Policy', 'Pets may be allowed depending on the booking. Please include pets when submitting your booking request. A pet fee may apply. All pets must be kept on a leash or under supervision on the property grounds. Please clean up after your pets and do not allow pets on furniture or bedding unless agreed with the host. Any damage caused by pets is the responsibility of the guest.', '{"pets_allowed": true, "max_pets": 2, "pet_fee_note": "Pet fee shown during booking if pets are added.", "leash_required": true, "furniture_note": "Pets are not permitted on furniture or bedding."}'),
  (prop_id, 'accessibility', 'Accessibility Notes', 'We want guests to have accurate expectations before booking. Tiki Cottage is a single-story property with level entry from the main parking area. The primary bedroom and main bathroom are on the ground floor. There are a few steps at the front entry. The property has not been independently certified for ADA compliance. Please contact the host directly with any specific accessibility questions before booking.', '{"single_story": true, "step_free_entry": false, "entry_steps": 2, "bedroom_floor": "ground", "bathroom_accessible": "standard tub/shower combo", "parking_distance": "adjacent", "certification_note": "Not ADA certified. Contact host for specific questions."}')
ON CONFLICT (property_id, policy_type) DO NOTHING;

INSERT INTO local_recommendations (property_id, name, category, description, address, distance_label, website_url, is_featured, sort_order) VALUES
  (prop_id, 'Lake Texoma State Park', 'Beaches & Outdoors', 'Beautiful state park with swimming beaches, hiking trails, and picnic areas right on the lake.', 'Lake Texoma, OK', '5 min drive', 'https://www.travelok.com/state-parks/lake-texoma', true, 10),
  (prop_id, 'Highport Marina', 'Beaches & Outdoors', 'Full-service marina with boat rentals, fishing charters, and lake access.', 'Pottsboro, TX', '10 min drive', '', true, 20),
  (prop_id, 'Lake Texoma Fishing', 'Beaches & Outdoors', 'World-class striped bass fishing. Guided charters available year-round.', 'Lake Texoma', '5 min drive', '', false, 30),
  (prop_id, 'Catfish Bay Marina', 'Beaches & Outdoors', 'Popular local marina with boat launches, camping, and lakeside dining.', 'Kingston, OK', '15 min drive', '', false, 40),
  (prop_id, 'The Dock Restaurant', 'Food & Drinks', 'Casual lakeside dining with fresh seafood, burgers, and sunset views.', 'Pottsboro, TX', '10 min drive', '', true, 50),
  (prop_id, 'Catfish Bay Café', 'Food & Drinks', 'Local favorite for catfish, BBQ, and Southern comfort food.', 'Kingston, OK', '15 min drive', '', false, 60),
  (prop_id, 'Lone Star Coffee', 'Food & Drinks', 'Cozy local coffee shop with espresso drinks, pastries, and Wi-Fi.', 'Pottsboro, TX', '8 min drive', '', false, 70),
  (prop_id, 'Walmart Supercenter', 'Shopping', 'Full-service grocery and general merchandise store for any supplies you need.', 'Pottsboro, TX', '12 min drive', '', false, 80),
  (prop_id, 'Brookshire''s Grocery', 'Shopping', 'Local grocery store with fresh produce, deli, and essentials.', 'Durant, OK', '20 min drive', '', false, 90),
  (prop_id, 'Tanglewood Resort', 'Family Activities', 'Family resort with pools, mini golf, boat rentals, and activities for all ages.', 'Pottsboro, TX', '12 min drive', 'https://www.tanglewoodresort.com', true, 100),
  (prop_id, 'Eisenhower State Park', 'Beaches & Outdoors', 'Scenic park with hiking, picnicking, and access to the lake shoreline.', 'Denison, TX', '20 min drive', '', false, 110),
  (prop_id, 'Pottsboro Animal Clinic', 'Essentials', 'Veterinary clinic for pet emergencies or health needs during your stay.', 'Pottsboro, TX', '10 min drive', '', false, 120),
  (prop_id, 'Medical Center of Southeastern Oklahoma', 'Essentials', 'Full-service hospital for medical emergencies.', 'Durant, OK', '25 min drive', '', false, 130);

END $$;

-- SECTION 22: SEED — EMAIL TEMPLATES

DO $$
DECLARE v_pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_received_guest', 'Booking Request – Guest',
 'Booking Request Received – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Received</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, we received your booking request for <strong>{{listing_name}}</strong> and will review it shortly.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;font-size:14px">{{guest_count}}</td></tr></table><p style="font-size:14px;color:#555">We will be in touch soon to confirm your reservation.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_received_admin', 'Booking Request – Admin',
 'New Booking Request – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">New Booking Request</h2><p style="color:#555;margin:0 0 20px">A new booking request has been submitted for <strong>{{listing_name}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_count}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Estimated Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to approve or decline this request.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_confirmed_guest', 'Booking Confirmed – Guest',
 'Booking Confirmed – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Confirmed!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, your booking at <strong>{{listing_name}}</strong> is confirmed. We look forward to hosting you!</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:14px;color:#555">You will receive access instructions closer to your arrival date. Questions? Contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_confirmed_admin', 'Booking Confirmed – Admin',
 'Booking Confirmed – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Confirmed</h2><p style="color:#555;margin:0 0 20px">A booking at <strong>{{listing_name}}</strong> has been confirmed.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to view the full booking details.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_cancelled_guest', 'Booking Cancelled – Guest',
 'Booking Cancelled – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Cancelled</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, your booking at <strong>{{listing_name}}</strong> has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">If you have questions, contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_cancelled_admin', 'Booking Cancelled – Admin',
 'Booking Cancelled – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Cancelled</h2><p style="color:#555;margin:0 0 20px">A booking at <strong>{{listing_name}}</strong> has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px">{{estimated_total}}</td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to review and manage this booking.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_approved_guest', 'Booking Request Approved – Guest',
 'Your booking request has been approved – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, great news — your booking request at <strong>{{listing_name}}</strong> has been approved. Your dates are being held while payment is pending. Please complete payment to finalize your reservation.</p><div style="margin:24px 0;text-align:center">{{payment_button}}</div><p style="font-size:13px;color:#777;margin:0 0 20px;text-align:center">If the button does not work, copy and paste this link into your browser:<br><a href="{{payment_url}}" style="color:#2563eb">{{payment_url}}</a></p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total Trip Price</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:14px;color:#555;margin:0 0 20px">Questions? Contact us at <a href="mailto:{{primary_guest_contact_email}}">{{primary_guest_contact_email}}</a>.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_approved_admin', 'Booking Request Approved – Admin',
 'Booking Approved – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved</h2><p style="color:#555;margin:0 0 20px">You approved a booking request at <strong>{{listing_name}}</strong>. Dates are now reserved.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">Payment status: <strong>{{payment_status}}</strong> — payment link sent to guest: <a href="{{payment_url}}">{{payment_url}}</a></p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_declined_guest', 'Booking Request Declined – Guest',
 'Your booking request was not approved – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Not Approved</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, unfortunately your booking request at <strong>{{listing_name}}</strong> was not approved for the requested dates.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Requested check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Requested check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555;margin:0 0 12px">Your dates were not reserved and no payment was collected.</p><p style="font-size:14px;color:#555;margin:0 0 20px">You are welcome to check availability for other dates or contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a>.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_declined_admin', 'Booking Request Declined – Admin',
 'Booking Request Declined – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Declined</h2><p style="color:#555;margin:0 0 20px">You declined a booking request at <strong>{{listing_name}}</strong>. The dates remain available.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:13px;color:#777">No payment was collected and no dates were reserved.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'inquiry_received_admin', 'New Inquiry – Admin',
 'New Inquiry from {{guest_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">New Inquiry</h2><p style="color:#555;margin:0 0 20px">Someone sent a message through the <strong>{{listing_name}}</strong> contact form.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{sender_phone}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px;vertical-align:top">Message</td><td style="padding:10px 0;font-size:14px;white-space:pre-wrap">{{inquiry_message}}</td></tr></table><a href="mailto:{{guest_email}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">Reply to {{guest_name}}</a></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'inquiry_auto_reply_guest', 'Inquiry Auto-Reply – Guest',
 'We received your message – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Thanks for reaching out!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, we received your message about <strong>{{listing_name}}</strong> and will get back to you as soon as possible.</p><p style="font-size:14px;color:#555">In the meantime, you can browse availability on the listing page.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'pre_arrival_guest', 'Pre-Arrival Instructions',
 'Your stay at {{listing_name}} is coming up!',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Your stay is almost here!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, we''re looking forward to welcoming you to {{listing_name}} tomorrow.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;font-size:14px">{{guest_count}}</td></tr></table><p style="font-size:14px;color:#555">If you have any questions before you arrive, reply to this email or contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'check_in_day_guest', 'Check-In Day Reminder',
 'Welcome day is here – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Today''s the day!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, your stay at {{listing_name}} begins today. We''re so excited to host you.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">If anything comes up during your stay, don''t hesitate to reach out at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'check_out_reminder_guest', 'Check-Out Reminder',
 'Reminder: Check-out tomorrow at {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Check-out reminder</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, just a friendly reminder that your stay at {{listing_name}} ends tomorrow.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">Please make sure to leave the property tidy. If you have any questions, contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'review_request_guest', 'Review Request',
 'How was your stay at {{listing_name}}?',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">We hope you enjoyed your stay!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, thank you so much for choosing {{listing_name}}. We hope you had a wonderful time!</p><p style="font-size:14px;color:#555">If you enjoyed your stay, we''d love to hear about it. Your feedback means the world to us.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'test_email', 'Test Email',
 'Test Email – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2>Test Email</h2><p>This is a test email from {{listing_name}}. If you received this, your email settings are working correctly.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'stuff_to_do', 'Stuff To Do',
 'Things to do',
 '<div style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f6f6f6;margin:0;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eeeeee;"><tr><td style="padding:28px 24px 12px 24px;"><h2 style="font-size:24px;line-height:1.3;margin:0 0 8px 0;color:#111;font-weight:700;">Things to Do Near Tiki Paradise</h2><p style="font-size:15px;line-height:1.6;color:#555;margin:0;">Hi {{guest_name}}, we''re so glad you''ll be joining us. Below is a helpful list of places nearby where you can eat, play, relax, swim, fish, and explore.</p></td></tr><tr><td style="padding:12px 24px 8px 24px;"><div style="background-color:#f9f9f9;border:1px solid #eeeeee;border-radius:10px;padding:14px;"><p style="font-size:14px;line-height:1.6;color:#555;margin:0;"><strong>Please note:</strong> The area is rural, but most modern amenities are available nearby. If there''s anything you need during your stay, please let us know.</p></div></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Fun Things to Do</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;overflow:hidden;"><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Megastar Casino</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">3 miles</td></tr><tr><td style="padding:12px 14px;color:#111;font-size:14px;font-weight:600;">Cedar Mills Petting Zoo</td><td style="padding:12px 14px;color:#666;font-size:14px;text-align:right;">1.5 miles</td></tr></table></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Grocery & Essentials</h3><div style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;padding:14px;margin-bottom:12px;"><p style="font-size:14px;line-height:1.6;color:#111;margin:0 0 4px 0;font-weight:700;">Dollar Tree <span style="font-weight:400;color:#666;">— 3 miles</span></p><p style="font-size:14px;line-height:1.6;color:#555;margin:0;">Limited selection, but usually has food prep items, snacks, firewood, and small essentials.</p></div><div style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;padding:14px;"><p style="font-size:14px;line-height:1.6;color:#111;margin:0 0 4px 0;font-weight:700;">Gas Station <span style="font-weight:400;color:#666;">— less than 1 mile</span></p><p style="font-size:14px;line-height:1.6;color:#555;margin:0;">Nearby option for limited food items, quick snacks, and firewood.</p></div></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Restaurants</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;overflow:hidden;"><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Pelicans Landing Restaurant</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">1.5 miles</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Kitchen 377 — Casino Restaurant</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">3 miles</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Twisted Anchor Grill & Patio</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">15 miles</td></tr><tr><td style="padding:12px 14px;color:#111;font-size:14px;font-weight:600;">\u201cThe Bar\u201d Bar</td><td style="padding:12px 14px;color:#666;font-size:14px;text-align:right;">3 miles</td></tr></table></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Bars</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;overflow:hidden;"><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Pelicans Landing Restaurant</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">1.5 miles</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">\u201cThe Bar\u201d Bar</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">3 miles</td></tr><tr><td style="padding:12px 14px;color:#111;font-size:14px;font-weight:600;">Kitchen 377 — Casino Bar</td><td style="padding:12px 14px;color:#666;font-size:14px;text-align:right;">3 miles</td></tr></table></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Places to Swim & Fish</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;overflow:hidden;"><tr><td style="padding:12px 14px;color:#111;font-size:14px;font-weight:600;">Cedar Mills Marina</td><td style="padding:12px 14px;color:#666;font-size:14px;text-align:right;">1.5 miles</td></tr></table></td></tr><tr><td style="padding:18px 24px 8px 24px;"><h3 style="font-size:17px;line-height:1.4;margin:0 0 10px 0;color:#111;">Places to Hike</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#fafafa;border:1px solid #eeeeee;border-radius:10px;overflow:hidden;"><tr><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#111;font-size:14px;font-weight:600;">Juniper Point Public Use Area</td><td style="padding:12px 14px;border-bottom:1px solid #eeeeee;color:#666;font-size:14px;text-align:right;">1 mile</td></tr><tr><td style="padding:12px 14px;color:#111;font-size:14px;font-weight:600;">Cross Timbers Hiking Trail</td><td style="padding:12px 14px;color:#666;font-size:14px;text-align:right;">2 miles</td></tr></table></td></tr><tr><td style="padding:18px 24px 8px 24px;"><div style="background-color:#f9f9f9;border:1px solid #eeeeee;border-radius:10px;padding:14px;"><p style="font-size:14px;line-height:1.6;color:#555;margin:0;">We hope this helps you enjoy the area and make the most of your stay. Have fun, relax, and enjoy your time at Tiki Paradise!</p></div></td></tr><tr><td style="padding:20px 24px 28px 24px;"><p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 6px 0;">Have a wonderful stay!</p><p style="font-size:13px;line-height:1.5;color:#777;margin:0;">Tiki Paradise</p></td></tr></table></td></tr></table></div>',
 false, false)
ON CONFLICT (property_id, template_key) DO NOTHING;

END $$;

-- SECTION 23: SEED — EMAIL AUTOMATIONS

DO $$
DECLARE v_pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
VALUES
  (v_pid, 'Booking Request Received – Guest', 'booking_request_received_guest', 'guest', 'booking_request_received', 0, NULL, true,  'Sent to guest when booking request is submitted'),
  (v_pid, 'Booking Request Received – Admin', 'booking_request_received_admin', 'admin', 'booking_request_received', 0, NULL, true,  'Sent to host when booking request is submitted'),
  (v_pid, 'Booking Confirmed – Guest',        'booking_confirmed_guest',        'guest', 'booking_confirmed',        0, NULL, true,  'Sent to guest when booking is confirmed / paid'),
  (v_pid, 'Booking Confirmed – Admin',        'booking_confirmed_admin',        'admin', 'booking_confirmed',        0, NULL, true,  'Sent to host when booking is confirmed / paid'),
  (v_pid, 'Booking Cancelled – Guest',        'booking_cancelled_guest',        'guest', 'booking_cancelled',        0, NULL, true,  'Sent to guest when booking is cancelled'),
  (v_pid, 'Booking Cancelled – Admin',        'booking_cancelled_admin',        'admin', 'booking_cancelled',        0, NULL, true,  'Sent to host when booking is cancelled'),
  (v_pid, 'Inquiry Auto-Reply – Guest',       'inquiry_auto_reply_guest',       'guest', 'inquiry_received',         0, NULL, true,  'Auto-reply sent to guest when inquiry is submitted'),
  (v_pid, 'New Inquiry – Admin',              'inquiry_received_admin',         'admin', 'inquiry_received',         0, NULL, true,  'Sent to host when inquiry is submitted'),
  (v_pid, 'Booking Request Approved – Guest', 'booking_request_approved_guest', 'guest', 'booking_request_approved', 0, NULL, true,  'Sends when admin approves a manual booking request'),
  (v_pid, 'Booking Request Approved – Admin', 'booking_request_approved_admin', 'admin', 'booking_request_approved', 0, NULL, false, 'Admin notice when a booking request is approved'),
  (v_pid, 'Booking Request Declined – Guest', 'booking_request_declined_guest', 'guest', 'booking_request_declined', 0, NULL, true,  'Sends when admin declines a booking request'),
  (v_pid, 'Booking Request Declined – Admin', 'booking_request_declined_admin', 'admin', 'booking_request_declined', 0, NULL, false, 'Admin notice when a booking request is declined'),
  (v_pid, 'Pre-Arrival Instructions',         'pre_arrival_guest',              'guest', 'before_check_in',          1, '09:00:00', false, 'Sent 1 day before check-in at 9:00 AM. Review template before activating.'),
  (v_pid, 'Check-In Day Reminder',            'check_in_day_guest',             'guest', 'day_of_check_in',          0, '08:00:00', false, 'Sent on check-in day at 8:00 AM.'),
  (v_pid, 'Check-Out Reminder',               'check_out_reminder_guest',       'guest', 'before_check_out',         1, '18:00:00', false, 'Sent 1 day before check-out at 6:00 PM.'),
  (v_pid, 'Review Request',                   'review_request_guest',           'guest', 'after_check_out',          1, '10:00:00', false, 'Sent 1 day after check-out at 10:00 AM.'),
  (v_pid, 'Stuff To Do',                      'stuff_to_do',                    'guest', 'day_of_check_in',          1, '12:00:00', false, NULL)
ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

END $$;

-- SECTION 24: SEED — EMAIL SETTINGS, PAYMENT SETTINGS, ACCOUNT SETTINGS

INSERT INTO email_settings (property_id, email_provider, admin_email)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'disabled', '')
ON CONFLICT (property_id) DO NOTHING;

INSERT INTO payment_settings (property_id, payment_mode, stripe_test_enabled, site_url)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'test_manual', false, '')
ON CONFLICT (property_id) DO NOTHING;

INSERT INTO account_settings (property_id, role, timezone, currency, date_format, account_status, support_email, support_message, support_enabled)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Owner/Admin',
  'America/Chicago',
  'USD',
  'MM/DD/YYYY',
  'active',
  'support@example.com',
  'Need help with your website or booking system? Contact support using the information below.',
  true
)
ON CONFLICT (property_id) DO NOTHING;

-- BOOTSTRAP COMPLETE
