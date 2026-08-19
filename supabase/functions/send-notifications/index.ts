import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Module-level client — one per isolate, safe for stateless edge functions
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Twilio (SMS) — env-only, unchanged
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "";

// Single-property app — this ID is shared across all edge functions and migrations
const PROPERTY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ── Email provider config ─────────────────────────────────────────────────────

interface EmailConfig {
  propertyId: string;
  propertyTitle: string;
  provider: string;
  fromEmail: string;
  adminEmail: string;
  resendApiKey: string;
  smtpHostname: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpFrom: string;
  // Diagnostic fields (never contain secrets)
  _emailSettingsFound: boolean;
  _emailProviderFromDb: string | null;
}

async function loadEmailConfig(): Promise<EmailConfig> {
  // Title is purely cosmetic — look it up softly, never abort on failure
  let propertyTitle = "Tiki Cottage";
  try {
    const { data } = await supabase
      .from("properties").select("title,name").eq("id", PROPERTY_ID).limit(1);
    const row = (data as { title?: string; name?: string }[] | null)?.[0];
    if (row) propertyTitle = row.title ?? row.name ?? "Tiki Cottage";
  } catch { /* best-effort */ }

  const envProvider = (Deno.env.get("EMAIL_PROVIDER") ?? "disabled").toLowerCase().trim();

  let s: {
    email_provider: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_from: string;
    admin_email: string;
  } | null = null;

  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("email_provider,smtp_host,smtp_port,smtp_secure,smtp_from,admin_email")
      .eq("property_id", PROPERTY_ID)
      .limit(1);
    if (error) {
      console.warn("[email] email_settings query error:", error.message, "code:", error.code);
    }
    s = (data as typeof s[] | null)?.[0] ?? null;
    console.log("[email] email_settings found:", !!s, s ? `provider=${s.email_provider} host=${s.smtp_host}` : "(none)");
  } catch (e) {
    console.warn("[email] email_settings query threw:", e instanceof Error ? e.message : String(e));
  }

  if (!s) {
    console.warn("[email] No email_settings row found for PROPERTY_ID:", PROPERTY_ID, "— using env fallback, provider:", envProvider);
    return {
      propertyId: PROPERTY_ID,
      propertyTitle,
      provider: envProvider,
      fromEmail: Deno.env.get("FROM_EMAIL") ?? "",
      adminEmail: Deno.env.get("ADMIN_EMAIL") ?? "",
      resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
      smtpHostname: Deno.env.get("SMTP_HOSTNAME") ?? "",
      smtpPort: parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10),
      smtpSecure: Deno.env.get("SMTP_SECURE") === "true",
      smtpUsername: Deno.env.get("SMTP_USERNAME") ?? "",
      smtpPassword: Deno.env.get("SMTP_PASSWORD") ?? "",
      smtpFrom: Deno.env.get("SMTP_FROM") ?? "",
      _emailSettingsFound: false,
      _emailProviderFromDb: null,
    };
  }

  // Vault reads are isolated — failure must NOT change provider to "disabled"
  const uKey = `email_smtp_username_${PROPERTY_ID}`;
  const pKey = `email_smtp_password_${PROPERTY_ID}`;
  let vaultUsername: string | null = null;
  let vaultPassword: string | null = null;

  try {
    const { data, error } = await supabase.rpc("email_settings_get_secret", { p_name: uKey });
    if (error) console.warn("[email] vault username rpc error:", error.message);
    vaultUsername = data ?? null;
  } catch (e) {
    console.warn("[email] vault username read threw:", e instanceof Error ? e.message : String(e));
  }
  try {
    const { data, error } = await supabase.rpc("email_settings_get_secret", { p_name: pKey });
    if (error) console.warn("[email] vault password rpc error:", error.message);
    vaultPassword = data ?? null;
  } catch (e) {
    console.warn("[email] vault password read threw:", e instanceof Error ? e.message : String(e));
  }

  const provider = (s.email_provider || envProvider || "disabled").toLowerCase().trim();
  console.log("[email] resolved provider:", provider, "username:", !!vaultUsername, "password:", !!vaultPassword);

  return {
    propertyId: PROPERTY_ID,
    propertyTitle,
    provider,
    fromEmail: s.smtp_from || Deno.env.get("FROM_EMAIL") || "",
    adminEmail: s.admin_email || Deno.env.get("ADMIN_EMAIL") || "",
    resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
    smtpHostname: s.smtp_host || Deno.env.get("SMTP_HOSTNAME") || "",
    smtpPort: s.smtp_port ?? parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10),
    smtpSecure: s.smtp_secure ?? (Deno.env.get("SMTP_SECURE") === "true"),
    smtpUsername: vaultUsername || Deno.env.get("SMTP_USERNAME") || "",
    smtpPassword: vaultPassword || Deno.env.get("SMTP_PASSWORD") || "",
    smtpFrom: s.smtp_from || Deno.env.get("SMTP_FROM") || "",
    _emailSettingsFound: true,
    _emailProviderFromDb: s.email_provider,
  };
}

