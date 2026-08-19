CREATE TABLE IF NOT EXISTS platform_stripe_webhook_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id          text NOT NULL,
  event_type               text NOT NULL,
  processed_status         text NOT NULL DEFAULT 'processed'
    CHECK (processed_status IN ('processed','skipped','failed')),
  related_client_id        uuid REFERENCES platform_clients(id) ON DELETE SET NULL,
  related_subscription_id  uuid REFERENCES platform_client_subscriptions(id) ON DELETE SET NULL,
  error_message            text,
  received_at              timestamptz NOT NULL DEFAULT now(),
  processed_at             timestamptz,
  CONSTRAINT uq_stripe_event_id UNIQUE (stripe_event_id)
);

ALTER TABLE platform_stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Super admin can read all events
CREATE POLICY "webhook_events_select" ON platform_stripe_webhook_events
  FOR SELECT TO authenticated USING (is_platform_super_admin());

-- Service role bypasses RLS, so no insert policy needed for edge function.
-- Add an anon-safe insert policy via service_role bypass (edge function uses service role key).
