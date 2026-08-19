
CREATE TABLE platform_generated_setup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  job_id uuid REFERENCES platform_provisioning_jobs(id) ON DELETE SET NULL,
  task_group text NOT NULL,
  task_key text NOT NULL,
  task_label text NOT NULL,
  provider text NOT NULL DEFAULT 'app',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','copied','completed','skipped')),
  instructions text NOT NULL DEFAULT '',
  command_text text,
  copy_payload jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_generated_setup_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_setup_tasks" ON platform_generated_setup_tasks FOR SELECT
  TO authenticated USING (is_platform_super_admin());

CREATE POLICY "insert_setup_tasks" ON platform_generated_setup_tasks FOR INSERT
  TO authenticated WITH CHECK (is_platform_super_admin());

CREATE POLICY "update_setup_tasks" ON platform_generated_setup_tasks FOR UPDATE
  TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

CREATE POLICY "delete_setup_tasks" ON platform_generated_setup_tasks FOR DELETE
  TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_platform_generated_setup_tasks_updated_at
  BEFORE UPDATE ON platform_generated_setup_tasks
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();
