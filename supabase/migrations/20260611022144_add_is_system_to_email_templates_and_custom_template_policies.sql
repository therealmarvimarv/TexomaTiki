
-- Add is_system flag to distinguish seeded/system templates from admin-created ones
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Mark all currently seeded templates as system templates
UPDATE email_templates SET is_system = true WHERE template_key IN (
  'booking_request_received_guest',
  'booking_request_received_admin',
  'booking_confirmed_guest',
  'booking_confirmed_admin',
  'booking_cancelled_guest',
  'booking_cancelled_admin',
  'booking_declined_guest',
  'inquiry_received_admin',
  'inquiry_auto_reply_guest',
  'test_email',
  'pre_arrival_guest',
  'check_in_day_guest',
  'check_out_reminder_guest',
  'review_request_guest'
);

-- Allow authenticated admins to insert new custom templates
CREATE POLICY "auth_insert_custom_email_templates" ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (is_system = false);

-- Allow authenticated admins to delete custom templates only
CREATE POLICY "auth_delete_custom_email_templates" ON email_templates
  FOR DELETE TO authenticated
  USING (is_system = false);
