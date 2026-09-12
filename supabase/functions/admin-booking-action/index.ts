import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action = "approve" | "confirm" | "decline" | "cancel" | "mark_paid" | "refund";

type RefundMode = "full" | "partial";

// Fire-and-forget notification — email failure must not break admin actions
async function notify(payload: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("[admin-booking-action] notification error:", e));
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn.split("T")[0] + "T00:00:00");
  const b = new Date(checkOut.split("T")[0] + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify caller is allowlisted in admin_users (service-role bypasses RLS)
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return new Response(JSON.stringify({ error: "Forbidden — caller is not an admin user" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as {
      bookingId: string;
      action: Action;
      notes?: string;
      refundMode?: RefundMode;
      refundAmount?: number;
    };

    const { bookingId, action, notes, refundMode, refundAmount } = body;

    if (!bookingId || !action) {
      return new Response(JSON.stringify({ error: "bookingId and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validActions: Action[] = ["approve", "confirm", "decline", "cancel", "mark_paid", "refund"];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id,property_id,guest_name,guest_email,check_in,check_out,guests,pets,amount_total,status,payment_status,amount_paid,refunded_amount,stripe_payment_intent_id,stripe_checkout_session_id,currency")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // ── APPROVE (pending_review → pending_payment via Stripe, or confirmed fallback) ──
    if (action === "approve") {
      if (booking.status !== "pending_review") {
        return new Response(JSON.stringify({ error: `Cannot approve a booking with status: ${booking.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const checkInDate = booking.check_in.split("T")[0];
      const checkOutDate = booking.check_out.split("T")[0];

      // Date conflict checks
      const { data: conflictingBookings } = await supabase
        .from("bookings").select("id")
        .eq("property_id", booking.property_id).eq("status", "confirmed")
        .neq("id", bookingId).lt("check_in", checkOutDate).gt("check_out", checkInDate);
      if (conflictingBookings && conflictingBookings.length > 0) {
        return new Response(JSON.stringify({ error: "This booking can no longer be approved because the dates are no longer available." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ownerBlockConflicts } = await supabase
        .from("owner_blocks").select("id").eq("property_id", booking.property_id)
        .lt("start_date", checkOutDate).gt("end_date", checkInDate);
      if (ownerBlockConflicts && ownerBlockConflicts.length > 0) {
        return new Response(JSON.stringify({ error: "This booking can no longer be approved because the dates are no longer available." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to create Stripe checkout session for this existing booking
      let checkoutUrl: string | null = null;
      let stripeUnconfigured = false;
      try {
        const checkoutRes = await fetch(
          `${SUPABASE_URL}/functions/v1/create-checkout-session-for-booking`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ booking_id: bookingId }),
          },
        );
        if (checkoutRes.ok) {
          const checkoutData = await checkoutRes.json();
          checkoutUrl = checkoutData.checkout_url ?? null;
        } else {
          const errData = await checkoutRes.json().catch(() => ({}));
          const errCode = errData?.code ?? "";
          if (errCode === "MANUAL_MODE" || errCode === "STRIPE_NOT_CONFIGURED") {
            // Stripe intentionally not set up — silent fallback to manual confirm
            stripeUnconfigured = true;
            console.log("[admin-booking-action] Stripe not configured, using manual confirm fallback");
          } else {
            // Stripe is configured but session creation failed — surface to admin
            console.error("[admin-booking-action] Stripe checkout failed:", errData?.error ?? errCode);
            return new Response(JSON.stringify({
              error: `Payment link could not be created: ${errData?.error ?? errData?.stripe_error ?? "Stripe error"}. Approval email was not sent.`,
              code: "CHECKOUT_FAILED",
            }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) {
        console.error("[admin-booking-action] payment link creation failed:", e);
        return new Response(JSON.stringify({
          error: "Payment link could not be created (network error). Approval email was not sent.",
          code: "CHECKOUT_FAILED",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (checkoutUrl) {
        // Stripe configured — booking already set to pending_payment by checkout function
        notify({
          type: "booking_request_approved",
          bookingId,
          propertyId: booking.property_id,
          guestName: booking.guest_name,
          guestEmail: booking.guest_email,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights: nightsBetween(booking.check_in, booking.check_out),
          guests: booking.guests,
          pets: booking.pets ?? 0,
          totalPrice: (booking.amount_total ?? 0) / 100,
          paymentStatus: "pending",
          paymentUrl: checkoutUrl,
        });
        return new Response(JSON.stringify({ ok: true, action: "approved", bookingId, hasPaymentLink: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stripe not configured — fall back to manual confirm: block dates, set confirmed
      const datesToBlock: { property_id: string; date: string; source: string; booking_id: string }[] = [];
      const [y1, m1, d1] = checkInDate.split("-").map(Number);
      const [y2, m2, d2] = checkOutDate.split("-").map(Number);
      const start = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);
      const cur = new Date(start);
      while (cur < end) {
        datesToBlock.push({
          property_id: booking.property_id,
          date: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
          source: "booking", booking_id: booking.id,
        });
        cur.setDate(cur.getDate() + 1);
      }
      if (datesToBlock.length > 0) {
        const { error: blockError } = await supabase.from("blocked_dates")
          .upsert(datesToBlock, { onConflict: "property_id,date" });
        if (blockError?.code === "23505") {
          return new Response(JSON.stringify({ error: "This booking can no longer be approved because the dates are no longer available." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      await supabase.from("cleaning_tasks").insert({
        property_id: booking.property_id, booking_id: booking.id,
        task_date: checkOutDate, checkout_date: checkOutDate,
        assigned_to: "", status: "needed",
        notes: `Auto-created for booking by ${booking.guest_name}`,
      });
      await supabase.from("bookings").update({
        status: "confirmed", confirmed_at: now, updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      notify({
        type: "booking_request_approved",
        bookingId,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nightsBetween(booking.check_in, booking.check_out),
        guests: booking.guests,
        pets: booking.pets ?? 0,
        totalPrice: (booking.amount_total ?? 0) / 100,
        paymentStatus: booking.payment_status ?? "pending",
      });

      return new Response(JSON.stringify({ ok: true, action: "approved", bookingId, hasPaymentLink: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CONFIRM ───────────────────────────────────────────────────────────────
    if (action === "confirm") {
      if (!["pending_review", "pending_payment", "pending"].includes(booking.status)) {
        return new Response(JSON.stringify({ error: `Cannot confirm a booking with status: ${booking.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const checkInDate = booking.check_in.split("T")[0];
      const checkOutDate = booking.check_out.split("T")[0];

      const { data: conflictingBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("property_id", booking.property_id)
        .eq("status", "confirmed")
        .neq("id", bookingId)
        .lt("check_in", checkOutDate)
        .gt("check_out", checkInDate);

      if (conflictingBookings && conflictingBookings.length > 0) {
        return new Response(JSON.stringify({
          error: "This booking can no longer be confirmed because the dates are no longer available.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: ownerBlockConflicts } = await supabase
        .from("owner_blocks")
        .select("id")
        .eq("property_id", booking.property_id)
        .lt("start_date", checkOutDate)
        .gt("end_date", checkInDate);

      if (ownerBlockConflicts && ownerBlockConflicts.length > 0) {
        return new Response(JSON.stringify({
          error: "This booking can no longer be confirmed because the dates are no longer available.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: blockedConflicts } = await supabase
        .from("blocked_dates")
        .select("date")
        .eq("property_id", booking.property_id)
        .neq("booking_id", bookingId)
        .gte("date", checkInDate)
        .lt("date", checkOutDate);

      if (blockedConflicts && blockedConflicts.length > 0) {
        return new Response(JSON.stringify({
          error: "This booking can no longer be confirmed because the dates are no longer available.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const datesToBlock: { property_id: string; date: string; source: string; booking_id: string }[] = [];
      const [y1, m1, d1] = checkInDate.split("-").map(Number);
      const [y2, m2, d2] = checkOutDate.split("-").map(Number);
      const start = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);
      const cur = new Date(start);
      while (cur < end) {
        datesToBlock.push({
          property_id: booking.property_id,
          date: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
          source: "booking",
          booking_id: booking.id,
        });
        cur.setDate(cur.getDate() + 1);
      }

      if (datesToBlock.length > 0) {
        const { error: blockError } = await supabase
          .from("blocked_dates")
          .upsert(datesToBlock, { onConflict: "property_id,date" });
        if (blockError) {
          console.error("Failed to block dates:", blockError);
          if (blockError.code === "23505") {
            return new Response(JSON.stringify({
              error: "This booking can no longer be confirmed because the dates are no longer available.",
            }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ error: "Failed to block dates for booking" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await supabase.from("cleaning_tasks").insert({
        property_id: booking.property_id,
        booking_id: booking.id,
        task_date: checkOutDate,
        checkout_date: checkOutDate,
        assigned_to: "",
        status: "needed",
        notes: `Auto-created for booking by ${booking.guest_name}`,
      });

      await supabase.from("bookings").update({
        status: "confirmed",
        confirmed_at: now,
        updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      // Fire-and-forget approved email (manual approval — payment NOT collected)
      notify({
        type: "booking_request_approved",
        bookingId,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nightsBetween(booking.check_in, booking.check_out),
        guests: booking.guests,
        pets: booking.pets ?? 0,
        totalPrice: (booking.amount_total ?? 0) / 100,
        paymentStatus: booking.payment_status ?? "pending",
      });

      return new Response(JSON.stringify({ ok: true, action: "confirmed", bookingId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DECLINE ───────────────────────────────────────────────────────────────
    if (action === "decline") {
      if (!["pending_review", "pending_payment", "pending"].includes(booking.status)) {
        return new Response(JSON.stringify({ error: `Cannot decline a booking with status: ${booking.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Release any booking-created blocked_dates so dates become available again
      await supabase
        .from("blocked_dates")
        .delete()
        .eq("property_id", booking.property_id)
        .eq("booking_id", bookingId)
        .eq("source", "booking");

      await supabase.from("bookings").update({
        status: "declined",
        declined_at: now,
        updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      // Fire-and-forget declined email (request not approved — no payment was collected)
      notify({
        type: "booking_request_declined",
        bookingId,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: booking.check_in.split("T")[0],
        checkOut: booking.check_out.split("T")[0],
      });

      return new Response(JSON.stringify({ ok: true, action: "declined", bookingId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (["cancelled", "declined", "expired"].includes(booking.status)) {
        return new Response(JSON.stringify({ error: `Booking is already ${booking.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("blocked_dates")
        .delete()
        .eq("property_id", booking.property_id)
        .eq("booking_id", bookingId)
        .eq("source", "booking");

      await supabase
        .from("cleaning_tasks")
        .update({ status: "skipped", updated_at: now })
        .eq("booking_id", bookingId)
        .neq("status", "completed");

      await supabase.from("bookings").update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      // Fire-and-forget cancellation email
      notify({
        type: "booking_cancelled",
        bookingId,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: booking.check_in.split("T")[0],
        checkOut: booking.check_out.split("T")[0],
      });

      return new Response(JSON.stringify({ ok: true, action: "cancelled", bookingId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MARK PAID ─────────────────────────────────────────────────────────────
    if (action === "mark_paid") {
      await supabase.from("bookings").update({
        payment_status: "paid",
        payment_method: "manual",
        amount_paid: booking.amount_total ?? 0,
        paid_at: now,
        updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      return new Response(JSON.stringify({ ok: true, action: "mark_paid", bookingId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REFUND ────────────────────────────────────────────────────────────────
    if (action === "refund") {
      const paymentIntentId = booking.stripe_payment_intent_id;
      if (!paymentIntentId) {
        return new Response(JSON.stringify({ error: "This booking has no Stripe PaymentIntent and cannot be refunded via Stripe." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = booking.amount_paid ?? 0;
      const alreadyRefunded = booking.refunded_amount ?? 0;
      const remainingRefundable = amountPaid - alreadyRefunded;

      if (remainingRefundable <= 0) {
        return new Response(JSON.stringify({ error: "This booking has no refundable amount remaining." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let refundAmountCents: number;
      if (refundMode === "full") {
        refundAmountCents = remainingRefundable;
      } else if (refundMode === "partial") {
        if (!refundAmount || refundAmount <= 0) {
          return new Response(JSON.stringify({ error: "Refund amount must be greater than zero." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (refundAmount > remainingRefundable) {
          return new Response(JSON.stringify({ error: `Refund amount (${(refundAmount / 100).toFixed(2)}) exceeds remaining refundable amount (${(remainingRefundable / 100).toFixed(2)}).` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        refundAmountCents = refundAmount;
      } else {
        return new Response(JSON.stringify({ error: "refundMode is required (\"full\" or \"partial\")" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine whether the original payment was test or live by checking
      // the stored payment_events event_payload for this booking.
      // Do NOT rely on the current payment_mode setting — it may have changed.
      const { data: paymentEvent } = await supabase
        .from("payment_events")
        .select("event_payload")
        .eq("booking_id", bookingId)
        .eq("event_type", "checkout.session.completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const eventPayload = paymentEvent?.event_payload as Record<string, unknown> | null;
      const isLiveMode = eventPayload?.livemode === true;

      const vaultKeyName = isLiveMode ? "stripe_live_secret_key" : "stripe_test_secret_key";
      const requiredPrefix = isLiveMode ? "sk_live_" : "sk_test_";

      const { data: vaultKey } = await supabase.rpc("payment_settings_get_secret", { p_name: vaultKeyName });
      const secretKey = (typeof vaultKey === "string" && vaultKey.startsWith(requiredPrefix)) ? vaultKey : "";
      if (!secretKey) {
        return new Response(JSON.stringify({ error: `Stripe ${isLiveMode ? "live" : "test"} secret key is not configured. Cannot issue refund.` }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call Stripe Refunds API
      const refundBody: Record<string, unknown> = {
        payment_intent: paymentIntentId,
        amount: String(refundAmountCents),
      };

      const formBody = Object.entries(refundBody)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");

      const stripeRes = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody,
      });

      const stripeData = await stripeRes.json();

      if (!stripeRes.ok) {
        console.error("[admin-booking-action] Stripe refund error:", stripeData);
        return new Response(JSON.stringify({
          error: `Stripe refund failed: ${stripeData?.error?.message ?? "Unknown Stripe error"}`,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newRefundedAmount = alreadyRefunded + refundAmountCents;
      const isFullyRefunded = newRefundedAmount >= amountPaid;

      await supabase.from("bookings").update({
        refunded_amount: newRefundedAmount,
        refunded_at: now,
        payment_status: isFullyRefunded ? "refunded" : "partially_refunded",
        updated_at: now,
        ...(notes ? { payment_notes: notes } : {}),
      }).eq("id", bookingId);

      const refundType = refundMode === "full" ? "Full Refund" : "Partial Refund";

      notify({
        type: "booking_refunded",
        bookingId,
        propertyId: booking.property_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        checkIn: booking.check_in.split("T")[0],
        checkOut: booking.check_out.split("T")[0],
        refundAmount: refundAmountCents / 100,
        totalRefunded: newRefundedAmount / 100,
        remainingAmount: (amountPaid - newRefundedAmount) / 100,
        refundType,
      });

      return new Response(JSON.stringify({
        ok: true,
        action: "refunded",
        bookingId,
        refundAmount: refundAmountCents,
        totalRefunded: newRefundedAmount,
        fullyRefunded: isFullyRefunded,
        stripeRefundId: stripeData.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unhandled action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-booking-action error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
