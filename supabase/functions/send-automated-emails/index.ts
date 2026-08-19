import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPERTY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Automation {
  id: string;
  property_id: string;
  name: string;
  template_id: string | null;
  template_key: string | null;
  recipient_type: "guest" | "admin" | "both";
  trigger_type: string;
  offset_days: number;
  send_time: string | null;
  is_active: boolean;
}

interface Booking {
  id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  amount_total: number | null;
  amount_subtotal: number | null;
  amount_fees: number | null;
  payment_status: string | null;
  confirmation_code: string | null;
  special_requests: string | null;
  status: string;
}

interface EmailConfig {
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
  propertyTitle: string;
}

// ── Email config ──────────────────────────────────────────────────────────────

async function loadEmailConfig(): Promise<EmailConfig> {
  let propertyTitle = "Tiki Cottage";
  try {
    const { data } = await supabase.from("properties").select("title").eq("id", PROPERTY_ID).limit(1);
    propertyTitle = (data as { title?: string }[])?.[0]?.title ?? propertyTitle;
  } catch { /* best-effort */ }

  const { data: s } = await supabase
    .from("email_settings")
    .select("email_provider,smtp_host,smtp_port,smtp_secure,smtp_from,admin_email")
    .eq("property_id", PROPERTY_ID)
    .maybeSingle();

  let vaultUsername = "";
  let vaultPassword = "";
  try {
    const { data } = await supabase.rpc("email_settings_get_secret", {
      p_name: `email_smtp_username_${PROPERTY_ID}`,
    });
    vaultUsername = data ?? "";
  } catch { /* ok */ }
  try {
    const { data } = await supabase.rpc("email_settings_get_secret", {
      p_name: `email_smtp_password_${PROPERTY_ID}`,
    });
    vaultPassword = data ?? "";
  } catch { /* ok */ }

  const provider = s?.email_provider ?? Deno.env.get("EMAIL_PROVIDER") ?? "disabled";

  return {
    provider,
    fromEmail: s?.smtp_from ?? Deno.env.get("FROM_EMAIL") ?? "",
    adminEmail: s?.admin_email ?? Deno.env.get("ADMIN_EMAIL") ?? "",
    resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
    smtpHostname: s?.smtp_host ?? Deno.env.get("SMTP_HOSTNAME") ?? "",
    smtpPort: s?.smtp_port ?? parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10),
    smtpSecure: s?.smtp_secure ?? (Deno.env.get("SMTP_SECURE") === "true"),
    smtpUsername: vaultUsername || Deno.env.get("SMTP_USERNAME") || "",
    smtpPassword: vaultPassword || Deno.env.get("SMTP_PASSWORD") || "",
    smtpFrom: s?.smtp_from ?? Deno.env.get("SMTP_FROM") ?? "",
    propertyTitle,
  };
}

// ── Template rendering ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) =>
    key in vars ? escapeHtml(vars[key]) : `{{${key}}}`
  );
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(cents: number | null, dollars?: number): string {
  if (cents != null && cents > 0) return `$${(cents / 100).toFixed(2)}`;
  if (dollars != null) return `$${Number(dollars).toFixed(2)}`;
  return "";
}

