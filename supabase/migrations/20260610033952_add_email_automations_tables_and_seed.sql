
-- email_automations table
CREATE TABLE email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  name text NOT NULL DEFAULT '',
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  template_key text,
  recipient_type text NOT NULL DEFAULT 'guest'
    CHECK (recipient_type IN ('guest', 'admin', 'both')),
  trigger_type text NOT NULL
    CHECK (trigger_type IN (
      'booking_confirmed', 'before_check_in', 'day_of_check_in',
      'after_check_in', 'before_check_out', 'day_of_check_out', 'after_check_out'
    )),
  offset_days integer NOT NULL DEFAULT 0,
  send_time time,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_email_automations" ON email_automations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_email_automations" ON email_automations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_email_automations" ON email_automations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_email_automations" ON email_automations
  FOR DELETE TO authenticated USING (true);

-- email_automation_sends table
CREATE TABLE email_automation_sends (
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

CREATE POLICY "select_email_automation_sends" ON email_automation_sends
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_insert_email_automation_sends" ON email_automation_sends
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_update_email_automation_sends" ON email_automation_sends
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- Seed 4 automation email templates
INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'pre_arrival_guest',
  'Pre-Arrival Instructions',
  'Your stay at {{property_title}} is coming up!',
  '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:22px;margin-bottom:4px">Your stay is almost here!</h2>
<p style="color:#555;margin-top:0">Hi {{guest_name}}, we''re looking forward to welcoming you to {{property_title}} tomorrow.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;font-size:14px">{{guest_count}}</td></tr>
</table>
<p style="font-size:14px;color:#555">If you have any questions before you arrive, reply to this email or contact us at {{host_email}}.</p>
<p style="font-size:13px;color:#777">We can''t wait to host you!</p>
</div>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND template_key = 'pre_arrival_guest'
);

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'check_in_day_guest',
  'Check-In Day Reminder',
  'Welcome day is here – {{property_title}}',
  '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:22px;margin-bottom:4px">Today''s the day!</h2>
<p style="color:#555;margin-top:0">Hi {{guest_name}}, your stay at {{property_title}} begins today. We''re so excited to host you.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr>
</table>
<p style="font-size:14px;color:#555">If anything comes up during your stay, don''t hesitate to reach out at {{host_email}}.</p>
<p style="font-size:13px;color:#777">Enjoy your stay!</p>
</div>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND template_key = 'check_in_day_guest'
);

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'check_out_reminder_guest',
  'Check-Out Reminder',
  'Reminder: Check-out tomorrow at {{property_title}}',
  '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:22px;margin-bottom:4px">Check-out reminder</h2>
<p style="color:#555;margin-top:0">Hi {{guest_name}}, just a friendly reminder that your stay at {{property_title}} ends tomorrow.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr>
</table>
<p style="font-size:14px;color:#555">Please make sure to leave the property tidy. If you have any questions, contact us at {{host_email}}.</p>
<p style="font-size:13px;color:#777">Thank you for staying with us!</p>
</div>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND template_key = 'check_out_reminder_guest'
);

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'review_request_guest',
  'Review Request',
  'How was your stay at {{property_title}}?',
  '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:22px;margin-bottom:4px">We hope you enjoyed your stay!</h2>
<p style="color:#555;margin-top:0">Hi {{guest_name}}, thank you so much for choosing {{property_title}}. We hope you had a wonderful time!</p>
<p style="font-size:14px;color:#555">If you enjoyed your stay, we''d love to hear about it. Your feedback means the world to us and helps future guests make great decisions.</p>
<p style="font-size:13px;color:#777">We hope to welcome you back soon!</p>
</div>',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND template_key = 'review_request_guest'
);

-- Seed default automations (inactive by default — owner must review and activate)
INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Pre-Arrival Instructions',
  'pre_arrival_guest',
  'guest',
  'before_check_in',
  1,
  '09:00:00',
  false,
  'Sent 1 day before check-in at 9:00 AM. Review template before activating.'
WHERE NOT EXISTS (
  SELECT 1 FROM email_automations
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND name = 'Pre-Arrival Instructions'
);

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Check-In Day Reminder',
  'check_in_day_guest',
  'guest',
  'day_of_check_in',
  0,
  '08:00:00',
  false,
  'Sent on check-in day at 8:00 AM.'
WHERE NOT EXISTS (
  SELECT 1 FROM email_automations
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND name = 'Check-In Day Reminder'
);

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Check-Out Reminder',
  'check_out_reminder_guest',
  'guest',
  'before_check_out',
  1,
  '18:00:00',
  false,
  'Sent 1 day before check-out at 6:00 PM.'
WHERE NOT EXISTS (
  SELECT 1 FROM email_automations
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND name = 'Check-Out Reminder'
);

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Review Request',
  'review_request_guest',
  'guest',
  'after_check_out',
  1,
  '10:00:00',
  false,
  'Sent 1 day after check-out at 10:00 AM.'
WHERE NOT EXISTS (
  SELECT 1 FROM email_automations
  WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND name = 'Review Request'
);

-- pg_cron job to run automated emails every 15 minutes
SELECT cron.unschedule('run_automated_emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run_automated_emails'
);

SELECT cron.schedule(
  'run_automated_emails',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/send-automated-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;$$
);
