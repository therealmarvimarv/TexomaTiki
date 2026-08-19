/*
  # iCal security cleanup and public_availability import source fix

  ## Summary
  Five targeted fixes following the iCal readiness audit. No booking logic,
  pricing logic, or availability structure is changed.

  ## Changes

  ### 1. Fix public_availability — import source matching
  The ical-import function writes blocked_dates with source = 'import:<uuid>'
  (one unique value per calendar source) to enable per-source cleanup.
  The previous view checked `source = 'import'` (exact match), which never
  matched those rows. They fell through to the 'booked' branch instead of
  'blocked'. Fixed by using `source LIKE 'import:%'`.

  ### 2. Revoke anon access to raw owner_blocks
  owner_blocks had full anon table-level grants and a public SELECT policy.
  Anon users could query owner_blocks directly and see reason, notes,
  block_type, created_at — admin-private operational details.
  Revoke all anon grants and drop the public SELECT policy.
  Admin authenticated access and service_role access are preserved.
  Guest availability continues to work through public_availability (SECURITY
  DEFINER), which does not require direct anon table access.

  ### 3. Revoke unnecessary anon grants on bookings
  bookings had full Supabase-default table grants to anon. RLS blocked access
  in practice (no anon SELECT policy), but table-level grants are unnecessary
  and reduce defense in depth. Revoked for hardening.
  service_role access and authenticated access are unaffected.
  create-booking-request and admin-booking-action both use service_role.

  ## Security model after this migration
  - blocked_dates : anon = no access (revoked in earlier migration)
  - bookings      : anon = no access (revoked here)
  - owner_blocks  : anon = no access (revoked here)
  - public_availability view : anon + authenticated = SELECT only (unchanged)
  - import rows now correctly show unavailable_type = 'blocked' in the view
*/

-- ── 1. Fix public_availability: match 'import:<uuid>' source values ───────────
-- The view is SECURITY DEFINER (owner = postgres), so postgres must own the
-- new version too. Drop and recreate to update the CASE expression.

DROP VIEW IF EXISTS public_availability;

CREATE OR REPLACE VIEW public_availability
  WITH (security_invoker = false)
AS
  SELECT
    property_id,
    date,
    CASE
      WHEN source = 'owner'             THEN 'owner_block'
      -- ical-import writes source = 'import:<source-uuid>' for per-source cleanup
      WHEN source LIKE 'import:%'       THEN 'blocked'
      ELSE 'booked'
    END AS unavailable_type
  FROM blocked_dates

  UNION ALL

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

-- ── 2. Revoke anon access to raw owner_blocks ─────────────────────────────────
REVOKE ALL ON TABLE owner_blocks FROM anon;

DROP POLICY IF EXISTS "Public can read owner blocks" ON owner_blocks;

-- ── 3. Revoke unnecessary anon grants on bookings ────────────────────────────
REVOKE ALL ON TABLE bookings FROM anon;
