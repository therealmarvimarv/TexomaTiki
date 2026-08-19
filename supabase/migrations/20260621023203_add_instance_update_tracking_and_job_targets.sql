-- Add update tracking fields to platform_instances
ALTER TABLE platform_instances
  ADD COLUMN IF NOT EXISTS target_version text,
  ADD COLUMN IF NOT EXISTS update_status text NOT NULL DEFAULT 'up_to_date'
    CHECK (update_status IN ('up_to_date','update_available','pending_update','updating','updated','failed')),
  ADD COLUMN IF NOT EXISTS last_update_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz;

-- platform_update_job_targets
CREATE TABLE IF NOT EXISTS platform_update_job_targets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_job_id uuid NOT NULL REFERENCES platform_update_jobs(id) ON DELETE CASCADE,
  instance_id   uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','succeeded','failed','skipped')),
  from_version  text,
  to_version    text NOT NULL DEFAULT '',
  started_at    timestamptz,
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (update_job_id, instance_id)
);

ALTER TABLE platform_update_job_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_targets_select" ON platform_update_job_targets
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "job_targets_insert" ON platform_update_job_targets
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "job_targets_update" ON platform_update_job_targets
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "job_targets_delete" ON platform_update_job_targets
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_job_targets_updated_at
  BEFORE UPDATE ON platform_update_job_targets
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();
