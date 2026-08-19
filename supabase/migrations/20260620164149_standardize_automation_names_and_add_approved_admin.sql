
-- 1. Standardize automation display names to match "Event – Guest/Admin" convention
UPDATE email_automations SET name = 'Booking Request Approved – Guest'
  WHERE trigger_type = 'booking_request_approved' AND recipient_type = 'guest';

UPDATE email_automations SET name = 'Booking Request Declined – Guest'
  WHERE trigger_type = 'booking_request_declined' AND recipient_type = 'guest';

UPDATE email_automations SET name = 'Booking Request Declined – Admin'
  WHERE trigger_type = 'booking_request_declined' AND recipient_type = 'admin';

-- 2. Add missing Booking Request Approved – Admin automation if it doesn't exist
DO $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM properties LIMIT 1;
  IF v_pid IS NULL THEN RETURN; END IF;

  INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  SELECT v_pid,
    'Booking Request Approved – Admin',
    'booking_request_approved_admin',
    'admin',
    'booking_request_approved',
    0, NULL, false,
    'Admin notice when a booking request is approved.'
  WHERE NOT EXISTS (
    SELECT 1 FROM email_automations
    WHERE property_id = v_pid
      AND trigger_type = 'booking_request_approved'
      AND recipient_type = 'admin'
  );
END $$;
