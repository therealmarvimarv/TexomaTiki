import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9_-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const bookingId = url.searchParams.get("booking_id");

    if (!sessionId && !bookingId) {
      return new Response(
        JSON.stringify({ error: "Missing session_id or booking_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (sessionId && !SESSION_ID_RE.test(sessionId)) {
      return new Response(
        JSON.stringify({ error: "Invalid session_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (bookingId && !UUID_RE.test(bookingId)) {
      return new Response(
        JSON.stringify({ error: "Invalid booking_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase
      .from("bookings")
      .select("id,check_in,check_out,guests,guest_email,amount_total,total_price,status");

    if (sessionId) {
      query = query.eq("stripe_checkout_session_id", sessionId);
    } else {
      query = query.eq("id", bookingId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("booking-lookup query error:", error);
      return new Response(
        JSON.stringify({ error: "Lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ booking: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        booking: {
          id: data.id,
          check_in: data.check_in,
          check_out: data.check_out,
          guests: data.guests,
          guest_email: data.guest_email,
          amount_total: data.amount_total,
          total_price: data.total_price,
          status: data.status,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("booking-lookup error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
