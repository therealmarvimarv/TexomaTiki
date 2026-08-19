/*
  # Fix public_availability: include owner_blocks

  ## Summary
  Owner blocks created in the admin (owner_blocks table) were not appearing
  in public_availability because the view only read blocked_dates (which had
  a 'owner' source branch that was never populated — owner blocks go straight
  into owner_blocks, not blocked_dates). Guests could see and book
  owner-blocked dates.

  ## Change
  Add a third UNION ALL branch to public_availability that date-expands
  owner_blocks using generate_series, returning one row per blocked night.

  Convention: owner_blocks.end_date is exclusive (first day NOT blocked),
  identical to how check_out works for bookings.
  So the series runs: start_date <= date < end_date.

  The view continues to expose only three columns: property_id, date,
  unavailable_type. No reason, notes, block_type, IDs, or any private
  detail is returned. The view remains SECURITY DEFINER (owner = postgres)
  so anon users can query it without direct access to owner_blocks.

  ## Security
  - owner_blocks: anon = no access (revoked, unchanged)
  - public_availability: anon = SELECT only (unchanged)
  - No new public surface — view output is identical in shape
*/

DROP VIEW IF EXISTS public_availability;

CREATE OR REPLACE VIEW public_availability
  WITH (security_invoker = false)
AS
  -- Blocked dates recorded explicitly (source='booking', 'import:<uuid>', etc.)
  SELECT
    property_id,
    date,
    CASE
      WHEN source = 'owner'       THEN 'owner_block'
      WHEN source LIKE 'import:%' THEN 'blocked'
      ELSE 'booked'
    END AS unavailable_type
  FROM blocked_dates

  UNION ALL

  -- Owner blocks: date-expand start_date..end_date (end_date is exclusive)
  SELECT
    property_id,
    gs::date AS date,
    'owner_block' AS unavailable_type
  FROM owner_blocks,
    generate_series(
      start_date::timestamp,
      (end_date - INTERVAL '1 day')::timestamp,
      INTERVAL '1 day'
    ) gs

  UNION ALL

  -- Confirmed and pending_review bookings not yet written to blocked_dates
  SELECT
    b.property_id,
    gs::date AS date,
    CASE
      WHEN b.status = 'pending_review' THEN 'pending'
      ELSE 'booked'
    END AS unavailable_type
  FROM bookings b,
    generate_series(
      b.check_in::date,
      b.check_out::date - INTERVAL '1 day',
      INTERVAL '1 day'
    ) gs
  WHERE b.status IN ('confirmed', 'pending_review');

ALTER VIEW public_availability OWNER TO postgres;
GRANT SELECT ON public_availability TO anon, authenticated;
