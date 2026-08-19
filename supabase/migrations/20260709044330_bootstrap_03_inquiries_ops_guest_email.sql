-- Bootstrap Part 3: Inquiries, notification logs, owner operations, guest experience tables,
-- email settings/templates/automations, account settings

-- Inquiries
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Public can insert inquiries') THEN
    CREATE POLICY "Public can insert inquiries" ON inquiries FOR INSERT TO public WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can read inquiries') THEN
    CREATE POLICY "Authenticated admins can read inquiries" ON inquiries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can update inquiry status') THEN
    CREATE POLICY "Authenticated admins can update inquiry status" ON inquiries FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'Authenticated admins can delete inquiries') THEN
    CREATE POLICY "Authenticated admins can delete inquiries" ON inquiries FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Notification logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type text NOT NULL DEFAULT '',
  related_id uuid NULL,
  channel text NOT NULL DEFAULT 'email',
  provider text NOT NULL DEFAULT 'disabled',
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'skipped',
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  template_key text NOT NULL DEFAULT ''
);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Authenticated users can read notification logs') THEN
    CREATE POLICY "Authenticated users can read notification logs" ON notification_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS notification_logs_created_at_idx ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_related_idx ON notification_logs (related_type, related_id);
CREATE INDEX IF NOT EXISTS notification_logs_status_idx ON notification_logs (status);

-- Cleaning tasks
CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  task_date date NOT NULL,
  checkout_date date NOT NULL,
  assigned_to text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed','scheduled','in_progress','completed','skipped')),
  notes text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can select cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can select cleaning_tasks" ON cleaning_tasks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can insert cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can insert cleaning_tasks" ON cleaning_tasks FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can update cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can update cleaning_tasks" ON cleaning_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Authenticated users can delete cleaning_tasks') THEN
    CREATE POLICY "Authenticated users can delete cleaning_tasks" ON cleaning_tasks FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleaning_tasks' AND policyname = 'Service role can insert cleaning_tasks') THEN
    CREATE POLICY "Service role can insert cleaning_tasks" ON cleaning_tasks FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_property_id ON cleaning_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_booking_id ON cleaning_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_task_date ON cleaning_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_status ON cleaning_tasks(status);

-- Maintenance notes
CREATE TABLE IF NOT EXISTS maintenance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','archived')),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('repair','cleaning','supplies','inspection','guest_reported','general')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE maintenance_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can select maintenance_notes') THEN
    CREATE POLICY "Authenticated users can select maintenance_notes" ON maintenance_notes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can insert maintenance_notes') THEN
    CREATE POLICY "Authenticated users can insert maintenance_notes" ON maintenance_notes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can update maintenance_notes') THEN
    CREATE POLICY "Authenticated users can update maintenance_notes" ON maintenance_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_notes' AND policyname = 'Authenticated users can delete maintenance_notes') THEN
    CREATE POLICY "Authenticated users can delete maintenance_notes" ON maintenance_notes FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_property_id ON maintenance_notes(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_status ON maintenance_notes(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_priority ON maintenance_notes(priority);

-- Booking internal notes
CREATE TABLE IF NOT EXISTS booking_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_internal_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can select booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can select booking_internal_notes" ON booking_internal_notes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can insert booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can insert booking_internal_notes" ON booking_internal_notes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can update booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can update booking_internal_notes" ON booking_internal_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_internal_notes' AND policyname = 'Authenticated users can delete booking_internal_notes') THEN
    CREATE POLICY "Authenticated users can delete booking_internal_notes" ON booking_internal_notes FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_booking_internal_notes_booking_id ON booking_internal_notes(booking_id);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Public can read active faqs') THEN
    CREATE POLICY "Public can read active faqs" ON faqs FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can insert faqs') THEN
    CREATE POLICY "Admins can insert faqs" ON faqs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can update faqs') THEN
    CREATE POLICY "Admins can update faqs" ON faqs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faqs' AND policyname = 'Admins can delete faqs') THEN
    CREATE POLICY "Admins can delete faqs" ON faqs FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS faqs_property_id_idx ON faqs(property_id);

-- House rules
CREATE TABLE IF NOT EXISTS house_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Shield',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE house_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Public can read active house_rules') THEN
    CREATE POLICY "Public can read active house_rules" ON house_rules FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can insert house_rules') THEN
    CREATE POLICY "Admins can insert house_rules" ON house_rules FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can update house_rules') THEN
    CREATE POLICY "Admins can update house_rules" ON house_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_rules' AND policyname = 'Admins can delete house_rules') THEN
    CREATE POLICY "Admins can delete house_rules" ON house_rules FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS house_rules_property_id_idx ON house_rules(property_id);

-- Property policies
CREATE TABLE IF NOT EXISTS property_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, policy_type)
);
ALTER TABLE property_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Public can read active property_policies') THEN
    CREATE POLICY "Public can read active property_policies" ON property_policies FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can insert property_policies') THEN
    CREATE POLICY "Admins can insert property_policies" ON property_policies FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can update property_policies') THEN
    CREATE POLICY "Admins can update property_policies" ON property_policies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_policies' AND policyname = 'Admins can delete property_policies') THEN
    CREATE POLICY "Admins can delete property_policies" ON property_policies FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS property_policies_property_id_type_idx ON property_policies(property_id, policy_type);

