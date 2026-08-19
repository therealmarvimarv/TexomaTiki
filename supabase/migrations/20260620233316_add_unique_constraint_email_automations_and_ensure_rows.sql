-- Unique index prevents duplicate automation rows per property+template_key
CREATE UNIQUE INDEX IF NOT EXISTS email_automations_property_template_key_unique
  ON email_automations(property_id, template_key)
  WHERE template_key IS NOT NULL;

-- Ensure all 4 required time-based automation rows exist (idempotent)
DO $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM properties LIMIT 1;
  IF v_pid IS NULL THEN RETURN; END IF;

  INSERT INTO email_automations
    (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  VALUES
    (v_pid, 'Pre-Arrival Instructions', 'pre_arrival_guest', 'guest',
     'before_check_in', 1, '09:00:00', false,
     'Sent 1 day before check-in at 9:00 AM. Review template before activating.')
  ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

  INSERT INTO email_automations
    (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  VALUES
    (v_pid, 'Check-In Day Reminder', 'check_in_day_guest', 'guest',
     'day_of_check_in', 0, '08:00:00', false,
     'Sent on check-in day at 8:00 AM.')
  ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

  INSERT INTO email_automations
    (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  VALUES
    (v_pid, 'Check-Out Reminder', 'check_out_reminder_guest', 'guest',
     'before_check_out', 1, '18:00:00', false,
     'Sent 1 day before check-out at 6:00 PM.')
  ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

  INSERT INTO email_automations
    (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  VALUES
    (v_pid, 'Review Request', 'review_request_guest', 'guest',
     'after_check_out', 1, '10:00:00', false,
     'Sent 1 day after check-out at 10:00 AM.')
  ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;
END $$;
