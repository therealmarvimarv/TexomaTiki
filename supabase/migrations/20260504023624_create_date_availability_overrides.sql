/*
  # Create date_availability_overrides table

  1. New Table: `date_availability_overrides`
    - `id` (uuid, primary key)
    - `property_id` (uuid, FK → properties)
    - `date` (date, YYYY-MM-DD) — the specific date this override applies to
    - `min_nights` (integer) — custom minimum stay starting on this date; null = use property default
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Constraints
    - Unique on (property_id, date) — one override per date per property

  3. Security
    - RLS enabled
    - Public SELECT (same pattern as date_price_overrides)
    - Authenticated INSERT, UPDATE, DELETE
*/

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

CREATE POLICY "Public can read date availability overrides"
  ON date_availability_overrides FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert date availability overrides"
  ON date_availability_overrides FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update date availability overrides"
  ON date_availability_overrides FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete date availability overrides"
  ON date_availability_overrides FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_date_availability_overrides_property_date
  ON date_availability_overrides(property_id, date);