-- Local recommendations
CREATE TABLE IF NOT EXISTS local_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  description text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  distance_label text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE local_recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Public can read active local_recommendations') THEN
    CREATE POLICY "Public can read active local_recommendations" ON local_recommendations FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can insert local_recommendations') THEN
    CREATE POLICY "Admins can insert local_recommendations" ON local_recommendations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can update local_recommendations') THEN
    CREATE POLICY "Admins can update local_recommendations" ON local_recommendations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'local_recommendations' AND policyname = 'Admins can delete local_recommendations') THEN
    CREATE POLICY "Admins can delete local_recommendations" ON local_recommendations FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS local_recommendations_property_id_idx ON local_recommendations(property_id);

-- Email settings
CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email_provider text NOT NULL DEFAULT 'disabled'
    CHECK (email_provider IN ('disabled', 'smtp', 'resend')),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_from text NOT NULL DEFAULT '',
  admin_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_select_email_settings') THEN
    CREATE POLICY "auth_select_email_settings" ON email_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_insert_email_settings') THEN
    CREATE POLICY "auth_insert_email_settings" ON email_settings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_update_email_settings') THEN
    CREATE POLICY "auth_update_email_settings" ON email_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'auth_delete_email_settings') THEN
    CREATE POLICY "auth_delete_email_settings" ON email_settings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_email_settings_updated_at') THEN
    CREATE TRIGGER trg_email_settings_updated_at
      BEFORE UPDATE ON email_settings
      FOR EACH ROW EXECUTE FUNCTION update_email_settings_updated_at();
  END IF;
END $$;

