/*
  # Booking Stability Fields

  ## Summary
  Adds missing fields to support full booking lifecycle management:
  declined status tracking, pet count, and special requests.
  Also ensures the status column default and valid values are documented.

  ## Changes to bookings table
  - `declined_at` (timestamptz, nullable) — set when admin declines a pending_payment booking
  - `pets` (integer, default 0) — number of pets in the booking
  - `special_requests` (text, nullable) — guest's special requests or message

  ## Notes
  - Existing columns reused as-is: stripe_checkout_session_id, stripe_payment_intent_id,
    stripe_customer_id, amount_subtotal, amount_fees, amount_tax, amount_total, currency,
    payment_expires_at, confirmed_at, cancelled_at, refunded_at, payment_status, status
  - No duplicate columns are created
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'declined_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN declined_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'pets'
  ) THEN
    ALTER TABLE bookings ADD COLUMN pets integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'special_requests'
  ) THEN
    ALTER TABLE bookings ADD COLUMN special_requests text;
  END IF;
END $$;
