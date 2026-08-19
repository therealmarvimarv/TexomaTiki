/*
  # iCal Calendar Export Hardening

  ## Summary
  Adds the fields needed to secure the iCal export feed and improve iCal import
  source tracking. No existing columns are changed or removed.

  ## Changes

  ### properties table
  - `calendar_export_token` (text, unique, nullable) — random unguessable token
    required to access the iCal export endpoint. Generated on first use or on
    admin request to regenerate. Kept nullable so existing rows are unaffected
    until token is assigned.
  - `calendar_export_token_created_at` (timestamptz, nullable) — timestamp when
    the token was last generated or regenerated, for admin visibility.

  ### ical_sources table
  - `platform` (text, default 'other') — human label for the calendar platform
    (e.g. 'airbnb', 'vrbo', 'booking_com', 'other'). Used in admin UI.
  - `ical_source_id` (text, nullable) — stable opaque identifier stored on each
    blocked_date row so per-source cleanup can delete exactly the rows created by
    one source without touching other sources' blocks.
  - `created_at` (timestamptz, default now()) — when the source was added.
  - `updated_at` (timestamptz, default now()) — last modification timestamp.

  ## Security
  - No RLS policies changed.
  - calendar_export_token is server-side only; the export endpoint validates it
    before returning any calendar data.
  - No guest-facing tables are modified.
*/

-- ── properties: export token fields ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'calendar_export_token'
  ) THEN
    ALTER TABLE properties ADD COLUMN calendar_export_token text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'calendar_export_token_created_at'
  ) THEN
    ALTER TABLE properties ADD COLUMN calendar_export_token_created_at timestamptz;
  END IF;
END $$;

-- Unique constraint on the token so two properties can't share one
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_calendar_export_token_key'
  ) THEN
    ALTER TABLE properties ADD CONSTRAINT properties_calendar_export_token_key
      UNIQUE (calendar_export_token);
  END IF;
END $$;

-- ── ical_sources: platform, stable source id, timestamps ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ical_sources' AND column_name = 'platform'
  ) THEN
    ALTER TABLE ical_sources ADD COLUMN platform text NOT NULL DEFAULT 'other';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ical_sources' AND column_name = 'ical_source_id'
  ) THEN
    -- Stable short identifier used as the value stored in blocked_dates.source
    -- for blocks imported by this source. Filled with id::text on first sync.
    ALTER TABLE ical_sources ADD COLUMN ical_source_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ical_sources' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ical_sources ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ical_sources' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ical_sources ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
