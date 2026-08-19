/*
  # Add Day-of-Week Rates and Date Override Pricing

  ## Summary
  Adds two pricing tables to support flexible nightly rate configuration:

  ## New Tables

  ### `day_of_week_rates`
  Stores the default nightly rate for each day of the week for a property.
  - `property_id` - references the property
  - `day_of_week` - integer 0 (Sunday) through 6 (Saturday)
  - `rate` - nightly price for that day of week

  ### `date_price_overrides`
  Stores custom nightly rates for specific calendar dates, overriding day-of-week defaults.
  - `property_id` - references the property
  - `date` - the specific calendar date (date type)
  - `rate` - custom nightly price for that date

  ## Security
  - RLS enabled on both tables
  - Public can read (for frontend calendar display)
  - Only authenticated users can insert/update/delete
*/

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

CREATE POLICY "Anyone can read day of week rates"
  ON day_of_week_rates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert day of week rates"
  ON day_of_week_rates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update day of week rates"
  ON day_of_week_rates FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete day of week rates"
  ON day_of_week_rates FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── Date price overrides ──────────────────────────────────────────────────────

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

CREATE POLICY "Anyone can read date price overrides"
  ON date_price_overrides FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert date price overrides"
  ON date_price_overrides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update date price overrides"
  ON date_price_overrides FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete date price overrides"
  ON date_price_overrides FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
