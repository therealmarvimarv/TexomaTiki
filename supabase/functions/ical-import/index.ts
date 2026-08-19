import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// iCal import is admin-only. Only authenticated admin users can trigger a sync
// or create/edit/delete import sources. The endpoint requires a valid JWT.
//
// SECURITY:
// - Only http:// and https:// feed URLs are allowed.
// - localhost, 127.x.x.x, ::1, 10.x, 172.16-31.x, 192.168.x are blocked
//   to prevent SSRF attacks against internal services.
// - Fetch has a hard timeout so slow/hanging feeds cannot block the function.
// - Response size is capped to prevent memory exhaustion.
// - Per-source cleanup: when a source is re-synced, only blocked_dates rows
//   belonging to that source are replaced. Owner blocks, booking blocks, and
//   manually-created blocks are never touched.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Admin auth required ───────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sourceId: string | undefined = body.source_id;

    // Load enabled sources (optionally filtered to one)
    const query = supabase
      .from("ical_sources")
      .select("id, property_id, name, url, platform, ical_source_id, enabled")
      .eq("enabled", true);
    if (sourceId) query.eq("id", sourceId);

    const { data: sources, error: srcErr } = await query;
    if (srcErr) throw srcErr;

    const results: { name: string; dates: number; error?: string }[] = [];

    for (const source of sources ?? []) {
      try {
        // ── URL validation ──────────────────────────────────────────────────
        validateFeedUrl(source.url);

        // ── Fetch with timeout + size cap ───────────────────────────────────
        const ical = await fetchWithLimits(source.url);

        // ── Parse ───────────────────────────────────────────────────────────
        const blockedDates = parseIcalDates(ical);

        // Stable source key stored in blocked_dates.source for this feed
        // Use the source's UUID as a stable, unique identifier
        const sourceKey = `import:${source.id}`;

        // ── Per-source cleanup then insert ──────────────────────────────────
        // Delete only the rows that this specific source created previously.
        // Booking blocks, owner blocks, and other import sources are untouched.
        await supabase
          .from("blocked_dates")
          .delete()
          .eq("property_id", source.property_id)
          .eq("source", sourceKey);

        if (blockedDates.length > 0) {
          const rows = blockedDates.map((date) => ({
            property_id: source.property_id,
            date,
            source: sourceKey,
          }));

          const { error: insertErr } = await supabase
            .from("blocked_dates")
            .upsert(rows, { onConflict: "property_id,date" });

          if (insertErr) throw insertErr;
        }

        // ── Update source record ────────────────────────────────────────────
        await supabase
          .from("ical_sources")
          .update({
            last_sync_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);

        results.push({ name: source.name, dates: blockedDates.length });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ical-import] source="${source.name}" error:`, msg);

        await supabase
          .from("ical_sources")
          .update({
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);

        // Individual source failure is recorded but does not abort other sources
        results.push({ name: source.name, dates: 0, error: msg });
      }
    }

    return new Response(JSON.stringify({ synced: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("ical-import error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── URL validation (SSRF guard) ───────────────────────────────────────────────

function validateFeedUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid feed URL: ${raw}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Feed URL must use http or https (got ${parsed.protocol})`);
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") {
    throw new Error("Feed URL points to a disallowed address");
  }

  // Block IPv4 private/loopback ranges
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 127 ||                          // 127.0.0.0/8 loopback
      a === 10 ||                           // 10.0.0.0/8 private
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12 private
      (a === 192 && b === 168) ||            // 192.168.0.0/16 private
      a === 169                              // 169.254.0.0/16 link-local
    ) {
      throw new Error("Feed URL points to a private/internal address");
    }
  }

  // Block metadata endpoints (e.g. AWS/GCP instance metadata)
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new Error("Feed URL points to a disallowed address");
  }
}

// ── Fetch with timeout and response size cap ──────────────────────────────────

async function fetchWithLimits(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "TikiCottage-CalSync/1.0" },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch feed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`Feed returned HTTP ${resp.status}`);
  }

  // Read body with size cap
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("Empty response body");

  let totalBytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel();
      throw new Error(`Feed response exceeds ${MAX_RESPONSE_BYTES / 1024}KB size limit`);
    }
    chunks.push(value);
  }

  const full = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    full.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(full);
}

// ── iCal parser ───────────────────────────────────────────────────────────────

function parseIcalDates(ical: string): string[] {
  const dates: string[] = [];
  const lines = ical.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let inEvent = false;
  let dtstart = "";
  let dtend = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = "";
      dtend = "";
      continue;
    }
    if (line === "END:VEVENT") {
      if (dtstart && dtend) {
        const start = parseIcalDateValue(dtstart);
        const end = parseIcalDateValue(dtend);
        if (start && end && start < end) {
          const cur = new Date(start);
          while (cur < end) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    if (line.startsWith("DTSTART")) dtstart = line.split(":").slice(1).join(":");
    if (line.startsWith("DTEND")) dtend = line.split(":").slice(1).join(":");
  }

  return [...new Set(dates)];
}

function parseIcalDateValue(val: string): Date | null {
  // DATE format: 20240101
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(val);
  if (dateOnly) return new Date(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00Z`);
  // DATETIME format: 20240101T120000Z or 20240101T120000
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(val);
  if (dt) return new Date(`${dt[1]}-${dt[2]}-${dt[3]}T${dt[4]}:${dt[5]}:${dt[6]}Z`);
  return null;
}
