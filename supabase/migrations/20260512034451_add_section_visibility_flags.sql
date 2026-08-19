/*
  # Add Section Visibility Flags to Properties

  ## Summary
  Adds three boolean columns to the properties table to control which guest-facing
  content sections are displayed on the public listing page. Admins can toggle each
  section on or off from the Property Info editor.

  ## Changes to properties table
  - `show_local_recommendations` (boolean, default true) — controls Local Recommendations section
  - `show_faq` (boolean, default true) — controls FAQ accordion section
  - `show_guest_info` (boolean, default true) — controls Guest Information section (house rules, policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'show_local_recommendations'
  ) THEN
    ALTER TABLE properties ADD COLUMN show_local_recommendations boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'show_faq'
  ) THEN
    ALTER TABLE properties ADD COLUMN show_faq boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'show_guest_info'
  ) THEN
    ALTER TABLE properties ADD COLUMN show_guest_info boolean NOT NULL DEFAULT true;
  END IF;
END $$;
