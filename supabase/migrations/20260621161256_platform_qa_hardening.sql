-- ── Fill missing DELETE policies ─────────────────────────────────────────────

CREATE POLICY "launch_pkg_delete" ON platform_instance_launch_packages
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE POLICY "platform_settings_delete" ON platform_settings
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- ── platform_qa_checks table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_qa_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key       text NOT NULL UNIQUE,
  check_label     text NOT NULL,
  check_group     text NOT NULL,
  status          text NOT NULL DEFAULT 'not_checked'
    CHECK (status IN ('not_checked','passing','warning','failing')),
  message         text,
  last_checked_at timestamptz,
  checked_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_qa_checks_updated_at
  BEFORE UPDATE ON platform_qa_checks
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_qa_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_checks_select" ON platform_qa_checks
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "qa_checks_insert" ON platform_qa_checks
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "qa_checks_update" ON platform_qa_checks
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "qa_checks_delete" ON platform_qa_checks
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- ── Seed QA checks ────────────────────────────────────────────────────────────

INSERT INTO platform_qa_checks (check_key, check_label, check_group) VALUES
  -- Security
  ('rls_all_platform_tables',          'RLS enabled on all platform tables',                     'Security'),
  ('normal_admin_blocked_from_platform','Normal admin blocked from /platform',                   'Security'),
  ('edge_functions_require_super_admin','Edge functions require platform super_admin',            'Security'),
  ('stripe_webhook_sig_validation',     'Stripe webhook validates signature',                     'Security'),
  ('secrets_not_exposed_in_ui',         'Secrets not exposed in UI',                              'Security'),
  ('service_role_server_side_only',     'Service role key used server-side only',                 'Security'),

  -- Provisioning
  ('client_onboarding_flow',            'New client onboarding creates client row',               'Provisioning'),
  ('instance_created_on_onboarding',    'Instance row created on onboarding',                     'Provisioning'),
  ('provisioning_steps_auto_created',   'Provisioning steps auto-created for instance',           'Provisioning'),
  ('env_requirements_auto_created',     'Env requirements auto-created for instance',             'Provisioning'),
  ('handoff_row_auto_created',          'Handoff row auto-created for instance',                  'Provisioning'),
  ('launch_package_row_auto_created',   'Launch package row auto-created for instance',           'Provisioning'),
  ('health_checks_row_auto_created',    'Health check row auto-created for instance',             'Provisioning'),
  ('lifecycle_row_auto_created',        'Lifecycle row auto-created for client',                  'Provisioning'),

  -- Deployment
  ('source_duplication_ready',          'Source repo duplication (platform-duplicate-template-source) ready', 'Deployment'),
  ('netlify_site_creation_ready',       'Netlify site creation (platform-create-netlify-site) ready',         'Deployment'),
  ('netlify_env_vars_ready',            'Netlify env var setup (platform-set-netlify-env-vars) ready',        'Deployment'),
  ('netlify_deploy_action_ready',       'Netlify connect source (platform-connect-netlify-source) ready',     'Deployment'),
  ('netlify_domain_connect_ready',      'Netlify domain connect (platform-connect-netlify-domain) ready',     'Deployment'),
  ('domain_tracking_ready',             'Domain DNS tracking table ready',                                    'Deployment'),

  -- Business
  ('billing_tracking_ready',            'Billing/subscription tracking ready',                   'Business'),
  ('stripe_sync_ready',                 'Stripe subscription sync (platform-sync-stripe-subscription) ready', 'Business'),
  ('stripe_saas_webhook_ready',         'Stripe SaaS webhook (platform-stripe-subscription-webhook) deployed','Business'),
  ('access_enforcement_ready',          'Instance access enforcement ready',                      'Business'),
  ('support_tickets_ready',             'Support ticket system ready',                            'Business'),
  ('alerts_system_ready',               'Platform alerts system ready',                           'Business'),

  -- Launch
  ('health_checks_run',                 'Instance health checks run successfully',                'Launch'),
  ('launch_package_works',              'Launch package send works end-to-end',                   'Launch'),
  ('handoff_message_works',             'Handoff copy message and confirmation works',            'Launch'),
  ('mark_launched_works',               'Mark launched updates instance status correctly',        'Launch'),
  ('lifecycle_tracking_works',          'Lifecycle stage updates and logs events correctly',      'Launch'),
  ('generate_alerts_works',             'Generate alerts creates correct alerts without dupes',   'Launch')

ON CONFLICT (check_key) DO NOTHING;