// ── Template rendering ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// These vars contain pre-built HTML and must not be escaped.
const RAW_HTML_VARS = new Set(["payment_button"]);

function renderHtml(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) =>
    key in vars
      ? RAW_HTML_VARS.has(key) ? vars[key] : escapeHtml(vars[key])
      : `{{${key}}}`
  );
}

function renderText(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function resolveTemplate(
  propertyId: string,
  templateKey: string,
  vars: Record<string, string>,
  fallback: { subject: string; html: string },
): Promise<{ subject: string; html: string }> {
  if (propertyId) {
    try {
      const { data: tpl, error } = await supabase
        .from("email_templates")
        .select("subject,html_body,is_active")
        .eq("property_id", propertyId)
        .eq("template_key", templateKey)
        .maybeSingle();

      if (error) {
        console.warn(`[templates] DB error for ${templateKey}:`, error.message);
      } else if (tpl && tpl.is_active) {
        return {
          subject: renderText(tpl.subject, vars),
          html: renderHtml(tpl.html_body, vars),
        };
      } else if (tpl && !tpl.is_active) {
        console.warn(`[templates] ${templateKey} is inactive, using fallback`);
      }
    } catch (e) {
      console.warn(`[templates] Failed to load ${templateKey}:`, e);
    }
  }
  return fallback;
}

// ── Template variable builder ─────────────────────────────────────────────────

function buildVars(params: {
  propertyTitle?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCity?: string;
  guestCounty?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  pets?: number;
  totalPrice?: number;
  totalTripPrice?: number;
  averageNightlyPrice?: number;
  cleaningFee?: number;
  confirmationCode?: string;
  paymentStatus?: string;
  bookingStatus?: string;
  specialRequests?: string;
  inquiryMessage?: string;
  senderPhone?: string;
  adminEmail?: string;
  paymentUrl?: string;
  // account / listing settings
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessName?: string;
  businessAddress?: string;
  supportEmail?: string;
  propertyAddress?: string;
  checkInTime?: string;
  checkOutTime?: string;
  suggestedDoorCode?: string;
  listingName?: string;
  listingAddress?: string;
  listingCity?: string;
  listingState?: string;
  listingZip?: string;
  listingCountry?: string;
  listingManagerName?: string;
  listingManagerRole?: string;
  managerEmail?: string;
  managerPhone?: string;
  primaryGuestContactName?: string;
  primaryGuestContactEmail?: string;
  primaryGuestContactPhone?: string;
}): Record<string, string> {
  const total = params.totalTripPrice ?? params.totalPrice;
  return {
    // Property / Listing
    listing_name: params.listingName ?? "",
    listing_address: params.listingAddress ?? "",
    listing_city: params.listingCity ?? "",
    listing_state: params.listingState ?? "",
    listing_zip: params.listingZip ?? "",
    listing_country: params.listingCountry ?? "",
    check_in_time: params.checkInTime ?? "",
    check_out_time: params.checkOutTime ?? "",
    suggested_door_code: params.suggestedDoorCode ?? "",
    // Listing Contact
    listing_manager_name: params.listingManagerName ?? "",
    listing_manager_role: params.listingManagerRole ?? "",
    manager_email: params.managerEmail ?? "",
    manager_phone: params.managerPhone ?? "",
    primary_guest_contact_name: params.primaryGuestContactName ?? "",
    primary_guest_contact_email: params.primaryGuestContactEmail ?? "",
    primary_guest_contact_phone: params.primaryGuestContactPhone ?? "",
    // Guest
    guest_name: params.guestName ?? "",
    guest_email: params.guestEmail ?? "",
    guest_phone: params.guestPhone ?? "",
    guest_city: params.guestCity ?? "",
    guest_county: params.guestCounty ?? "",
    // Booking
    check_in: params.checkIn ? fmtDate(params.checkIn) : "",
    check_out: params.checkOut ? fmtDate(params.checkOut) : "",
    nights: params.nights != null ? String(params.nights) : "",
    guests: params.guests != null ? String(params.guests) : "",
    confirmation_code: params.confirmationCode ?? "",
    average_nightly_price: params.averageNightlyPrice != null ? fmtMoney(params.averageNightlyPrice) : "",
    total_trip_price: total != null ? fmtMoney(total) : "",
    cleaning_fee: params.cleaningFee != null ? fmtMoney(params.cleaningFee) : "",
    payment_status: params.paymentStatus ?? "",
    booking_status: params.bookingStatus ?? "",
    special_requests: params.specialRequests ?? "",
    // Owner / Business
    owner_name: params.ownerName ?? "",
    owner_email: params.ownerEmail ?? "",
    owner_phone: params.ownerPhone ?? "",
    business_name: params.businessName ?? "",
    business_address: params.businessAddress ?? "",
    support_email: params.supportEmail ?? "",
    // Other
    inquiry_message: params.inquiryMessage ?? "",
    current_date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    payment_url: params.paymentUrl ?? "",
    payment_button: params.paymentUrl
      ? `<a href="${params.paymentUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Complete Payment</a>`
      : "",
  };
}

// ── Account settings → buildVars param mapper ─────────────────────────────────

function accountParams(a: AccountSettings) {
  return {
    ownerName: a.owner_name, ownerEmail: a.owner_email, ownerPhone: a.owner_phone,
    businessName: a.business_name, businessAddress: a.business_address,
    supportEmail: a.support_email,
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time, suggestedDoorCode: a.suggested_door_code,
    listingName: a.listing_name, listingAddress: a.listing_address,
    listingCity: a.listing_city, listingState: a.listing_state,
    listingZip: a.listing_zip, listingCountry: a.listing_country,
    listingManagerName: a.listing_manager_name, listingManagerRole: a.listing_manager_role,
    managerEmail: a.manager_email, managerPhone: a.manager_phone,
    primaryGuestContactName: a.primary_guest_contact_name,
    primaryGuestContactEmail: a.primary_guest_contact_email,
    primaryGuestContactPhone: a.primary_guest_contact_phone,
  };
}

// ── Load account settings ─────────────────────────────────────────────────────

interface AccountSettings {
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  business_name?: string;
  business_address?: string;
  support_email?: string;
  property_address?: string;
  check_in_time?: string;
  check_out_time?: string;
  suggested_door_code?: string;
  listing_name?: string;
  listing_address?: string;
  listing_city?: string;
  listing_state?: string;
  listing_zip?: string;
  listing_country?: string;
  listing_manager_name?: string;
  listing_manager_role?: string;
  manager_email?: string;
  manager_phone?: string;
  primary_guest_contact_name?: string;
  primary_guest_contact_email?: string;
  primary_guest_contact_phone?: string;
}

let _accountCache: AccountSettings | null = null;

async function loadAccountSettings(): Promise<AccountSettings> {
  if (_accountCache) return _accountCache;
  try {
    const { data } = await supabase
      .from("account_settings")
      .select("owner_name,owner_email,owner_phone,business_name,business_address,support_email,property_address,check_in_time,check_out_time,suggested_door_code,listing_name,listing_address,listing_city,listing_state,listing_zip,listing_country,listing_manager_name,listing_manager_role,manager_email,manager_phone,primary_guest_contact_name,primary_guest_contact_email,primary_guest_contact_phone")
      .eq("property_id", PROPERTY_ID)
      .maybeSingle();
    _accountCache = (data as AccountSettings) ?? {};
  } catch {
    _accountCache = {};
  }
  return _accountCache!;
}

// ── Load booking confirmation code ────────────────────────────────────────────

async function loadConfirmationCode(bookingId: string | undefined): Promise<string> {
  if (!bookingId) return "";
  try {
    const { data } = await supabase
      .from("bookings")
      .select("confirmation_code,payment_status")
      .eq("id", bookingId)
      .maybeSingle();
    return (data as { confirmation_code?: string } | null)?.confirmation_code ?? bookingId.slice(0, 8).toUpperCase();
  } catch {
    return "";
  }
}

// ── Send result ───────────────────────────────────────────────────────────────

interface SendResult {
  sent: boolean;
  provider: string;
  reason?: string;
  error?: string;
}

// ── Email abstraction ─────────────────────────────────────────────────────────

async function sendEmail(
  cfg: EmailConfig,
  to: string,
  subject: string,
  html: string,
  relatedType = "",
  relatedId: string | null = null,
  templateKey = "",
  replyTo?: string,
): Promise<SendResult> {
  if (!to) {
    return { sent: false, provider: cfg.provider, reason: "No recipient address" };
  }

  async function logResult(status: "sent" | "skipped" | "failed", errorMsg?: string) {
    try {
      const { error } = await supabase.from("notification_logs").insert({
        related_type: relatedType,
        related_id: relatedId ?? null,
        channel: "email",
        provider: cfg.provider,
        recipient: to,
        subject,
        status,
        template_key: templateKey || null,
        error_message: errorMsg ?? null,
      });
      if (error) console.warn("Notification log insert failed:", error.message);
    } catch (e) {
      console.warn("Notification log insert threw:", e instanceof Error ? e.message : String(e));
    }
  }

  if (!cfg.provider || cfg.provider === "disabled") {
    console.log(`[email:disabled] skipping to=${to} subject="${subject}"`);
    await logResult("skipped");
    return { sent: false, provider: "disabled", reason: "Email provider not configured" };
  }

  if (cfg.provider === "resend") {
    if (!cfg.resendApiKey) {
      await logResult("skipped", "RESEND_API_KEY not set");
      return { sent: false, provider: "resend", reason: "RESEND_API_KEY not configured" };
    }
    if (!cfg.fromEmail) {
      await logResult("skipped", "FROM_EMAIL not set");
      return { sent: false, provider: "resend", reason: "FROM_EMAIL not configured" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: cfg.fromEmail, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      if (!res.ok) {
        const text = await res.text();
        await logResult("failed", `HTTP ${res.status}: ${text.slice(0, 200)}`);
        return { sent: false, provider: "resend", error: text };
      }
      await logResult("sent");
      return { sent: true, provider: "resend" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logResult("failed", msg);
      return { sent: false, provider: "resend", error: msg };
    }
  }

  if (cfg.provider === "smtp") {
    const missing = [
      !cfg.smtpHostname && "smtp_host",
      !cfg.smtpUsername && "smtp_username",
      !cfg.smtpPassword && "smtp_password",
    ].filter(Boolean).join(", ");

    if (missing) {
      console.warn(`[email:smtp] Missing config: ${missing}`);
      await logResult("skipped", `Missing SMTP config: ${missing}`);
      return { sent: false, provider: "smtp", reason: `Missing SMTP configuration: ${missing}` };
    }

    const attemptSmtp = async (): Promise<{ ok: boolean; error?: string }> => {
      try {
        const nodemailer = await import("npm:nodemailer@6");
        const transporter = nodemailer.createTransport({
          host: cfg.smtpHostname,
          port: cfg.smtpPort,
          secure: cfg.smtpSecure,
          auth: { user: cfg.smtpUsername, pass: cfg.smtpPassword },
          pool: false,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        await transporter.sendMail({
          from: cfg.smtpFrom || cfg.smtpUsername,
          to,
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    };

    let attempt = await attemptSmtp();
    if (!attempt.ok && attempt.error && /421|too many concurrent/i.test(attempt.error)) {
      console.warn("[email:smtp] 421 concurrent limit hit, retrying in 3s...");
      await new Promise(r => setTimeout(r, 3000));
      attempt = await attemptSmtp();
    }

    if (!attempt.ok) {
      console.error("[email:smtp] send error:", attempt.error);
      await logResult("failed", attempt.error);
      return { sent: false, provider: "smtp", error: attempt.error };
    }
    await logResult("sent");
    return { sent: true, provider: "smtp" };
  }

  console.warn(`[email] Unknown provider="${cfg.provider}", skipping`);
  await logResult("skipped", `Unknown provider: ${cfg.provider}`);
  return { sent: false, provider: cfg.provider, reason: `Unknown provider: ${cfg.provider}` };
}

// ── SMS ───────────────────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !to) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
  });
  if (!res.ok) console.error("Twilio error:", await res.text());
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ── Payload types ─────────────────────────────────────────────────────────────

interface BookingConfirmedPayload {
  type: "booking_confirmed";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pets?: number;
  totalPrice: number;
  propertyName?: string;
}

interface BookingRequestPayload {
  type: "booking_request_received";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pets?: number;
  totalPrice: number;
  propertyName?: string;
  specialRequests?: string;
}

interface BookingCancelledPayload {
  type: "booking_cancelled";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  propertyName?: string;
}

interface BookingDeclinedPayload {
  type: "booking_declined";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  propertyName?: string;
}

interface ContactPayload {
  type: "contact";
  inquiryId?: string;
  propertyId?: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  propertyName?: string;
}

interface BookingRequestApprovedPayload {
  type: "booking_request_approved";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pets?: number;
  totalPrice: number;
  paymentStatus?: string;
  paymentUrl?: string;
  propertyName?: string;
}

interface BookingRequestDeclinedPayload {
  type: "booking_request_declined";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  propertyName?: string;
}


interface LegacyBookingPayload {
  type: "booking";
  bookingId?: string;
  propertyId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalPrice: number;
  propertyName?: string;
}

type Payload =
  | BookingConfirmedPayload
  | BookingRequestPayload
  | BookingRequestApprovedPayload
  | BookingRequestDeclinedPayload
  | BookingCancelledPayload
  | BookingDeclinedPayload
  | ContactPayload
  | LegacyBookingPayload;

// ── Automation gate ───────────────────────────────────────────────────────────

async function isAutomationActive(templateKey: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("email_automations")
      .select("is_active")
      .eq("property_id", PROPERTY_ID)
      .eq("template_key", templateKey)
      .maybeSingle();
    if (data === null) return true; // no row = fail open (allow)
    return data.is_active;
  } catch {
    return true; // fail open on error
  }
}

// ── Notification handlers ─────────────────────────────────────────────────────

async function handleBookingRequest(cfg: EmailConfig, p: BookingRequestPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();
  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    guestPhone: p.guestPhone, checkIn: p.checkIn, checkOut: p.checkOut,
    nights: p.nights, guests: p.guests, pets: p.pets, totalPrice: p.totalPrice,
    specialRequests: p.specialRequests,
    ...accountParams(account),
  });

  const [guestTpl, adminTpl] = await Promise.all([
    resolveTemplate(pid, "booking_request_received_guest", vars, {
      subject: `Booking Request Received – ${property}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Received</h2><p>Hi ${escapeHtml(p.guestName)}, your request for ${escapeHtml(property)} has been received.</p></div>`,
    }),
    resolveTemplate(pid, "booking_request_received_admin", vars, {
      subject: `New Booking Request – ${p.guestName} (${p.checkIn})`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>New Booking Request</h2><p>Guest: ${escapeHtml(p.guestName)} (${escapeHtml(p.guestEmail)})<br>Dates: ${p.checkIn} – ${p.checkOut}</p></div>`,
    }),
  ]);

  const adminSms = `New booking request at ${property}!\nGuest: ${p.guestName}\n${p.checkIn} – ${p.checkOut} (${p.nights} nights)\n${p.guestEmail}`;

  const [guestActive, adminActive] = await Promise.all([
    isAutomationActive("booking_request_received_guest"),
    isAutomationActive("booking_request_received_admin"),
  ]);
  if (guestActive) {
    await sendEmail(cfg, p.guestEmail, guestTpl.subject, guestTpl.html, "booking", relatedId, "booking_request_received_guest");
  }
  if (adminActive && cfg.adminEmail) {
    if (cfg.provider === "smtp") await new Promise(r => setTimeout(r, 600));
    await sendEmail(cfg, cfg.adminEmail, adminTpl.subject, adminTpl.html, "booking", relatedId, "booking_request_received_admin");
  }
  if (ADMIN_PHONE) sendSms(ADMIN_PHONE, adminSms);
}

async function handleBookingConfirmed(cfg: EmailConfig, p: BookingConfirmedPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();
  const confirmationCode = await loadConfirmationCode(p.bookingId);
  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    guestPhone: p.guestPhone, checkIn: p.checkIn, checkOut: p.checkOut,
    nights: p.nights, guests: p.guests, pets: p.pets, totalPrice: p.totalPrice,
    totalTripPrice: p.totalPrice, confirmationCode, paymentStatus: p.paymentStatus,
    ...accountParams(account),
  });

  const [guestTpl, adminTpl] = await Promise.all([
    resolveTemplate(pid, "booking_confirmed_guest", vars, {
      subject: `Your Booking is Confirmed – ${property}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Confirmed!</h2><p>Hi ${escapeHtml(p.guestName)}, your stay at ${escapeHtml(property)} is confirmed.</p></div>`,
    }),
    resolveTemplate(pid, "booking_confirmed_admin", vars, {
      subject: `Booking Confirmed – ${p.guestName} (${p.checkIn})`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Confirmed</h2><p>Guest: ${escapeHtml(p.guestName)} (${escapeHtml(p.guestEmail)})<br>Dates: ${p.checkIn} – ${p.checkOut}</p></div>`,
    }),
  ]);

  const adminSms = `Booking confirmed at ${property}!\nGuest: ${p.guestName}\n${p.checkIn} – ${p.checkOut}\nTotal: ${fmtMoney(p.totalPrice)}`;

  const [guestActive, adminActive] = await Promise.all([
    isAutomationActive("booking_confirmed_guest"),
    isAutomationActive("booking_confirmed_admin"),
  ]);
  if (guestActive) {
    await sendEmail(cfg, p.guestEmail, guestTpl.subject, guestTpl.html, "booking", relatedId, "booking_confirmed_guest");
  }
  if (adminActive && cfg.adminEmail) {
    if (cfg.provider === "smtp") await new Promise(r => setTimeout(r, 600));
    await sendEmail(cfg, cfg.adminEmail, adminTpl.subject, adminTpl.html, "booking", relatedId, "booking_confirmed_admin");
  }
  if (ADMIN_PHONE) sendSms(ADMIN_PHONE, adminSms);
}

async function handleBookingCancelled(cfg: EmailConfig, p: BookingCancelledPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();
  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    checkIn: p.checkIn, checkOut: p.checkOut,
    ...accountParams(account),
  });

  const [guestTpl, adminTpl] = await Promise.all([
    resolveTemplate(pid, "booking_cancelled_guest", vars, {
      subject: `Your Booking Has Been Cancelled – ${property}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Cancelled</h2><p>Hi ${escapeHtml(p.guestName)}, your booking at ${escapeHtml(property)} has been cancelled.</p></div>`,
    }),
    resolveTemplate(pid, "booking_cancelled_admin", vars, {
      subject: `Booking Cancelled – ${p.guestName} (${p.checkIn})`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Cancelled</h2><p>Guest: ${escapeHtml(p.guestName)} (${escapeHtml(p.guestEmail)})<br>Dates: ${p.checkIn} – ${p.checkOut}</p></div>`,
    }),
  ]);

  const [guestActive, adminActive] = await Promise.all([
    isAutomationActive("booking_cancelled_guest"),
    isAutomationActive("booking_cancelled_admin"),
  ]);
  if (guestActive) {
    await sendEmail(cfg, p.guestEmail, guestTpl.subject, guestTpl.html, "booking", relatedId, "booking_cancelled_guest");
  }
  if (adminActive && cfg.adminEmail) {
    if (cfg.provider === "smtp") await new Promise(r => setTimeout(r, 600));
    await sendEmail(cfg, cfg.adminEmail, adminTpl.subject, adminTpl.html, "booking", relatedId, "booking_cancelled_admin");
  }
}

async function handleBookingDeclined(cfg: EmailConfig, p: BookingDeclinedPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();
  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    checkIn: p.checkIn, checkOut: p.checkOut,
    ...accountParams(account),
  });

  const tpl = await resolveTemplate(pid, "booking_request_declined_guest", vars, {
    subject: `Your booking request was not approved – ${property}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Not Approved</h2><p>Hi ${escapeHtml(p.guestName)}, your request at ${escapeHtml(property)} was not approved. Your dates were not reserved and no payment was collected.</p></div>`,
  });

  if (await isAutomationActive("booking_request_declined_guest")) {
    await sendEmail(cfg, p.guestEmail, tpl.subject, tpl.html, "booking", relatedId, "booking_request_declined_guest");
  }
}

async function handleBookingRequestApproved(cfg: EmailConfig, p: BookingRequestApprovedPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();
  const confirmationCode = await loadConfirmationCode(p.bookingId);

  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    guestPhone: p.guestPhone, checkIn: p.checkIn, checkOut: p.checkOut,
    nights: p.nights, guests: p.guests, pets: p.pets, totalPrice: p.totalPrice,
    totalTripPrice: p.totalPrice, confirmationCode, paymentStatus: p.paymentStatus ?? "pending",
    paymentUrl: p.paymentUrl,
    ...accountParams(account),
  });

  const hasPaymentLink = !!p.paymentUrl;
  const guestFallbackHtml = hasPaymentLink
    ? `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Approved!</h2><p>Hi ${escapeHtml(p.guestName)}, your booking request has been approved and your dates are being held while your payment is pending.</p><p>Please complete your payment to finalize the reservation. Your hold will expire if payment is not received in time.</p><p style="margin-top:24px">${vars.payment_button}</p></div>`
    : `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Approved!</h2><p>Hi ${escapeHtml(p.guestName)}, your booking request at ${escapeHtml(property)} has been approved and your dates are reserved.</p><p>The owner will contact you separately with payment instructions.</p></div>`;

  const [guestTpl, adminTpl] = await Promise.all([
    resolveTemplate(pid, "booking_request_approved_guest", vars, {
      subject: `Your booking request has been approved – ${property}`,
      html: guestFallbackHtml,
    }),
    resolveTemplate(pid, "booking_request_approved_admin", vars, {
      subject: `Booking Approved – ${p.guestName} (${p.checkIn})`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Approved</h2><p>Guest: ${escapeHtml(p.guestName)} (${escapeHtml(p.guestEmail)})<br>Dates: ${p.checkIn} – ${p.checkOut}<br>Payment: ${hasPaymentLink ? "Payment link sent to guest" : "pending (contact guest manually)"}</p>${hasPaymentLink ? `<p>Payment link: <a href="${escapeHtml(p.paymentUrl!)}">${escapeHtml(p.paymentUrl!)}</a></p>` : ""}</div>`,
    }),
  ]);

  const [guestActive, adminActive] = await Promise.all([
    isAutomationActive("booking_request_approved_guest"),
    isAutomationActive("booking_request_approved_admin"),
  ]);
  if (guestActive) {
    await sendEmail(cfg, p.guestEmail, guestTpl.subject, guestTpl.html, "booking", relatedId, "booking_request_approved_guest");
  }
  if (adminActive && cfg.adminEmail) {
    if (cfg.provider === "smtp") await new Promise(r => setTimeout(r, 600));
    await sendEmail(cfg, cfg.adminEmail, adminTpl.subject, adminTpl.html, "booking", relatedId, "booking_request_approved_admin");
  }
}

async function handleBookingRequestDeclined(cfg: EmailConfig, p: BookingRequestDeclinedPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;
  const relatedId = p.bookingId ?? null;
  const account = await loadAccountSettings();

  const vars = buildVars({
    propertyTitle: property, guestName: p.guestName, guestEmail: p.guestEmail,
    checkIn: p.checkIn, checkOut: p.checkOut,
    ...accountParams(account),
  });

  const tpl = await resolveTemplate(pid, "booking_request_declined_guest", vars, {
    subject: `Your booking request was not approved – ${property}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Booking Request Not Approved</h2><p>Hi ${escapeHtml(p.guestName)}, unfortunately your booking request at ${escapeHtml(property)} was not approved. Your dates were not reserved and no payment was collected.</p></div>`,
  });

  if (await isAutomationActive("booking_request_declined_guest")) {
    await sendEmail(cfg, p.guestEmail, tpl.subject, tpl.html, "booking", relatedId, "booking_request_declined_guest");
  }
}

async function handleContact(cfg: EmailConfig, p: ContactPayload): Promise<void> {
  const property = p.propertyName ?? cfg.propertyTitle;
  const pid = p.propertyId ?? cfg.propertyId;

  let inquiryId: string | null = p.inquiryId ?? null;
  if (!inquiryId) {
    try {
      const { data, error } = await supabase.from("inquiries").insert({
        property_id: p.propertyId ?? null,
        sender_name: p.senderName,
        sender_email: p.senderEmail,
        sender_phone: p.senderPhone ?? null,
        message: p.message,
        status: "new",
      }).select("id").maybeSingle();
      if (error) console.error("Failed to persist inquiry:", error.message);
      inquiryId = data?.id ?? null;
    } catch (e) {
      console.error("Failed to persist inquiry:", e instanceof Error ? e.message : String(e));
    }
  }

  const account = await loadAccountSettings();
  const vars = buildVars({
    propertyTitle: property, guestName: p.senderName, guestEmail: p.senderEmail,
    guestPhone: p.senderPhone, senderPhone: p.senderPhone, inquiryMessage: p.message,
    ...accountParams(account),
  });

  const [adminTpl, guestTpl] = await Promise.all([
    resolveTemplate(pid, "inquiry_received_admin", vars, {
      subject: `New Message from ${p.senderName}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>New Contact Message</h2><p>From: ${escapeHtml(p.senderName)} (${escapeHtml(p.senderEmail)})</p><p>${escapeHtml(p.message)}</p></div>`,
    }),
    resolveTemplate(pid, "inquiry_auto_reply_guest", vars, {
      subject: `We received your message – ${property}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>We got your message!</h2><p>Hi ${escapeHtml(p.senderName)}, thanks for reaching out. We will get back to you soon.</p></div>`,
    }),
  ]);

  const adminSms = `New message from ${p.senderName} (${p.senderEmail}):\n"${p.message.slice(0, 120)}${p.message.length > 120 ? "…" : ""}"`;

  const [adminActive, guestActive] = await Promise.all([
    isAutomationActive("inquiry_received_admin"),
    isAutomationActive("inquiry_auto_reply_guest"),
  ]);
  if (adminActive && cfg.adminEmail) {
    await sendEmail(cfg, cfg.adminEmail, adminTpl.subject, adminTpl.html, "inquiry", inquiryId, "inquiry_received_admin", p.senderEmail);
    if (cfg.provider === "smtp") await new Promise(r => setTimeout(r, 600));
  }
  if (guestActive) {
    await sendEmail(cfg, p.senderEmail, guestTpl.subject, guestTpl.html, "inquiry", inquiryId, "inquiry_auto_reply_guest");
  }
  if (ADMIN_PHONE) sendSms(ADMIN_PHONE, adminSms);
}

// ── Test email (admin-only) ───────────────────────────────────────────────────

async function handleTestEmail(req: Request): Promise<Response> {
  const json = (data: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // 1. Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ sent: false, error: "Unauthorized" }, 401);

  let userEmail: string | undefined;
  try {
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !data?.user) return json({ sent: false, error: "Unauthorized" }, 401);
    userEmail = data.user.email ?? undefined;
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    console.error("[test-email] auth.getUser threw:", msg);
    return json({ sent: false, error: `Auth check failed: ${msg}` }, 500);
  }

  // 2. Load email config with safe diagnostics
  let cfg: EmailConfig;
  try {
    cfg = await loadEmailConfig();
  } catch (cfgErr) {
    const msg = cfgErr instanceof Error ? cfgErr.message : String(cfgErr);
    console.error("[test-email] loadEmailConfig threw:", msg);
    return json({ sent: false, error: `Config load failed: ${msg}` }, 500);
  }

  console.log("[test-email] config:", {
    provider: cfg.provider,
    smtpHostExists: !!cfg.smtpHostname,
    smtpPort: cfg.smtpPort,
    smtpSecure: cfg.smtpSecure,
    smtpFromExists: !!cfg.smtpFrom,
    adminEmailExists: !!cfg.adminEmail,
    smtpUsernameExists: !!cfg.smtpUsername,
    smtpPasswordExists: !!cfg.smtpPassword,
  });

  // 3. Resolve recipient
  const recipient = cfg.adminEmail || userEmail;
  if (!recipient) return json({ sent: false, error: "No admin email configured" }, 400);

  // 4. Read requested template key from body
  let requestedTemplateKey = "test_email";
  try {
    const body = await req.json();
    if (body?.templateKey && typeof body.templateKey === "string") {
      requestedTemplateKey = body.templateKey;
    }
  } catch { /* no body or not JSON — use default */ }

  // 5. Resolve template
  const accountForTest = await loadAccountSettings();
  const sampleVars = buildVars({
    guestName: "Jane Smith",
    guestEmail: recipient, checkIn: "2026-07-10", checkOut: "2026-07-13",
    nights: 3, guests: 2, totalPrice: 45000, totalTripPrice: 45000,
    confirmationCode: `TIKI-${cfg.propertyId.slice(0, 8).toUpperCase()}`,
    paymentStatus: "pending", bookingStatus: "confirmed",
    specialRequests: "Early check-in if possible.",
    inquiryMessage: "Do you allow early check-in?",
    ...accountParams(accountForTest),
  });

  const tpl = await resolveTemplate(cfg.propertyId, requestedTemplateKey, sampleVars, {
    subject: `Test Email – ${cfg.propertyTitle}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Test Email</h2><p>Provider: <strong>${cfg.provider}</strong></p><p>Sent at: ${new Date().toISOString()}</p></div>`,
  });

  // 6. Send — sendEmail always returns SendResult, never throws
  const result = await sendEmail(cfg, recipient, tpl.subject, tpl.html, "test", null, requestedTemplateKey);
  const debug = {
    _config: {
      provider: cfg.provider,
      emailSettingsFound: cfg._emailSettingsFound,
      emailProviderFromDb: cfg._emailProviderFromDb,
      propertyIdUsed: cfg.propertyId || "(none)",
      smtpHostExists: !!cfg.smtpHostname,
      smtpPort: cfg.smtpPort,
      smtpSecure: cfg.smtpSecure,
      smtpFromExists: !!cfg.smtpFrom,
      adminEmailExists: !!cfg.adminEmail,
      smtpUsernameExists: !!cfg.smtpUsername,
      smtpPasswordExists: !!cfg.smtpPassword,
    },
  };
  return json({ ...(result as unknown as Record<string, unknown>), ...debug });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (url.pathname.endsWith("/test-email") || url.searchParams.get("action") === "test-email") {
    try {
      return await handleTestEmail(req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("handleTestEmail unexpected error:", msg);
      return new Response(JSON.stringify({ sent: false, error: `Unexpected error: ${msg}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // IMPORTANT: verify_jwt=false so guests can trigger booking/inquiry notifications.
  // All recipients, subjects, and templates are selected server-side from fixed event types.
  // Free-form recipient/subject/body fields must never be accepted from callers.
  try {
    const payload: Payload = await req.json();
    const cfg = await loadEmailConfig();

    switch (payload.type) {
      case "booking_request_received":
        await handleBookingRequest(cfg, payload);
        break;
      case "booking_confirmed":
        await handleBookingConfirmed(cfg, payload);
        break;
      case "booking_request_approved":
        await handleBookingRequestApproved(cfg, payload);
        break;
      case "booking_request_declined":
        await handleBookingRequestDeclined(cfg, payload);
        break;
      case "booking":
        await handleBookingConfirmed(cfg, { ...payload, type: "booking_confirmed" });
        break;
      case "booking_cancelled":
        await handleBookingCancelled(cfg, payload);
        break;
      case "booking_declined":
        await handleBookingDeclined(cfg, payload);
        break;
      case "contact":
        await handleContact(cfg, payload);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown notification type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notifications error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
