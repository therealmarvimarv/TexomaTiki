UPDATE email_templates
SET
  html_body = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
  <h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved!</h2>

  <p style="color:#555;margin:0 0 20px">
    Hi {{guest_name}}, great news — your booking request at <strong>{{listing_name}}</strong> has been approved.
  </p>

  <p style="color:#555;margin:0 0 20px">
    Your dates are being held while payment is pending. Please complete payment to finalize your reservation.
  </p>

  <div style="margin:24px 0;text-align:center">
    {{payment_button}}
  </div>

  <p style="font-size:13px;color:#777;margin:0 0 20px;text-align:center">
    If the button does not work, copy and paste this link into your browser:<br>
    <a href="{{payment_url}}" style="color:#2563eb">{{payment_url}}</a>
  </p>

  <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Property</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{listing_name}}</strong></td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Address</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{listing_address}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}} at {{check_in_time}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}} at {{check_out_time}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Confirmation #</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{confirmation_code}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#555;font-size:14px">Total Trip Price</td>
      <td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td>
    </tr>
  </table>

  <p style="font-size:14px;color:#555;margin:0 0 20px">
    Questions? Contact us at <a href="mailto:{{primary_guest_contact_email}}">{{primary_guest_contact_email}}</a> or {{primary_guest_contact_phone}}.
  </p>

  <p style="font-size:12px;color:#999">We look forward to hosting you!</p>
</div>',
  updated_at = now()
WHERE template_key = 'booking_request_approved_guest';
