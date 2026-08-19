-- Update booking_request_approved_guest template to include payment button
UPDATE email_templates
SET
  html_body = replace(replace(
    html_body,
    'Payment has not been collected through the website. {{owner_name}} will contact you separately with payment instructions.',
    'Please complete your payment to finalize the reservation. Your hold will expire if payment is not received in time.'
  ),
  -- Inject payment_button placeholder before the closing questions paragraph if not already present
  '<p style="font-size:14px;color:#555;margin:0 0 20px">Questions?',
  '{{payment_button}}<p style="font-size:14px;color:#555;margin:0 0 20px">Questions?'
  ),
  updated_at = now()
WHERE template_key = 'booking_request_approved_guest'
  AND html_body NOT LIKE '%{{payment_button}}%';

-- Update booking_request_approved_admin to mention payment link variable
UPDATE email_templates
SET
  html_body = replace(
    html_body,
    'payment has not been collected through the website.',
    'payment link sent to guest: <a href="{{payment_url}}">{{payment_url}}</a>'
  ),
  updated_at = now()
WHERE template_key = 'booking_request_approved_admin'
  AND html_body NOT LIKE '%{{payment_url}}%';