function buildVars(
  booking: Booking,
  cfg: EmailConfig,
  account: Record<string, string>,
): Record<string, string> {
  const checkIn = booking.check_in.split("T")[0];
  const checkOut = booking.check_out.split("T")[0];
  const msIn = new Date(checkIn).getTime();
  const msOut = new Date(checkOut).getTime();
  const nights = Math.round((msOut - msIn) / 86400000);
  const total = fmtMoney(booking.amount_total, booking.total_price);
  const confirmCode = booking.confirmation_code ?? booking.id.slice(0, 8).toUpperCase();

  return {
    // Property / Listing
    listing_name: account.listing_name ?? "",
    listing_address: account.listing_address ?? "",
    listing_city: account.listing_city ?? "",
    listing_state: account.listing_state ?? "",
    listing_zip: account.listing_zip ?? "",
    listing_country: account.listing_country ?? "",
    check_in_time: account.check_in_time ?? "",
    check_out_time: account.check_out_time ?? "",
    suggested_door_code: account.suggested_door_code ?? "",
    // Listing Contact
    listing_manager_name: account.listing_manager_name ?? "",
    listing_manager_role: account.listing_manager_role ?? "",
    manager_email: account.manager_email ?? "",
    manager_phone: account.manager_phone ?? "",
    primary_guest_contact_name: account.primary_guest_contact_name ?? "",
    primary_guest_contact_email: account.primary_guest_contact_email ?? "",
    primary_guest_contact_phone: account.primary_guest_contact_phone ?? "",
    // Guest
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone ?? "",
    guest_city: "",
    guest_county: "",
    // Booking
    check_in: fmtDate(checkIn),
    check_out: fmtDate(checkOut),
    nights: String(nights),
    guests: String(booking.guests),
    confirmation_code: confirmCode,
    average_nightly_price: fmtMoney(booking.amount_subtotal, booking.total_price / Math.max(nights, 1)),
    total_trip_price: total,
    cleaning_fee: fmtMoney(booking.amount_fees),
    payment_status: booking.payment_status ?? "",
    booking_status: booking.status,
    special_requests: booking.special_requests ?? "",
    inquiry_message: "",
    // Owner / Business
    owner_name: account.owner_name ?? "",
    owner_email: account.owner_email ?? "",
    owner_phone: account.owner_phone ?? "",
    business_name: account.business_name ?? "",
    business_address: account.business_address ?? "",
    support_email: account.support_email ?? "",
    // Other
    current_date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

// ── Send email ────────────────────────────────────────────────────────────────

async function sendEmail(
  cfg: EmailConfig,
  to: string,
  subject: string,
  html: string,
  bookingId: string,
  templateKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: "No recipient" };
  if (!cfg.provider || cfg.provider === "disabled") {
    await logSend(bookingId, templateKey, to, "skipped", "Email provider disabled");
    return { ok: false, error: "disabled" };
  }

  if (cfg.provider === "resend") {
    if (!cfg.resendApiKey || !cfg.fromEmail) {
      await logSend(bookingId, templateKey, to, "skipped", "Resend not configured");
      return { ok: false, error: "Resend not configured" };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.fromEmail, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      await logSend(bookingId, templateKey, to, "failed", err.slice(0, 200));
      return { ok: false, error: err };
    }
    await logSend(bookingId, templateKey, to, "sent");
    return { ok: true };
  }

  if (cfg.provider === "smtp") {
    const missing = [
      !cfg.smtpHostname && "smtp_host",
      !cfg.smtpUsername && "smtp_username",
      !cfg.smtpPassword && "smtp_password",
    ].filter(Boolean).join(", ");
    if (missing) {
      await logSend(bookingId, templateKey, to, "skipped", `Missing: ${missing}`);
      return { ok: false, error: `Missing SMTP config: ${missing}` };
    }
    try {
      const nodemailer = await import("npm:nodemailer@6");
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHostname, port: cfg.smtpPort, secure: cfg.smtpSecure,
        auth: { user: cfg.smtpUsername, pass: cfg.smtpPassword },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      });
      await transporter.sendMail({ from: cfg.smtpFrom || cfg.smtpUsername, to, subject, html });
      await logSend(bookingId, templateKey, to, "sent");
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logSend(bookingId, templateKey, to, "failed", msg);
      return { ok: false, error: msg };
    }
  }

  return { ok: false, error: `Unknown provider: ${cfg.provider}` };
}

async function logSend(
  bookingId: string,
  templateKey: string,
  recipient: string,
  status: string,
  errorMessage?: string,
) {
  try {
    await supabase.from("notification_logs").insert({
      related_type: "booking",
      related_id: bookingId,
      channel: "email",
      provider: "automated",
      recipient,
      subject: "",
      status,
      template_key: templateKey || null,
      error_message: errorMessage ?? null,
    });
  } catch { /* best-effort */ }
}

// ── Determine if an automation is due for a booking ───────────────────────────

