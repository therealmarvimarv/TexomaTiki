-- Widen trigger_type CHECK to include booking_refunded
ALTER TABLE email_automations DROP CONSTRAINT IF EXISTS email_automations_trigger_type_check;
ALTER TABLE email_automations ADD CONSTRAINT email_automations_trigger_type_check CHECK (
  trigger_type IN (
    'booking_request_received',
    'booking_request_approved',
    'booking_request_declined',
    'booking_confirmed',
    'booking_cancelled',
    'booking_refunded',
    'inquiry_received',
    'before_check_in',
    'day_of_check_in',
    'after_check_in',
    'before_check_out',
    'day_of_check_out',
    'after_check_out'
  )
);

DO $$
DECLARE v_pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_refunded_guest', 'Booking Refunded – Guest',
 'Refund Processed – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Refund Processed</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, a {{refund_type}} has been processed for your booking at <strong>{{listing_name}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Booking Number</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{booking_number}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Refund Type</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{refund_type}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Amount Refunded</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{refund_amount}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Total Refunded</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{total_refunded}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Remaining Balance</td><td style="padding:10px 0;font-size:14px">{{remaining_amount}}</td></tr></table><p style="font-size:14px;color:#555">The refund has been processed through Stripe and may take a few business days to appear on your statement. If you have questions, contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a>.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_refunded_admin', 'Booking Refunded – Admin',
 'Refund Processed – {{guest_name}} ({{booking_number}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Refund Processed</h2><p style="color:#555;margin:0 0 20px">A {{refund_type}} has been processed for a booking at <strong>{{listing_name}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Booking Number</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{booking_number}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Refund Type</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{refund_type}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Amount Refunded</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{refund_amount}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Total Refunded</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{total_refunded}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Remaining Refundable</td><td style="padding:10px 0;font-size:14px">{{remaining_amount}}</td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to view the full booking details.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
VALUES
  (v_pid, 'Booking Refunded – Guest', 'booking_refunded_guest', 'guest', 'booking_refunded', 0, NULL, true, 'Sent to guest when a Stripe refund is processed'),
  (v_pid, 'Booking Refunded – Admin', 'booking_refunded_admin', 'admin', 'booking_refunded', 0, NULL, true, 'Sent to admin when a Stripe refund is processed')
ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

END $$;
