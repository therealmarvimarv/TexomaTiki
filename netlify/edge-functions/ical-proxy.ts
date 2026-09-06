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

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Extract the token from the last path segment, stripping the .ics suffix.
  // Expected shape: /calendar/ical/{token}.ics
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) {
    return new Response("Missing token", { status: 400 });
  }
  const token = last.endsWith(".ics") ? last.slice(0, -4) : last;

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

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers,
  });
};
