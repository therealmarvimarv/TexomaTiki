
-- 1. Standardize display names to consistent "Event – Guest/Admin" format
UPDATE email_templates SET name = 'Booking Cancelled – Admin'          WHERE template_key = 'booking_cancelled_admin';
UPDATE email_templates SET name = 'Booking Confirmed – Admin'          WHERE template_key = 'booking_confirmed_admin';
UPDATE email_templates SET name = 'Booking Request Approved – Guest'   WHERE template_key = 'booking_request_approved_guest';
UPDATE email_templates SET name = 'Booking Request Approved – Admin'   WHERE template_key = 'booking_request_approved_admin';
UPDATE email_templates SET name = 'Booking Request Declined – Guest'   WHERE template_key = 'booking_request_declined_guest';

-- 2. Deactivate legacy duplicate (booking_declined_guest was the old key,
--    superseded by booking_request_declined_guest)
UPDATE email_templates
  SET name      = 'Booking Request Declined – Guest (Legacy)',
      is_active = false
  WHERE template_key = 'booking_declined_guest';

-- 3. Add missing Booking Request Declined – Admin template
DO $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM properties LIMIT 1;
  IF v_pid IS NULL THEN RETURN; END IF;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system)
  VALUES (
    v_pid,
    'booking_request_declined_admin',
    'Booking Request Declined – Admin',
    'Booking Request Declined – {{guest_name}} ({{check_in}})',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Declined</h2>
<p style="color:#555;margin:0 0 20px">You declined a booking request at <strong>{{property_title}}</strong>. The dates remain available.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr>
</table>
<p style="font-size:13px;color:#777">No payment was collected and no dates were reserved.</p>
</div>$h$,
    true, true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  -- 4. Seed default (inactive) automation for declined admin notice
  INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  SELECT v_pid, 'Booking Request Declined – Admin Notice', 'booking_request_declined_admin', 'admin',
    'booking_request_declined', 0, NULL, false, 'Admin notice when a booking request is declined.'
  WHERE NOT EXISTS (
    SELECT 1 FROM email_automations WHERE property_id = v_pid AND trigger_type = 'booking_request_declined' AND recipient_type = 'admin'
  );
END $$;
