import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Webhook secret is loaded from Supabase Vault via payment_settings.
// Falls back to STRIPE_WEBHOOK_SECRET env var if vault has no entry.
// Signature must be verified before any DB operation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function notify(payload: Record<string, unknown>): Promise<void> {
  const url = `${SUPABASE_URL}/functions/v1/send-notifications`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("Notification error:", e));
}

type SupabaseClient = ReturnType<typeof createClient>;

async function hasDateConflict(
  supabase: SupabaseClient,
  bookingId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const { data: confirmedConflicts } = await supabase
    .from("bookings")
    .select("id")
    .eq("property_id", propertyId)
    .eq("status", "confirmed")
    .neq("id", bookingId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (confirmedConflicts && confirmedConflicts.length > 0) return true;

  const now = new Date().toISOString();
  const { data: pendingConflicts } = await supabase
    .from("bookings")
    .select("id, payment_expires_at")
    .eq("property_id", propertyId)
    .eq("status", "pending_payment")
    .neq("id", bookingId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if ((pendingConflicts ?? []).some((r) => !r.payment_expires_at || r.payment_expires_at > now)) {
    return true;
  }

  const checkInDate = checkIn.split("T")[0];
  const checkOutDate = checkOut.split("T")[0];
  const { data: ownerBlocks } = await supabase
    .from("owner_blocks")
    .select("id")
    .eq("property_id", propertyId)
    .lt("start_date", checkOutDate)
    .gt("end_date", checkInDate);

  if (ownerBlocks && ownerBlocks.length > 0) return true;

  const { data: foreignBlocked } = await supabase
    .from("blocked_dates")
    .select("date")
    .eq("property_id", propertyId)
    .gte("date", checkInDate)
    .lt("date", checkOutDate)
    .neq("booking_id", bookingId);

  if (foreignBlocked && foreignBlocked.length > 0) return true;

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    // Load both test and live webhook secrets from vault, then fall back to env var.
    // The webhook doesn't know which mode sent the event, so we try both.
    const [testWhRes, liveWhRes] = await Promise.all([
      supabase.rpc("payment_settings_get_secret", { p_name: "stripe_webhook_secret" }),
      supabase.rpc("payment_settings_get_secret", { p_name: "stripe_live_webhook_secret" }),
    ]);
    const testWhSecret = (typeof testWhRes.data === "string" && testWhRes.data.length > 0)
      ? testWhRes.data
      : (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "");
    const liveWhSecret = (typeof liveWhRes.data === "string" && liveWhRes.data.length > 0)
      ? liveWhRes.data
      : "";

    if (!testWhSecret && !liveWhSecret) {
      console.error("No webhook secret configured in vault or env");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Verify signature: try test secret first, then live secret
    let valid = false;
    let usedSecret = "";
    if (testWhSecret) {
      valid = await verifyStripeSignature(rawBody, sigHeader, testWhSecret);
      if (valid) usedSecret = "test";
    }
    if (!valid && liveWhSecret) {
      valid = await verifyStripeSignature(rawBody, sigHeader, liveWhSecret);
      if (valid) usedSecret = "live";
    }

    if (!valid) {
      console.error("Invalid Stripe signature (tried both test and live secrets)");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      livemode: boolean;
      data: { object: Record<string, unknown> };
    };

    // Enforce livemode consistency: a test-secret-verified event must be
    // livemode=false, and a live-secret-verified event must be livemode=true.
    // Reject any mismatch before touching the database.
    if (usedSecret === "test" && event.livemode !== false) {
      console.error("Webhook: test secret verified but event.livemode is not false — rejecting");
      return new Response("Livemode mismatch", { status: 400 });
    }
    if (usedSecret === "live" && event.livemode !== true) {
      console.error("Webhook: live secret verified but event.livemode is not true — rejecting");
      return new Response("Livemode mismatch", { status: 400 });
    }

    // Idempotency: log event, skip if already processed
    const { error: eventInsertError } = await supabase.from("payment_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      event_payload: event.data.object,
    });

    if (eventInsertError?.code === "23505") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = event.data.object as Record<string, unknown>;

    // ── checkout.session.completed ────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const sessionId = session["id"] as string;
      const paymentIntentId = session["payment_intent"] as string | null;
      const customerId = session["customer"] as string | null;
      const sessionAmountTotal = session["amount_total"] as number | null;
      const sessionPaymentStatus = session["payment_status"] as string | null;
      const metadata = (session["metadata"] as Record<string, string>) ?? {};

      const { data: booking } = await supabase
        .from("bookings")
        .select("id,status,payment_status,guest_name,guest_email,guest_phone,check_in,check_out,guests,pets,amount_total,property_id")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();

      if (!booking) {
        console.error("Webhook: no booking found for session:", sessionId);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      await supabase.from("payment_events")
        .update({ booking_id: booking.id })
        .eq("stripe_event_id", event.id);

      // Guard 1: booking must still be pending_payment / pending
      if (booking.status !== "pending_payment" || booking.payment_status !== "pending") {
        console.warn(
          `Webhook: booking ${booking.id} is ${booking.status}/${booking.payment_status}, ` +
          "not pending_payment/pending — skipping confirm.",
        );
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      await supabase.from("bookings").update({
        stripe_payment_intent_id: paymentIntentId ?? null,
        stripe_customer_id: customerId ?? null,
        paid_at: new Date().toISOString(),
      }).eq("id", booking.id);

      // Guard 2: amount must match
      if (
        sessionAmountTotal != null &&
        booking.amount_total != null &&
        sessionAmountTotal !== booking.amount_total
      ) {
        console.error(
          `Webhook: amount mismatch for booking ${booking.id} — ` +
          `session=${sessionAmountTotal} booking=${booking.amount_total}. Flagging payment_conflict.`,
        );
        await supabase.from("bookings").update({
          status: "payment_conflict",
          payment_status: sessionPaymentStatus === "paid" ? "paid" : "pending",
          amount_paid: sessionAmountTotal,
        }).eq("id", booking.id);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      const propertyId = metadata["property_id"] ?? booking.property_id;
      const ciDate = new Date(booking.check_in);
      const coDate = new Date(booking.check_out);

      // Guard 3: re-check date conflicts
      const conflict = await hasDateConflict(
        supabase, booking.id, propertyId, booking.check_in, booking.check_out,
      );

      if (conflict) {
        console.error(
          `Webhook: date conflict detected for booking ${booking.id} ` +
          `(${booking.check_in} – ${booking.check_out}). ` +
          "Payment received but dates unavailable. Flagging payment_conflict.",
        );
        await supabase.from("bookings").update({
          status: "payment_conflict",
          payment_status: sessionPaymentStatus === "paid" ? "paid" : "pending",
          amount_paid: sessionAmountTotal ?? booking.amount_total ?? 0,
        }).eq("id", booking.id);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Step 1: Insert blocked_dates — do NOT upsert over another booking
      const blockedRows: { property_id: string; date: string; source: string; booking_id: string }[] = [];
      const cur = new Date(ciDate);
      while (cur < coDate) {
        blockedRows.push({
          property_id: propertyId,
          date: cur.toISOString().split("T")[0],
          source: "booking",
          booking_id: booking.id,
        });
        cur.setDate(cur.getDate() + 1);
      }

      let blockedInsertFailed = false;
      if (blockedRows.length > 0) {
        const { error: blockedErr } = await supabase
          .from("blocked_dates")
          .insert(blockedRows);

        if (blockedErr) {
          if (blockedErr.code === "23505") {
            console.error(
              `Webhook: blocked_dates insert 23505 for booking ${booking.id} — ` +
              "dates already held by another booking. Flagging payment_conflict.",
            );
          } else {
            console.error(`Webhook: blocked_dates insert error for booking ${booking.id}:`, blockedErr);
          }
          blockedInsertFailed = true;
        }
      }

      if (blockedInsertFailed) {
        await supabase.from("bookings").update({
          status: "payment_conflict",
          payment_status: sessionPaymentStatus === "paid" ? "paid" : "pending",
          amount_paid: sessionAmountTotal ?? booking.amount_total ?? 0,
        }).eq("id", booking.id);
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Step 2: Confirm booking (blocked_dates already written)
      await supabase.from("bookings").update({
        status: "confirmed",
        payment_status: "paid",
        payment_method: "stripe",
        amount_paid: sessionAmountTotal ?? booking.amount_total ?? 0,
        confirmed_at: new Date().toISOString(),
      }).eq("id", booking.id);

      // Step 3: Create cleaning task
      const checkoutDateStr = booking.check_out.split("T")[0];
      await supabase.from("cleaning_tasks").insert({
        property_id: propertyId,
        booking_id: booking.id,
        task_date: checkoutDateStr,
        checkout_date: checkoutDateStr,
        assigned_to: "",
        status: "needed",
        notes: `Auto-created for booking by ${booking.guest_name}`,
      });

      // Step 4: Send confirmation notification
      const nights = Math.round((coDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
      await notify({
        type: "booking_confirmed",
        bookingId: booking.id,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestPhone: booking.guest_phone ?? undefined,
        checkIn: booking.check_in.split("T")[0],
        checkOut: booking.check_out.split("T")[0],
        nights,
        guests: booking.guests,
        pets: booking.pets ?? 0,
        totalPrice: (sessionAmountTotal ?? booking.amount_total ?? 0) / 100,
      });
    }

    // ── checkout.session.expired ──────────────────────────────────────────────
    if (event.type === "checkout.session.expired") {
      const sessionId = session["id"] as string;

      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();

      if (booking) {
        await supabase.from("payment_events")
          .update({ booking_id: booking.id })
          .eq("stripe_event_id", event.id);

        if (booking.status === "pending_payment") {
          await supabase.from("bookings").update({
            status: "expired",
            payment_status: "expired",
          }).eq("id", booking.id);
        }
      }
    }

    // ── payment_intent.payment_failed ─────────────────────────────────────────
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntentId = session["id"] as string;

      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (booking) {
        await supabase.from("payment_events")
          .update({ booking_id: booking.id })
          .eq("stripe_event_id", event.id);

        if (booking.status === "pending_payment") {
          await supabase.from("bookings").update({
            status: "payment_failed",
            payment_status: "failed",
          }).eq("id", booking.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
