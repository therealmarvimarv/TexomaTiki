import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function flattenToFormData(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
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

async function stripePost(path: string, body: Record<string, unknown>, secretKey: string): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: flattenToFormData(body),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Accept both service-role token (internal calls) and user JWT (admin UI)
  const token = authHeader.replace("Bearer ", "");
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json() as { booking_id: string };
    const { booking_id } = body;
    if (!booking_id) return json({ error: "booking_id is required" }, 400);

    const { data: booking } = await supabase
      .from("bookings")
      .select("id,property_id,guest_name,guest_email,guests,check_in,check_out,status,payment_status,payment_expires_at,stripe_checkout_session_id,amount_subtotal,amount_fees,amount_tax,amount_total,total_price")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) return json({ error: "Booking not found" }, 404);
    if (!["pending_review", "pending_payment"].includes(booking.status)) {
      return json({ error: `Cannot create payment link for booking with status: ${booking.status}`, code: "INVALID_STATUS" }, 400);
    }

    // Load payment config from DB + vault
    const { data: prop } = await supabase.from("properties").select("id").limit(1).maybeSingle();
    const { data: settings } = prop
      ? await supabase.from("payment_settings").select("payment_mode,site_url,checkout_expires_minutes").eq("property_id", prop.id).maybeSingle()
      : { data: null };

    const paymentMode = settings?.payment_mode ?? "test_manual";

    // Manual modes never create Stripe checkout sessions — even admin-initiated.
    if (paymentMode === "test_manual" || paymentMode === "live_manual") {
      return json({ error: "Online payment is not enabled for the active mode", code: "MANUAL_MODE" }, 503);
    }

    if (paymentMode !== "test_stripe" && paymentMode !== "live_stripe") {
      return json({ error: `Unsupported payment mode: ${paymentMode}`, code: "UNSUPPORTED_MODE" }, 400);
    }

    // Load only the vault key matching the active mode — no fallback between test and live.
    const vaultKeyName = paymentMode === "live_stripe" ? "stripe_live_secret_key" : "stripe_test_secret_key";
    const requiredPrefix = paymentMode === "live_stripe" ? "sk_live_" : "sk_test_";

    const { data: vaultKey } = await supabase.rpc("payment_settings_get_secret", { p_name: vaultKeyName });
    const secretKey = (typeof vaultKey === "string" && vaultKey.startsWith(requiredPrefix)) ? vaultKey : "";
    if (!secretKey) {
      return json({ error: "Stripe key not configured for the active mode", code: "STRIPE_NOT_CONFIGURED" }, 503);
    }

    const rawSiteUrl = settings?.site_url ?? Deno.env.get("SITE_URL") ?? "http://localhost:5173";
    const siteUrl = rawSiteUrl.replace(/\/+$/, "");
    const expiresMinutes = settings?.checkout_expires_minutes ??
      parseInt(Deno.env.get("STRIPE_CHECKOUT_EXPIRES_MINUTES") ?? "30", 10);
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();
    const expiresAtUnix = Math.floor(Date.now() / 1000) + expiresMinutes * 60;

    const checkIn = booking.check_in.split("T")[0];
    const checkOut = booking.check_out.split("T")[0];
    const [y1, m1, d1] = checkIn.split("-").map(Number);
    const [y2, m2, d2] = checkOut.split("-").map(Number);
    const nights = Math.round(
      (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000,
    );

    const totalCents = booking.amount_total ?? Math.round((booking.total_price ?? 0) * 100);
    const subtotalCents = booking.amount_subtotal ?? totalCents;
    const feesCents = booking.amount_fees ?? 0;
    const taxCents = booking.amount_tax ?? 0;

    if (totalCents < 50) return json({ error: "Booking total is too low to process via Stripe" }, 400);

    const lineItems: Record<string, unknown>[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Stay — ${nights} night${nights !== 1 ? "s" : ""}`,
            description: `${checkIn} to ${checkOut}`,
          },
          unit_amount: subtotalCents,
        },
        quantity: 1,
      },
    ];
    if (feesCents > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: "Fees" }, unit_amount: feesCents },
        quantity: 1,
      });
    }
    if (taxCents > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: "Taxes" }, unit_amount: taxCents },
        quantity: 1,
      });
    }

    const stripeBody: Record<string, unknown> = {
      mode: "payment",
      customer_email: booking.guest_email,
      client_reference_id: booking.id,
      expires_at: String(expiresAtUnix),
      success_url: `${siteUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/booking/cancelled?booking_id=${booking.id}`,
      line_items: lineItems,
      "metadata[booking_id]": booking.id,
      "metadata[property_id]": booking.property_id,
      "metadata[check_in]": checkIn,
      "metadata[check_out]": checkOut,
    };

    const stripeRes = await stripePost("/checkout/sessions", stripeBody, secretKey);
    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("[create-checkout-session-for-booking] Stripe error:", stripeData);
      return json({ error: "Failed to create Stripe session", stripe_error: stripeData?.error?.message ?? "Unknown error" }, 500);
    }

    await supabase.from("bookings").update({
      status: "pending_payment",
      payment_status: "pending",
      payment_method: "stripe",
      stripe_checkout_session_id: stripeData.id,
      payment_expires_at: expiresAt,
      payment_due_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", booking.id);

    return json({ checkout_url: stripeData.url, session_id: stripeData.id, booking_id: booking.id });
  } catch (err) {
    console.error("[create-checkout-session-for-booking] error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
