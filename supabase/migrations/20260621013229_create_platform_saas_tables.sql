-- ── Platform SaaS Tables ─────────────────────────────────────────────────────
-- Isolated from client admin. Only accessible to users with platform_role = 'super_admin'.

-- 1. Platform profiles — maps auth users to platform roles
CREATE TABLE IF NOT EXISTS platform_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_role text NOT NULL DEFAULT 'super_admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE platform_profiles ENABLE ROW LEVEL SECURITY;

-- Security-definer helper to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_platform_super_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_profiles
    WHERE user_id = auth.uid() AND platform_role = 'super_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

CREATE POLICY "platform_profiles_super_admin_select" ON platform_profiles
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_profiles_super_admin_insert" ON platform_profiles
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_profiles_super_admin_update" ON platform_profiles
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_profiles_super_admin_delete" ON platform_profiles
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- 2. Platform clients
CREATE TABLE IF NOT EXISTS platform_clients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name              text NOT NULL DEFAULT '',
  owner_email             text NOT NULL DEFAULT '',
  owner_phone             text,
  business_name           text,
  status                  text NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead', 'trial', 'active', 'past_due', 'suspended', 'cancelled')),
  plan_name               text,
  billing_status          text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  signup_date             date,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_clients_select" ON platform_clients
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_clients_insert" ON platform_clients
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_clients_update" ON platform_clients
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_clients_delete" ON platform_clients
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- 3. Platform instances
CREATE TABLE IF NOT EXISTS platform_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_name         text NOT NULL DEFAULT '',
  property_name         text,
  frontend_url          text,
  admin_url             text,
  custom_domain         text,
  netlify_site_id       text,
  supabase_project_ref  text,
  supabase_project_url  text,
  environment           text NOT NULL DEFAULT 'production'
    CHECK (environment IN ('template', 'staging', 'production')),
  provisioning_status   text NOT NULL DEFAULT 'not_started'
    CHECK (provisioning_status IN ('not_started', 'pending', 'deployed', 'failed', 'suspended')),
  current_version       text,
  last_deployed_at      timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_instances_select" ON platform_instances
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_instances_insert" ON platform_instances
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_instances_update" ON platform_instances
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_instances_delete" ON platform_instances
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- 4. Platform support access logs
CREATE TABLE IF NOT EXISTS platform_support_access_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES platform_clients(id) ON DELETE SET NULL,
  instance_id  uuid REFERENCES platform_instances(id) ON DELETE SET NULL,
  accessed_by  text NOT NULL DEFAULT '',
  reason       text,
  access_type  text NOT NULL DEFAULT 'viewed_dashboard'
    CHECK (access_type IN ('viewed_dashboard', 'opened_frontend', 'opened_backend', 'support_note')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_support_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_access_logs_select" ON platform_support_access_logs
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_access_logs_insert" ON platform_support_access_logs
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());

-- 5. Platform update jobs
CREATE TABLE IF NOT EXISTS platform_update_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_version   text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  scope            text NOT NULL DEFAULT 'all_instances'
    CHECK (scope IN ('all_instances', 'selected_instances')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

ALTER TABLE platform_update_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_update_jobs_select" ON platform_update_jobs
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_update_jobs_insert" ON platform_update_jobs
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_update_jobs_update" ON platform_update_jobs
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_update_jobs_delete" ON platform_update_jobs
  FOR DELETE TO authenticated USING (is_platform_super_admin());

-- 6. Platform settings (single-row)
CREATE TABLE IF NOT EXISTS platform_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_version   text NOT NULL DEFAULT '1.0.0',
  notes            text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select" ON platform_settings
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "platform_settings_insert" ON platform_settings
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "platform_settings_update" ON platform_settings
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

INSERT INTO platform_settings (master_version, notes)
VALUES ('1.0.0', 'Initial platform version')
ON CONFLICT DO NOTHING;

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_platform_updated_at()
  RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_platform_clients_updated_at
  BEFORE UPDATE ON platform_clients
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

CREATE TRIGGER trg_platform_instances_updated_at
  BEFORE UPDATE ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();
