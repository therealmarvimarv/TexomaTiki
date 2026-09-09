/*
# Add guest breakdown fields to bookings

1. Changes
- Add `adults` integer column (nullable, default null) to `bookings`
- Add `children` integer column (nullable, default null) to `bookings`
- Add `infants` integer column (nullable, default null) to `bookings`
2. Notes
- Existing bookings keep null values — no backfill, no data invention.
- New bookings will store the adult/child/infant counts from the guest selector.
- The existing `guests` column (total non-infant count) and `pets` column are unchanged.
- Null adults/children/infants means "breakdown unavailable" for historical bookings.
*/

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adults integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS children integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS infants integer;
