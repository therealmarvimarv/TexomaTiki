/*
  # Owner Operations Tables

  Adds four new tables for owner/admin operations:

  1. cleaning_tasks — Track property turnovers after guest stays
     - Links to bookings (optional), has assigned_to, status, notes
     - Status: needed | scheduled | in_progress | completed | skipped

  2. maintenance_notes — Track repairs, supplies, inspections, general tasks
     - Priority: low | medium | high | urgent
     - Status: open | in_progress | completed | archived
     - Category: repair | cleaning | supplies | inspection | guest_reported | general

  3. booking_internal_notes — Private admin notes per booking (never guest-visible)
     - Linked to booking_id
     - admin_label for display (auto-filled)

  4. seasonal_pricing_presets — Reusable date-range pricing rules
     - Wins over day-of-week and base pricing, loses to date-specific overrides
     - Has priority field for tie-breaking when date ranges overlap

  Security:
  - RLS enabled on all four tables
  - Only authenticated users (admins) can read/write
  - Public (anon) cannot access any of these tables
*/

-- ─── 1. cleaning_tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id    uuid REFERENCES bookings(id) ON DELETE SET NULL,
  task_date     date NOT NULL,
  checkout_date date NOT NULL,
  assigned_to   text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'needed'
                  CHECK (status IN ('needed','scheduled','in_progress','completed','skipped')),
  notes         text NOT NULL DEFAULT '',
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select cleaning_tasks"
  ON cleaning_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cleaning_tasks"
  ON cleaning_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cleaning_tasks"
  ON cleaning_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cleaning_tasks"
  ON cleaning_tasks FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_property_id ON cleaning_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_booking_id ON cleaning_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_task_date ON cleaning_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_status ON cleaning_tasks(status);

-- ─── 2. maintenance_notes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  priority     text NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','completed','archived')),
  category     text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('repair','cleaning','supplies','inspection','guest_reported','general')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select maintenance_notes"
  ON maintenance_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert maintenance_notes"
  ON maintenance_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update maintenance_notes"
  ON maintenance_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maintenance_notes"
  ON maintenance_notes FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_maintenance_notes_property_id ON maintenance_notes(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_status ON maintenance_notes(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_priority ON maintenance_notes(priority);

-- ─── 3. booking_internal_notes ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_internal_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select booking_internal_notes"
  ON booking_internal_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert booking_internal_notes"
  ON booking_internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update booking_internal_notes"
  ON booking_internal_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete booking_internal_notes"
  ON booking_internal_notes FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_booking_internal_notes_booking_id ON booking_internal_notes(booking_id);

-- ─── 4. seasonal_pricing_presets ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_pricing_presets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name         text NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  nightly_rate numeric(10,2) NOT NULL CHECK (nightly_rate > 0),
  min_nights   integer,
  priority     integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_date_order CHECK (end_date >= start_date)
);

ALTER TABLE seasonal_pricing_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select seasonal_pricing_presets"
  ON seasonal_pricing_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert seasonal_pricing_presets"
  ON seasonal_pricing_presets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update seasonal_pricing_presets"
  ON seasonal_pricing_presets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete seasonal_pricing_presets"
  ON seasonal_pricing_presets FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_property ON seasonal_pricing_presets(property_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_dates ON seasonal_pricing_presets(start_date, end_date);

-- ─── 5. owner_blocks — manual owner date blocks ───────────────────────────────
-- Uses start_date/end_date range instead of per-day rows (unlike blocked_dates).
-- The availability check function also queries owner_blocks.

CREATE TABLE IF NOT EXISTS owner_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  block_type  text NOT NULL DEFAULT 'unavailable'
                CHECK (block_type IN ('owner_stay','maintenance','deep_cleaning','private_hold','unavailable','other')),
  reason      text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_block_date_order CHECK (end_date > start_date)
);

ALTER TABLE owner_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select owner_blocks"
  ON owner_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert owner_blocks"
  ON owner_blocks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update owner_blocks"
  ON owner_blocks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete owner_blocks"
  ON owner_blocks FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_owner_blocks_property_id ON owner_blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_owner_blocks_dates ON owner_blocks(start_date, end_date);
