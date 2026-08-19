-- Catch-up migration: add columns missing from the early schema so the bootstrap SQL can run cleanly.
-- All statements use IF NOT EXISTS / DO blocks to be safe to re-run.

-- Properties: add columns added after initial schema
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='display_price_mode') THEN
    ALTER TABLE properties ADD COLUMN display_price_mode text NOT NULL DEFAULT 'base' CHECK (display_price_mode IN ('base', 'average'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='min_nights') THEN
    ALTER TABLE properties ADD COLUMN min_nights integer NOT NULL DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='max_nights') THEN
    ALTER TABLE properties ADD COLUMN max_nights integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='min_notice_days') THEN
    ALTER TABLE properties ADD COLUMN min_notice_days integer NOT NULL DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='max_advance_days') THEN
    ALTER TABLE properties ADD COLUMN max_advance_days integer NOT NULL DEFAULT 180;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='show_local_recommendations') THEN
    ALTER TABLE properties ADD COLUMN show_local_recommendations boolean NOT NULL DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='show_faq') THEN
    ALTER TABLE properties ADD COLUMN show_faq boolean NOT NULL DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='show_guest_info') THEN
    ALTER TABLE properties ADD COLUMN show_guest_info boolean NOT NULL DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='calendar_export_token') THEN
    ALTER TABLE properties ADD COLUMN calendar_export_token text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='calendar_export_token_created_at') THEN
    ALTER TABLE properties ADD COLUMN calendar_export_token_created_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_calendar_export_token_key') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_calendar_export_token_key UNIQUE (calendar_export_token);
  END IF;
END $$;

-- Bookings: add all columns from the bootstrap schema that are missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
    ALTER TABLE bookings ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='stripe_checkout_session_id') THEN
    ALTER TABLE bookings ADD COLUMN stripe_checkout_session_id text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='stripe_customer_id') THEN
    ALTER TABLE bookings ADD COLUMN stripe_customer_id text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_subtotal') THEN
    ALTER TABLE bookings ADD COLUMN amount_subtotal integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_fees') THEN
    ALTER TABLE bookings ADD COLUMN amount_fees integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_tax') THEN
    ALTER TABLE bookings ADD COLUMN amount_tax integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_total') THEN
    ALTER TABLE bookings ADD COLUMN amount_total integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='currency') THEN
    ALTER TABLE bookings ADD COLUMN currency text NOT NULL DEFAULT 'usd';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_expires_at') THEN
    ALTER TABLE bookings ADD COLUMN payment_expires_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='confirmed_at') THEN
    ALTER TABLE bookings ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='cancelled_at') THEN
    ALTER TABLE bookings ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='refunded_at') THEN
    ALTER TABLE bookings ADD COLUMN refunded_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='declined_at') THEN
    ALTER TABLE bookings ADD COLUMN declined_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='pets') THEN
    ALTER TABLE bookings ADD COLUMN pets integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='special_requests') THEN
    ALTER TABLE bookings ADD COLUMN special_requests text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_method') THEN
    ALTER TABLE bookings ADD COLUMN payment_method text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount_paid') THEN
    ALTER TABLE bookings ADD COLUMN amount_paid integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='deposit_required') THEN
    ALTER TABLE bookings ADD COLUMN deposit_required integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='security_deposit') THEN
    ALTER TABLE bookings ADD COLUMN security_deposit integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_notes') THEN
    ALTER TABLE bookings ADD COLUMN payment_notes text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_due_at') THEN
    ALTER TABLE bookings ADD COLUMN payment_due_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='refunded_amount') THEN
    ALTER TABLE bookings ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='archived_at') THEN
    ALTER TABLE bookings ADD COLUMN archived_at timestamptz;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='archived_by') THEN
    ALTER TABLE bookings ADD COLUMN archived_by uuid;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='archive_reason') THEN
    ALTER TABLE bookings ADD COLUMN archive_reason text;
  END IF;
END $$;

-- property_images: add missing columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_images' AND column_name='storage_path') THEN
    ALTER TABLE property_images ADD COLUMN storage_path text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_images' AND column_name='source') THEN
    ALTER TABLE property_images ADD COLUMN source text NOT NULL DEFAULT 'url';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_images' AND column_name='section_id') THEN
    ALTER TABLE property_images ADD COLUMN section_id uuid REFERENCES photo_sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ical_sources: add missing columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ical_sources' AND column_name='platform') THEN
    ALTER TABLE ical_sources ADD COLUMN platform text NOT NULL DEFAULT 'other';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ical_sources' AND column_name='ical_source_id') THEN
    ALTER TABLE ical_sources ADD COLUMN ical_source_id text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ical_sources' AND column_name='updated_at') THEN
    ALTER TABLE ical_sources ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
