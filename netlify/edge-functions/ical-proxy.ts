import type { Context } from "@netlify/edge-functions";

const SUPABASE_URL = "https://kxytygmulacvwahvnrtm.supabase.co";
const PROPERTY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Headers we forward from the upstream Supabase response to the client.
// Set-Cookie is deliberately excluded — VRBO rejects feeds that carry a
// cross-domain Set-Cookie (Domain=supabase.co).
const FORWARD_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
];

const REDACT_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key", "apikey"];

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Extract the token from the last path segment, stripping the .ics suffix.
  // Expected shape: /icalendar/{token}.ics
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) {
    return new Response("Missing token", { status: 400 });
  }
  const token = last.endsWith(".ics") ? last.slice(0, -4) : last;

  // ── TEMPORARY DIAGNOSTIC LOGGING (remove after VRBO test) ──────────────────
  const safePath = pathname.replace(/\/icalendar\/[^/]+\.ics$/, "/icalendar/[REDACTED].ics");
  const reqHeaders: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    reqHeaders[key] = REDACT_HEADERS.includes(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  context.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: request.method,
    userAgent: request.headers.get("user-agent") ?? "(none)",
    host: request.headers.get("host") ?? "(none)",
    path: safePath,
    headers: reqHeaders,
  }));
  // ── END TEMPORARY DIAGNOSTIC LOGGING ────────────────────────────────────────

  const upstream = `${SUPABASE_URL}/functions/v1/ical-export/${PROPERTY_ID}/${token}.ics`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { method: "GET" });
  } catch {
    return new Response("Failed to reach calendar upstream", { status: 502 });
  }

  // Build a clean response with only the safe headers — no Set-Cookie.
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = upstreamRes.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey");

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers,
  });
};
