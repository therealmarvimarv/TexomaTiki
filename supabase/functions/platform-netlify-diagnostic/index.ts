import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return respond({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return respond({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await adminClient
    .from("platform_profiles").select("platform_role").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.platform_role !== "super_admin") return respond({ error: "Forbidden" }, 403);

  let body: { instance_id?: string; deploy_id?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const { instance_id, deploy_id } = body;
  if (!instance_id) return respond({ error: "instance_id required" }, 400);

  // Read instance
  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_slug,netlify_site_id,frontend_url,admin_url,repo_url,last_deployed_at")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return respond({ error: "Instance not found" }, 404);

  if (!netlifyToken) {
    return respond({ error: "NETLIFY_AUTH_TOKEN not configured", db_values: instance }, 500);
  }

  const result: Record<string, unknown> = { db_values: instance };

  // 1. GET site by saved ID
  let siteByIdStatus: number | null = null;
  let siteByIdData: Record<string, unknown> | null = null;
  if (instance.netlify_site_id) {
    const r = await fetch(`https://api.netlify.com/api/v1/sites/${instance.netlify_site_id}`, {
      headers: { Authorization: `Bearer ${netlifyToken}` },
    });
    siteByIdStatus = r.status;
    if (r.ok) {
      const s = await r.json() as Record<string, unknown>;
      siteByIdData = {
        id: s.id,
        name: s.name,
        url: s.url,
        ssl_url: s.ssl_url,
        admin_url: s.admin_url,
        account_id: s.account_id,
        account_slug: s.account_slug,
        published_deploy: (s.published_deploy as Record<string, unknown> | null)?.id ?? null,
      };
    }
  }
  result.get_site_by_id_status = siteByIdStatus;
  result.site_by_id = siteByIdData;

  // 2. GET site list, search for matches
  const listRes = await fetch("https://api.netlify.com/api/v1/sites?per_page=100", {
    headers: { Authorization: `Bearer ${netlifyToken}` },
  });
  let matchFromList: Record<string, unknown> | null = null;
  if (listRes.ok) {
    const sites = await listRes.json() as Array<Record<string, unknown>>;
    const slug = (instance.instance_slug as string ?? "").toLowerCase();
    const savedId = instance.netlify_site_id as string | null;
    const match = sites.find(s =>
      s.id === savedId ||
      (s.name as string)?.includes("demo-business") ||
      (s.name as string)?.includes(slug)
    );
    if (match) {
      matchFromList = {
        id: match.id,
        name: match.name,
        url: match.url,
        ssl_url: match.ssl_url,
        admin_url: match.admin_url,
        account_id: match.account_id,
        account_slug: match.account_slug,
        published_deploy: (match.published_deploy as Record<string, unknown> | null)?.id ?? null,
      };
    }
    result.list_total_sites = sites.length;
  } else {
    result.list_error = `GET /sites returned ${listRes.status}`;
  }
  result.matching_site_from_list = matchFromList;

  // 3. Determine real site (prefer by ID, fallback to list match)
  const realSite = siteByIdData ?? matchFromList;
  result.site_exists_in_netlify = !!realSite;

  if (!realSite) {
    // Clear stale fields
    await adminClient.from("platform_instances").update({
      netlify_site_id: null,
      frontend_url: null,
      admin_url: null,
      last_deployed_at: null,
    }).eq("id", instance_id);
    result.db_update = "cleared stale netlify_site_id, frontend_url, admin_url, last_deployed_at";
    result.stale_netlify_site_id = true;
  } else {
    // Update with real values
    const realSslUrl = realSite.ssl_url as string | null;
    const realUrl = realSite.url as string | null;
    const bestUrl = (realSslUrl?.startsWith("https://") ? realSslUrl : null) ?? realUrl ?? null;
    const patch: Record<string, string | null> = {};
    if (realSite.id !== instance.netlify_site_id) patch.netlify_site_id = realSite.id as string;
    if (bestUrl && bestUrl !== instance.frontend_url) patch.frontend_url = bestUrl;
    if (realSite.admin_url && realSite.admin_url !== instance.admin_url) patch.admin_url = realSite.admin_url as string;
    if (Object.keys(patch).length > 0) {
      await adminClient.from("platform_instances").update(patch).eq("id", instance_id);
      result.db_update = `updated: ${Object.keys(patch).join(", ")}`;
    } else {
      result.db_update = "no changes needed";
    }
    result.stale_netlify_site_id = false;
    result.actual_url = bestUrl;
    result.actual_admin_url = realSite.admin_url ?? null;
    result.has_published_deploy = !!realSite.published_deploy;
  }

  // ── Deploy status check ───────────────────────────────────────────────────
  // Fetch specific deploy by ID if provided, plus latest deploys for the site.
  const safeDeploy = (d: Record<string, unknown>) => ({
    deploy_id: d.id,
    deploy_state: d.state,
    deploy_created_at: d.created_at,
    deploy_updated_at: d.updated_at,
    deploy_published_at: d.published_at ?? null,
    error_message: d.error_message ?? null,
    deploy_ssl_url: d.deploy_ssl_url ?? d.ssl_url ?? d.url ?? null,
    deploy_log_url: d.log_access_attributes
      ? (d.log_access_attributes as Record<string, unknown>).url ?? null
      : null,
  });

  if (deploy_id) {
    const dr = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy_id}`, {
      headers: { Authorization: `Bearer ${netlifyToken}` },
    });
    if (dr.ok) {
      result.deploy_by_id = safeDeploy(await dr.json() as Record<string, unknown>);
    } else {
      result.deploy_by_id_error = `GET /deploys/${deploy_id} returned ${dr.status}`;
    }
  }

  if (instance.netlify_site_id) {
    const lr = await fetch(
      `https://api.netlify.com/api/v1/sites/${instance.netlify_site_id}/deploys?per_page=3`,
      { headers: { Authorization: `Bearer ${netlifyToken}` } },
    );
    if (lr.ok) {
      const list = await lr.json() as Array<Record<string, unknown>>;
      result.latest_deploys = list.map(safeDeploy);
    } else {
      result.latest_deploys_error = `GET /sites/.../deploys returned ${lr.status}`;
    }
  }

  return respond(result);
});
