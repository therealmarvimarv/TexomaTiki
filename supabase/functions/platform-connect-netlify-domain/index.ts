import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  // ── Auth: verify platform super_admin ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient  = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  const { data: profile } = await adminClient
    .from("platform_profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.platform_role !== "super_admin") return err("Forbidden", 403);

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { instance_id?: string; domain_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON"); }
  const { instance_id, domain_id } = body;
  if (!instance_id || !domain_id) return err("instance_id and domain_id are required");

  // ── Load instance + domain ─────────────────────────────────────────────────
  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id, netlify_site_id, instance_name")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);

  const { data: domain } = await adminClient
    .from("platform_instance_domains")
    .select("id, domain, instance_id")
    .eq("id", domain_id)
    .eq("instance_id", instance_id)
    .maybeSingle();
  if (!domain) return err("Domain not found or does not belong to instance", 404);

  // ── Netlify API ────────────────────────────────────────────────────────────
  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");
  const netliftySiteId = instance.netlify_site_id;

  if (!netlifyToken) {
    await adminClient.from("platform_instance_domains").update({
      status: "pending_dns",
      notes: "NETLIFY_AUTH_TOKEN not configured — connect domain manually in Netlify dashboard.",
      last_checked_at: new Date().toISOString(),
    }).eq("id", domain_id);

    return ok({
      success: false,
      manual_required: true,
      message: "NETLIFY_AUTH_TOKEN not configured. Please connect the domain manually in the Netlify dashboard.",
    });
  }

  if (!netliftySiteId) {
    return ok({
      success: false,
      manual_required: true,
      message: "No Netlify site ID on instance. Deploy to Netlify first, then connect the domain.",
    });
  }

  // Call Netlify API to add custom domain
  let netlifyRes: Response;
  let netlifyDomainId: string | null = null;
  let netlifyError: string | null = null;

  try {
    netlifyRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${netliftySiteId}/domain_aliases`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain: domain.domain }),
      }
    );

    const netlifyBody = await netlifyRes.json();

    if (netlifyRes.ok) {
      netlifyDomainId = netlifyBody.id ?? null;
    } else {
      // 422 often means domain already added — treat as success
      if (netlifyRes.status === 422) {
        netlifyDomainId = "existing";
      } else {
        netlifyError = netlifyBody.message ?? netlifyBody.error ?? `Netlify API error ${netlifyRes.status}`;
      }
    }
  } catch (e) {
    netlifyError = (e as Error).message ?? "Network error calling Netlify API";
  }

  if (netlifyError) {
    await adminClient.from("platform_instance_domains").update({
      status: "failed",
      notes: `Netlify API error: ${netlifyError}`,
      last_checked_at: new Date().toISOString(),
    }).eq("id", domain_id);

    return ok({
      success: false,
      manual_required: true,
      message: `Netlify API failed: ${netlifyError}. Connect domain manually in Netlify dashboard.`,
    });
  }

  // ── Success: update domain record ──────────────────────────────────────────
  await adminClient.from("platform_instance_domains").update({
    status: "connected_to_netlify",
    netlify_domain_id: netlifyDomainId,
    last_checked_at: new Date().toISOString(),
    notes: netlifyDomainId === "existing"
      ? "Domain already present on Netlify site — marked as connected."
      : "Connected via Netlify API.",
  }).eq("id", domain_id);

  // ── Log provisioning job event if one exists ───────────────────────────────
  const { data: latestJob } = await adminClient
    .from("platform_provisioning_jobs")
    .select("id")
    .eq("instance_id", instance_id)
    .in("status", ["running", "waiting", "succeeded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestJob) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id: latestJob.id,
      event_type: "info",
      message: `Domain ${domain.domain} connected to Netlify`,
    }).select().maybeSingle().catch(() => null);
  }

  return ok({
    success: true,
    message: `Domain ${domain.domain} connected to Netlify successfully.`,
    netlify_domain_id: netlifyDomainId,
  });
});
