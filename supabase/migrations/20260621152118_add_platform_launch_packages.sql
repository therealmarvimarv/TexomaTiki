CREATE TABLE IF NOT EXISTS platform_instance_launch_packages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id              uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  checklist                jsonb NOT NULL DEFAULT '[]',
  qa_notes                 text,
  launch_summary_snapshot  jsonb,
  package_status           text NOT NULL DEFAULT 'draft'
    CHECK (package_status IN ('draft','ready','sent','completed')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_launch_package_instance UNIQUE (instance_id)
);

CREATE TRIGGER trg_launch_package_updated_at
  BEFORE UPDATE ON platform_instance_launch_packages
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_instance_launch_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "launch_pkg_select" ON platform_instance_launch_packages
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "launch_pkg_insert" ON platform_instance_launch_packages
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "launch_pkg_update" ON platform_instance_launch_packages
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- Default checklist items
CREATE OR REPLACE FUNCTION default_launch_checklist() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '[
    {"key":"frontend_opened",       "label":"Frontend opened successfully",           "done":false},
    {"key":"admin_opened",          "label":"Admin login page opened successfully",   "done":false},
    {"key":"client_admin_confirmed","label":"Client admin email confirmed",           "done":false},
    {"key":"property_profile_ok",   "label":"Property profile reviewed",             "done":false},
    {"key":"pricing_ok",            "label":"Pricing reviewed",                      "done":false},
    {"key":"fees_ok",               "label":"Fees reviewed",                         "done":false},
    {"key":"photos_ok",             "label":"Photos reviewed",                       "done":false},
    {"key":"email_templates_ok",    "label":"Email templates reviewed",              "done":false},
    {"key":"calendar_ok",           "label":"Calendar/iCal reviewed",               "done":false},
    {"key":"booking_tested",        "label":"Guest booking request tested",          "done":false},
    {"key":"payment_tested",        "label":"Payment flow tested (if enabled)",      "done":false},
    {"key":"handoff_sent",          "label":"Handoff message copied/sent",           "done":false},
    {"key":"final_walkthrough",     "label":"Final walkthrough completed",           "done":false}
  ]'::jsonb;
$$;

-- Auto-create package when a new instance is added
CREATE OR REPLACE FUNCTION trg_create_launch_package_fn()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO platform_instance_launch_packages (client_id, instance_id, checklist)
  VALUES (NEW.client_id, NEW.id, default_launch_checklist())
  ON CONFLICT (instance_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_launch_package
  AFTER INSERT ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION trg_create_launch_package_fn();

-- Backfill existing instances
INSERT INTO platform_instance_launch_packages (client_id, instance_id, checklist)
SELECT client_id, id, default_launch_checklist()
FROM platform_instances
ON CONFLICT (instance_id) DO NOTHING;
