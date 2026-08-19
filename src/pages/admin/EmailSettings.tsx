import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Mail, CheckCircle2, AlertCircle, AlertTriangle, Clock,
  Send, Loader2, RefreshCw, Eye, EyeOff, Trash2, Save,
  ChevronDown, ChevronUp, RotateCcw, FileText, Settings, List,
  MessageSquare, Zap, Plus, ToggleLeft, ToggleRight, X, Copy,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailStatus {
  provider: string;
  configured: boolean;
  smtp_configured: boolean;
  missing_fields: string[];
  config_warning?: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_from: string;
  admin_email: string;
  smtp_username_preview: string | null;
  smtp_username_configured: boolean;
  smtp_password_configured: boolean;
  adminEmail?: string;
}

interface EmailTemplate {
  id: string;
  property_id: string;
  template_key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  is_active: boolean;
  is_system: boolean;
  updated_at: string;
}

interface NotificationLog {
  id: string;
  related_type: string;
  related_id: string | null;
  channel: string;
  provider: string;
  recipient: string;
  subject: string;
  status: string;
  template_key: string | null;
  error_message: string | null;
  created_at: string;
}

// ── Default template content (for Reset to Default) ───────────────────────────

const TEMPLATE_DEFAULTS: Record<string, { subject: string; html_body: string }> = {
  booking_request_received_guest: {
    subject: 'Booking Request Received – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Booking Request Received</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, your booking request for {{listing_name}} has been received. The host will review it and confirm availability soon.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Property</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{listing_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Nights</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{nights}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Estimated total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">No payment has been charged yet. You will receive another email once the host confirms your stay.</p></div>`,
  },
  booking_request_received_admin: {
    subject: 'New Booking Request – {{guest_name}} ({{check_in}})',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">New Booking Request</h2><p style="color:#555;margin-top:0">A guest is requesting dates at {{listing_name}}. Review and confirm or decline.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_email}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Nights</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{nights}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Estimated total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table></div>`,
  },
  booking_confirmed_guest: {
    subject: 'Your Booking is Confirmed – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Your Booking is Confirmed!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, great news — your stay at {{listing_name}} is confirmed.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Nights</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{nights}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total paid</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">If you have any questions, reply to this email or contact the host directly.</p></div>`,
  },
  booking_cancelled_guest: {
    subject: 'Your Booking Has Been Cancelled – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Booking Cancelled</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, your booking at {{listing_name}} has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:13px;color:#777">If you believe this is an error, please contact the host directly.</p></div>`,
  },
  booking_request_approved_guest: {
    subject: 'Your booking request has been approved – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px">
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
</div>`,
  },
  booking_request_approved_admin: {
    subject: 'Booking Approved – {{guest_name}} ({{check_in}})',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Approved</h2><p style="color:#555;margin:0 0 20px">You approved a booking request at <strong>{{listing_name}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">Payment status: <strong>{{payment_status}}</strong>{{payment_url}} — <a href="{{payment_url}}">View payment link</a></p></div>`,
  },
  booking_request_declined_guest: {
    subject: 'Your booking request was not approved – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Not Approved</h2><p style="color:#555;margin:0 0 20px">Hi {{guest_name}}, unfortunately your booking request at <strong>{{listing_name}}</strong> was not approved for the requested dates.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Requested check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Requested check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:14px;color:#555;margin:0 0 12px">Your dates were not reserved and no payment was collected.</p><p style="font-size:14px;color:#555;margin:0 0 20px">You are welcome to check availability for other dates or contact us at <a href="mailto:{{owner_email}}">{{owner_email}}</a>.</p></div>`,
  },
  booking_request_declined_admin: {
    subject: 'Booking Request Declined – {{guest_name}} ({{check_in}})',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:20px"><h2 style="font-size:22px;font-weight:600;margin:0 0 8px">Booking Request Declined</h2><p style="color:#555;margin:0 0 20px">You declined a booking request at <strong>{{listing_name}}</strong>. The dates remain available.</p><table style="width:100%;border-collapse:collapse;margin:0 0 20px"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><a href="mailto:{{guest_email}}">{{guest_email}}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;font-size:14px">{{check_out}}</td></tr></table><p style="font-size:13px;color:#777">No payment was collected and no dates were reserved.</p></div>`,
  },
  inquiry_received_admin: {
    subject: 'New Message from {{guest_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">New Contact Message</h2><p style="color:#555;margin-top:0">Someone sent a message through the {{listing_name}} contact form.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_email}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Message</td><td style="padding:10px 0;font-size:14px;white-space:pre-wrap">{{inquiry_message}}</td></tr></table><a href="mailto:{{guest_email}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">Reply to {{guest_name}}</a></div>`,
  },
  inquiry_auto_reply_guest: {
    subject: 'We received your message – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">We got your message!</h2><p style="color:#555;margin-top:0">Hi {{guest_name}}, thanks for reaching out about {{listing_name}}. We will get back to you as soon as possible.</p><blockquote style="border-left:3px solid #ddd;padding-left:16px;color:#666;font-size:14px;margin:24px 0">{{inquiry_message}}</blockquote><p style="font-size:13px;color:#777">Please do not reply to this email directly — we will reach out from {{support_email}}.</p></div>`,
  },
  test_email: {
    subject: 'Test Email – {{listing_name}}',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Test Email</h2><p style="color:#555;">This is a test email from {{listing_name}}. Your email provider is configured and working correctly.</p><p style="font-size:13px;color:#777;margin-top:24px;">Sent at: {{current_date}}</p></div>`,
  },
  booking_confirmed_admin: {
    subject: 'Booking Confirmed – {{guest_name}} ({{check_in}})',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Booking Confirmed</h2><p style="color:#555;margin-top:0">A booking at <strong>{{listing_name}}</strong> has been confirmed.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_email}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Nights</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{nights}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px"><strong>{{total_trip_price}}</strong></td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to view the full booking details.</p></div>`,
  },
  booking_cancelled_admin: {
    subject: 'Booking Cancelled – {{guest_name}} ({{check_in}})',
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="font-size:22px;margin-bottom:4px">Booking Cancelled</h2><p style="color:#555;margin-top:0">A booking at <strong>{{listing_name}}</strong> has been cancelled.</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px;width:40%">Guest</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px"><strong>{{guest_name}}</strong></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guest Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guest_email}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-in</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_in}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Check-out</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{check_out}}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">{{guests}}</td></tr><tr><td style="padding:10px 0;color:#555;font-size:14px">Total</td><td style="padding:10px 0;font-size:14px">{{total_trip_price}}</td></tr></table><p style="font-size:13px;color:#777">Log in to the admin dashboard to review and manage this booking.</p></div>`,
  },
};

