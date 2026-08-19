-- Bootstrap Part 2: Pricing tables, availability, bookings indexes/RLS, payment settings, public_availability view

-- Day-of-week rates
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

-- Date price overrides
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

-- Date availability overrides
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

-- Seasonal pricing presets
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

-- Property fees
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

-- Blocked dates RLS (table already exists, just ensure RLS + policies)
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

-- iCal sources RLS
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

-- Owner blocks
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

-- Bookings indexes (table + columns exist after catchup migration)
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

-- Public availability view
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

-- Payment events
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

-- Payment settings
CREATE TABLE IF NOT EXISTS payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  payment_mode text NOT NULL DEFAULT 'manual' CHECK (payment_mode IN ('manual', 'stripe_test')),
  site_url text NOT NULL DEFAULT '',
  checkout_expires_minutes integer NOT NULL DEFAULT 30 CHECK (checkout_expires_minutes BETWEEN 30 AND 1440),
  stripe_test_enabled boolean NOT NULL DEFAULT false,
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

-- Vault helpers for payment secrets
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
REVOKE ALL ON FUNCTION payment_settings_secret_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_secret_exists(text) TO service_role;

CREATE OR REPLACE FUNCTION payment_settings_secret_preview(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE val text; prefix text; last4 text;
BEGIN
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF val IS NULL OR length(val) < 8 THEN RETURN NULL; END IF;
  IF val LIKE 'sk_test_%' THEN prefix := 'sk_test_';
  ELSIF val LIKE 'whsec_%' THEN prefix := 'whsec_';
  ELSE prefix := ''; END IF;
  last4 := right(val, 4);
  RETURN prefix || '••••••' || last4;
END;
$$;
REVOKE ALL ON FUNCTION payment_settings_secret_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payment_settings_secret_preview(text) TO service_role;

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
