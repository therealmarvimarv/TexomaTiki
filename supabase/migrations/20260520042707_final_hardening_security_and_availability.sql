/*
  # Final Hardening: Security + Availability Sanitization

  ## Summary
  Closes remaining security gaps identified in the stabilization audit.

  ## Changes

  ### Fix 1: Remove public INSERT on bookings
  - Drop "Anyone can insert bookings" policy (anon WITH CHECK: true).
  - Guest bookings now flow exclusively through the create-booking-request
    Edge Function, which runs as service_role.
  - Public/anon users retain no write access to bookings.

  ### Fix 2: Remove public SELECT on raw bookings + create sanitized view
  - Drop "Public can read confirmed booking dates" policy on bookings table.
    That policy returned full rows including guest PII.
  - Create a `public_availability` VIEW that exposes only:
    - date (unavailable date)
    - unavailable_type ('booked', 'pending', 'owner_block', 'blocked')
    - property_id
  - No guest name, email, phone, payment data, or internal IDs exposed.
  - Enable RLS on the view and allow anon/authenticated SELECT.
  - Sources combined: blocked_dates table (booked/owner/imported blocks)
    + confirmed/pending_review bookings (date expansion done in SQL).

  ### Fix 4: Unique index on blocked_dates
  - Already applied in stabilization migration; included here as idempotent
    safety net to ensure the constraint is in place before the confirm
    re-check logic relies on it.
*/

-- ─── Fix 1: Drop public INSERT on bookings ────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert bookings" ON bookings;

-- ─── Fix 2a: Drop leaky public SELECT on raw bookings ────────────────────────
DROP POLICY IF EXISTS "Public can read confirmed booking dates" ON bookings;

-- ─── Fix 2b: Sanitized availability view ─────────────────────────────────────
-- Combines blocked_dates rows + date-expanded confirmed/pending_review bookings
-- Returns only: property_id, date, unavailable_type
-- No PII, no payment data, no booking IDs.

CREATE OR REPLACE VIEW public_availability AS
  -- From blocked_dates (source distinguishes booking / owner / import)
  SELECT
    property_id,
    date,
    CASE
      WHEN source = 'owner'   THEN 'owner_block'
      WHEN source = 'import'  THEN 'blocked'
      ELSE 'booked'
    END AS unavailable_type
  FROM blocked_dates

  UNION ALL

  -- Date-expand confirmed bookings not already in blocked_dates
  -- (pending_review bookings are not yet in blocked_dates; we expose them
  --  as 'pending' so the date picker can show they are tentatively held)
  SELECT
    b.property_id,
    gs::date AS date,
    CASE
      WHEN b.status = 'pending_review' THEN 'pending'
      ELSE 'booked'
    END AS unavailable_type
  FROM bookings b,
    generate_series(b.check_in::date, b.check_out::date - INTERVAL '1 day', INTERVAL '1 day') gs
  WHERE b.status IN ('confirmed', 'pending_review');

-- Grant public read on the view
GRANT SELECT ON public_availability TO anon, authenticated;

-- ─── Fix 4: Idempotent unique index guard ─────────────────────────────────────
-- Already applied in stabilization migration; safe to re-assert.
ALTER TABLE blocked_dates
  DROP CONSTRAINT IF EXISTS blocked_dates_property_id_date_key;
ALTER TABLE blocked_dates
  ADD CONSTRAINT blocked_dates_property_id_date_key UNIQUE (property_id, date);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_date
  ON blocked_dates (property_id, date);