// Static sample values for booking/guest/other fields.
// Account-sourced fields (listing, contact, owner/business) are loaded from
// account_settings at runtime and merged in buildPreviewVars().
const BOOKING_SAMPLE_VARS: Record<string, string> = {
  guest_name: 'Jane Smith',
  guest_email: 'jane@example.com',
  guest_phone: '(555) 867-5309',
  guest_city: 'Phoenix',
  guest_county: 'Maricopa County',
  check_in: 'Thu, Jul 10, 2026',
  check_out: 'Sun, Jul 13, 2026',
  nights: '3',
  guests: '2',
  confirmation_code: 'TIKI-ABC12345',
  average_nightly_price: '$250.00',
  total_trip_price: '$1,250.00',
  cleaning_fee: '$150.00',
  payment_status: 'Pending',
  booking_status: 'Confirmed',
  special_requests: 'Early check-in if available.',
  inquiry_message: 'Sample inquiry message.',
  current_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  payment_url: 'https://checkout.stripe.com/c/pay/sample',
  payment_button: '<a href="https://checkout.stripe.com/c/pay/sample" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Complete Payment</a>',
};

// Keys sourced from account_settings — real values are loaded at runtime.
const ACCOUNT_VAR_KEYS: (keyof AccountVars)[] = [
  'listing_name', 'listing_address', 'listing_city', 'listing_state', 'listing_zip', 'listing_country',
  'check_in_time', 'check_out_time', 'suggested_door_code',
  'listing_manager_name', 'listing_manager_role', 'manager_email', 'manager_phone',
  'primary_guest_contact_name', 'primary_guest_contact_email', 'primary_guest_contact_phone',
  'owner_name', 'owner_email', 'owner_phone', 'business_name', 'business_address', 'support_email',
];

interface AccountVars {
  listing_name?: string; listing_address?: string; listing_city?: string;
  listing_state?: string; listing_zip?: string; listing_country?: string;
  check_in_time?: string; check_out_time?: string; suggested_door_code?: string;
  listing_manager_name?: string; listing_manager_role?: string;
  manager_email?: string; manager_phone?: string;
  primary_guest_contact_name?: string; primary_guest_contact_email?: string; primary_guest_contact_phone?: string;
  owner_name?: string; owner_email?: string; owner_phone?: string;
  business_name?: string; business_address?: string; support_email?: string;
}

function buildPreviewVars(accountVars: AccountVars): Record<string, string> {
  const account: Record<string, string> = {};
  for (const k of ACCOUNT_VAR_KEYS) {
    account[k] = accountVars[k] ?? '';
  }
  return { ...BOOKING_SAMPLE_VARS, ...account };
}

const EMAIL_TEMPLATE_VARIABLES: { group: string; vars: [string, string][] }[] = [
  { group: 'Property / Listing', vars: [
    ['listing_name', 'Listing name'],
    ['listing_address', 'Listing street address'],
    ['listing_city', 'Listing city'],
    ['listing_state', 'Listing state'],
    ['listing_zip', 'Listing ZIP code'],
    ['listing_country', 'Listing country'],
    ['check_in_time', 'Check-in time (e.g. 4:00 PM)'],
    ['check_out_time', 'Check-out time (e.g. 11:00 AM)'],
    ['suggested_door_code', 'Door/access code (private — admin use only)'],
  ]},
  { group: 'Listing Contact', vars: [
    ['listing_manager_name', 'Listing manager name'],
    ['listing_manager_role', 'Listing manager role'],
    ['manager_email', 'Manager email'],
    ['manager_phone', 'Manager phone'],
    ['primary_guest_contact_name', 'Primary guest contact name'],
    ['primary_guest_contact_email', 'Primary guest contact email'],
    ['primary_guest_contact_phone', 'Primary guest contact phone'],
  ]},
  { group: 'Guest', vars: [
    ['guest_name', 'Guest full name'],
    ['guest_email', 'Guest email address'],
    ['guest_phone', 'Guest phone number'],
    ['guest_city', 'Guest city'],
    ['guest_county', 'Guest county'],
  ]},
  { group: 'Booking', vars: [
    ['check_in', 'Formatted check-in date'],
    ['check_out', 'Formatted check-out date'],
    ['nights', 'Number of nights'],
    ['guests', 'Number of guests'],
    ['confirmation_code', 'Booking confirmation code'],
    ['average_nightly_price', 'Average nightly rate'],
    ['total_trip_price', 'Total trip price'],
    ['cleaning_fee', 'Cleaning fee'],
    ['payment_status', 'Payment status'],
    ['booking_status', 'Booking status'],
    ['special_requests', 'Guest special requests'],
  ]},
  { group: 'Owner / Business', vars: [
    ['owner_name', 'Owner name'],
    ['owner_email', 'Owner email'],
    ['owner_phone', 'Owner phone'],
    ['business_name', 'Business / company name'],
    ['business_address', 'Business address'],
    ['support_email', 'Support email'],
  ]},
  { group: 'Other', vars: [
    ['inquiry_message', 'Contact form message'],
    ['current_date', "Today's date"],
    ['payment_url', 'Stripe Checkout URL (approval emails only)'],
    ['payment_button', 'Complete Payment button HTML (approval emails only)'],
  ]},
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchStatus(token: string): Promise<EmailStatus | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/email-settings-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveProviderSettings(token: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: EmailStatus; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/email-settings-update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? 'Save failed' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error' };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderPreview(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{([a-z_]+)\}\}/g, (_, key) =>
    key in vars
      ? vars[key]
      : `<span style="background:#fef08a;padding:0 2px;font-family:monospace;font-size:0.9em">{{${key}}}</span>`
  );
}

const STATUS_STYLES: Record<string, { badge: string; icon: React.ElementType; iconClass: string }> = {
  sent:    { badge: 'bg-green-100 text-green-700', icon: CheckCircle2, iconClass: 'text-green-500' },
  skipped: { badge: 'bg-gray-100 text-gray-500',   icon: AlertTriangle, iconClass: 'text-gray-400' },
  failed:  { badge: 'bg-red-100 text-red-700',     icon: AlertCircle,   iconClass: 'text-red-500'  },
};

