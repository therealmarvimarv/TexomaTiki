-- ── Health fields on platform_instances ──────────────────────────────────────

ALTER TABLE platform_instances
  ADD COLUMN IF NOT EXISTS health_status              text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown','healthy','warning','failing')),
  ADD COLUMN IF NOT EXISTS launch_readiness_status    text NOT NULL DEFAULT 'not_ready'
    CHECK (launch_readiness_status IN ('not_ready','needs_review','ready_to_launch','launched')),
  ADD COLUMN IF NOT EXISTS last_health_check_at       timestamptz,
  ADD COLUMN IF NOT EXISTS launched_at                timestamptz,
  ADD COLUMN IF NOT EXISTS launched_by                text;

-- ── Health checks table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_instance_health_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id      uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  check_key        text NOT NULL,
  check_label      text NOT NULL,
  check_group      text NOT NULL,
  status           text NOT NULL DEFAULT 'not_checked'
    CHECK (status IN ('not_checked','passing','warning','failing','skipped')),
  severity         text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  message          text,
  last_checked_at  timestamptz,
  checked_by       text,
  external_url     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_instance_check_key UNIQUE (instance_id, check_key)
);

CREATE TRIGGER trg_health_checks_updated_at
  BEFORE UPDATE ON platform_instance_health_checks
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_instance_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_checks_select" ON platform_instance_health_checks
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "health_checks_insert" ON platform_instance_health_checks
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "health_checks_update" ON platform_instance_health_checks
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "health_checks_delete" ON platform_instance_health_checks
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- ── Seed function ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_instance_health_checks(p_instance_id uuid, p_client_id uuid)
  RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  checks JSONB := '[
    {"key":"source_repo_connected",               "label":"Source repo connected",             "group":"Deployment", "severity":"critical"},
    {"key":"netlify_site_created",                "label":"Netlify site created",              "group":"Deployment", "severity":"critical"},
    {"key":"netlify_env_vars_set",                "label":"Netlify env vars configured",       "group":"Deployment", "severity":"critical"},
    {"key":"netlify_latest_deploy_present",       "label":"Netlify deploy exists",             "group":"Deployment", "severity":"warning"},
    {"key":"frontend_url_reachable",              "label":"Frontend URL reachable",            "group":"Deployment", "severity":"warning"},
    {"key":"admin_url_reachable",                 "label":"Admin URL reachable",               "group":"Deployment", "severity":"warning"},
    {"key":"supabase_project_created",            "label":"Supabase project created",          "group":"Database",   "severity":"critical"},
    {"key":"database_bootstrap_guided",           "label":"DB bootstrap guided",               "group":"Database",   "severity":"warning"},
    {"key":"migrations_applied_manual_confirmed", "label":"Migrations applied (confirmed)",    "group":"Database",   "severity":"critical"},
    {"key":"edge_functions_deployed_manual_confirmed","label":"Edge functions deployed (confirmed)","group":"Database","severity":"warning"},
    {"key":"storage_configured_manual_confirmed", "label":"Storage configured (confirmed)",    "group":"Database",   "severity":"info"},
    {"key":"property_profile_ready",              "label":"Property profile set up",           "group":"App Setup",  "severity":"warning"},
    {"key":"pricing_ready",                       "label":"Pricing configured",                "group":"App Setup",  "severity":"warning"},
    {"key":"fees_ready",                          "label":"Fees configured",                   "group":"App Setup",  "severity":"info"},
    {"key":"photos_ready",                        "label":"Photos uploaded",                   "group":"App Setup",  "severity":"info"},
    {"key":"email_templates_ready",               "label":"Email templates ready",             "group":"App Setup",  "severity":"warning"},
    {"key":"calendar_sync_ready",                 "label":"Calendar sync configured",          "group":"App Setup",  "severity":"info"},
    {"key":"stripe_guest_payments_ready",         "label":"Guest Stripe payments configured",  "group":"App Setup",  "severity":"warning"},
    {"key":"billing_status_ok",                   "label":"Billing status OK",                 "group":"Business",   "severity":"critical"},
    {"key":"access_status_ok",                    "label":"Instance access OK",                "group":"Business",   "severity":"critical"},
    {"key":"handoff_ready",                       "label":"Handoff package ready",             "group":"Business",   "severity":"warning"},
    {"key":"client_admin_ready",                  "label":"Client admin invited",              "group":"Business",   "severity":"warning"}
  ]';
  rec JSONB;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(checks)
  LOOP
    INSERT INTO platform_instance_health_checks
      (client_id, instance_id, check_key, check_label, check_group, severity)
    VALUES (
      p_client_id, p_instance_id,
      rec->>'key', rec->>'label', rec->>'group', rec->>'severity'
    )
    ON CONFLICT (instance_id, check_key) DO NOTHING;
  END LOOP;
END;
$$;

-- Trigger: seed checks on new instance
CREATE OR REPLACE FUNCTION trg_seed_health_checks_fn()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_instance_health_checks(NEW.id, NEW.client_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_instance_health_checks
  AFTER INSERT ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION trg_seed_health_checks_fn();

-- Backfill existing instances
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, client_id FROM platform_instances LOOP
    PERFORM seed_instance_health_checks(r.id, r.client_id);
  END LOOP;
END;
$$;
