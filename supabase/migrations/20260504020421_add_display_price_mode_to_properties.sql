/*
  # Add display_price_mode to properties

  Adds a column that controls whether the public booking card shows the
  static base price or the average of the configured day-of-week rates.

  ## Changes
  - `display_price_mode` (text, default 'base') — 'base' = fixed default nightly
    rate, 'average' = average of day-of-week rates (falls back to base_price if
    no day-of-week rates are configured)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'display_price_mode'
  ) THEN
    ALTER TABLE properties ADD COLUMN display_price_mode text NOT NULL DEFAULT 'base'
      CHECK (display_price_mode IN ('base', 'average'));
  END IF;
END $$;
