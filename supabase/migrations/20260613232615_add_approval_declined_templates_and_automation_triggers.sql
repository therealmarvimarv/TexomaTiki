
-- 1. Widen trigger_type CHECK first so inserts below pass
ALTER TABLE email_automations DROP CONSTRAINT IF EXISTS email_automations_trigger_type_check;
ALTER TABLE email_automations ADD CONSTRAINT email_automations_trigger_type_check
  CHECK (trigger_type IN (
    'booking_confirmed',
    'booking_request_approved',
    'booking_request_declined',
    'before_check_in',
    'day_of_check_in',
    'after_check_in',
    'before_check_out',
    'day_of_check_out',
    'after_check_out'
  ));

-- 2. Seed templates and automations
DO $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM properties LIMIT 1;
  IF v_pid IS NULL THEN RETURN; END IF;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system)
  VALUES (
    v_pid,
    'booking_request_approved_guest',
    'Booking Request Approved',
    'Your booking request has been approved – {{property_title}}',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved!</h2>
<p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, great news — your booking request at <strong>{{property_title}}</strong> has been approved and your dates are reserved.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Property</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{property_title}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Address</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{property_address}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}} at {{check_in_time}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}} at {{check_out_time}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Confirmation #</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{confirmation_code}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Total Trip Price</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr>
</table>
<p style="font-size:14px;color:#555;margin:0 0 12px"><strong>Payment note:</strong> Payment has not been collected through the website. {{owner_name}} will contact you separately with payment instructions.</p>
<p style="font-size:14px;color:#555;margin:0 0 20px">Questions? Contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a> or {{owner_phone}}.</p>
<p style="font-size:12px;color:#999">We look forward to hosting you!</p>
</div>$h$,
    true, true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system)
  VALUES (
    v_pid,
    'booking_request_approved_admin',
    'Booking Request Approved (Admin Notice)',
    'Booking Approved – {{guest_name}} ({{check_in}})',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved</h2>
<p style="color:#555;margin:0 0 20px">You approved a booking request at <strong>{{property_title}}</strong>. Dates are now reserved.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr>
</table>
<p style="font-size:13px;color:#777">Payment status: <strong>{{payment_status}}</strong> — payment has not been collected through the website.</p>
</div>$h$,
    true, true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system)
  VALUES (
    v_pid,
    'booking_request_declined_guest',
    'Booking Request Declined',
    'Your booking request was not approved – {{property_title}}',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Not Approved</h2>
<p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, unfortunately your booking request at <strong>{{property_title}}</strong> was not approved for the requested dates.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Requested check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Requested check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr>
</table>
<p style="font-size:14px;color:#555;margin:0 0 12px">Your dates were not reserved and no payment was collected.</p>
<p style="font-size:14px;color:#555;margin:0 0 20px">You are welcome to check availability for other dates or contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a>.</p>
<p style="font-size:12px;color:#999">Thank you for your interest in {{property_title}}.</p>
</div>$h$,
    true, true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  SELECT v_pid, 'Booking Request Approved – Guest Email', 'booking_request_approved_guest', 'guest',
    'booking_request_approved', 0, NULL, false, 'Sends when admin approves a manual booking request.'
  WHERE NOT EXISTS (
    SELECT 1 FROM email_automations WHERE property_id = v_pid AND trigger_type = 'booking_request_approved' AND recipient_type = 'guest'
  );

  INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
  SELECT v_pid, 'Booking Request Declined – Guest Email', 'booking_request_declined_guest', 'guest',
    'booking_request_declined', 0, NULL, false, 'Sends when admin declines a booking request.'
  WHERE NOT EXISTS (
    SELECT 1 FROM email_automations WHERE property_id = v_pid AND trigger_type = 'booking_request_declined' AND recipient_type = 'guest'
  );

END $$;
