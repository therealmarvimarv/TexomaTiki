-- ── Instance access enforcement fields ──────────────────────────────────────

ALTER TABLE platform_instances
  ADD COLUMN IF NOT EXISTS access_status              text NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active','warning','restricted','suspended','cancelled')),
  ADD COLUMN IF NOT EXISTS access_reason              text,
  ADD COLUMN IF NOT EXISTS access_updated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS access_updated_by          text,
  ADD COLUMN IF NOT EXISTS billing_enforcement_mode   text NOT NULL DEFAULT 'manual'
    CHECK (billing_enforcement_mode IN ('manual','automatic_warning_only','automatic_restrict','automatic_suspend')),
  ADD COLUMN IF NOT EXISTS last_billing_status        text,
  ADD COLUMN IF NOT EXISTS billing_status_synced_at   timestamptz;

-- ── Instance access event log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_instance_access_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id              uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  subscription_id          uuid REFERENCES platform_client_subscriptions(id) ON DELETE SET NULL,
  event_type               text NOT NULL
    CHECK (event_type IN ('billing_warning','restricted','suspended','restored','cancelled','manual_note')),
  previous_access_status   text,
  new_access_status        text NOT NULL,
  reason                   text,
  created_by               text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_instance_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_events_select" ON platform_instance_access_events
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "access_events_insert" ON platform_instance_access_events
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());

-- ── Billing status sync trigger on subscriptions ──────────────────────────────
-- When a subscription status changes, update last_billing_status on related instances
-- but do NOT automatically change access_status (enforced in app layer or webhook).

CREATE OR REPLACE FUNCTION sync_instance_billing_status()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE platform_instances
    SET last_billing_status    = NEW.status,
        billing_status_synced_at = now()
    WHERE client_id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_instance_billing_status
  AFTER UPDATE OF status ON platform_client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_instance_billing_status();

-- Backfill last_billing_status for existing instances
UPDATE platform_instances pi
SET last_billing_status    = s.status,
    billing_status_synced_at = now()
FROM platform_client_subscriptions s
WHERE s.client_id = pi.client_id
  AND pi.last_billing_status IS NULL;
