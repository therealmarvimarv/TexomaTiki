ALTER TABLE property_fees
  ADD COLUMN IF NOT EXISTS apply_to_guest_quote boolean NOT NULL DEFAULT true;
