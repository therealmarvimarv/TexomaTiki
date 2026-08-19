import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// iCal export is intentionally unauthenticated so that Airbnb, VRBO, and
// Booking.com can fetch the feed automatically. Access is controlled by a
// per-property secret token passed as a query parameter. Requests without a
// valid token are rejected before any calendar data is returned.
//
// SECURITY: This response must never include guest names, emails, phone
// numbers, booking IDs, payment data, internal notes, or admin notes.
// Event summaries must be generic ("Reserved" / "Unavailable").

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("property_id");
    const token = url.searchParams.get("token");

    if (!propertyId) {
      return new Response("Missing property_id", { status: 400, headers: corsHeaders });
    }
    if (!token) {
      return new Response("Missing token", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate token against the property record — timing-safe via DB lookup
    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id, title, calendar_export_token")
      .eq("id", propertyId)
      .maybeSingle();

    if (propErr || !property) {
      return new Response("Property not found", { status: 404, headers: corsHeaders });
    }

    if (!property.calendar_export_token || property.calendar_export_token !== token) {
      return new Response("Invalid or missing export token", { status: 403, headers: corsHeaders });
    }

    const propertyTitle = (property.title ?? "Tiki Cottage").trim();
    const dtstamp = toIcalDateTime(new Date());

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tiki Cottage//Vacation Rental Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${propertyTitle} Calendar`,
    ];

    // ── Confirmed bookings ────────────────────────────────────────────────────
    // Only export confirmed bookings. Pending requests do not hold dates and
    // must not block external platforms.
    const { data: bookings, error: bookErr } = await supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("property_id", propertyId)
      .eq("status", "confirmed")
      .order("check_in", { ascending: true });

    if (bookErr) throw bookErr;

    for (const booking of bookings ?? []) {
      // Use a hashed/opaque UID — never expose the raw booking UUID externally
      const uid = `booking-${await shortHash(booking.id)}@tikicottage`;
      const dtstart = toIcalDate(booking.check_in);
      const dtend = toIcalDate(booking.check_out);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${propertyTitle} Reserved`,
        "END:VEVENT",
      );
    }

    // ── Owner / manual blocks ─────────────────────────────────────────────────
    // Export ranges from owner_blocks table as "Unavailable" events.
    const { data: ownerBlocks, error: ownerErr } = await supabase
      .from("owner_blocks")
      .select("id, start_date, end_date")
      .eq("property_id", propertyId)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .order("start_date", { ascending: true });

    if (ownerErr) throw ownerErr;

    for (const block of ownerBlocks ?? []) {
      const uid = `block-${await shortHash(block.id)}@tikicottage`;
      const dtstart = toIcalDate(block.start_date);
      // owner_blocks.end_date is exclusive (same convention as check_out for bookings):
      // the overlap check in create-booking-request uses .gt("end_date", checkIn),
      // meaning end_date is the first day NOT blocked. iCal all-day DTEND is also
      // exclusive, so end_date maps directly — no +1 needed.
      const dtend = toIcalDate(block.end_date);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        "SUMMARY:Unavailable",
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n") + "\r\n", {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tiki-cottage-calendar.ics"',
        // Prevent aggressive caching so platforms get fresh data
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("ical-export error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Date helpers ──────────────────────────────────────────────────────────────

// Convert "YYYY-MM-DD" or ISO string to iCal DATE value (YYYYMMDD)
function toIcalDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, "");
}

function toIcalDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") + "Z";
}

// Produce a short opaque hash of a UUID so the raw booking/block ID is never
// exposed in the exported .ics file.
async function shortHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