-- Email vault helpers
CREATE OR REPLACE FUNCTION email_settings_upsert_secret(p_name text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF existing_id IS NULL THEN PERFORM vault.create_secret(p_value, p_name, 'email setting');
  ELSE PERFORM vault.update_secret(existing_id, p_value, p_name, 'email setting'); END IF;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_upsert_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_upsert_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_get_secret(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION email_settings_get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_get_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_delete_secret(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN DELETE FROM vault.secrets WHERE name = p_name; END;
$$;
REVOKE ALL ON FUNCTION email_settings_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_delete_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_secret_exists(p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name); END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_secret_exists(text) TO service_role;

CREATE OR REPLACE FUNCTION email_settings_secret_preview(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = vault, public, extensions AS $$
DECLARE val text;
BEGIN
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF val IS NULL OR length(val) < 4 THEN RETURN NULL; END IF;
  RETURN left(val, 3) || '••••';
END;
$$;
REVOKE ALL ON FUNCTION email_settings_secret_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION email_settings_secret_preview(text) TO service_role;

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, template_key)
);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'anon_no_access_email_templates') THEN
    CREATE POLICY "anon_no_access_email_templates" ON email_templates FOR ALL TO anon USING (false);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_select_email_templates') THEN
    CREATE POLICY "auth_select_email_templates" ON email_templates FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_update_email_templates') THEN
    CREATE POLICY "auth_update_email_templates" ON email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_insert_custom_email_templates') THEN
    CREATE POLICY "auth_insert_custom_email_templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (is_system = false);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'auth_delete_custom_email_templates') THEN
    CREATE POLICY "auth_delete_custom_email_templates" ON email_templates FOR DELETE TO authenticated USING (is_system = false);
  END IF;
END $$;

-- Email automations
CREATE TABLE IF NOT EXISTS email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  name text NOT NULL DEFAULT '',
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  template_key text,
  recipient_type text NOT NULL DEFAULT 'guest'
    CHECK (recipient_type IN ('guest', 'admin', 'both')),
  trigger_type text NOT NULL
    CHECK (trigger_type IN (
      'booking_request_received', 'booking_request_approved', 'booking_request_declined',
      'booking_confirmed', 'booking_cancelled', 'inquiry_received',
      'before_check_in', 'day_of_check_in', 'after_check_in',
      'before_check_out', 'day_of_check_out', 'after_check_out'
    )),
  offset_days integer NOT NULL DEFAULT 0,
  send_time time,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'select_email_automations') THEN
    CREATE POLICY "select_email_automations" ON email_automations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'insert_email_automations') THEN
    CREATE POLICY "insert_email_automations" ON email_automations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'update_email_automations') THEN
    CREATE POLICY "update_email_automations" ON email_automations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automations' AND policyname = 'delete_email_automations') THEN
    CREATE POLICY "delete_email_automations" ON email_automations FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS email_automations_property_template_key_unique
  ON email_automations(property_id, template_key) WHERE template_key IS NOT NULL;

-- Email automation sends log
CREATE TABLE IF NOT EXISTS email_automation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  recipient_email text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, booking_id)
);
ALTER TABLE email_automation_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'select_email_automation_sends') THEN
    CREATE POLICY "select_email_automation_sends" ON email_automation_sends FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'service_insert_email_automation_sends') THEN
    CREATE POLICY "service_insert_email_automation_sends" ON email_automation_sends FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_automation_sends' AND policyname = 'service_update_email_automation_sends') THEN
    CREATE POLICY "service_update_email_automation_sends" ON email_automation_sends FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Account settings
CREATE TABLE IF NOT EXISTS account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid REFERENCES auth.users(id),
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'Owner/Admin',
  owner_name text,
  owner_email text,
  owner_phone text,
  business_name text,
  business_address text,
  support_email text,
  support_phone text,
  support_message text,
  support_hours text,
  support_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  currency text NOT NULL DEFAULT 'USD',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  account_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  property_address text,
  check_in_time text,
  check_out_time text,
  suggested_door_code text,
  listing_name text,
  listing_address text,
  listing_city text,
  listing_state text,
  listing_zip text,
  listing_country text,
  listing_manager_name text,
  listing_manager_role text,
  manager_email text,
  manager_phone text,
  primary_guest_contact_name text,
  primary_guest_contact_email text,
  primary_guest_contact_phone text,
  UNIQUE (property_id)
);
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'select_account_settings') THEN
    CREATE POLICY "select_account_settings" ON account_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'insert_account_settings') THEN
    CREATE POLICY "insert_account_settings" ON account_settings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'update_account_settings') THEN
    CREATE POLICY "update_account_settings" ON account_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_settings' AND policyname = 'delete_account_settings') THEN
    CREATE POLICY "delete_account_settings" ON account_settings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
