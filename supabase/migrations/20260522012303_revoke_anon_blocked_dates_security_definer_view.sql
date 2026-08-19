/*
  # Revoke anon SELECT on blocked_dates; harden public_availability view

  ## Summary
  The raw `blocked_dates` table was readable by anon users, exposing
  property_id, date, source, and booking_id. Guest-facing code now uses
  the `public_availability` view exclusively, so direct anon access to
  blocked_dates is no longer needed.

  ## Changes

  ### 1. Revoke anon table-level privileges on blocked_dates
  Remove the broad anon grants that were applied by Supabase defaults.
  Authenticated and service_role access is preserved.

  ### 2. Drop the anon RLS SELECT policy on blocked_dates
  "Anyone can read blocked dates" allowed anon users to bypass intent
  even with table grants removed; drop it explicitly.

  ### 3. Recreate public_availability as SECURITY DEFINER
  A plain view runs as the querying user's role. After revoking anon
  access to blocked_dates, the plain view would fail for anon users.
  SECURITY DEFINER makes the view execute as its owner (postgres), which
  always has access to the underlying tables. The view itself still only
  returns (property_id, date, unavailable_type) — no PII.

  ### 4. Re-grant SELECT on the view to anon and authenticated
  The view is the only public surface for availability data.

  ### Security model after this migration
  - blocked_dates: anon = no access at all (table or RLS)
  - blocked_dates: authenticated = SELECT/INSERT/UPDATE/DELETE (admin use)
  - blocked_dates: service_role = SELECT/INSERT/UPDATE/DELETE (edge functions)
  - public_availability view: anon + authenticated = SELECT only
  - Guests query only public_availability (3 safe columns, no PII)
*/

-- ─── 1. Revoke all anon grants on blocked_dates ───────────────────────────────
REVOKE ALL ON TABLE blocked_dates FROM anon;

-- ─── 2. Drop the public/anon RLS SELECT policy ────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read blocked dates" ON blocked_dates;

-- ─── 3. Recreate public_availability as SECURITY DEFINER view ────────────────
-- Drop the existing plain view first, then recreate with SECURITY DEFINER.
DROP VIEW IF EXISTS public_availability;

CREATE OR REPLACE VIEW public_availability
  WITH (security_invoker = false)
AS
  SELECT
    property_id,
    date,
    CASE
      WHEN source = 'owner'  THEN 'owner_block'
      WHEN source = 'import' THEN 'blocked'
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

-- Make the view owned by postgres so SECURITY DEFINER runs with full access
ALTER VIEW public_availability OWNER TO postgres;

-- ─── 4. Grant SELECT on the view to anon and authenticated ───────────────────
GRANT SELECT ON public_availability TO anon, authenticated;
