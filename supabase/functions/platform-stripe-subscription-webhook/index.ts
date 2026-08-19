import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Platform SaaS subscription webhook — handles Stripe events for platform billing ONLY.
// Does NOT process guest booking payments. Those are handled by stripe-webhook.
// Requires: STRIPE_PLATFORM_WEBHOOK_SECRET set via Supabase secrets.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLATFORM_WEBHOOK_SECRET = Deno.env.get("STRIPE_PLATFORM_WEBHOOK_SECRET") ?? "";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

const STATUS_MAP: Record<string, string> = {
  trialing:           "trial",
  active:             "active",
  past_due:           "past_due",
  unpaid:             "past_due",
  canceled:           "cancelled",
  incomplete_expired: "expired",
  paused:             "suspended",
};

// ── Stripe signature verification (same algorithm as guest webhook) ───────────

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) return false;
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === signature;
  } catch {
    return false;
  }
}

function ok200() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // If webhook secret not configured → log and return 200 (misconfiguration, don't retry)
  if (!PLATFORM_WEBHOOK_SECRET) {
    console.warn("STRIPE_PLATFORM_WEBHOOK_SECRET not set — skipping signature verification");
    return ok200();
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, PLATFORM_WEBHOOK_SECRET);
  if (!valid) return fail("Invalid signature", 401);

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return fail("Invalid JSON", 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  // ── Idempotency check ──────────────────────────────────────────────────────

  const { data: existing } = await admin
    .from("platform_stripe_webhook_events")
    .select("id,processed_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return ok200(); // Already processed or skipped — safe to acknowledge
  }

  // ── Skip unhandled event types ─────────────────────────────────────────────

  if (!HANDLED_EVENTS.has(event.type)) {
    await admin.from("platform_stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed_status: "skipped",
      processed_at: now,
    });
    return ok200();
  }

  const obj = event.data.object;
  let subRow: Record<string, unknown> | null = null;

  // ── Locate matching platform_client_subscriptions row ─────────────────────

  if (event.type === "checkout.session.completed") {
    // Match by stripe_checkout_session_id
    const sessionId = obj["id"] as string;
    const { data } = await admin
      .from("platform_client_subscriptions")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    subRow = data;

    // If found, also pull the subscription ID from the session object
    if (subRow && obj["subscription"]) {
      await admin
        .from("platform_client_subscriptions")
        .update({
          stripe_subscription_id: obj["subscription"] as string,
          stripe_customer_id: obj["customer"] as string ?? subRow.stripe_customer_id,
          sync_status: "connected",
          last_synced_at: now,
        })
        .eq("id", subRow.id as string);
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    const stripSubId = obj["id"] as string;
    const custId = obj["customer"] as string;
    // Try by subscription ID first, then customer ID
    let res = await admin.from("platform_client_subscriptions").select("*").eq("stripe_subscription_id", stripSubId).maybeSingle();
    if (!res.data && custId) {
      res = await admin.from("platform_client_subscriptions").select("*").eq("stripe_customer_id", custId).maybeSingle();
    }
    subRow = res.data;
  } else if (event.type.startsWith("invoice.")) {
    const custId = obj["customer"] as string;
    const stripSubId = obj["subscription"] as string | undefined;
    let res = stripSubId
      ? await admin.from("platform_client_subscriptions").select("*").eq("stripe_subscription_id", stripSubId).maybeSingle()
      : { data: null };
    if (!res.data && custId) {
      res = await admin.from("platform_client_subscriptions").select("*").eq("stripe_customer_id", custId).maybeSingle();
    }
    subRow = res.data;
  }

  // ── No match — log as skipped, return 200 (don't create random records) ────

  if (!subRow) {
    await admin.from("platform_stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed_status: "skipped",
      error_message: "No matching platform_client_subscriptions row found",
      processed_at: now,
    });
    return ok200();
  }

  const subId = subRow.id as string;
  const clientId = subRow.client_id as string;

  // ── Build update payload ───────────────────────────────────────────────────

  const updates: Record<string, unknown> = {
    last_synced_at: now,
    sync_status: "connected",
    sync_error: null,
  };

  let processedStatus: "processed" | "skipped" | "failed" = "processed";
  let errorMessage: string | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Sub ID already saved above in the special block; just mark connected
        updates.sync_status = "connected";
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeStatus = obj["status"] as string;
        if (STATUS_MAP[stripeStatus]) updates.status = STATUS_MAP[stripeStatus];
        updates.stripe_subscription_id = obj["id"] as string;
        updates.stripe_customer_id = obj["customer"] as string;
        updates.stripe_subscription_status = stripeStatus;
        const items = (obj["items"] as { data: { price: { id: string; product: string } }[] } | undefined)?.data;
        if (items?.[0]) {
          updates.stripe_price_id = items[0].price?.id;
          updates.stripe_product_id = items[0].price?.product;
        }
        const periodStart = obj["current_period_start"] as number | undefined;
        const periodEnd = obj["current_period_end"] as number | undefined;
        if (periodStart) updates.current_period_starts_at = new Date(periodStart * 1000).toISOString();
        if (periodEnd) {
          updates.current_period_ends_at = new Date(periodEnd * 1000).toISOString();
          updates.next_invoice_date = new Date(periodEnd * 1000).toISOString();
        }
        const trialEnd = obj["trial_end"] as number | undefined;
        if (trialEnd) updates.trial_ends_at = new Date(trialEnd * 1000).toISOString();
        const latestInvoice = obj["latest_invoice"] as string | undefined;
        if (latestInvoice) updates.stripe_latest_invoice_id = latestInvoice;
        break;
      }

      case "customer.subscription.deleted": {
        updates.status = "cancelled";
        updates.stripe_subscription_status = "canceled";
        break;
      }

      case "invoice.payment_succeeded": {
        updates.stripe_latest_invoice_id = obj["id"] as string;
        // Period dates may be on the subscription object within invoice lines
        const periodEnd = obj["period_end"] as number | undefined;
        if (periodEnd) {
          updates.current_period_ends_at = new Date(periodEnd * 1000).toISOString();
          updates.next_invoice_date = new Date(periodEnd * 1000).toISOString();
        }
        const periodStart = obj["period_start"] as number | undefined;
        if (periodStart) updates.current_period_starts_at = new Date(periodStart * 1000).toISOString();
        break;
      }

      case "invoice.payment_failed": {
        updates.status = "past_due";
        updates.stripe_subscription_status = "past_due";
        updates.sync_error = "Payment failed";
        updates.sync_status = "sync_failed";
        errorMessage = "invoice.payment_failed received";
        break;
      }
    }

    await admin
      .from("platform_client_subscriptions")
      .update(updates)
      .eq("id", subId);

    // ── Instance access sync ───────────────────────────────────────────────
    // Update last_billing_status on all instances for this client.
    // Enforce access_status changes conservatively based on billing_enforcement_mode.

    const newBillingStatus = updates.status as string | undefined;
    if (newBillingStatus) {
      // Fetch all instances for this client
      const { data: instances } = await admin
        .from("platform_instances")
        .select("id,access_status,billing_enforcement_mode,last_billing_status")
        .eq("client_id", clientId);

      for (const inst of (instances ?? [])) {
        const mode = inst.billing_enforcement_mode as string;
        const currentAccess = inst.access_status as string;

        const instUpdates: Record<string, unknown> = {
          last_billing_status: newBillingStatus,
          billing_status_synced_at: now,
        };

        let newAccessStatus: string | null = null;
        let eventType: string | null = null;

        if (newBillingStatus === "past_due") {
          // Any enforcement mode >= automatic_warning_only → set warning (unless already worse)
          if (mode !== "manual" && !["suspended", "cancelled"].includes(currentAccess)) {
            newAccessStatus = "warning";
            eventType = "billing_warning";
          }
        } else if (newBillingStatus === "active" || newBillingStatus === "trial") {
          // Only restore if mode is automatic_suspend and not manually suspended/cancelled
          if (mode === "automatic_suspend" && currentAccess === "warning") {
            newAccessStatus = "active";
            eventType = "restored";
          }
        } else if (newBillingStatus === "suspended") {
          if (mode === "automatic_suspend" && !["suspended", "cancelled"].includes(currentAccess)) {
            newAccessStatus = "suspended";
            eventType = "suspended";
          }
        } else if (newBillingStatus === "cancelled") {
          if (mode === "automatic_suspend" && currentAccess !== "cancelled") {
            newAccessStatus = "cancelled";
            eventType = "cancelled";
          }
        }

        if (newAccessStatus && newAccessStatus !== currentAccess) {
          instUpdates.access_status = newAccessStatus;
          instUpdates.access_reason = `Billing status changed to ${newBillingStatus} via Stripe webhook`;
          instUpdates.access_updated_at = now;
          instUpdates.access_updated_by = "stripe_webhook";
        }

        await admin.from("platform_instances").update(instUpdates).eq("id", inst.id as string);

        if (newAccessStatus && newAccessStatus !== currentAccess && eventType) {
          await admin.from("platform_instance_access_events").insert({
            client_id: clientId,
            instance_id: inst.id as string,
            subscription_id: subId,
            event_type: eventType,
            previous_access_status: currentAccess,
            new_access_status: newAccessStatus,
            reason: `Billing status: ${newBillingStatus}`,
            created_by: "stripe_webhook",
          });
        }
      }
    }

  } catch (e) {
    processedStatus = "failed";
    errorMessage = (e as Error).message;
    console.error(`platform-stripe-webhook error processing ${event.type}:`, e);
  }

  // ── Log event ─────────────────────────────────────────────────────────────

  await admin.from("platform_stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    processed_status: processedStatus,
    related_client_id: clientId,
    related_subscription_id: subId,
    error_message: errorMessage,
    processed_at: now,
  });

  return ok200();
});
