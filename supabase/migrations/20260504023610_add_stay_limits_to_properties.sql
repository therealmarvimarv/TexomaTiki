/*
  # Add length-of-stay and booking-limit columns to properties

  1. Changes to `properties` table
    - `min_nights` (integer, default 1) — shortest stay allowed
    - `max_nights` (integer, default 0) — longest stay allowed; 0 = no limit
    - `min_notice_days` (integer, default 1) — how many days advance notice required before check-in
    - `max_advance_days` (integer, default 180) — how far in the future a guest can book (days)

  2. Notes
    - All columns have safe defaults so existing rows are unaffected
    - No destructive operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'min_nights'
  ) THEN
    ALTER TABLE properties ADD COLUMN min_nights integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'max_nights'
  ) THEN
    ALTER TABLE properties ADD COLUMN max_nights integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'min_notice_days'
  ) THEN
    ALTER TABLE properties ADD COLUMN min_notice_days integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'max_advance_days'
  ) THEN
    ALTER TABLE properties ADD COLUMN max_advance_days integer NOT NULL DEFAULT 180;
  END IF;
END $$;
