/*
  # Add Payment Readiness Fields to Bookings

  ## Summary
  Extends the bookings table with fields needed for full payment lifecycle tracking.
  Only adds fields that do NOT already exist. Existing fields are reused as-is:
    - payment_status (already exists, default 'unpaid')
    - paid_at (already exists)
    - refunded_at (already exists)
    - amount_total (already exists, integer cents — serves as amount_due)
    - stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id (already exist)

  ## New Columns Added

  - `payment_method` (text, nullable) — stripe | manual | cash | zelle | venmo | other
  - `amount_paid` (integer, default 0) — total amount paid in cents
  - `deposit_required` (integer, default 0) — deposit amount due in cents (future use)
  - `security_deposit` (integer, default 0) — security/damage deposit in cents (future use)
  - `payment_notes` (text, nullable) — admin-only internal notes about payment
  - `payment_due_at` (timestamptz, nullable) — when payment is due (future balance-due flows)
  - `refunded_amount` (integer, default 0) — total amount refunded in cents

  ## Notes
  - All money fields use integer cents (e.g. $100.00 = 10000)
  - deposit_required and security_deposit default to 0; not wired into guest checkout yet
  - payment_method defaults NULL; set to 'stripe' by webhook on checkout.session.completed
  - amount_paid updated by webhook after confirmed payment
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_method') THEN
    ALTER TABLE bookings ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'amount_paid') THEN
    ALTER TABLE bookings ADD COLUMN amount_paid integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'deposit_required') THEN
    ALTER TABLE bookings ADD COLUMN deposit_required integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'security_deposit') THEN
    ALTER TABLE bookings ADD COLUMN security_deposit integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_notes') THEN
    ALTER TABLE bookings ADD COLUMN payment_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_due_at') THEN
    ALTER TABLE bookings ADD COLUMN payment_due_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'refunded_amount') THEN
    ALTER TABLE bookings ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0;
  END IF;
END $$;
