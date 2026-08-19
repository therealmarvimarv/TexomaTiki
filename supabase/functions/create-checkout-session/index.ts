import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// IMPORTANT: Stripe keys are loaded from Supabase Vault via payment_settings.
// They are never read from Deno.env directly (env vars are a fallback only).
// Accepts both sk_test_ (test_stripe mode) and sk_live_ (live_stripe mode) keys.
// The active payment_mode in payment_settings determines which vault key is loaded.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Availability helper ────────────────────────────────────────────────────────

interface AvailabilityResult {
  available: boolean;
  code: string;
  message: string;
}

type SupabaseClient = ReturnType<typeof createClient>;

interface PropertyRules {
  min_nights: number;
  max_nights: number | null;
  max_guests: number | null;
  min_notice_days: number | null;
  max_advance_days: number | null;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

async function checkAvailability(
  supabase: SupabaseClient,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  rules: PropertyRules,
  minNightsOverride: number | null,
): Promise<AvailabilityResult> {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const ciDate = new Date(y1, m1 - 1, d1);
  const coDate = new Date(y2, m2 - 1, d2);

  if (isNaN(ciDate.getTime()) || isNaN(coDate.getTime())) {
    return { available: false, code: "INVALID_DATES", message: "Invalid check-in or check-out date." };
  }
  if (ciDate >= coDate) {
    return { available: false, code: "INVALID_DATES", message: "Check-out must be after check-in." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ciDate < today) {
    return { available: false, code: "PAST_DATE", message: "Check-in date cannot be in the past." };
  }

  const nights = Math.round((coDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
  const effectiveMin = minNightsOverride ?? rules.min_nights ?? 1;
  const effectiveMax = (rules.max_nights && rules.max_nights > 0) ? rules.max_nights : null;

  if (nights < effectiveMin) {
    return {
      available: false,
      code: "MIN_NIGHTS",
      message: `Minimum stay is ${effectiveMin} night${effectiveMin !== 1 ? "s" : ""}.`,
    };
  }
  if (effectiveMax !== null && nights > effectiveMax) {
    return {
      available: false,
      code: "MAX_NIGHTS",
      message: `Maximum stay is ${effectiveMax} night${effectiveMax !== 1 ? "s" : ""}.`,
    };
  }
  if (rules.max_guests !== null && guests > rules.max_guests) {
    return {
      available: false,
      code: "MAX_GUESTS",
      message: `Guest count exceeds the property capacity of ${rules.max_guests}.`,
    };
  }

  const todayStr = today.toISOString().split("T")[0];
  if (rules.min_notice_days != null) {
    const earliest = addDays(todayStr, rules.min_notice_days);
    if (checkIn < earliest) {
      return {
        available: false,
        code: "MIN_NOTICE",
        message: `Bookings require at least ${rules.min_notice_days} day(s) advance notice.`,
      };
    }
  }
  if (rules.max_advance_days != null) {
    const latest = addDays(todayStr, rules.max_advance_days);
    if (checkIn > latest) {
      return {
        available: false,
        code: "MAX_ADVANCE",
        message: `Bookings can only be made up to ${rules.max_advance_days} days in advance.`,
      };
    }
  }

  const { data: blockedRows, error: blockedErr } = await supabase
    .from("blocked_dates")
    .select("date")
    .eq("property_id", propertyId)
    .gte("date", checkIn)
    .lt("date", checkOut);

  if (blockedErr) {
    return { available: false, code: "DB_ERROR", message: "Unable to check availability. Please try again." };
  }
  if (blockedRows && blockedRows.length > 0) {
    return { available: false, code: "BLOCKED", message: "The selected dates are blocked by the host." };
  }

  const { data: ownerRows, error: ownerErr } = await supabase
    .from("owner_blocks")
    .select("id")
    .eq("property_id", propertyId)
    .lt("start_date", checkOut)
    .gt("end_date", checkIn);

  if (ownerErr) {
    return { available: false, code: "DB_ERROR", message: "Unable to check availability. Please try again." };
  }
  if (ownerRows && ownerRows.length > 0) {
    return { available: false, code: "BLOCKED", message: "The selected dates are blocked by the host." };
  }

  const { data: conflictRows, error: conflictErr } = await supabase
    .from("bookings")
    .select("id, status, payment_expires_at")
    .eq("property_id", propertyId)
    .not("status", "in", '("expired","cancelled","declined","payment_failed","refunded")')
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (conflictErr) {
    return { available: false, code: "DB_ERROR", message: "Unable to check availability. Please try again." };
  }

  const now = new Date();
  const activeConflict = (conflictRows ?? []).some((row) => {
    if (row.status === "confirmed") return true;
    if (row.status === "pending_payment") {
      if (!row.payment_expires_at) return true;
      return new Date(row.payment_expires_at) > now;
    }
    return false;
  });

  if (activeConflict) {
    return { available: false, code: "CONFLICT", message: "The selected dates conflict with an existing reservation." };
  }

  return { available: true, code: "OK", message: "Dates are available." };
}

// ── Pricing ────────────────────────────────────────────────────────────────────

interface DbFee {
  name: string;
  fee_type: string;
  amount: number;
  applies_after_guests: number | null;
  apply_to_guest_quote: boolean;
  is_standard: boolean;
}

interface SeasonalPreset {
  start_date: string;
  end_date: string;
  nightly_rate: number;
  priority: number;
}

function resolveNightlyRate(
  dateStr: string,
  basePrice: number,
  dowRates: { day_of_week: number; rate: number }[],
  dateOverrides: Record<string, number>,
  seasonalPresets: SeasonalPreset[],
): number {
  if (dateOverrides[dateStr] !== undefined) return dateOverrides[dateStr];

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const matching = seasonalPresets.filter((p) => {
    const [sy, sm, sd] = p.start_date.split("-").map(Number);
    const [ey, em, ed] = p.end_date.split("-").map(Number);
    return date >= new Date(sy, sm - 1, sd) && date <= new Date(ey, em - 1, ed);
  });
  if (matching.length > 0) {
    const best = matching.reduce((a, b) => (b.priority > a.priority ? b : a));
    return Number(best.nightly_rate);
  }

  const dow = date.getDay();
  const dowRate = dowRates.find((r) => r.day_of_week === dow);
  if (dowRate) return Number(dowRate.rate);

  return basePrice;
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function calcPricing(
  checkIn: string,
  checkOut: string,
  basePrice: number,
  dowRates: { day_of_week: number; rate: number }[],
  dateOverrides: Record<string, number>,
  seasonalPresets: SeasonalPreset[],
  guests: number,
  pets: number,
  dbFees: DbFee[],
  taxRate: number,
): { subtotalCents: number; feesCents: number; taxCents: number; totalCents: number; nights: number } | null {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return null;

  let subtotal = 0;
  let cur = checkIn;
  for (let i = 0; i < nights; i++) {
    subtotal += resolveNightlyRate(cur, basePrice, dowRates, dateOverrides, seasonalPresets);
    cur = addDaysStr(cur, 1);
  }

  let feesTotal = 0;
  for (const fee of dbFees) {
    if (fee.apply_to_guest_quote === false) continue;
    if (fee.is_standard && fee.name === "Pets" && pets === 0) continue;
    const threshold = fee.applies_after_guests ?? 0;
    const extraGuests = Math.max(0, guests - threshold);
    let amount = 0;
    switch (fee.fee_type) {
      case "per_stay":             amount = fee.amount; break;
      case "per_night":            amount = fee.amount * nights; break;
      case "per_guest_per_stay":   amount = fee.amount * extraGuests; break;
      case "per_guest_per_night":  amount = fee.amount * extraGuests * nights; break;
    }
    feesTotal += amount;
  }

  const taxes = (subtotal + feesTotal) * taxRate;
  return {
    subtotalCents: Math.round(subtotal * 100),
    feesCents: Math.round(feesTotal * 100),
    taxCents: Math.round(taxes * 100),
    totalCents: Math.round((subtotal + feesTotal + taxes) * 100),
    nights,
  };
}

// ── Stripe form-encoding ───────────────────────────────────────────────────────

function flattenToFormData(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          parts.push(flattenToFormData(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof val === "object") {
      parts.push(flattenToFormData(val as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.join("&");
}

async function stripePost(
  path: string,
  body: Record<string, unknown>,
  secretKey: string,
): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: flattenToFormData(body),
  });
}

// ── Load payment config from vault + payment_settings ─────────────────────────

interface PaymentConfig {
  paymentMode: string;
  stripeSecretKey: string;
  siteUrl: string;
  expiresMinutes: number;
}

async function loadPaymentConfig(supabase: SupabaseClient): Promise<PaymentConfig> {
  const { data: prop } = await supabase
    .from("properties")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { data: settings } = prop
    ? await supabase
        .from("payment_settings")
        .select("payment_mode, site_url, checkout_expires_minutes")
        .eq("property_id", prop.id)
        .maybeSingle()
    : { data: null };

  const paymentMode = settings?.payment_mode ?? "test_manual";
  const rawSiteUrl = settings?.site_url ?? Deno.env.get("SITE_URL") ?? "http://localhost:5173";
  const siteUrl = rawSiteUrl.replace(/\/+$/, "");
  const expiresMinutes = settings?.checkout_expires_minutes ??
    parseInt(Deno.env.get("STRIPE_CHECKOUT_EXPIRES_MINUTES") ?? "30", 10);

  // Load the appropriate Stripe key from vault based on the active mode
  let vaultKeyName = "stripe_test_secret_key";
  if (paymentMode === "live_stripe") {
    vaultKeyName = "stripe_live_secret_key";
  }

  const { data: vaultKey } = await supabase.rpc("payment_settings_get_secret", {
    p_name: vaultKeyName,
  });

  const stripeSecretKey = (typeof vaultKey === "string" && vaultKey.length > 0)
    ? vaultKey
    : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

  return { paymentMode, stripeSecretKey, siteUrl, expiresMinutes };
}

// ── Handler ────────────────────────────────────────────────────────────────────

interface RequestBody {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  pets?: number;
  special_requests?: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Load payment config from vault/DB (not from request body)
    const config = await loadPaymentConfig(supabase);

    // Guard: refuse if payment mode is manual (test_manual or live_manual)
    if (config.paymentMode === "test_manual" || config.paymentMode === "live_manual") {
      return new Response(
        JSON.stringify({
          error: "Online payment is not enabled. Please use the booking request form.",
          code: "MANUAL_MODE",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guard: refuse unsupported/unknown payment modes (only test_stripe and live_stripe proceed)
    if (config.paymentMode !== "test_stripe" && config.paymentMode !== "live_stripe") {
      return new Response(
        JSON.stringify({
          error: `Unsupported payment mode: ${config.paymentMode}`,
          code: "UNSUPPORTED_MODE",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guard: refuse if Stripe key is missing or doesn't match the expected prefix
    if (!config.stripeSecretKey) {
      return new Response(
        JSON.stringify({
          error: "Online payment is not configured yet. Please contact the host to book.",
          code: "STRIPE_NOT_CONFIGURED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (config.paymentMode === "test_stripe" && !config.stripeSecretKey.startsWith("sk_test_")) {
      return new Response(
        JSON.stringify({
          error: "Online payment is not configured yet. Please contact the host to book.",
          code: "STRIPE_NOT_CONFIGURED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (config.paymentMode === "live_stripe" && !config.stripeSecretKey.startsWith("sk_live_")) {
      return new Response(
        JSON.stringify({
          error: "Online payment is not configured yet. Please contact the host to book.",
          code: "STRIPE_NOT_CONFIGURED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: RequestBody = await req.json();
    const {
      property_id, check_in, check_out, guests,
      pets = 0, special_requests,
      guest_name, guest_email, guest_phone,
    } = body;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!property_id || !check_in || !check_out || !guests || !guest_name || !guest_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(check_in) || !dateRegex.test(check_out)) {
      return new Response(JSON.stringify({ error: "Dates must be YYYY-MM-DD format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (check_out <= check_in) {
      return new Response(JSON.stringify({ error: "Check-out must be after check-in" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load property rules + pricing data in parallel ───────────────────────
    const [propRes, dowRes, overrideRes, feesRes, availOverrideRes, seasonalRes] = await Promise.all([
      supabase.from("properties")
        .select("base_price,tax_rate,min_nights,max_nights,max_guests,min_notice_days,max_advance_days,is_active")
        .eq("id", property_id)
        .maybeSingle(),
      supabase.from("day_of_week_rates").select("day_of_week,rate").eq("property_id", property_id),
      supabase.from("date_price_overrides").select("date,rate").eq("property_id", property_id),
      supabase.from("property_fees").select("name,fee_type,amount,applies_after_guests,apply_to_guest_quote,is_standard")
        .eq("property_id", property_id).eq("enabled", true).order("sort_order"),
      supabase.from("date_availability_overrides").select("date,min_nights")
        .eq("property_id", property_id).gte("date", check_in).lte("date", check_out),
      supabase.from("seasonal_pricing_presets")
        .select("start_date,end_date,nightly_rate,priority")
        .eq("property_id", property_id)
        .eq("is_active", true),
    ]);

    const prop = propRes.data;
    if (!prop) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!prop.is_active) {
      return new Response(JSON.stringify({ error: "Property is not available for booking" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const availOverrides = availOverrideRes.data ?? [];
    const minNightsOverride = availOverrides.find((o) => o.date === check_in)?.min_nights ?? null;

    const rules: PropertyRules = {
      min_nights: prop.min_nights ?? 1,
      max_nights: prop.max_nights ?? null,
      max_guests: prop.max_guests ?? null,
      min_notice_days: prop.min_notice_days ?? null,
      max_advance_days: prop.max_advance_days ?? null,
    };

    // ── Availability check ────────────────────────────────────────────────────
    const avail = await checkAvailability(
      supabase, property_id, check_in, check_out, guests, rules, minNightsOverride,
    );

    if (!avail.available) {
      const httpStatus = avail.code === "CONFLICT" || avail.code === "BLOCKED" ? 409 : 400;
      return new Response(JSON.stringify({ error: avail.message, code: avail.code }), {
        status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Server-side pricing ───────────────────────────────────────────────────
    const basePrice = Number(prop.base_price);
    const taxRate = Number(prop.tax_rate ?? 0);

    const dowRates = (dowRes.data ?? []).map((r) => ({ day_of_week: r.day_of_week, rate: Number(r.rate) }));
    const dateOverrides: Record<string, number> = {};
    for (const o of (overrideRes.data ?? [])) dateOverrides[o.date] = Number(o.rate);
    const seasonalPresets: SeasonalPreset[] = (seasonalRes.data ?? []).map((p) => ({
      start_date: p.start_date,
      end_date: p.end_date,
      nightly_rate: Number(p.nightly_rate),
      priority: p.priority,
    }));
    const dbFees: DbFee[] = (feesRes.data ?? []).map((f) => ({
      name: f.name,
      fee_type: f.fee_type,
      amount: Number(f.amount),
      applies_after_guests: f.applies_after_guests,
      apply_to_guest_quote: f.apply_to_guest_quote ?? true,
      is_standard: f.is_standard ?? false,
    }));

    const pricing = calcPricing(check_in, check_out, basePrice, dowRates, dateOverrides, seasonalPresets, guests, pets, dbFees, taxRate);
    if (!pricing) {
      return new Response(JSON.stringify({ error: "Unable to calculate pricing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pricing.totalCents < 50) {
      return new Response(JSON.stringify({ error: "Booking total is below minimum charge amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create booking: pending_payment ───────────────────────────────────────
    const expiresAt = new Date(Date.now() + config.expiresMinutes * 60 * 1000).toISOString();

    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        property_id,
        check_in: check_in + "T00:00:00Z",
        check_out: check_out + "T00:00:00Z",
        guests,
        pets,
        special_requests: special_requests ?? null,
        guest_name,
        guest_email,
        guest_phone: guest_phone ?? null,
        total_price: pricing.totalCents / 100,
        status: "pending_payment",
        payment_status: "pending",
        payment_method: "stripe",
        amount_subtotal: pricing.subtotalCents,
        amount_fees: pricing.feesCents,
        amount_tax: pricing.taxCents,
        amount_total: pricing.totalCents,
        amount_paid: 0,
        currency: "usd",
        payment_expires_at: expiresAt,
        payment_due_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError || !booking) {
      console.error("Booking insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create booking" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Stripe Checkout Session ────────────────────────────────────────
    const expiresAtUnix = Math.floor(Date.now() / 1000) + config.expiresMinutes * 60;

    const lineItems: Record<string, unknown>[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Stay — ${pricing.nights} night${pricing.nights !== 1 ? "s" : ""}`,
            description: `${check_in} to ${check_out}`,
          },
          unit_amount: pricing.subtotalCents,
        },
        quantity: 1,
      },
    ];

    if (pricing.feesCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Fees" },
          unit_amount: pricing.feesCents,
        },
        quantity: 1,
      });
    }

    if (pricing.taxCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Taxes" },
          unit_amount: pricing.taxCents,
        },
        quantity: 1,
      });
    }

    const stripeBody: Record<string, unknown> = {
      mode: "payment",
      customer_email: guest_email,
      client_reference_id: booking.id,
      expires_at: String(expiresAtUnix),
      success_url: `${config.siteUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.siteUrl}/booking/cancelled?booking_id=${booking.id}`,
      line_items: lineItems,
      "metadata[booking_id]": booking.id,
      "metadata[property_id]": property_id,
      "metadata[check_in]": check_in,
      "metadata[check_out]": check_out,
    };

    const stripeRes = await stripePost("/checkout/sessions", stripeBody, config.stripeSecretKey);
    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", stripeData);
      await supabase.from("bookings")
        .update({ status: "payment_failed", payment_status: "failed" })
        .eq("id", booking.id);
      return new Response(JSON.stringify({ error: "Failed to create payment session" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("bookings")
      .update({ stripe_checkout_session_id: stripeData.id })
      .eq("id", booking.id);

    return new Response(
      JSON.stringify({ url: stripeData.url, booking_id: booking.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
