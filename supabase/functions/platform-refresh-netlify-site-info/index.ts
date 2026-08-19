import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function err(msg: string, status: number, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return err("Unauthorized", 401);

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await adminClient
    .from("platform_profiles")
    .select("platform_role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.platform_role !== "super_admin") {
    return err("Forbidden — not a platform super_admin", 403);
  }

  let body: { instance_id?: string; clear_stale?: boolean };
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  const { instance_id, clear_stale } = body;
  if (!instance_id) return err("instance_id is required", 400);

  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id, instance_name, netlify_site_id, frontend_url, admin_url")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);
  if (!instance.netlify_site_id) {
    return err("No netlify_site_id on this instance. Run Create Netlify Site first.", 400);
  }

  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");
  if (!netlifyToken) return err("NETLIFY_AUTH_TOKEN is not configured.", 500);

  const siteId = instance.netlify_site_id;

  // Fetch real site info from Netlify
  let netlifyRes: Response;
  try {
    netlifyRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${netlifyToken}` },
    });
  } catch {
    return err("Network error reaching Netlify API", 502);
  }

  if (!netlifyRes.ok) {
    if (netlifyRes.status === 404) {
      if (clear_stale) {
        // Clear all Netlify fields except repo_url
        await adminClient
          .from("platform_instances")
          .update({
            netlify_site_id: null,
            frontend_url: null,
            admin_url: null,
            last_deployed_at: null,
          })
          .eq("id", instance_id);
        return new Response(
          JSON.stringify({
            site_exists: false,
            stale_cleared: true,
            site_id_checked: siteId,
            message: "Stale Netlify site info cleared. You can now create a new Netlify site.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          site_exists: false,
          stale_cleared: false,
          site_id_checked: siteId,
          error: "Netlify site ID not found. The site may have been deleted or created under a different account/team.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let msg = `Netlify API returned ${netlifyRes.status}`;
    try {
      const eb = await netlifyRes.json() as Record<string, unknown>;
      if (typeof eb.message === "string") msg += `: ${eb.message}`;
    } catch { /* ignore */ }
    return err(msg, 502, { site_id_used: siteId });
  }

  const site = await netlifyRes.json() as Record<string, unknown>;

  const actualSiteName = (site.name ?? "") as string;
  // ssl_url may be "" on a new undeployed site — fall through to url
  const rawSslUrl = site.ssl_url as string | undefined;
  const rawUrl = site.url as string | undefined;
  const actualUrl: string =
    (rawSslUrl && rawSslUrl.startsWith("https://") ? rawSslUrl : null) ??
    (rawUrl && rawUrl.startsWith("http") ? rawUrl : null) ??
    (actualSiteName ? `https://${actualSiteName}.netlify.app` : "");

  const netlifyDashboardUrl = `https://app.netlify.com/sites/${actualSiteName}`;

  // Update frontend_url + admin_url only if we have a real URL
  if (actualUrl) {
    await adminClient
      .from("platform_instances")
      .update({
        frontend_url: actualUrl,
        admin_url: `${actualUrl}/admin`,
      })
      .eq("id", instance_id);
  }

  return ok({
    site_exists: true,
    site_id: siteId,
    actual_site_name: actualSiteName,
    actual_ssl_url: rawSslUrl ?? null,
    actual_url: rawUrl ?? null,
    frontend_url_saved: actualUrl || null,
    admin_url_saved: actualUrl ? `${actualUrl}/admin` : null,
    netlify_dashboard_url: netlifyDashboardUrl,
    default_domain: site.default_domain ?? null,
    account_id: site.account_id ?? null,
    account_slug: site.account_slug ?? null,
  });
});