function ProviderBadge({ provider }: { provider: string }) {
  const cfg: Record<string, { label: string; style: string }> = {
    resend:   { label: 'Resend',   style: 'bg-blue-50 text-blue-700 border-blue-200' },
    smtp:     { label: 'SMTP',     style: 'bg-amber-50 text-amber-700 border-amber-200' },
    disabled: { label: 'Disabled', style: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const c = cfg[provider] ?? { label: provider, style: 'bg-gray-100 text-gray-500 border-gray-200' };
  return <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${c.style}`}>{c.label}</span>;
}

// ── Secret field ──────────────────────────────────────────────────────────────

function SecretField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoComplete="new-password"
          className="w-full px-3 py-2 pr-10 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Provider form ─────────────────────────────────────────────────────────────

function SmtpForm({ status, token, onSaved }: {
  status: EmailStatus | null; token: string; onSaved: (s: EmailStatus) => void;
}) {
  const [provider, setProvider] = useState<'disabled' | 'smtp' | 'resend'>((status?.provider as 'disabled' | 'smtp' | 'resend') ?? 'disabled');
  const [smtpHost, setSmtpHost] = useState(status?.smtp_host ?? '');
  const [smtpPort, setSmtpPort] = useState(String(status?.smtp_port ?? 587));
  const [smtpSecure, setSmtpSecure] = useState(status?.smtp_secure ?? false);
  const [smtpFrom, setSmtpFrom] = useState(status?.smtp_from ?? '');
  const [adminEmail, setAdminEmail] = useState(status?.admin_email ?? status?.adminEmail ?? '');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!status) return;
    setProvider((status.provider as 'disabled' | 'smtp' | 'resend') ?? 'disabled');
    setSmtpHost(status.smtp_host ?? '');
    setSmtpPort(String(status.smtp_port ?? 587));
    setSmtpSecure(status.smtp_secure ?? false);
    setSmtpFrom(status.smtp_from ?? '');
    setAdminEmail(status.admin_email ?? status.adminEmail ?? '');
  }, [status]);

  async function handleSave() {
    setSaving(true); setMsg(null);
    const r = await saveProviderSettings(token, {
      email_provider: provider, smtp_host: smtpHost,
      smtp_port: parseInt(smtpPort, 10) || 587, smtp_secure: smtpSecure,
      smtp_from: smtpFrom, admin_email: adminEmail,
      ...(smtpUsername ? { smtp_username: smtpUsername } : {}),
      ...(smtpPassword ? { smtp_password: smtpPassword } : {}),
    });
    setSaving(false);
    if (r.ok && r.data) { setSmtpUsername(''); setSmtpPassword(''); onSaved(r.data as EmailStatus); setMsg({ type: 'ok', text: 'Settings saved.' }); }
    else setMsg({ type: 'err', text: r.error ?? 'Save failed.' });
    setTimeout(() => setMsg(null), 5000);
  }

  async function handleClear() {
    setClearing(true); setMsg(null);
    const r = await saveProviderSettings(token, {
      email_provider: provider, smtp_host: smtpHost,
      smtp_port: parseInt(smtpPort, 10) || 587, smtp_secure: smtpSecure,
      smtp_from: smtpFrom, admin_email: adminEmail, clear_credentials: true,
    });
    setClearing(false);
    if (r.ok && r.data) { onSaved(r.data as EmailStatus); setMsg({ type: 'ok', text: 'Credentials cleared.' }); }
    else setMsg({ type: 'err', text: r.error ?? 'Clear failed.' });
    setTimeout(() => setMsg(null), 5000);
  }

  const portNum = parseInt(smtpPort, 10);
  const portHint = portNum === 465 ? 'Port 465 — Secure: On (SSL)' : portNum === 587 ? 'Port 587 — Secure: Off (STARTTLS, recommended)' : '';

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Email Provider</label>
        <div className="flex gap-2 flex-wrap">
          {(['disabled', 'smtp', 'resend'] as const).map(p => (
            <button key={p} onClick={() => setProvider(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${provider === p ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {p === 'disabled' ? 'Disabled' : p === 'smtp' ? 'SMTP' : 'Resend'}
            </button>
          ))}
        </div>
      </div>

      {provider === 'smtp' && (
        <>
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5">
            SMTP sends emails through your own provider — Google Workspace, Zoho, cPanel, GoDaddy, or any SMTP host.
            Use port 587 with Secure off for most providers. Credentials are stored securely and never shown again.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">SMTP Host</label>
              <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                placeholder="smtp.yourdomain.com"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">SMTP Port</label>
              <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} min={1} max={65535}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              {portHint && <p className="text-xs text-gray-400 mt-1">{portHint}</p>}
            </div>
            <div className="flex items-center gap-3 pt-6">
              <button type="button" onClick={() => setSmtpSecure(s => !s)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${smtpSecure ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${smtpSecure ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-700">Secure (SSL/TLS)</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">From Email</label>
              <input type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)}
                placeholder="bookings@yourdomain.com"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Email <span className="text-red-500">*</span></label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Booking notifications will be sent here.</p>
            </div>
          </div>
          <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">SMTP Credentials</p>
                <p className="text-xs text-gray-400 mt-0.5">Stored in vault. Leave blank to keep existing.</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className={status?.smtp_username_configured ? 'text-green-600' : 'text-gray-400'}>
                  User: {status?.smtp_username_configured ? (status.smtp_username_preview ?? 'configured') : 'not set'}
                </span>
                <span className={status?.smtp_password_configured ? 'text-green-600' : 'text-gray-400'}>
                  Pass: {status?.smtp_password_configured ? 'configured' : 'not set'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SecretField label="SMTP Username" value={smtpUsername} onChange={setSmtpUsername}
                placeholder={status?.smtp_username_configured ? '(keep existing)' : 'user@yourdomain.com'} />
              <SecretField label="SMTP Password" value={smtpPassword} onChange={setSmtpPassword}
                placeholder={status?.smtp_password_configured ? '(keep existing)' : 'App password'} />
            </div>
            {(status?.smtp_username_configured || status?.smtp_password_configured) && (
              <button onClick={handleClear} disabled={clearing}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors">
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Clear saved credentials
              </button>
            )}
          </div>
        </>
      )}

      {provider === 'resend' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5">
            Set <code className="bg-gray-100 px-1 rounded font-mono">RESEND_API_KEY</code> and{' '}
            <code className="bg-gray-100 px-1 rounded font-mono">FROM_EMAIL</code> as Supabase Edge Function secrets.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Email</label>
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
              placeholder="you@yourdomain.com"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}

      {provider === 'disabled' && (
        <p className="text-xs text-gray-500">No emails will be sent while provider is set to Disabled.</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        {msg && <span className={`text-sm ${msg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

// ── Template editor ───────────────────────────────────────────────────────────

function TemplateEditor({ tpl, token, onSaved, onDuplicate, onDelete, previewVars }: {
  tpl: EmailTemplate; token: string;
  onSaved: (updated: EmailTemplate) => void;
  onDuplicate: (tpl: EmailTemplate) => void;
  onDelete: (tpl: EmailTemplate) => void;
  previewVars: Record<string, string>;
}) {
  const [subject, setSubject] = useState(tpl.subject);
  const [html, setHtml] = useState(tpl.html_body);
  const [isActive, setIsActive] = useState(tpl.is_active);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [varsOpen, setVarsOpen] = useState(false);

  async function handleSave() {
    setSaving(true); setMsg(null);
    const { error } = await supabase.from('email_templates').update({
      subject, html_body: html, is_active: isActive,
    }).eq('id', tpl.id);
    setSaving(false);
    if (error) { setMsg({ type: 'err', text: error.message }); return; }
    setMsg({ type: 'ok', text: 'Template saved.' });
    onSaved({ ...tpl, subject, html_body: html, is_active: isActive });
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleTest() {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notifications?action=test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: tpl.template_key }),
      });
      const data = await res.json();
      if (data.sent) setMsg({ type: 'ok', text: 'Test email sent.' });
      else setMsg({ type: 'err', text: data.reason ?? data.error ?? 'Not sent — check provider.' });
    } catch { setMsg({ type: 'err', text: 'Request failed.' }); }
    setTesting(false);
    setTimeout(() => setMsg(null), 5000);
  }

  function handleReset() {
    const def = TEMPLATE_DEFAULTS[tpl.template_key];
    if (!def) return;
    setSubject(def.subject);
    setHtml(def.html_body);
    setMsg({ type: 'ok', text: 'Reset to default — save to apply.' });
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {(['edit', 'preview'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize rounded-t transition-colors border-b-2 -mb-px ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'edit' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">HTML Body</label>
            <textarea value={html} onChange={e => setHtml(e.target.value)} rows={12}
              className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsActive(a => !a)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700">Active</span>
            {!isActive && <span className="text-xs text-amber-600 ml-1">(inactive — will use built-in fallback)</span>}
          </div>

          {/* Variable reference */}
          <div className="border rounded-xl overflow-hidden">
            <button onClick={() => setVarsOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <span>Available variables</span>
              {varsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {varsOpen && (
              <div className="px-3 pb-3 pt-2 border-t bg-gray-50 space-y-3">
                {EMAIL_TEMPLATE_VARIABLES.map(({ group, vars }) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {vars.map(([key, desc]) => (
                        <div key={key} className="flex items-center gap-2">
                          <code className="text-xs bg-white border px-1.5 py-0.5 rounded font-mono text-blue-700 whitespace-nowrap">{`{{${key}}}`}</code>
                          <span className="text-xs text-gray-500">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="px-3 py-2 border-b bg-gray-50">
            <p className="text-xs text-gray-500">
              Subject: <span className="font-medium text-gray-700">{renderPreview(subject, previewVars)}</span>
            </p>
          </div>
          <div
            className="p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: renderPreview(html, previewVars) }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button onClick={handleTest} disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Test Send
        </button>
        <button onClick={() => onDuplicate(tpl)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors">
          <Copy className="w-3.5 h-3.5" />
          Duplicate
        </button>
        {TEMPLATE_DEFAULTS[tpl.template_key] && (
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border rounded-lg hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>
        )}
        {!tpl.is_system && (
          <button onClick={() => onDelete(tpl)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
        {msg && (
          <span className={`text-xs ${msg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

// ── Templates section ─────────────────────────────────────────────────────────

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

interface CreateTemplateFormProps {
  propertyId: string;
  existingKeys: Set<string>;
  onCreated: (tpl: EmailTemplate) => void;
  onCancel: () => void;
  previewVars: Record<string, string>;
}

function CreateTemplateForm({ propertyId, existingKeys, onCreated, onCancel, previewVars }: CreateTemplateFormProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [varsOpen, setVarsOpen] = useState(false);

  const derivedKey = keyTouched ? key : slugify(name);
  const keyError = derivedKey
    ? !/^[a-z0-9_]+$/.test(derivedKey)
      ? 'Only lowercase letters, numbers, and underscores.'
      : existingKeys.has(derivedKey)
        ? 'This key already exists. Choose a different one.'
        : ''
    : '';

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!derivedKey) { setError('Template key is required.'); return; }
    if (keyError) { setError(keyError); return; }
    setSaving(true); setError('');
    const { data, error: err } = await supabase.from('email_templates')
      .insert({
        property_id: propertyId,
        template_key: derivedKey,
        name: name.trim(),
        subject: subject.trim(),
        html_body: html,
        is_active: isActive,
        is_system: false,
      })
      .select('*').single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated(data as EmailTemplate);
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">New Template</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        {/* Edit / Preview tabs */}
        <div className="flex gap-1 border-b border-gray-200 pb-0">
          {(['edit', 'preview'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium capitalize rounded-t transition-colors border-b-2 -mb-px ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'edit' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Template Name <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Welcome Message" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Template Key <span className="text-red-500">*</span></label>
                <input type="text" value={keyTouched ? key : derivedKey}
                  onChange={e => { setKeyTouched(true); setKey(e.target.value); }}
                  placeholder="welcome_message" className={`${inputCls} font-mono`} />
                {keyError && <p className="text-xs text-red-600 mt-1">{keyError}</p>}
                {!keyError && derivedKey && <p className="text-xs text-gray-400 mt-1 font-mono">{`{{${derivedKey}}}`} — used by automations</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Your booking at {{listing_name}}"
                  className={`${inputCls} font-mono`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>HTML Body</label>
                <textarea value={html} onChange={e => setHtml(e.target.value)} rows={10}
                  placeholder="<p>Hi {{guest_name}}, ...</p>"
                  className={`${inputCls} text-xs font-mono resize-y`} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <button type="button" onClick={() => setIsActive(a => !a)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-700">Active</span>
              </div>
            </div>

            {/* Variable reference */}
            <div className="border rounded-xl overflow-hidden">
              <button onClick={() => setVarsOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <span>Available variables</span>
                {varsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {varsOpen && (
                <div className="px-3 pb-3 pt-2 border-t bg-gray-50 space-y-3">
                  {EMAIL_TEMPLATE_VARIABLES.map(({ group, vars }) => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {vars.map(([vkey, desc]) => (
                          <div key={vkey} className="flex items-center gap-2">
                            <code className="text-xs bg-white border px-1.5 py-0.5 rounded font-mono text-blue-700 whitespace-nowrap">{`{{${vkey}}}`}</code>
                            <span className="text-xs text-gray-500">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="px-3 py-2 border-b bg-gray-50">
              <p className="text-xs text-gray-500">
                Subject: <span className="font-medium text-gray-700">{renderPreview(subject, previewVars)}</span>
              </p>
            </div>
            <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: renderPreview(html, previewVars) }} />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving || !!keyError}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create Template
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesSection({ token }: { token: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>(buildPreviewVars({}));
  const PROPERTY_ID_LOCAL = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('email_templates').select('*').order('name');
    setTemplates((data ?? []) as EmailTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase
      .from('account_settings')
      .select('listing_name,listing_address,listing_city,listing_state,listing_zip,listing_country,check_in_time,check_out_time,suggested_door_code,listing_manager_name,listing_manager_role,manager_email,manager_phone,primary_guest_contact_name,primary_guest_contact_email,primary_guest_contact_phone,owner_name,owner_email,owner_phone,business_name,business_address,support_email')
      .eq('property_id', PROPERTY_ID_LOCAL)
      .maybeSingle()
      .then(({ data }) => {
        setPreviewVars(buildPreviewVars((data as AccountVars) ?? {}));
      });
  }, []);

  function handleSaved(updated: EmailTemplate) {
    setTemplates(ts => ts.map(t => t.id === updated.id ? updated : t));
  }

  function handleCreated(tpl: EmailTemplate) {
    setTemplates(ts => [...ts, tpl].sort((a, b) => a.name.localeCompare(b.name)));
    setCreating(false);
    setExpandedId(tpl.id);
  }

  async function handleDuplicate(tpl: EmailTemplate) {
    const baseKey = tpl.template_key + '_copy';
    const existingKeys = new Set(templates.map(t => t.template_key));
    let newKey = baseKey;
    let n = 2;
    while (existingKeys.has(newKey)) { newKey = `${baseKey}_${n++}`; }
    const { data, error } = await supabase.from('email_templates')
      .insert({
        property_id: PROPERTY_ID_LOCAL,
        template_key: newKey,
        name: tpl.name + ' (Copy)',
        subject: tpl.subject,
        html_body: tpl.html_body,
        text_body: tpl.text_body,
        is_active: false,
        is_system: false,
      })
      .select('*').single();
    if (error) return;
    const created = data as EmailTemplate;
    setTemplates(ts => [...ts, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpandedId(created.id);
  }

  async function handleDeleteRequest(tpl: EmailTemplate) {
    setDeleteMsg('');
    // Check if any automation uses this template
    const { data: autos } = await supabase
      .from('email_automations')
      .select('id')
      .eq('template_key', tpl.template_key)
      .limit(1);
    if (autos && autos.length > 0) {
      setDeleteMsg('This template is used by an automation. Deactivate or change the automation first.');
      setDeleteTarget(tpl);
      return;
    }
    setDeleteTarget(tpl);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('email_templates').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { setDeleteMsg(error.message); return; }
    setTemplates(ts => ts.filter(t => t.id !== deleteTarget.id));
    if (expandedId === deleteTarget.id) setExpandedId(null);
    setDeleteTarget(null);
    setDeleteMsg('');
  }

  const existingKeys = new Set(templates.map(t => t.template_key));

  if (loading) return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500">
          Customize the email copy sent to guests and admins. Use{' '}
          <code className="bg-gray-100 px-1 rounded font-mono text-xs">{'{{variable}}'}</code>{' '}
          placeholders — values are filled in automatically when emails are sent.
        </p>
        {!creating && (
          <button onClick={() => { setCreating(true); setExpandedId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
            Create Template
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <CreateTemplateForm
          propertyId={PROPERTY_ID_LOCAL}
          existingKeys={existingKeys}
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
          previewVars={previewVars}
        />
      )}

      {/* Template list */}
      {templates.length === 0 && !creating ? (
        <div className="text-center py-10 text-sm text-gray-400">
          No templates found. Check that the database migration ran successfully.
        </div>
      ) : (
        <div className="space-y-1">
          {templates.map(tpl => {
            const isOpen = expandedId === tpl.id;
            return (
              <div key={tpl.id} className="border rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setExpandedId(isOpen ? null : tpl.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{tpl.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tpl.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {tpl.is_system
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-100">System</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-100">Custom</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-lg">{tpl.subject}</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-3" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-3" />}
                </button>
                {isOpen && (
                  <TemplateEditor
                    tpl={tpl}
                    token={token}
                    onSaved={handleSaved}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDeleteRequest}
                    previewVars={previewVars}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Custom Template</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
                </p>
                {deleteMsg && <p className="text-sm text-red-600 mt-2">{deleteMsg}</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDeleteTarget(null); setDeleteMsg(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              {!deleteMsg && (
                <button onClick={confirmDelete} disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Test email button ─────────────────────────────────────────────────────────

function TestEmailButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function sendTest() {
    setState('sending'); setMessage('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notifications?action=test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: 'test_email' }),
      });
      const data = await res.json();
      if (data.sent) {
        setState('sent'); setMessage('Test email sent.');
      } else {
        const base = data.reason ?? data.error ?? 'Not sent — check provider.';
        const cfg = data._config;
        const hint = cfg
          ? ` (provider=${cfg.provider}, host=${cfg.smtpHostExists}, user=${cfg.smtpUsernameExists}, pass=${cfg.smtpPasswordExists})`
          : '';
        setState('error'); setMessage(base + hint);
      }
    } catch (err) {
      setState('error'); setMessage(err instanceof Error ? err.message : 'Unexpected error');
    }
    setTimeout(() => setState('idle'), 8000);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={sendTest} disabled={state === 'sending'}
        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send Test Email
      </button>
      {message && <span className={`text-sm ${state === 'sent' ? 'text-green-700' : 'text-red-600'}`}>{message}</span>}
    </div>
  );
}

// ── Notification logs ─────────────────────────────────────────────────────────

function NotificationLogs() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'sent' | 'skipped' | 'failed'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('notification_logs')
      .select('id,related_type,related_id,channel,provider,recipient,subject,status,template_key,error_message,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (filter !== 'all') query.eq('status', filter);
    const { data, error: err } = await query;
    if (err) setError('Could not load notification logs.');
    setLogs((data ?? []) as NotificationLog[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filters: Array<'all' | 'sent' | 'skipped' | 'failed'> = ['all', 'sent', 'skipped', 'failed'];

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-3">
        <h3 className="font-semibold text-gray-900">Recent Notification Logs</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 py-4"><AlertCircle className="w-4 h-4" />{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No notification logs yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 pr-3 font-medium">Time</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-left py-2 pr-3 font-medium">Template</th>
                  <th className="text-left py-2 pr-3 font-medium">Recipient</th>
                  <th className="text-left py-2 font-medium">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const s = STATUS_STYLES[log.status] ?? STATUS_STYLES.skipped;
                  const StatusIcon = s.icon;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 pr-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${s.iconClass}`} />
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{log.status}</span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={log.error_message}>{log.error_message}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {log.template_key
                          ? <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{log.template_key}</code>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-gray-600 max-w-[140px] truncate" title={log.recipient}>{log.recipient}</td>
                      <td className="py-2.5 text-xs text-gray-700 max-w-[200px] truncate" title={log.subject}>{log.subject}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Automations ───────────────────────────────────────────────────────────────

const SUPABASE_FUNC_URL = SUPABASE_URL;

const TRIGGER_LABELS: Record<string, string> = {
  booking_request_received: 'Booking Request Submitted',
  booking_request_approved: 'Booking Request Approved',
  booking_request_declined: 'Booking Request Declined',
  booking_confirmed:        'Booking Confirmed / Paid',
  booking_cancelled:        'Booking Cancelled',
  inquiry_received:         'Inquiry Submitted',
  before_check_in:          'Before Check-In',
  day_of_check_in:          'Day of Check-In',
  after_check_in:           'After Check-In',
  before_check_out:         'Before Check-Out',
  day_of_check_out:         'Day of Check-Out',
  after_check_out:          'After Check-Out',
};

const RECIPIENT_LABELS: Record<string, string> = {
  guest: 'Guest only',
  admin: 'Owner/Admin only',
  both:  'Guest + Owner/Admin',
};

interface Automation {
  id: string;
  property_id: string;
  name: string;
  template_id: string | null;
  template_key: string | null;
  recipient_type: string;
  trigger_type: string;
  offset_days: number;
  send_time: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

const EMPTY_AUTO: Omit<Automation, 'id' | 'property_id' | 'created_at'> = {
  name: '',
  template_id: null,
  template_key: null,
  recipient_type: 'guest',
  trigger_type: 'before_check_in',
  offset_days: 1,
  send_time: '09:00',
  is_active: false,
  notes: null,
};

const IMMEDIATE_TRIGGERS = [
  'booking_request_received',
  'booking_request_approved',
  'booking_request_declined',
  'booking_confirmed',
  'booking_cancelled',
  'inquiry_received',
];

function triggerDescription(a: Automation): string {
  const base = TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type;
  if (IMMEDIATE_TRIGGERS.includes(a.trigger_type)) return base + ' (immediately)';
  if (a.trigger_type === 'day_of_check_in' || a.trigger_type === 'day_of_check_out') {
    return base + (a.send_time ? ` at ${a.send_time}` : '');
  }
  const days = a.offset_days === 1 ? '1 day' : `${a.offset_days} days`;
  return `${days} ${a.trigger_type.startsWith('before') ? 'before' : 'after'} ` +
    (a.trigger_type.includes('check_in') ? 'check-in' : 'check-out') +
    (a.send_time ? ` at ${a.send_time}` : '');
}

interface AutoFormProps {
  initial: Omit<Automation, 'id' | 'property_id' | 'created_at'> | Automation;
  templates: { id: string; template_key: string; name: string }[];
  onSave: (data: Omit<Automation, 'id' | 'property_id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AutoForm({ initial, templates, onSave, onCancel, saving }: AutoFormProps) {
  const [form, setForm] = useState({ ...initial });
  const [varsOpen, setVarsOpen] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const showOffset = !IMMEDIATE_TRIGGERS.includes(form.trigger_type) && !['day_of_check_in', 'day_of_check_out'].includes(form.trigger_type);
  const showTime = !IMMEDIATE_TRIGGERS.includes(form.trigger_type);

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Automation Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Pre-Arrival Instructions" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Trigger</label>
          <div className="relative">
            <select value={form.trigger_type} onChange={e => set('trigger_type', e.target.value)} className={inputCls + ' appearance-none pr-8'}>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Recipient</label>
          <div className="relative">
            <select value={form.recipient_type} onChange={e => set('recipient_type', e.target.value)} className={inputCls + ' appearance-none pr-8'}>
              {Object.entries(RECIPIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {showOffset && (
          <div>
            <label className={labelCls}>Offset Days</label>
            <input type="number" min={0} max={30} value={form.offset_days}
              onChange={e => set('offset_days', parseInt(e.target.value) || 0)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">0 = same day</p>
          </div>
        )}
        {showTime && (
          <div>
            <label className={labelCls}>Send Time (24h)</label>
            <input type="time" value={form.send_time ?? ''} onChange={e => set('send_time', e.target.value || null)} className={inputCls} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelCls}>Template</label>
          <div className="relative">
            <select
              value={form.template_key ?? ''}
              onChange={e => set('template_key', e.target.value || null)}
              className={inputCls + ' appearance-none pr-8'}
            >
              <option value="">— Select a template —</option>
              {templates.map(t => <option key={t.id} value={t.template_key}>{t.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Templates are edited in the Templates tab.</p>
          <div className="border rounded-xl overflow-hidden mt-3">
            <button onClick={() => setVarsOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <span>Available template variables</span>
              {varsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {varsOpen && (
              <div className="px-3 pb-3 pt-2 border-t bg-gray-50 space-y-3">
                {EMAIL_TEMPLATE_VARIABLES.map(({ group, vars }) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {vars.map(([key, desc]) => (
                        <div key={key} className="flex items-center gap-2">
                          <code className="text-xs bg-white border px-1.5 py-0.5 rounded font-mono text-blue-700 whitespace-nowrap">{`{{${key}}}`}</code>
                          <span className="text-xs text-gray-500">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes (optional)</label>
          <input type="text" value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)}
            placeholder="Internal reminder about this automation" className={inputCls} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="button" onClick={() => set('is_active', !form.is_active)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <span className="text-sm text-gray-700">Active</span>
          {!form.is_active && <span className="text-xs text-amber-600">(inactive — will not run)</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function AutomationsSection({ token }: { token: string }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<{ id: string; template_key: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function flash(f: { type: 'ok' | 'err'; text: string }) {
    setMsg(f);
    setTimeout(() => setMsg(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [autoRes, tplRes] = await Promise.all([
      supabase.from('email_automations').select('*').eq('property_id', PROPERTY_ID).order('created_at'),
      supabase.from('email_templates').select('id,template_key,name').eq('property_id', PROPERTY_ID).order('name'),
    ]);
    setAutomations((autoRes.data ?? []) as Automation[]);
    setTemplates((tplRes.data ?? []) as { id: string; template_key: string; name: string }[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Omit<Automation, 'id' | 'property_id' | 'created_at'>) {
    setSaving(true);
    const { data: row, error } = await supabase.from('email_automations')
      .insert({ ...data, property_id: PROPERTY_ID })
      .select('*').single();
    setSaving(false);
    if (error) { flash({ type: 'err', text: 'Failed to create automation.' }); return; }
    setAutomations(prev => [...prev, row as Automation]);
    setCreating(false);
    flash({ type: 'ok', text: 'Automation created.' });
  }

  async function handleEdit(id: string, data: Omit<Automation, 'id' | 'property_id' | 'created_at'>) {
    setSaving(true);
    const { error } = await supabase.from('email_automations')
      .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    if (error) { flash({ type: 'err', text: 'Failed to save automation.' }); return; }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    setEditingId(null);
    flash({ type: 'ok', text: 'Automation saved.' });
  }

  async function toggleActive(a: Automation) {
    const next = !a.is_active;
    const { error } = await supabase.from('email_automations')
      .update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', a.id);
    if (!error) setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, is_active: next } : x));
  }

  async function doDelete(id: string) {
    setDeleting(true);
    const { error } = await supabase.from('email_automations').delete().eq('id', id);
    setDeleting(false);
    setDeleteConfirm(null);
    if (error) { flash({ type: 'err', text: 'Delete failed.' }); return; }
    setAutomations(prev => prev.filter(a => a.id !== id));
    flash({ type: 'ok', text: 'Automation deleted.' });
  }

  async function sendTest(a: Automation) {
    setTesting(a.id);
    try {
      const res = await fetch(`${SUPABASE_FUNC_URL}/functions/v1/send-automated-emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, automation_id: a.id }),
      });
      const data = await res.json();
      if (data.ok) flash({ type: 'ok', text: `Test run: ${data.sent} sent, ${data.skipped} skipped. (sent to admin only)` });
      else flash({ type: 'err', text: data.error ?? 'Test failed.' });
    } catch { flash({ type: 'err', text: 'Request failed.' }); }
    setTesting(null);
  }

  if (loading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  const activeCount = automations.filter(a => a.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-500">
            Automations define <em>when</em> emails send. Templates define <em>what</em> they say.
            Active automations run every 15 minutes. Inactive automations are skipped.
          </p>
          {activeCount > 0 && (
            <p className="text-xs text-green-700 mt-1 font-medium">{activeCount} active automation{activeCount !== 1 ? 's' : ''} running.</p>
          )}
        </div>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          New Automation
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {creating && (
        <div className="border-2 border-gray-900 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">New Automation</h4>
            <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <AutoForm
            initial={EMPTY_AUTO}
            templates={templates}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={saving}
          />
        </div>
      )}

      {automations.length === 0 && !creating ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500 mb-1">No automations yet</p>
          <p className="text-xs text-gray-400">Create automations to send emails automatically based on booking events.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map(a => {
            const isEditing = editingId === a.id;
            const templateName = templates.find(t => t.template_key === a.template_key || t.id === a.template_id)?.name ?? a.template_key ?? '—';

            return (
              <div key={a.id} className={`border rounded-xl bg-white overflow-hidden ${a.is_active ? 'border-green-200' : 'border-gray-200'}`}>
                {isEditing ? (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900">Edit Automation</h4>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
                    </div>
                    <AutoForm
                      initial={a}
                      templates={templates}
                      onSave={data => handleEdit(a.id, data)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{triggerDescription(a)} · {RECIPIENT_LABELS[a.recipient_type] ?? a.recipient_type}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Template: <span className="text-gray-600">{templateName}</span></p>
                        {a.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{a.notes}</p>}
                      </div>
                      <button
                        onClick={() => toggleActive(a)}
                        className="flex-shrink-0 mt-0.5"
                        title={a.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {a.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-600 hover:text-green-700" />
                          : <ToggleLeft className="w-6 h-6 text-gray-400 hover:text-gray-600" />}
                      </button>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => { setEditingId(a.id); setCreating(false); }}
                        className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => sendTest(a)}
                        disabled={testing === a.id}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {testing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Test
                      </button>
                      {deleteConfirm === a.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-600">Delete?</span>
                          <button
                            onClick={() => doDelete(a.id)}
                            disabled={deleting}
                            className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(a.id)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Inquiries ─────────────────────────────────────────────────────────────────

interface InquiryRow {
  id: string;
  property_id: string | null;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  status: string;
  created_at: string;
}

const INQUIRY_STATUS_STYLES: Record<string, string> = {
  new:       'bg-blue-100 text-blue-700',
  read:      'bg-gray-100 text-gray-600',
  responded: 'bg-green-100 text-green-700',
  archived:  'bg-gray-100 text-gray-400',
};

function InquiriesSection() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<InquiryRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('inquiries')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError('Could not load inquiries.');
    setInquiries((data ?? []) as InquiryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    const { error: err } = await supabase.from('inquiries').update({ status: 'read' }).eq('id', id);
    if (!err) setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'read' } : i));
  }

  async function copyEmail(email: string, id: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function doDelete(id: string) {
    setDeleting(true);
    const { error: err } = await supabase.from('inquiries').delete().eq('id', id);
    setDeleting(false);
    setDeleteConfirm(null);
    if (err) {
      setMsg({ type: 'err', text: 'Delete failed: ' + err.message });
    } else {
      setInquiries(prev => prev.filter(i => i.id !== id));
      if (detail?.id === id) setDetail(null);
      setMsg({ type: 'ok', text: 'Inquiry deleted.' });
    }
    setTimeout(() => setMsg(null), 4000);
  }

  const btnClass = 'text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors';

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Guest Inquiries</h3>
          <p className="text-xs text-gray-400 mt-0.5">Contact form submissions. Replies happen from your email inbox — inquiry emails use Reply-To: guest email.</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="p-5">
        {msg && (
          <div className={`flex items-center gap-2 text-sm mb-4 p-3 rounded-xl ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 py-4"><AlertCircle className="w-4 h-4" />{error}</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No inquiries yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map(inq => (
              <div key={inq.id} className={`border rounded-xl p-4 transition-colors ${inq.status === 'new' ? 'border-blue-200 bg-blue-50/20' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{inq.sender_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INQUIRY_STATUS_STYLES[inq.status] ?? 'bg-gray-100 text-gray-600'}`}>{inq.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{inq.sender_email}{inq.sender_phone ? ` · ${inq.sender_phone}` : ''}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{fmtDate(inq.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2 mb-3">{inq.message}</p>
                <div className="flex gap-2 flex-wrap items-center">
                  {inq.status === 'new' && (
                    <button onClick={() => markRead(inq.id)} className={btnClass}>Mark read</button>
                  )}
                  <button onClick={() => setDetail(inq)} className={btnClass}>Details</button>
                  <button onClick={() => copyEmail(inq.sender_email, inq.id)} className={btnClass}>
                    {copied === inq.id ? 'Copied!' : 'Copy email'}
                  </button>
                  {deleteConfirm === inq.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button
                        onClick={() => doDelete(inq.id)}
                        disabled={deleting}
                        className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleting ? '...' : 'Yes'}
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className={btnClass}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(inq.id)}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-2xl border shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Inquiry Details</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Name</dt>
                <dd className="text-gray-900">{detail.sender_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Email</dt>
                <dd className="font-mono text-xs text-gray-900">{detail.sender_email}</dd>
              </div>
              {detail.sender_phone && (
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">Phone</dt>
                  <dd className="text-gray-900">{detail.sender_phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Received</dt>
                <dd className="text-gray-900">{fmtDate(detail.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Message</dt>
                <dd className="text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.message}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t">
              <button
                onClick={() => copyEmail(detail.sender_email, detail.id)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {copied === detail.id ? 'Copied!' : 'Copy email'}
              </button>
              <button
                onClick={() => setDetail(null)}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'provider' | 'templates' | 'automations' | 'inquiries' | 'logs';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'provider',    label: 'Provider',    icon: Settings      },
  { id: 'templates',  label: 'Templates',   icon: FileText      },
  { id: 'automations',label: 'Automations', icon: Zap           },
  { id: 'inquiries',  label: 'Inquiries',   icon: MessageSquare },
  { id: 'logs',       label: 'Logs',        icon: List          },
];

export default function EmailSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['provider', 'templates', 'automations', 'inquiries', 'logs'];
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    validTabs.includes(tabFromUrl as Tab) ? (tabFromUrl as Tab) : 'provider'
  );
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [token, setToken] = useState('');

  function handleTabChange(t: Tab) {
    setActiveTab(t);
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', t); return n; }, { replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? '';
      setToken(t);
      if (t) fetchStatus(t).then(s => { setStatus(s); setStatusLoading(false); });
      else setStatusLoading(false);
    });
  }, []);

  const provider = status?.provider ?? 'disabled';
  const isConfigured = status?.configured && provider !== 'disabled';
  const missingFields = status?.missing_fields ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Email Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure transactional email and customize notification templates.</p>
      </div>

      {/* Status bar */}
      {!statusLoading && (
        <div className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-4 flex-wrap ${
          provider === 'disabled' ? 'border-gray-200' : isConfigured ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'
        }`}>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <ProviderBadge provider={provider} />
              {provider === 'disabled' ? (
                <span className="text-sm text-gray-500">Email sending is disabled</span>
              ) : isConfigured ? (
                <span className="flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Configured</span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> Missing: {missingFields.join(', ')}</span>
              )}
              {status?.config_warning && (
                <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" />{status.config_warning}</span>
              )}
            </div>
          </div>
          {status?.admin_email && (
            <p className="text-xs text-gray-500">Admin: <span className="font-medium text-gray-700">{status.admin_email}</span></p>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Provider tab */}
      {activeTab === 'provider' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Provider Configuration</h3>
            {!statusLoading && <SmtpForm status={status} token={token} onSaved={s => setStatus(s)} />}
          </div>
          {!statusLoading && provider !== 'disabled' && (
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Send Test Email</h3>
              <p className="text-xs text-gray-500 mb-4">Sends to the configured admin address only.</p>
              <TestEmailButton token={token} />
            </div>
          )}
        </div>
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Email Templates</h3>
          <TemplatesSection token={token} />
        </div>
      )}

      {/* Automations tab */}
      {activeTab === 'automations' && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Email Automations</h3>
          <p className="text-xs text-gray-400 mb-5">
            Set up time-based emails that send automatically for confirmed bookings.
          </p>
          <AutomationsSection token={token} />
        </div>
      )}

      {/* Inquiries tab */}
      {activeTab === 'inquiries' && <InquiriesSection />}

      {/* Logs tab */}
      {activeTab === 'logs' && <NotificationLogs />}
    </div>
  );
}
