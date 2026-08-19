import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
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

function toSafeSiteName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")  // spaces, underscores, special chars → hyphen
    .replace(/-+/g, "-")           // collapse multiple hyphens
    .replace(/^-+|-+$/g, "")       // strip leading/trailing hyphens
    .slice(0, 52);                 // Netlify practical limit
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
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

  // Check Netlify provider is verified
  const { data: netlifyProvider } = await adminClient
    .from("platform_provider_integrations")
    .select("status")
    .eq("provider", "netlify")
    .maybeSingle();
  if (!netlifyProvider || netlifyProvider.status !== "verified") {
    return err("Netlify provider is not verified. Configure it in Platform Integrations first.", 400);
  }

  // Parse body
  let body: { instance_id?: string; job_id?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const { instance_id, job_id } = body;
  if (!instance_id) return err("instance_id is required", 400);

  // Load instance
  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_name,instance_slug,netlify_site_id,frontend_url,provisioning_status,client_id")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);

  // Prevent duplicates
  if (instance.netlify_site_id) {
    return err(`Netlify site already exists for this instance: ${instance.netlify_site_id}`, 409);
  }

  // Get credentials (never exposed to frontend)
  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");
  const netlifyTeamId = Deno.env.get("NETLIFY_TEAM_ID");
  if (!netlifyToken) {
    return err("NETLIFY_AUTH_TOKEN is not configured in edge function secrets.", 500);
  }

  const siteName = toSafeSiteName(instance.instance_slug ?? instance.instance_name);
  const now = new Date().toISOString();

  // Log start
  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id,
      event_type: "info",
      message: `Netlify site creation started for ${instance.instance_name} (site name: ${siteName})`,
    });
  }

  // Call Netlify API
  // account_slug must be a query param, NOT in the request body
  const netlifyUrl = netlifyTeamId
    ? `https://api.netlify.com/api/v1/sites?account_slug=${encodeURIComponent(netlifyTeamId)}`
    : "https://api.netlify.com/api/v1/sites";

  let netlifyRes: Response;
  try {
    netlifyRes = await fetch(netlifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: siteName }),
    });
  } catch {
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "error",
        message: `Netlify site creation failed — network error reaching Netlify API`,
      });
    }
    return err("Network error reaching Netlify API", 502);
  }

  if (!netlifyRes.ok) {
    let netlifyApiMsg = "";
    let netlifyErrors: unknown = undefined;
    try {
      const eb = await netlifyRes.json() as Record<string, unknown>;
      if (typeof eb.message === "string") netlifyApiMsg = eb.message;
      if (eb.errors) netlifyErrors = eb.errors;
    } catch { /* non-JSON body */ }

    // Compose a safe, actionable error — never include token/auth header
    let friendly = `Netlify API returned ${netlifyRes.status}`;
    if (netlifyApiMsg) friendly += `: ${netlifyApiMsg}`;

    if (netlifyRes.status === 422) {
      const hints: string[] = [
        `Requested site name "${siteName}" may already be taken — try a different instance_slug.`,
      ];
      if (netlifyTeamId) {
        hints.push(`Team/account slug "${netlifyTeamId}" (NETLIFY_TEAM_ID) may be wrong — verify it in Netlify Team Settings.`);
      } else {
        hints.push("NETLIFY_TEAM_ID is not set — site will be created under the default personal account.");
      }
      hints.push("Payload may be invalid — check that the site name contains only letters, numbers, and hyphens.");
      friendly = `Netlify 422 Unprocessable Entity. ${hints.join(" ")}`;
      if (netlifyApiMsg) friendly += ` Netlify message: ${netlifyApiMsg}`;
    }

    const logMsg = netlifyErrors
      ? `Netlify site creation failed — ${friendly} | errors: ${JSON.stringify(netlifyErrors)}`
      : `Netlify site creation failed — ${friendly}`;

    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "error", message: logMsg,
      });
    }

    return new Response(
      JSON.stringify({
        error: friendly,
        netlify_status: netlifyRes.status,
        requested_site_name: siteName,
        ...(netlifyTeamId ? { team_slug_used: netlifyTeamId } : {}),
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const site = await netlifyRes.json() as Record<string, string>;
  const siteId: string = site.id;
  const siteFinalName: string = site.name;
  // ssl_url may be "" (empty string, not null) on a brand-new undeployed site;
  // fall through to url, then construct from the actual site name Netlify assigned.
  const rawSslUrl = site.ssl_url;
  const rawUrl = site.url;
  const siteUrl: string =
    (rawSslUrl && rawSslUrl.startsWith("https://") ? rawSslUrl : null) ??
    (rawUrl && rawUrl.startsWith("http") ? rawUrl : null) ??
    (siteFinalName ? `https://${siteFinalName}.netlify.app` : "");
  const netlifyAdminUrl: string = site.admin_url ?? "";

  // Update platform_instances
  const instancePatch: Record<string, string | null> = {
    netlify_site_id: siteId,
  };
  if (siteUrl) {
    instancePatch.frontend_url = siteUrl;
    instancePatch.admin_url = `${siteUrl}/admin`;
  }
  await adminClient.from("platform_instances").update(instancePatch).eq("id", instance_id);

  // Mark related generated setup task completed
  await adminClient
    .from("platform_generated_setup_tasks")
    .update({ status: "completed" })
    .eq("instance_id", instance_id)
    .eq("task_key", "netlify_create_site")
    .in("status", ["draft", "ready", "copied"]);

  // Mark provisioning step completed
  await adminClient
    .from("platform_provisioning_steps")
    .update({ status: "completed", completed_at: now, external_url: siteUrl || null })
    .eq("instance_id", instance_id)
    .eq("step_key", "create_netlify_site")
    .in("status", ["not_started", "in_progress"]);

  // Log success
  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id,
      event_type: "success",
      message: `Netlify site created: ${siteFinalName}${siteUrl ? ` — ${siteUrl}` : ""}`,
    });
  }

  return ok({
    site_id: siteId,
    site_name: siteFinalName,
    site_url: siteUrl,
    netlify_admin_url: netlifyAdminUrl,
  });
});
