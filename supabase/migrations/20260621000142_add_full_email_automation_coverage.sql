-- Widen trigger_type CHECK constraint to include new immediate trigger types
ALTER TABLE email_automations DROP CONSTRAINT IF EXISTS email_automations_trigger_type_check;
ALTER TABLE email_automations ADD CONSTRAINT email_automations_trigger_type_check CHECK (
  trigger_type IN (
    'booking_request_received',
    'booking_request_approved',
    'booking_request_declined',
    'booking_confirmed',
    'booking_cancelled',
    'inquiry_received',
    'before_check_in',
    'day_of_check_in',
    'after_check_in',
    'before_check_out',
    'day_of_check_out',
    'after_check_out'
  )
);

-- Ensure existing event-based automations are active by default
UPDATE email_automations
SET is_active = true
WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND template_key IN (
    'booking_request_approved_guest',
    'booking_request_approved_admin',
    'booking_request_declined_guest',
    'booking_request_declined_admin'
  );

-- Insert missing automation rows (all active by default, preserving existing behavior)
INSERT INTO email_automations (property_id, template_key, trigger_type, recipient_type, offset_days, send_time, is_active, notes)
VALUES
  -- Booking request received
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_request_received_guest', 'booking_request_received', 'guest', 0, NULL, true, 'Sent to guest when booking request is submitted'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_request_received_admin', 'booking_request_received', 'admin', 0, NULL, true, 'Sent to host when booking request is submitted'),
  -- Booking confirmed
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_confirmed_guest', 'booking_confirmed', 'guest', 0, NULL, true, 'Sent to guest when booking is confirmed / paid'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_confirmed_admin', 'booking_confirmed', 'admin', 0, NULL, true, 'Sent to host when booking is confirmed / paid'),
  -- Booking cancelled
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_cancelled_guest', 'booking_cancelled', 'guest', 0, NULL, true, 'Sent to guest when booking is cancelled'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'booking_cancelled_admin', 'booking_cancelled', 'admin', 0, NULL, true, 'Sent to host when booking is cancelled'),
  -- Inquiry / contact
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'inquiry_auto_reply_guest', 'inquiry_received', 'guest', 0, NULL, true, 'Auto-reply sent to guest when inquiry is submitted'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'inquiry_received_admin', 'inquiry_received', 'admin', 0, NULL, true, 'Sent to host when inquiry is submitted')
ON CONFLICT DO NOTHING;
