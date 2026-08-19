-- Phase 5: Provisioning Automation Foundation

-- 1. New columns on platform_instances
ALTER TABLE platform_instances
  ADD COLUMN IF NOT EXISTS instance_slug text,
  ADD COLUMN IF NOT EXISTS repo_url text,
  ADD COLUMN IF NOT EXISTS source_template_ref text,
  ADD COLUMN IF NOT EXISTS deployment_strategy text NOT NULL DEFAULT 'manual'
    CHECK (deployment_strategy IN ('manual', 'semi_automated', 'automated')),
  ADD COLUMN IF NOT EXISTS provisioning_job_id uuid;

-- 2. Provisioning jobs table
CREATE TABLE IF NOT EXISTS platform_provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
  job_type text NOT NULL DEFAULT 'new_instance'
    CHECK (job_type IN ('new_instance', 'update', 'rebuild')),
  template_version text,
  requested_by text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_provisioning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_platform_provisioning_jobs" ON platform_provisioning_jobs FOR SELECT
  TO authenticated USING (is_platform_super_admin());
CREATE POLICY "insert_platform_provisioning_jobs" ON platform_provisioning_jobs FOR INSERT
  TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "update_platform_provisioning_jobs" ON platform_provisioning_jobs FOR UPDATE
  TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "delete_platform_provisioning_jobs" ON platform_provisioning_jobs FOR DELETE
  TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_platform_provisioning_jobs_updated_at
  BEFORE UPDATE ON platform_provisioning_jobs
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- 3. Provisioning job events table
CREATE TABLE IF NOT EXISTS platform_provisioning_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES platform_provisioning_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'info'
    CHECK (event_type IN ('info', 'success', 'warning', 'error', 'action')),
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_provisioning_job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_platform_provisioning_job_events" ON platform_provisioning_job_events FOR SELECT
  TO authenticated USING (is_platform_super_admin());
CREATE POLICY "insert_platform_provisioning_job_events" ON platform_provisioning_job_events FOR INSERT
  TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "update_platform_provisioning_job_events" ON platform_provisioning_job_events FOR UPDATE
  TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "delete_platform_provisioning_job_events" ON platform_provisioning_job_events FOR DELETE
  TO authenticated USING (is_platform_super_admin());

-- 4. FK from platform_instances.provisioning_job_id → platform_provisioning_jobs
ALTER TABLE platform_instances
  ADD CONSTRAINT fk_instances_provisioning_job
  FOREIGN KEY (provisioning_job_id) REFERENCES platform_provisioning_jobs(id) ON DELETE SET NULL;
