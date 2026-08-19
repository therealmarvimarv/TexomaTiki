-- ── Platform alerts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id   uuid REFERENCES platform_instances(id) ON DELETE CASCADE,
  alert_type    text NOT NULL DEFAULT 'other'
    CHECK (alert_type IN (
      'urgent_support','billing_past_due','billing_cancelled',
      'access_suspended','health_failing','domain_failed','ssl_pending',
      'webhook_failed','provisioning_failed','launch_blocked',
      'lifecycle_blocked','manual_review','other'
    )),
  severity      text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info','warning','critical')),
  title         text NOT NULL,
  message       text,
  status        text NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','read','resolved','dismissed')),
  source_table  text,
  source_id     uuid,
  action_url    text,
  created_by    text,
  read_at       timestamptz,
  resolved_at   timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_platform_alerts_updated_at
  BEFORE UPDATE ON platform_alerts
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select" ON platform_alerts
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "alerts_insert" ON platform_alerts
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "alerts_update" ON platform_alerts
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "alerts_delete" ON platform_alerts
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE INDEX IF NOT EXISTS idx_alerts_client_id   ON platform_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status       ON platform_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity     ON platform_alerts(severity);
-- Unique active alert per (client_id, instance_id, alert_type, source_id):
-- prevents duplicate open alerts for the same signal
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_alert
  ON platform_alerts(COALESCE(client_id::text,'_'), COALESCE(instance_id::text,'_'), alert_type, COALESCE(source_id::text,'_'))
  WHERE status IN ('unread','read');

-- ── Alert events ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_alert_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    uuid NOT NULL REFERENCES platform_alerts(id) ON DELETE CASCADE,
  event_type  text NOT NULL DEFAULT 'created'
    CHECK (event_type IN ('created','read','resolved','dismissed','reopened','note_added')),
  message     text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_events_select" ON platform_alert_events
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "alert_events_insert" ON platform_alert_events
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON platform_alert_events(alert_id, created_at DESC);