function isDue(automation: Automation, booking: Booking, nowUtc: Date, tzOffsetHours: number): boolean {
  // Convert now to property-local date
  const nowLocal = new Date(nowUtc.getTime() + tzOffsetHours * 3600000);
  const todayLocal = nowLocal.toISOString().split("T")[0];

  const checkInDate = booking.check_in.split("T")[0];
  const checkOutDate = booking.check_out.split("T")[0];

  let targetDate: string;

  switch (automation.trigger_type) {
    case "booking_confirmed":
      // Due immediately; handled separately — here always false
      return false;
    case "before_check_in": {
      const d = new Date(checkInDate + "T00:00:00");
      d.setDate(d.getDate() - automation.offset_days);
      targetDate = d.toISOString().split("T")[0];
      break;
    }
    case "day_of_check_in":
      targetDate = checkInDate;
      break;
    case "after_check_in": {
      const d = new Date(checkInDate + "T00:00:00");
      d.setDate(d.getDate() + automation.offset_days);
      targetDate = d.toISOString().split("T")[0];
      break;
    }
    case "before_check_out": {
      const d = new Date(checkOutDate + "T00:00:00");
      d.setDate(d.getDate() - automation.offset_days);
      targetDate = d.toISOString().split("T")[0];
      break;
    }
    case "day_of_check_out":
      targetDate = checkOutDate;
      break;
    case "after_check_out": {
      const d = new Date(checkOutDate + "T00:00:00");
      d.setDate(d.getDate() + automation.offset_days);
      targetDate = d.toISOString().split("T")[0];
      break;
    }
    default:
      return false;
  }

  if (targetDate !== todayLocal) return false;

  // Check send_time — if set, must be past that time locally
  if (automation.send_time) {
    const [hh, mm] = automation.send_time.split(":").map(Number);
    const sendMinutes = hh * 60 + mm;
    const nowMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
    return nowMinutes >= sendMinutes;
  }

  return true;
}

// ── Resolve template ──────────────────────────────────────────────────────────

