-- ── Lifecycle tracking table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_client_lifecycle (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL UNIQUE REFERENCES platform_clients(id) ON DELETE CASCADE,
  lifecycle_stage   text NOT NULL DEFAULT 'onboarding'
    CHECK (lifecycle_stage IN (
      'lead','signed','onboarding','provisioning','qa_review',
      'ready_to_launch','launched','active','past_due',
      'suspended','cancelled','archived'
    )),
  lifecycle_status  text NOT NULL DEFAULT 'on_track'
    CHECK (lifecycle_status IN ('on_track','needs_attention','blocked','completed')),
  reason            text,
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_lifecycle_updated_at
  BEFORE UPDATE ON platform_client_lifecycle
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_client_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifecycle_select" ON platform_client_lifecycle
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "lifecycle_insert" ON platform_client_lifecycle
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "lifecycle_update" ON platform_client_lifecycle
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "lifecycle_delete" ON platform_client_lifecycle
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- ── Lifecycle events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_client_lifecycle_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  previous_stage   text,
  new_stage        text NOT NULL,
  previous_status  text,
  new_status       text NOT NULL,
  reason           text,
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_client_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifecycle_events_select" ON platform_client_lifecycle_events
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "lifecycle_events_insert" ON platform_client_lifecycle_events
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_client_id
  ON platform_client_lifecycle_events(client_id, created_at DESC);

-- ── Backfill existing clients ─────────────────────────────────────────────────
-- Best-effort stage assignment based on client.status

INSERT INTO platform_client_lifecycle (client_id, lifecycle_stage, lifecycle_status, reason, updated_by)
SELECT
  c.id,
  CASE c.status
    WHEN 'lead'      THEN 'lead'
    WHEN 'trial'     THEN 'onboarding'
    WHEN 'active'    THEN 'active'
    WHEN 'past_due'  THEN 'past_due'
    WHEN 'suspended' THEN 'suspended'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE                  'onboarding'
  END,
  CASE c.status
    WHEN 'past_due'  THEN 'needs_attention'
    WHEN 'suspended' THEN 'blocked'
    WHEN 'cancelled' THEN 'blocked'
    ELSE                  'on_track'
  END,
  'Auto-assigned from client status at migration',
  'system'
FROM platform_clients c
ON CONFLICT (client_id) DO NOTHING;

-- ── Auto-create lifecycle row on new client ───────────────────────────────────

CREATE OR REPLACE FUNCTION create_default_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO platform_client_lifecycle (client_id, lifecycle_stage, lifecycle_status, reason, updated_by)
  VALUES (
    NEW.id,
    CASE NEW.status
      WHEN 'lead'      THEN 'lead'
      WHEN 'trial'     THEN 'onboarding'
      WHEN 'active'    THEN 'active'
      WHEN 'past_due'  THEN 'past_due'
      WHEN 'suspended' THEN 'suspended'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE                  'onboarding'
    END,
    CASE NEW.status
      WHEN 'past_due'  THEN 'needs_attention'
      WHEN 'suspended' THEN 'blocked'
      WHEN 'cancelled' THEN 'blocked'
      ELSE                  'on_track'
    END,
    'Auto-created on client record creation',
    'system'
  )
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_client_lifecycle
  AFTER INSERT ON platform_clients
  FOR EACH ROW EXECUTE FUNCTION create_default_lifecycle();
