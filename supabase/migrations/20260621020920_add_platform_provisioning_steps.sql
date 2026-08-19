-- platform_provisioning_steps
CREATE TABLE IF NOT EXISTS platform_provisioning_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  step_key     text NOT NULL,
  step_label   text NOT NULL,
  step_group   text NOT NULL,
  status       text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed', 'skipped')),
  instructions text,
  external_url text,
  completed_at timestamptz,
  completed_by text,
  notes        text,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_provisioning_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prov_steps_select" ON platform_provisioning_steps
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "prov_steps_insert" ON platform_provisioning_steps
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "prov_steps_update" ON platform_provisioning_steps
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "prov_steps_delete" ON platform_provisioning_steps
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_prov_steps_updated_at
  BEFORE UPDATE ON platform_provisioning_steps
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- Auto-create default steps on new instance
CREATE OR REPLACE FUNCTION create_default_provisioning_steps()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO platform_provisioning_steps
    (instance_id, step_key, step_label, step_group, sort_order)
  VALUES
    (NEW.id, 'confirm_client_details',   'Confirm client details',                      'Client Setup',   10),
    (NEW.id, 'confirm_plan_billing',     'Confirm plan/billing status',                 'Client Setup',   20),
    (NEW.id, 'confirm_property_name',    'Confirm property/listing name',               'Client Setup',   30),
    (NEW.id, 'create_supabase_project',  'Create isolated Supabase project or database','Supabase Setup', 40),
    (NEW.id, 'apply_migrations',         'Apply master template migrations',            'Supabase Setup', 50),
    (NEW.id, 'configure_auth',           'Configure Auth',                              'Supabase Setup', 60),
    (NEW.id, 'configure_storage',        'Configure Storage buckets',                   'Supabase Setup', 70),
    (NEW.id, 'configure_edge_secrets',   'Configure Edge Function secrets',             'Supabase Setup', 80),
    (NEW.id, 'deploy_edge_functions',    'Deploy Edge Functions',                       'Supabase Setup', 90),
    (NEW.id, 'create_netlify_site',      'Create Netlify site',                         'Netlify Setup',  100),
    (NEW.id, 'connect_repo',             'Connect repo/template source',                'Netlify Setup',  110),
    (NEW.id, 'configure_env_vars',       'Configure environment variables',             'Netlify Setup',  120),
    (NEW.id, 'deploy_frontend',          'Deploy frontend',                             'Netlify Setup',  130),
    (NEW.id, 'verify_prod_build',        'Verify production build',                     'Netlify Setup',  140),
    (NEW.id, 'add_custom_domain',        'Add custom domain',                           'Domain Setup',   150),
    (NEW.id, 'configure_dns',            'Configure DNS',                               'Domain Setup',   160),
    (NEW.id, 'verify_ssl',              'Verify SSL',                                   'Domain Setup',   170),
    (NEW.id, 'create_admin_user',        'Create first admin user',                     'App Setup',      180),
    (NEW.id, 'set_account_profile',      'Set account/profile details',                 'App Setup',      190),
    (NEW.id, 'add_property_info',        'Add property info',                           'App Setup',      200),
    (NEW.id, 'add_pricing_fees',         'Add pricing/fees',                            'App Setup',      210),
    (NEW.id, 'add_photos',              'Add photos',                                   'App Setup',      220),
    (NEW.id, 'configure_email',          'Configure email provider',                    'App Setup',      230),
    (NEW.id, 'configure_stripe',         'Configure Stripe/test payment',               'App Setup',      240),
    (NEW.id, 'configure_ical',           'Configure iCal sync',                         'App Setup',      250),
    (NEW.id, 'test_booking_request',     'Test guest booking request',                  'Launch Testing', 260),
    (NEW.id, 'test_admin_approval',      'Test admin approval',                         'Launch Testing', 270),
    (NEW.id, 'test_payment_link',        'Test payment link',                           'Launch Testing', 280),
    (NEW.id, 'test_email_notifications', 'Test email notifications',                    'Launch Testing', 290),
    (NEW.id, 'test_date_blocking',       'Test date blocking',                          'Launch Testing', 300),
    (NEW.id, 'test_automations',         'Test automations',                            'Launch Testing', 310),
    (NEW.id, 'final_launch_approval',    'Final launch approval',                       'Launch Testing', 320);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_provisioning_steps
  AFTER INSERT ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION create_default_provisioning_steps();

-- Sync instance provisioning_status from step states
CREATE OR REPLACE FUNCTION sync_instance_provisioning_status()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_total       int;
  v_completed   int;
  v_failed      int;
  v_in_progress int;
  v_new_status  text;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed','skipped')),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'in_progress')
  INTO v_total, v_completed, v_failed, v_in_progress
  FROM platform_provisioning_steps
  WHERE instance_id = NEW.instance_id;

  IF v_total = 0 THEN
    v_new_status := 'not_started';
  ELSIF v_failed > 0 THEN
    v_new_status := 'failed';
  ELSIF v_completed = v_total THEN
    v_new_status := 'deployed';
  ELSIF v_completed > 0 OR v_in_progress > 0 THEN
    v_new_status := 'pending';
  ELSE
    v_new_status := 'not_started';
  END IF;

  UPDATE platform_instances
  SET provisioning_status = v_new_status, updated_at = now()
  WHERE id = NEW.instance_id
    AND provisioning_status NOT IN ('suspended');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_instance_prov_status
  AFTER INSERT OR UPDATE ON platform_provisioning_steps
  FOR EACH ROW EXECUTE FUNCTION sync_instance_provisioning_status();
