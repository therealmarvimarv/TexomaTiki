-- ── platform_client_subscriptions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_client_subscriptions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  status                     text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','past_due','suspended','cancelled','expired')),
  plan_name                  text,
  billing_cycle              text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','yearly','lifetime','manual')),
  price_amount               numeric(10,2),
  currency                   text NOT NULL DEFAULT 'USD',
  trial_starts_at            timestamptz,
  trial_ends_at              timestamptz,
  current_period_starts_at   timestamptz,
  current_period_ends_at     timestamptz,
  next_invoice_date          timestamptz,
  payment_method             text NOT NULL DEFAULT 'manual_invoice'
    CHECK (payment_method IN ('stripe','manual_invoice','cash','zelle','check','other')),
  stripe_customer_id         text,
  stripe_subscription_id     text,
  notes                      text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscription_client UNIQUE (client_id)
);

ALTER TABLE platform_client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_select" ON platform_client_subscriptions
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "subscription_insert" ON platform_client_subscriptions
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "subscription_update" ON platform_client_subscriptions
  FOR UPDATE TO authenticated
  USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "subscription_delete" ON platform_client_subscriptions
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_subscription_updated_at
  BEFORE UPDATE ON platform_client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Auto-create subscription row for new clients ─────────────────────────────

CREATE OR REPLACE FUNCTION create_default_client_subscription()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- Map client status to subscription status where possible
  v_status := CASE NEW.status
    WHEN 'trial'      THEN 'trial'
    WHEN 'active'     THEN 'active'
    WHEN 'suspended'  THEN 'suspended'
    WHEN 'cancelled'  THEN 'cancelled'
    ELSE 'trial'
  END;

  INSERT INTO platform_client_subscriptions
    (client_id, status, plan_name, stripe_subscription_id)
  VALUES
    (NEW.id, v_status, NEW.plan_name, NEW.stripe_subscription_id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_client_subscription
  AFTER INSERT ON platform_clients
  FOR EACH ROW EXECUTE FUNCTION create_default_client_subscription();

-- ── Backfill existing clients ─────────────────────────────────────────────────

INSERT INTO platform_client_subscriptions (client_id, status, plan_name, stripe_subscription_id)
SELECT
  id,
  CASE status
    WHEN 'trial'     THEN 'trial'
    WHEN 'active'    THEN 'active'
    WHEN 'suspended' THEN 'suspended'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'trial'
  END,
  plan_name,
  stripe_subscription_id
FROM platform_clients
WHERE id NOT IN (SELECT client_id FROM platform_client_subscriptions)
ON CONFLICT (client_id) DO NOTHING;
