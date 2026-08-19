/*
# Seed Email Templates, Automations, and Default Settings

Applies the final seed data sections 22–24 of the bootstrap SQL for Tiki Cottage (property ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890).

1. SECTION 22: email_templates — 18 rows (17 system templates + 1 custom stuff_to_do)
   - booking_request_received_guest/admin
   - booking_confirmed_guest/admin
   - booking_cancelled_guest/admin
   - booking_request_approved_guest/admin
   - booking_request_declined_guest/admin
   - inquiry_received_admin
   - inquiry_auto_reply_guest
   - pre_arrival_guest, check_in_day_guest, check_out_reminder_guest
   - review_request_guest, test_email, stuff_to_do

2. SECTION 23: email_automations — 17 rows linking templates to trigger types

3. SECTION 24: Default settings rows
   - email_settings: provider=disabled
   - payment_settings: mode=manual, stripe_test_enabled=false
   - account_settings: America/Chicago, USD, active

All inserts use ON CONFLICT DO NOTHING for idempotency.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 22: SEED — EMAIL TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_received_guest', 'Booking Request – Guest',
 'Booking Request Received – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Received</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, we received your booking request for <strong>{{listing_name}}</strong> and will review it shortly.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;font-size:14px">{{guest_count}}</td></tr></table><p style="font-size:14px;color:#555">We will be in touch soon to confirm your reservation.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_received_admin', 'Booking Request – Admin',
 'New Booking Request – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">New Booking Request</h2><p style="color:#555;margin:0 0 20px">A new booking request has been submitted for <strong>{{listing_name}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_count}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Estimated Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to approve or decline this request.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_confirmed_guest', 'Booking Confirmed – Guest',
 'Booking Confirmed – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Confirmed!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, your booking at <strong>{{listing_name}}</strong> is confirmed. We look forward to hosting you!</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:14px;color:#555">You will receive access instructions closer to your arrival date. Questions? Contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_confirmed_admin', 'Booking Confirmed – Admin',
 'Booking Confirmed – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Confirmed</h2><p style="color:#555;margin:0 0 20px">A booking at <strong>{{listing_name}}</strong> has been confirmed.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{estimated_total}}</strong></td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to view the full booking details.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_cancelled_guest', 'Booking Cancelled – Guest',
 'Booking Cancelled – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Cancelled</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, your booking at <strong>{{listing_name}}</strong> has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">If you have questions, contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_cancelled_admin', 'Booking Cancelled – Admin',
 'Booking Cancelled – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Cancelled</h2><p style="color:#555;margin:0 0 20px">A booking at <strong>{{listing_name}}</strong> has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px">{{estimated_total}}</td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to review and manage this booking.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_approved_guest', 'Booking Request Approved – Guest',
 'Your booking request has been approved – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, great news — your booking request at <strong>{{listing_name}}</strong> has been approved. Your dates are being held while payment is pending. Please complete payment to finalize your reservation.</p><div style="margin:24px 0;text-align:center">{{payment_button}}</div><p style="font-size:13px;color:#777;margin:0 0 20px;text-align:center">If the button does not work, copy and paste this link into your browser:<br><a href="{{payment_url}}" style="color:#2563eb">{{payment_url}}</a></p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total Trip Price</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:14px;color:#555;margin:0 0 20px">Questions? Contact us at <a href="mailto:{{primary_guest_contact_email}}">{{primary_guest_contact_email}}</a>.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_approved_admin', 'Booking Request Approved – Admin',
 'Booking Approved – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved</h2><p style="color:#555;margin:0 0 20px">You approved a booking request at <strong>{{listing_name}}</strong>. Dates are now reserved.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">Payment status: <strong>{{payment_status}}</strong> — payment link sent to guest: <a href="{{payment_url}}">{{payment_url}}</a></p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_declined_guest', 'Booking Request Declined – Guest',
 'Your booking request was not approved – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Not Approved</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, unfortunately your booking request at <strong>{{listing_name}}</strong> was not approved for the requested dates.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Requested check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Requested check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555;margin:0 0 12px">Your dates were not reserved and no payment was collected.</p><p style="font-size:14px;color:#555;margin:0 0 20px">You are welcome to check availability for other dates or contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a>.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'booking_request_declined_admin', 'Booking Request Declined – Admin',
 'Booking Request Declined – {{guest_name}} ({{check_in}})',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Declined</h2><p style="color:#555;margin:0 0 20px">You declined a booking request at <strong>{{listing_name}}</strong>. The dates remain available.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:13px;color:#777">No payment was collected and no dates were reserved.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'inquiry_received_admin', 'New Inquiry – Admin',
 'New Inquiry from {{guest_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">New Inquiry</h2><p style="color:#555;margin:0 0 20px">Someone sent a message through the <strong>{{listing_name}}</strong> contact form.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{sender_phone}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px;vertical-align:top">Message</td><td style="padding:10px 0;font-size:14px;white-space:pre-wrap">{{inquiry_message}}</td></tr></table><a href="mailto:{{guest_email}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">Reply to {{guest_name}}</a></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'inquiry_auto_reply_guest', 'Inquiry Auto-Reply – Guest',
 'We received your message – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Thanks for reaching out!</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, we received your message about <strong>{{listing_name}}</strong> and will get back to you as soon as possible.</p><p style="font-size:14px;color:#555">In the meantime, you can browse availability on the listing page.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'pre_arrival_guest', 'Pre-Arrival Instructions',
 'Your stay at {{listing_name}} is coming up!',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Your stay is almost here!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, we''re looking forward to welcoming you to {{listing_name}} tomorrow.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;font-size:14px">{{guest_count}}</td></tr></table><p style="font-size:14px;color:#555">If you have any questions before you arrive, reply to this email or contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'check_in_day_guest', 'Check-In Day Reminder',
 'Welcome day is here – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Today''s the day!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, your stay at {{listing_name}} begins today. We''re so excited to host you.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">If anything comes up during your stay, don''t hesitate to reach out at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'check_out_reminder_guest', 'Check-Out Reminder',
 'Reminder: Check-out tomorrow at {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Check-out reminder</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, just a friendly reminder that your stay at {{listing_name}} ends tomorrow.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555">Please make sure to leave the property tidy. If you have any questions, contact us at {{host_email}}.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'review_request_guest', 'Review Request',
 'How was your stay at {{listing_name}}?',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">We hope you enjoyed your stay!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, thank you so much for choosing {{listing_name}}. We hope you had a wonderful time!</p><p style="font-size:14px;color:#555">If you enjoyed your stay, we''d love to hear about it. Your feedback means the world to us.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'test_email', 'Test Email',
 'Test Email – {{listing_name}}',
 '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2>Test Email</h2><p>This is a test email from {{listing_name}}. If you received this, your email settings are working correctly.</p></div>',
 true, true)
ON CONFLICT (property_id, template_key) DO NOTHING;

INSERT INTO email_templates (property_id, template_key, name, subject, html_body, is_active, is_system) VALUES
(v_pid, 'stuff_to_do', 'Stuff To Do',
 'Things to do',
 '<div style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f6f6f6;margin:0;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eeeeee;"><tr><td style="padding:28px 24px 12px 24px;"><h2 style="font-size:24px;line-height:1.3;margin:0 0 8px 0;color:#111;font-weight:700;">Things to Do Near Tiki Paradise</h2><p style="font-size:15px;line-height:1.6;color:#555;margin:0;">Hi {{guest_name}}, we''re so glad you''ll be joining us.</p></td></tr></table></td></tr></table></div>',
 false, false)
ON CONFLICT (property_id, template_key) DO NOTHING;

END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 23: SEED — EMAIL AUTOMATIONS
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

INSERT INTO email_automations (property_id, name, template_key, recipient_type, trigger_type, offset_days, send_time, is_active, notes)
VALUES
  (v_pid, 'Booking Request Received – Guest', 'booking_request_received_guest', 'guest', 'booking_request_received', 0, NULL, true,  'Sent to guest when booking request is submitted'),
  (v_pid, 'Booking Request Received – Admin', 'booking_request_received_admin', 'admin', 'booking_request_received', 0, NULL, true,  'Sent to host when booking request is submitted'),
  (v_pid, 'Booking Confirmed – Guest',        'booking_confirmed_guest',        'guest', 'booking_confirmed',        0, NULL, true,  'Sent to guest when booking is confirmed / paid'),
  (v_pid, 'Booking Confirmed – Admin',        'booking_confirmed_admin',        'admin', 'booking_confirmed',        0, NULL, true,  'Sent to host when booking is confirmed / paid'),
  (v_pid, 'Booking Cancelled – Guest',        'booking_cancelled_guest',        'guest', 'booking_cancelled',        0, NULL, true,  'Sent to guest when booking is cancelled'),
  (v_pid, 'Booking Cancelled – Admin',        'booking_cancelled_admin',        'admin', 'booking_cancelled',        0, NULL, true,  'Sent to host when booking is cancelled'),
  (v_pid, 'Inquiry Auto-Reply – Guest',       'inquiry_auto_reply_guest',       'guest', 'inquiry_received',         0, NULL, true,  'Auto-reply sent to guest when inquiry is submitted'),
  (v_pid, 'New Inquiry – Admin',              'inquiry_received_admin',         'admin', 'inquiry_received',         0, NULL, true,  'Sent to host when inquiry is submitted'),
  (v_pid, 'Booking Request Approved – Guest', 'booking_request_approved_guest', 'guest', 'booking_request_approved', 0, NULL, true,  'Sends when admin approves a manual booking request'),
  (v_pid, 'Booking Request Approved – Admin', 'booking_request_approved_admin', 'admin', 'booking_request_approved', 0, NULL, false, 'Admin notice when a booking request is approved'),
  (v_pid, 'Booking Request Declined – Guest', 'booking_request_declined_guest', 'guest', 'booking_request_declined', 0, NULL, true,  'Sends when admin declines a booking request'),
  (v_pid, 'Booking Request Declined – Admin', 'booking_request_declined_admin', 'admin', 'booking_request_declined', 0, NULL, false, 'Admin notice when a booking request is declined'),
  (v_pid, 'Pre-Arrival Instructions',         'pre_arrival_guest',              'guest', 'before_check_in',          1, '09:00:00', false, 'Sent 1 day before check-in at 9:00 AM. Review template before activating.'),
  (v_pid, 'Check-In Day Reminder',            'check_in_day_guest',             'guest', 'day_of_check_in',          0, '08:00:00', false, 'Sent on check-in day at 8:00 AM.'),
  (v_pid, 'Check-Out Reminder',               'check_out_reminder_guest',       'guest', 'before_check_out',         1, '18:00:00', false, 'Sent 1 day before check-out at 6:00 PM.'),
  (v_pid, 'Review Request',                   'review_request_guest',           'guest', 'after_check_out',          1, '10:00:00', false, 'Sent 1 day after check-out at 10:00 AM.'),
  (v_pid, 'Stuff To Do',                      'stuff_to_do',                    'guest', 'day_of_check_in',          1, '12:00:00', false, NULL)
ON CONFLICT (property_id, template_key) WHERE template_key IS NOT NULL DO NOTHING;

END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 24: SEED — EMAIL SETTINGS, PAYMENT SETTINGS, ACCOUNT SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO email_settings (property_id, email_provider, admin_email)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'disabled', '')
ON CONFLICT (property_id) DO NOTHING;

INSERT INTO payment_settings (property_id, payment_mode, stripe_test_enabled, site_url)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'manual', false, '')
ON CONFLICT (property_id) DO NOTHING;

INSERT INTO account_settings (property_id, role, timezone, currency, date_format, account_status, support_email, support_message, support_enabled)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Owner/Admin',
  'America/Chicago',
  'USD',
  'MM/DD/YYYY',
  'active',
  'support@example.com',
  'Need help with your website or booking system? Contact support using the information below.',
  true
)
ON CONFLICT (property_id) DO NOTHING;
