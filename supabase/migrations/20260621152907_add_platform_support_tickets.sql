-- ── Support tickets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id  uuid REFERENCES platform_instances(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_on_client','waiting_on_me','resolved','closed')),
  priority     text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  category     text NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug','feature_request','billing','onboarding','domain_dns','email','payments','calendar_sync','content_update','maintenance','other')),
  source       text NOT NULL DEFAULT 'internal'
    CHECK (source IN ('internal','client_email','client_call','text_message','meeting','other')),
  assigned_to  text,
  due_date     date,
  resolved_at  timestamptz,
  closed_at    timestamptz,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON platform_support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select" ON platform_support_tickets
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "support_tickets_insert" ON platform_support_tickets
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "support_tickets_update" ON platform_support_tickets
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "support_tickets_delete" ON platform_support_tickets
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- ── Ticket activity log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_support_ticket_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES platform_support_tickets(id) ON DELETE CASCADE,
  event_type      text NOT NULL
    CHECK (event_type IN ('created','status_changed','priority_changed','assigned','note_added','resolved','closed','reopened')),
  message         text,
  previous_value  text,
  new_value       text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_support_ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_events_select" ON platform_support_ticket_events
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "ticket_events_insert" ON platform_support_ticket_events
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());

-- Index for quick per-ticket lookup
CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket_id
  ON platform_support_ticket_events(ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client_status
  ON platform_support_tickets(client_id, status);
