-- ── platform_client_handoffs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_client_handoffs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id         uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','preparing','ready_for_client','sent','accepted','needs_support','completed')),
  client_admin_name   text,
  client_admin_email  text,
  client_admin_phone  text,
  admin_invite_status text NOT NULL DEFAULT 'not_sent'
    CHECK (admin_invite_status IN ('not_sent','sent','accepted','expired','failed')),
  admin_url           text,
  frontend_url        text,
  handoff_notes       text,
  checklist           jsonb NOT NULL DEFAULT '{}',
  sent_at             timestamptz,
  accepted_at         timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_handoff_instance UNIQUE (instance_id)
);

ALTER TABLE platform_client_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoff_select" ON platform_client_handoffs
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "handoff_insert" ON platform_client_handoffs
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "handoff_update" ON platform_client_handoffs
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "handoff_delete" ON platform_client_handoffs
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_handoff_updated_at
  BEFORE UPDATE ON platform_client_handoffs
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Auto-create handoff row for new instances ────────────────────────────────

CREATE OR REPLACE FUNCTION create_default_client_handoff()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO platform_client_handoffs
    (client_id, instance_id, admin_url, frontend_url)
  VALUES
    (NEW.client_id, NEW.id, NEW.admin_url, NEW.frontend_url)
  ON CONFLICT (instance_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_client_handoff
  AFTER INSERT ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION create_default_client_handoff();

-- ── Backfill for existing instances missing a handoff row ────────────────────

INSERT INTO platform_client_handoffs (client_id, instance_id, admin_url, frontend_url)
SELECT client_id, id, admin_url, frontend_url
FROM platform_instances
WHERE id NOT IN (SELECT instance_id FROM platform_client_handoffs)
ON CONFLICT (instance_id) DO NOTHING;
