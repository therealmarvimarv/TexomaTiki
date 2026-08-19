/*
  # Tiki Cottage - Full Schema Migration

  ## Summary
  Creates all tables required for the Tiki Cottage vacation rental application,
  migrated from MySQL/Prisma to PostgreSQL/Supabase.

  ## Tables Created
  1. `users` - Admin user accounts for the property management dashboard
  2. `properties` - Rental property listings with pricing and details
  3. `property_images` - Photos associated with each property
  4. `highlights` - Key feature highlights shown on property listings
  5. `amenity_categories` - Groupings for amenities (Kitchen, Outdoor, etc.)
  6. `amenities` - Individual amenity items with icons
  7. `property_amenities` - Join table linking properties to amenities
  8. `sleeping_arrangements` - Bedroom/bed configurations per property
  9. `reviews` - Guest reviews with per-category ratings
  10. `pricing_rules` - Date-range based pricing overrides
  11. `bookings` - Guest reservation records with Stripe payment tracking
  12. `blocked_dates` - Dates unavailable for booking (manual or synced)
  13. `ical_sources` - External calendar feed URLs for availability sync

  ## Security
  - RLS enabled on all tables
  - Public read access on properties and related display data
  - Authenticated-only write access on all tables
  - Bookings writable by anyone (guests book without accounts), readable only by admins
*/

-- Users table
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

CREATE POLICY "Authenticated users can read users"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Properties table
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
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active properties"
  ON properties FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete properties"
  ON properties FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Property images
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read property images"
  ON property_images FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage property images"
  ON property_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update property images"
  ON property_images FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete property images"
  ON property_images FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Highlights
CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  icon text NOT NULL,
  text text NOT NULL,
  sort_order integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_highlights_property_id ON highlights(property_id);
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read highlights"
  ON highlights FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert highlights"
  ON highlights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update highlights"
  ON highlights FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete highlights"
  ON highlights FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Amenity categories
CREATE TABLE IF NOT EXISTS amenity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL
);

ALTER TABLE amenity_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read amenity categories"
  ON amenity_categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert amenity categories"
  ON amenity_categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update amenity categories"
  ON amenity_categories FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete amenity categories"
  ON amenity_categories FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Amenities
CREATE TABLE IF NOT EXISTS amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES amenity_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amenities_category_id ON amenities(category_id);
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read amenities"
  ON amenities FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert amenities"
  ON amenities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update amenities"
  ON amenities FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete amenities"
  ON amenities FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Property amenities join table
CREATE TABLE IF NOT EXISTS property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  UNIQUE(property_id, amenity_id)
);

CREATE INDEX IF NOT EXISTS idx_property_amenities_property_id ON property_amenities(property_id);
CREATE INDEX IF NOT EXISTS idx_property_amenities_amenity_id ON property_amenities(amenity_id);
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read property amenities"
  ON property_amenities FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert property amenities"
  ON property_amenities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete property amenities"
  ON property_amenities FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

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

CREATE POLICY "Anyone can read sleeping arrangements"
  ON sleeping_arrangements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert sleeping arrangements"
  ON sleeping_arrangements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sleeping arrangements"
  ON sleeping_arrangements FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sleeping arrangements"
  ON sleeping_arrangements FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

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

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Pricing rules
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  price_per_night numeric(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_property_id ON pricing_rules(property_id);
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pricing rules"
  ON pricing_rules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert pricing rules"
  ON pricing_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pricing rules"
  ON pricing_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pricing rules"
  ON pricing_rules FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Bookings
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
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Blocked dates
CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  booking_id uuid,
  UNIQUE(property_id, date)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_id ON blocked_dates(property_id);
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocked dates"
  ON blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert blocked dates"
  ON blocked_dates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update blocked dates"
  ON blocked_dates FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete blocked dates"
  ON blocked_dates FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- iCal sources
CREATE TABLE IF NOT EXISTS ical_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  enabled boolean DEFAULT true,
  last_sync_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_ical_sources_property_id ON ical_sources(property_id);
ALTER TABLE ical_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ical sources"
  ON ical_sources FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert ical sources"
  ON ical_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update ical sources"
  ON ical_sources FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete ical sources"
  ON ical_sources FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
