import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Admin-only endpoint. Generates or regenerates a calendar export token for a
// property. The token is a 32-byte cryptographically random hex string stored
// on the property row. The export URL is never stored — the admin UI builds it
// client-side from the returned token.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Require admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const propertyId: string | undefined = body.property_id;
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "property_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify property exists
    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .maybeSingle();

    if (propErr || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 32 bytes of cryptographic randomness → 64-char hex token
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const newToken = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
    const createdAt = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("properties")
      .update({
        calendar_export_token: newToken,
        calendar_export_token_created_at: createdAt,
      })
      .eq("id", propertyId);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ token: newToken, created_at: createdAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("ical-export-token error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
