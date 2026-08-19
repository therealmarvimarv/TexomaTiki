/*
  # Add active pending_payment bookings to public_availability

  ## Summary
  Guests using Stripe test mode can create pending_payment bookings while in
  Checkout. The server-side availability check already blocks double-booking,
  but the DateRangePicker had no visibility into these holds so a second guest
  could select the same dates until the webhook fired.

  This migration recreates public_availability to include a fourth UNION branch:
  bookings where status = 'pending_payment' AND payment_expires_at > now().
  Those dates are returned with unavailable_type = 'pending_payment' so the
  picker disables them without exposing any booking details.

  ## Changes

  ### 1. Recreate public_availability (SECURITY DEFINER, owned by postgres)
  Four branches:
  - blocked_dates rows        → 'booked' / 'owner_block' / 'blocked'
  - owner_blocks date ranges  → 'owner_block'
  - confirmed/pending_review  → 'booked' / 'pending'
  - active pending_payment    → 'pending_payment'

  Only three columns are returned: property_id, date, unavailable_type.
  No booking IDs, guest PII, payment amounts, or notes.

  ### 2. Re-grant SELECT to anon and authenticated
  Same grants as before; the view is the only public surface for availability.

  ## Security
  - anon cannot query raw bookings (no anon policy on bookings table — confirmed)
  - anon cannot query blocked_dates, owner_blocks directly
  - view runs as postgres (SECURITY DEFINER) so underlying table access is safe
  - expired pending_payment rows (payment_expires_at <= now()) are excluded
*/

-- ── Recreate view ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public_availability;

CREATE VIEW public_availability
  WITH (security_invoker = false)
AS
  -- Branch 1: manually blocked dates (blocked_dates table)
  SELECT
    property_id,
    date,
    CASE
      WHEN source = 'owner'          THEN 'owner_block'
      WHEN source LIKE 'import:%'    THEN 'blocked'
      ELSE 'booked'
    END AS unavailable_type
  FROM blocked_dates

  UNION ALL

  -- Branch 2: owner blocks (date ranges)
  SELECT
    ob.property_id,
    gs::date AS date,
    'owner_block' AS unavailable_type
  FROM owner_blocks ob,
    LATERAL generate_series(
      ob.start_date::timestamp,
      ob.end_date::timestamp - interval '1 day',
      interval '1 day'
    ) gs

  UNION ALL

  -- Branch 3: confirmed and pending_review bookings
  SELECT
    b.property_id,
    gs::date AS date,
    CASE
      WHEN b.status = 'pending_review' THEN 'pending'
      ELSE 'booked'
    END AS unavailable_type
  FROM bookings b,
    LATERAL generate_series(
      b.check_in::date::timestamp,
      b.check_out::date::timestamp - interval '1 day',
      interval '1 day'
    ) gs
  WHERE b.status IN ('confirmed', 'pending_review')

  UNION ALL

  -- Branch 4: active Stripe pending_payment holds
  -- Included only while payment_expires_at is in the future so expired
  -- holds are invisible without a separate cleanup job.
  SELECT
    b.property_id,
    gs::date AS date,
    'pending_payment' AS unavailable_type
  FROM bookings b,
    LATERAL generate_series(
      b.check_in::date::timestamp,
      b.check_out::date::timestamp - interval '1 day',
      interval '1 day'
    ) gs
  WHERE b.status = 'pending_payment'
    AND b.payment_expires_at IS NOT NULL
    AND b.payment_expires_at > now();

-- View must be owned by postgres for SECURITY DEFINER to grant cross-role access
ALTER VIEW public_availability OWNER TO postgres;

-- Re-grant SELECT (same as before)
GRANT SELECT ON public_availability TO anon, authenticated;