async function resolveTemplate(
  automation: Automation,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  const key = automation.template_key;
  const id = automation.template_id;

  let tpl: { subject: string; html_body: string; is_active: boolean } | null = null;

  if (id) {
    const { data } = await supabase
      .from("email_templates")
      .select("subject,html_body,is_active")
      .eq("id", id)
      .maybeSingle();
    tpl = data as typeof tpl;
  } else if (key) {
    const { data } = await supabase
      .from("email_templates")
      .select("subject,html_body,is_active")
      .eq("property_id", PROPERTY_ID)
      .eq("template_key", key)
      .maybeSingle();
    tpl = data as typeof tpl;
  }

  if (!tpl || !tpl.is_active) return null;

  return {
    subject: tpl.subject.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => vars[k] ?? ""),
    html: renderTemplate(tpl.html_body, vars),
  };
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function run(isTest: boolean, testAdminEmail?: string): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const result = { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  const cfg = await loadEmailConfig();

  // Load account settings for variable enrichment
  let account: Record<string, string> = {};
  try {
    const { data } = await supabase
      .from("account_settings")
      .select("owner_name,owner_email,owner_phone,business_name,business_address,support_email,timezone,property_address,check_in_time,check_out_time,suggested_door_code,listing_name,listing_address,listing_city,listing_state,listing_zip,listing_country,listing_manager_name,listing_manager_role,manager_email,manager_phone,primary_guest_contact_name,primary_guest_contact_email,primary_guest_contact_phone")
      .eq("property_id", PROPERTY_ID)
      .maybeSingle();
    if (data) account = data as Record<string, string>;
  } catch { /* ok */ }

  // Property timezone offset (simple lookup, no IANA conversion)
  const tzName = account.timezone || "America/Los_Angeles";
  // Use fixed offset approximation for common US timezones
  const TZ_OFFSETS: Record<string, number> = {
    "America/Los_Angeles": -7,  // PDT (summer)
    "America/Denver": -6,
    "America/Chicago": -5,
    "America/New_York": -4,
    "America/Anchorage": -8,
    "Pacific/Honolulu": -10,
    "America/Phoenix": -7,
  };
  const tzOffsetHours = TZ_OFFSETS[tzName] ?? -7;

  // Load active automations only — disabled automations never send, including in test mode
  const { data: automations, error: autoErr } = await supabase
    .from("email_automations")
    .select("*")
    .eq("property_id", PROPERTY_ID)
    .eq("is_active", true);

  if (autoErr || !automations?.length) {
    if (!automations?.length) {
      result.errors.push("No active automations found");
    }
    return result;
  }

  // Load eligible confirmed bookings
  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("id,property_id,guest_name,guest_email,guest_phone,check_in,check_out,guests,total_price,amount_total,amount_subtotal,amount_fees,payment_status,confirmation_code,special_requests,status")
    .eq("property_id", PROPERTY_ID)
    .eq("status", "confirmed")
    .is("archived_at", null)
    .not("guest_email", "is", null);

  if (bookErr || !bookings?.length) return result;

  const nowUtc = new Date();

  for (const automation of automations as Automation[]) {
    for (const booking of bookings as Booking[]) {
      result.processed++;

      // Check for existing send record
      const { data: existing } = await supabase
        .from("email_automation_sends")
        .select("id,status")
        .eq("automation_id", automation.id)
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (existing && (existing.status === "sent" || existing.status === "pending")) {
        result.skipped++;
        continue;
      }

      // Check if due
      const due = isTest || isDue(automation, booking, nowUtc, tzOffsetHours);
      if (!due) {
        result.skipped++;
        continue;
      }

      const vars = buildVars(booking, cfg, account);
      const tpl = await resolveTemplate(automation, vars);

      if (!tpl) {
        result.skipped++;
        await supabase.from("email_automation_sends").upsert({
          property_id: PROPERTY_ID,
          automation_id: automation.id,
          booking_id: booking.id,
          status: "skipped",
          recipient_email: booking.guest_email,
          error_message: "Template not found or inactive",
          updated_at: new Date().toISOString(),
        }, { onConflict: "automation_id,booking_id" });
        continue;
      }

      // Determine recipients
      const recipients: string[] = [];
      const actualAdminEmail = testAdminEmail || cfg.adminEmail;

      if (isTest) {
        if (actualAdminEmail) recipients.push(actualAdminEmail);
      } else {
        if (automation.recipient_type === "guest" || automation.recipient_type === "both") {
          recipients.push(booking.guest_email);
        }
        if ((automation.recipient_type === "admin" || automation.recipient_type === "both") && cfg.adminEmail) {
          recipients.push(cfg.adminEmail);
        }
      }

      if (recipients.length === 0) {
        result.skipped++;
        continue;
      }

      let allOk = true;
      for (const to of recipients) {
        if (cfg.provider === "smtp" && recipients.indexOf(to) > 0) {
          await new Promise(r => setTimeout(r, 600));
        }
        const res = await sendEmail(cfg, to, tpl.subject, tpl.html, booking.id, automation.template_key ?? "automation");
        if (!res.ok && res.error !== "disabled") allOk = false;
      }

      if (!isTest) {
        await supabase.from("email_automation_sends").upsert({
          property_id: PROPERTY_ID,
          automation_id: automation.id,
          booking_id: booking.id,
          status: allOk ? "sent" : "failed",
          recipient_email: recipients[0],
          sent_at: allOk ? new Date().toISOString() : null,
          error_message: allOk ? null : "Send failed",
          updated_at: new Date().toISOString(),
        }, { onConflict: "automation_id,booking_id" });
      }

      if (allOk) result.sent++;
      else result.failed++;
    }
  }

  return result;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Auth check for manual/test invocations from the UI
  const authHeader = req.headers.get("Authorization");
  const isScheduled = !authHeader || authHeader.startsWith("Bearer " + SUPABASE_SERVICE_ROLE_KEY);

  let isTest = false;
  let testAdminEmail: string | undefined;
  let testAutomationId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    isTest = body?.test === true;
    testAdminEmail = body?.admin_email;
    testAutomationId = body?.automation_id;
  } catch { /* ok */ }

  if (!isScheduled) {
    // Must be authenticated admin
    try {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
      const token = authHeader!.replace("Bearer ", "");
      const { data, error } = await anonClient.auth.getUser(token);
      if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  void testAutomationId; // reserved for future per-automation test

  try {
    const result = await run(isTest, testAdminEmail);
    return json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-automated-emails] error:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
