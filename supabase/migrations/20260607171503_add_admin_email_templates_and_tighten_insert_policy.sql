
-- 1. Seed booking_confirmed_admin and booking_cancelled_admin templates
--    Uses DO block to insert only if not already present (idempotent)
DO $$
DECLARE
  v_property_id uuid;
BEGIN
  SELECT id INTO v_property_id FROM properties LIMIT 1;
  IF v_property_id IS NULL THEN RETURN; END IF;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
  VALUES (
    v_property_id,
    'booking_confirmed_admin',
    'Booking Confirmed (Admin)',
    'Booking Confirmed – {{guest_name}} ({{check_in}})',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Confirmed</h2>
<p style="color:#555;margin:0 0 20px">A booking at <strong>{{property_title}}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Nights</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{nights}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_count}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr>
</table>
<p style="font-size:13px;color:#777">Log in to the admin dashboard to view the full booking details.</p>
</div>$h$,
    true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active)
  VALUES (
    v_property_id,
    'booking_cancelled_admin',
    'Booking Cancelled (Admin)',
    'Booking Cancelled – {{guest_name}} ({{check_in}})',
    $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Cancelled</h2>
<p style="color:#555;margin:0 0 20px">A booking at <strong>{{property_title}}</strong> has been cancelled.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_count}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px">{{estimated_total}}</td></tr>
</table>
<p style="font-size:13px;color:#777">Log in to the admin dashboard to review and manage this booking.</p>
</div>$h$,
    true
  )
  ON CONFLICT (property_id, template_key) DO NOTHING;

  -- Also update inquiry_received_admin to include sender_phone row
  UPDATE email_templates
  SET html_body = $h$<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
<h2 style="font-size:22px;font-weight:600;margin:0 0 8px">New Inquiry</h2>
<p style="color:#555;margin:0 0 20px">Someone sent a message through the <strong>{{property_title}}</strong> contact form.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{sender_phone}}</td></tr>
<tr><td style="padding:10px 0;color:#555;font-size:14px;vertical-align:top">Message</td><td style="padding:10px 0;font-size:14px;white-space:pre-wrap">{{inquiry_message}}</td></tr>
</table>
<a href="mailto:{{guest_email}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">Reply to {{guest_name}}</a>
</div>$h$
  WHERE property_id = v_property_id
    AND template_key = 'inquiry_received_admin';
END $$;

-- 2. Tighten email_templates INSERT policy:
--    Drop the broad authenticated INSERT, keep UPDATE for admin editing.
--    Seeding is done by service_role (bypasses RLS) so no INSERT policy needed.
DROP POLICY IF EXISTS "auth_insert_email_templates" ON email_templates;
