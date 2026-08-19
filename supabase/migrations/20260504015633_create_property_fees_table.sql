/*
  # Create property_fees table

  ## Summary
  Adds a flexible fee system for properties, replacing the single cleaning_fee column
  with a full table supporting standard and custom fees.

  ## New Tables

  ### `property_fees`
  - `id` (uuid, primary key)
  - `property_id` (uuid, FK → properties)
  - `name` (text) — display name, e.g. "Cleaning", "Pets", "Water"
  - `fee_type` (text) — one of: per_stay | per_night | per_guest_per_stay | per_guest_per_night
  - `amount` (numeric) — fee amount in USD
  - `applies_after_guests` (int, nullable) — for "per_guest_*" types: threshold after which fee applies
  - `is_standard` (boolean) — true for the 3 built-in slots (Cleaning, Pets, Additional guests)
  - `enabled` (boolean) — soft toggle; disabled fees are not applied
  - `sort_order` (int)
  - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled; public can read (needed for BookingCard on the frontend)
  - Only authenticated users can insert/update/delete
*/

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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_fees_property_id_idx ON property_fees (property_id);

ALTER TABLE property_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read property fees"
  ON property_fees FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert property fees"
  ON property_fees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update property fees"
  ON property_fees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete property fees"
  ON property_fees FOR DELETE
  TO authenticated
  USING (true);
