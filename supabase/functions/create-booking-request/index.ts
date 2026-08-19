import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Parse YYYY-MM-DD directly without Date object to avoid timezone issues
function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function dayOfWeekFromDateStr(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(year, month - 1, day).getDay();
}

function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(year, month - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface DowRate { day_of_week: number; rate: number }
interface DateOverride { date: string; rate: number }
interface SeasonalPreset { start_date: string; end_date: string; nightly_rate: number; min_nights: number | null; priority: number; is_active: boolean }
interface DbFee { name: string; fee_type: string; amount: number; applies_after_guests: number | null; apply_to_guest_quote: boolean; is_standard: boolean }

function resolveNightlyRate(
  dateStr: string,
  basePrice: number,
  dowRates: DowRate[],
  dateOverrides: DateOverride[],
  seasonalPresets: SeasonalPreset[],
): number {
  const override = dateOverrides.find((o) => o.date === dateStr);
  if (override) return override.rate;

  const matchingPresets = seasonalPresets.filter(
    (p) => p.is_active && compareDates(dateStr, p.start_date) >= 0 && compareDates(dateStr, p.end_date) <= 0
  );
  if (matchingPresets.length > 0) {
    const best = matchingPresets.reduce((a, b) => (b.priority > a.priority ? b : a));
    return Number(best.nightly_rate);
  }

  const dow = dayOfWeekFromDateStr(dateStr);
  const dowRate = dowRates.find((r) => r.day_of_week === dow);
  if (dowRate) return Number(dowRate.rate);

  return basePrice;
}

// Fire-and-forget notification — email failure must not break booking creation
async function notifyBookingRequest(payload: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("[create-booking-request] notification error:", e));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json() as Record<string, unknown>;

    // Accept both camelCase (frontend) and snake_case (direct API) payloads
    const propertyId = (body.propertyId ?? body.property_id) as string | undefined;
    const checkIn = (body.checkIn ?? body.check_in) as string | undefined;
    const checkOut = (body.checkOut ?? body.check_out) as string | undefined;
    const guests = body.guests as number | undefined;
    const pets = (body.pets as number | undefined) ?? 0;
    const guestName = (body.guestName ?? body.guest_name) as string | undefined;
    const guestEmail = (body.guestEmail ?? body.guest_email) as string | undefined;
    const guestPhone = (body.guestPhone ?? body.guest_phone) as string | undefined;
    const specialRequests = (body.specialRequests ?? body.special_requests) as string | undefined;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!propertyId || !checkIn || !checkOut || !guests || !guestName || !guestEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
      return new Response(JSON.stringify({ error: "Dates must be YYYY-MM-DD format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (compareDates(checkOut, checkIn) <= 0) {
      return new Response(JSON.stringify({ error: "Check-out must be after check-in" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nights = nightsBetween(checkIn, checkOut);

    // ── Load property ─────────────────────────────────────────────────────────
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id,base_price,tax_rate,max_guests,min_nights,max_nights,min_notice_days,max_advance_days,deposit_percentage,is_active")
      .eq("id", propertyId)
      .maybeSingle();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!property.is_active) {
      return new Response(JSON.stringify({ error: "Property is not available for booking" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Business rule validation ──────────────────────────────────────────────
    const todayStr = new Date().toISOString().split("T")[0];
    const minCheckIn = addDays(todayStr, property.min_notice_days ?? 1);
    if (compareDates(checkIn, minCheckIn) < 0) {
      return new Response(JSON.stringify({
        error: `Bookings require at least ${property.min_notice_days ?? 1} day(s) notice. Earliest available check-in: ${minCheckIn}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const maxCheckIn = addDays(todayStr, property.max_advance_days ?? 180);
    if (compareDates(checkIn, maxCheckIn) > 0) {
      return new Response(JSON.stringify({
        error: `Bookings can only be made up to ${property.max_advance_days ?? 180} days in advance`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const minNights = property.min_nights ?? 1;
    if (nights < minNights) {
      return new Response(JSON.stringify({ error: `Minimum stay is ${minNights} night(s)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxNights = property.max_nights ?? 0;
    if (maxNights > 0 && nights > maxNights) {
      return new Response(JSON.stringify({ error: `Maximum stay is ${maxNights} night(s)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (guests < 1 || guests > (property.max_guests ?? 99)) {
      return new Response(JSON.stringify({ error: `Guest count must be between 1 and ${property.max_guests}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Availability check ────────────────────────────────────────────────────
    const { data: blockedRows } = await supabase
      .from("blocked_dates")
      .select("date")
      .eq("property_id", propertyId)
      .gte("date", checkIn)
      .lt("date", checkOut);

    if (blockedRows && blockedRows.length > 0) {
      return new Response(JSON.stringify({ error: "Selected dates are not available" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: overlappingBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending_review"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);

    if (overlappingBookings && overlappingBookings.length > 0) {
      return new Response(JSON.stringify({ error: "Selected dates are not available" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ownerBlockRows } = await supabase
      .from("owner_blocks")
      .select("id")
      .eq("property_id", propertyId)
      .lt("start_date", checkOut)
      .gt("end_date", checkIn);

    if (ownerBlockRows && ownerBlockRows.length > 0) {
      return new Response(JSON.stringify({ error: "Selected dates are not available" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load pricing data ─────────────────────────────────────────────────────
    const [dowRes, overrideRes, feesRes, seasonalRes] = await Promise.all([
      supabase.from("day_of_week_rates").select("day_of_week,rate").eq("property_id", propertyId),
      supabase.from("date_price_overrides").select("date,rate").eq("property_id", propertyId),
      supabase.from("property_fees").select("name,fee_type,amount,applies_after_guests,apply_to_guest_quote,is_standard").eq("property_id", propertyId).eq("enabled", true).order("sort_order"),
      supabase.from("seasonal_pricing_presets").select("start_date,end_date,nightly_rate,min_nights,priority,is_active").eq("property_id", propertyId).eq("is_active", true),
    ]);

    const basePrice = Number(property.base_price ?? 0);
    const taxRate = Number(property.tax_rate ?? 0);
    const dowRates: DowRate[] = (dowRes.data ?? []).map((r) => ({ day_of_week: r.day_of_week, rate: Number(r.rate) }));
    const dateOverrides: DateOverride[] = (overrideRes.data ?? []).map((o) => ({ date: o.date, rate: Number(o.rate) }));
    const seasonalPresets: SeasonalPreset[] = (seasonalRes.data ?? []).map((p) => ({
      start_date: p.start_date,
      end_date: p.end_date,
      nightly_rate: Number(p.nightly_rate),
      min_nights: p.min_nights,
      priority: p.priority,
      is_active: p.is_active,
    }));
    const dbFees: DbFee[] = (feesRes.data ?? []).map((f) => ({
      name: f.name,
      fee_type: f.fee_type,
      amount: Number(f.amount),
      applies_after_guests: f.applies_after_guests,
      apply_to_guest_quote: f.apply_to_guest_quote ?? true,
      is_standard: f.is_standard ?? false,
    }));

    // ── Calculate pricing ─────────────────────────────────────────────────────
    let subtotalDollars = 0;
    let cur = checkIn;
    for (let i = 0; i < nights; i++) {
      subtotalDollars += resolveNightlyRate(cur, basePrice, dowRates, dateOverrides, seasonalPresets);
      cur = addDays(cur, 1);
    }

    const feeLines = dbFees
      .filter((fee) => fee.apply_to_guest_quote !== false)
      .map((fee) => {
        // Pets fee only applies when the guest brought pets
        if (fee.is_standard && fee.name === "Pets" && pets === 0) {
          return { name: fee.name, amount: 0 };
        }
        const threshold = fee.applies_after_guests ?? 0;
        const extraGuests = Math.max(0, guests - threshold);
        let amount = 0;
        switch (fee.fee_type) {
          case "per_stay": amount = fee.amount; break;
          case "per_night": amount = fee.amount * nights; break;
          case "per_guest_per_stay": amount = fee.amount * extraGuests; break;
          case "per_guest_per_night": amount = fee.amount * extraGuests * nights; break;
        }
        return { name: fee.name, amount };
      })
      .filter((l) => l.amount > 0);

    const feesTotalDollars = feeLines.reduce((s, l) => s + l.amount, 0);
    const taxDollars = (subtotalDollars + feesTotalDollars) * taxRate;
    const totalDollars = subtotalDollars + feesTotalDollars + taxDollars;

    const amountSubtotal = Math.round(subtotalDollars * 100);
    const amountFees = Math.round(feesTotalDollars * 100);
    const amountTax = Math.round(taxDollars * 100);
    const amountTotal = Math.round(totalDollars * 100);

    // ── Insert booking ────────────────────────────────────────────────────────
    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        property_id: propertyId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone ?? null,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        pets,
        special_requests: specialRequests ?? null,
        status: "pending_review",
        payment_status: "unpaid",
        amount_subtotal: amountSubtotal,
        amount_fees: amountFees,
        amount_tax: amountTax,
        amount_total: amountTotal,
        total_price: totalDollars,
        currency: "usd",
      })
      .select("id,status,amount_total,check_in,check_out,guests,guest_name")
      .maybeSingle();

    if (insertError || !booking) {
      console.error("Booking insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create booking request" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fire-and-forget booking request notification ──────────────────────────
    notifyBookingRequest({
      type: "booking_request_received",
      bookingId: booking.id,
      propertyId,
      guestName,
      guestEmail,
      guestPhone: guestPhone ?? undefined,
      checkIn,
      checkOut,
      nights,
      guests,
      pets,
      totalPrice: totalDollars,
      specialRequests: specialRequests ?? undefined,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        bookingId: booking.id,
        booking_id: booking.id,
        status: booking.status,
        amountTotal: booking.amount_total,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guests: booking.guests,
        guestName: booking.guest_name,
        nights,
        feeLines,
        amountSubtotal,
        amountFees,
        amountTax,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-booking-request error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
