import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// NOTE: Stripe SaaS subscription webhook not enabled yet.
// Use the sync action to pull latest state from Stripe on demand.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Stripe helpers (no SDK — lightweight fetch) ───────────────────────────────

async function stripeGet(path: string, secretKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`);
  }
  return res.json();
}

async function stripePost(path: string, params: Record<string, unknown>, secretKey: string) {
  const body = encodeFormData(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`);
  }
  return res.json();
}

function encodeFormData(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(encodeFormData(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // The platform's own Stripe key — set via: supabase secrets set STRIPE_PLATFORM_SECRET_KEY=sk_...
  const stripeKey = Deno.env.get("STRIPE_PLATFORM_SECRET_KEY") ?? "";

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return err("Unauthorized", 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("platform_profiles")
    .select("platform_role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.platform_role !== "super_admin") return err("Forbidden", 403);

  let body: { action?: string; client_id?: string; subscription_id?: string; price_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }

  const { action, client_id, subscription_id } = body;

  // Load subscription row
  let subQuery = admin.from("platform_client_subscriptions").select("*");
  if (client_id) subQuery = subQuery.eq("client_id", client_id);
  else if (subscription_id) subQuery = subQuery.eq("id", subscription_id);
  else return err("client_id or subscription_id required", 400);

  const { data: sub } = await subQuery.maybeSingle() as { data: Record<string, unknown> | null };
  if (!sub) return err("Subscription record not found", 404);

  const subId = sub.id as string;
  const clientId = sub.client_id as string;

  // ── action: create_customer ───────────────────────────────────────────────
  if (action === "create_customer") {
    if (sub.stripe_customer_id) return err("Stripe customer already exists", 400);
    if (!stripeKey) return err("STRIPE_PLATFORM_SECRET_KEY not configured. Set it via: supabase secrets set STRIPE_PLATFORM_SECRET_KEY=sk_...", 400);

    // Load client for name/email
    const { data: client } = await admin
      .from("platform_clients")
      .select("owner_name,owner_email,company_name")
      .eq("id", clientId)
      .maybeSingle() as { data: Record<string, unknown> | null };
    if (!client) return err("Client not found", 404);

    const customer = await stripePost("/customers", {
      email: client.owner_email as string,
      name: (client.company_name as string) ?? (client.owner_name as string),
      metadata: { platform_client_id: clientId },
    }, stripeKey);

    await admin
      .from("platform_client_subscriptions")
      .update({
        stripe_customer_id: customer.id,
        sync_status: "connected",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", subId);

    return ok({ success: true, stripe_customer_id: customer.id });
  }

  // ── action: sync ─────────────────────────────────────────────────────────
  if (!action || action === "sync") {
    const custId = sub.stripe_customer_id as string | null;
    const stripSubId = sub.stripe_subscription_id as string | null;

    if (!custId && !stripSubId) {
      return ok({ status: "not_connected", message: "No Stripe customer or subscription ID. Use create_customer first." });
    }
    if (!stripeKey) return err("STRIPE_PLATFORM_SECRET_KEY not configured", 400);

    const updates: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    };

    if (stripSubId) {
      const stripeSub = await stripeGet(`/subscriptions/${stripSubId}`, stripeKey);
      updates.stripe_subscription_status = stripeSub.status;
      updates.stripe_price_id = stripeSub.items?.data?.[0]?.price?.id ?? sub.stripe_price_id;
      updates.stripe_product_id = stripeSub.items?.data?.[0]?.price?.product ?? sub.stripe_product_id;
      updates.stripe_latest_invoice_id = stripeSub.latest_invoice ?? sub.stripe_latest_invoice_id;
      updates.sync_status = "connected";
      if (stripeSub.current_period_start) {
        updates.current_period_starts_at = new Date(stripeSub.current_period_start * 1000).toISOString();
      }
      if (stripeSub.current_period_end) {
        updates.current_period_ends_at = new Date(stripeSub.current_period_end * 1000).toISOString();
        updates.next_invoice_date = new Date(stripeSub.current_period_end * 1000).toISOString();
      }
      if (stripeSub.trial_end) {
        updates.trial_ends_at = new Date(stripeSub.trial_end * 1000).toISOString();
      }
      // Map Stripe status to local status
      const statusMap: Record<string, string> = {
        active: "active", past_due: "past_due", canceled: "cancelled",
        unpaid: "past_due", trialing: "trial", paused: "suspended",
      };
      if (statusMap[stripeSub.status]) updates.status = statusMap[stripeSub.status];
    } else if (custId) {
      // Just verify customer exists
      await stripeGet(`/customers/${custId}`, stripeKey);
      updates.sync_status = "connected";
    }

    await admin
      .from("platform_client_subscriptions")
      .update(updates)
      .eq("id", subId);

    // Return safe fields only — no payment method data, no secret keys
    return ok({
      success: true,
      sync_status: updates.sync_status ?? "connected",
      stripe_subscription_status: updates.stripe_subscription_status ?? null,
      current_period_ends_at: updates.current_period_ends_at ?? null,
      last_synced_at: updates.last_synced_at,
    });
  }

  // ── action: create_checkout ───────────────────────────────────────────────
  if (action === "create_checkout") {
    const custId = sub.stripe_customer_id as string | null;
    const priceId = (body.price_id as string | null) ?? (sub.stripe_price_id as string | null);

    if (!custId) return err("Stripe customer required. Create customer first.", 400);
    if (!priceId) return err("stripe_price_id required. Save a price ID to the subscription record first.", 400);
    if (!stripeKey) return err("STRIPE_PLATFORM_SECRET_KEY not configured", 400);

    const { data: client } = await admin
      .from("platform_clients")
      .select("owner_email")
      .eq("id", clientId)
      .maybeSingle() as { data: Record<string, unknown> | null };

    const session = await stripePost("/checkout/sessions", {
      mode: "subscription",
      customer: custId,
      customer_email: custId ? undefined : (client?.owner_email as string),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://placeholder.example.com/billing/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://placeholder.example.com/billing/cancel",
      metadata: { platform_client_id: clientId },
    }, stripeKey);

    await admin
      .from("platform_client_subscriptions")
      .update({ stripe_checkout_session_id: session.id, stripe_price_id: priceId })
      .eq("id", subId);

    // Return checkout URL — no secret keys in response
    return ok({ success: true, checkout_url: session.url, session_id: session.id });
  }

  return err(`Unknown action: ${action}`, 400);
});
