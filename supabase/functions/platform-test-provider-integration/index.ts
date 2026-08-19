import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Env key requirements per provider (key names only — no values stored or returned)
const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  netlify:             ["NETLIFY_AUTH_TOKEN", "NETLIFY_TEAM_ID"],
  supabase_management: ["SUPABASE_ACCESS_TOKEN", "SUPABASE_ORGANIZATION_ID"],
  stripe:              ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  resend:              ["RESEND_API_KEY"],
  twilio:              ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  smtp:                ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
  github:              ["GITHUB_TOKEN", "GITHUB_TEMPLATE_REPO", "GITHUB_ORG"],
  domain_dns:          ["DNS_PROVIDER", "DNS_API_TOKEN"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: verify caller is platform super_admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use anon client with user JWT to verify identity
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check platform_profiles for super_admin
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await adminClient
    .from("platform_profiles")
    .select("platform_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.platform_role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Forbidden — not a platform super_admin" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider = body.provider?.toLowerCase();
  if (!provider || !PROVIDER_ENV_KEYS[provider]) {
    return new Response(JSON.stringify({ error: "Unknown or missing provider" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requiredKeys = PROVIDER_ENV_KEYS[provider];
  const missingKeys: string[] = [];
  const presentKeys: string[] = [];

  for (const key of requiredKeys) {
    const val = Deno.env.get(key);
    if (val && val.trim().length > 0) {
      presentKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }

  const now = new Date().toISOString();
  let status: string;
  let message: string;

  if (missingKeys.length === 0) {
    status = "verified";
    message = `All ${requiredKeys.length} required environment variable(s) present.`;
  } else if (presentKeys.length === 0) {
    status = "not_configured";
    message = `Missing all required environment variables: ${missingKeys.join(", ")}.`;
  } else {
    status = "not_configured";
    message = `Partially configured. Missing: ${missingKeys.join(", ")}. Present: ${presentKeys.length}/${requiredKeys.length}.`;
  }

  // Update the provider row — key names only, never values
  await adminClient
    .from("platform_provider_integrations")
    .update({
      last_checked_at: now,
      last_check_status: status,
      last_check_message: message,
      status: status === "verified" ? "verified" : "not_configured",
    })
    .eq("provider", provider);

  return new Response(
    JSON.stringify({
      provider,
      status,
      message,
      present_count: presentKeys.length,
      total_count: requiredKeys.length,
      missing_keys: missingKeys,
      // present_keys intentionally omitted to avoid leaking key names that reveal what's configured
      checked_at: now,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
