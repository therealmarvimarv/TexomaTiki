import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action = "approve" | "confirm" | "decline" | "cancel" | "mark_paid";

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

  try {
    const body = await req.json() as {
      bookingId: string;
      action: Action;
      notes?: string;
    };

    const { bookingId, action, notes } = body;

    if (!bookingId || !action) {
      return new Response(JSON.stringify({ error: "bookingId and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validActions: Action[] = ["approve", "confirm", "decline", "cancel", "mark_paid"];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id,property_id,guest_name,guest_email,check_in,check_out,guests,pets,amount_total,status,payment_status")
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
