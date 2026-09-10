/*
# Add Things to Know visibility flag and editable labels

1. New Columns on `properties`
- `show_things_to_know` (boolean, NOT NULL, default true) — controls visibility of the entire "Things to know" section on the public listing page.
- `things_to_know_heading` (text, nullable) — custom heading for the section; falls back to "Things to know" when null.
- `house_rules_title` (text, nullable) — custom title for the House rules column; falls back to "House rules" when null.
- `cancellation_policy_title` (text, nullable) — custom title for the Cancellation policy column; falls back to "Cancellation policy" when null.
- `safety_notes_title` (text, nullable) — custom title for the Safety & property column; falls back to "Safety & property" when null.

2. Security
- No new tables. No RLS policy changes needed — existing policies on `properties` already cover these columns.

3. Important Notes
- All new columns are additive; no data is lost.
- The boolean defaults to true so existing listings keep showing the section.
- The text columns are nullable so existing rows use the hardcoded fallback labels until an admin sets custom values.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'show_things_to_know'
  ) THEN
    ALTER TABLE properties ADD COLUMN show_things_to_know boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'things_to_know_heading'
  ) THEN
    ALTER TABLE properties ADD COLUMN things_to_know_heading text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'house_rules_title'
  ) THEN
    ALTER TABLE properties ADD COLUMN house_rules_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'cancellation_policy_title'
  ) THEN
    ALTER TABLE properties ADD COLUMN cancellation_policy_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'safety_notes_title'
  ) THEN
    ALTER TABLE properties ADD COLUMN safety_notes_title text;
  END IF;
END $$;