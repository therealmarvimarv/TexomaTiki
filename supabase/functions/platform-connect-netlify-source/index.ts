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

function parseGithubRepo(repoUrl: string): string {
  const match = repoUrl.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (match) return match[1];
  if (!repoUrl.startsWith("http") && repoUrl.includes("/")) return repoUrl;
  return repoUrl;
}

async function netlifyGet(url: string, token: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    let body: Record<string, unknown> = {};
    try { body = await r.json(); } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: "network error" } };
  }
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
    .from("platform_profiles").select("platform_role").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.platform_role !== "super_admin") return err("Forbidden — not a platform super_admin", 403);

  const { data: providers } = await adminClient
    .from("platform_provider_integrations").select("provider,status").in("provider", ["netlify", "github"]);
  const provMap = Object.fromEntries((providers ?? []).map(p => [p.provider, p.status]));
  if (provMap.netlify !== "verified") return err("Netlify provider is not verified.", 400);
  if (provMap.github !== "verified") return err("GitHub/Source Control provider is not verified.", 400);

  let body: { instance_id?: string; job_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  const { instance_id, job_id } = body;
  if (!instance_id) return err("instance_id is required", 400);

  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_name,netlify_site_id,repo_url,frontend_url,last_deployed_at,client_id")
    .eq("id", instance_id).maybeSingle();
  if (!instance) return err("Instance not found", 404);
  if (!instance.netlify_site_id) return err("Netlify site not created yet. Run Create Netlify Site first.", 400);
  if (!instance.repo_url) return err("Source repo not created yet. Run Duplicate Master Source first.", 400);

  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");
  if (!netlifyToken) return err("NETLIFY_AUTH_TOKEN is not configured.", 500);

  const siteId = instance.netlify_site_id as string;
  const repoSlug = parseGithubRepo(instance.repo_url as string);
  const now = new Date().toISOString();

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "info",
      message: `Netlify source connection started — site: ${siteId}, repo: ${repoSlug}`,
    });
  }

  // ── Step 1: Link repo via PUT /sites/{id} ─────────────────────────────────
  let linkRes: Response;
  try {
    linkRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${netlifyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        repo: {
          provider: "github",
          repo: repoSlug,
          branch: "main",
          cmd: "npm run build",
          dir: "dist",
          private: true,
        },
      }),
    });
  } catch {
    if (job_id) await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "error", message: "Netlify source link failed — network error",
    });
    return err("Network error reaching Netlify API", 502);
  }

  // Repo linking via PAT requires Netlify's internal OAuth for GitHub.
  // A 401/422/403 here means we must link manually in the Netlify dashboard.
  if (!linkRes.ok) {
    let netlifyErrMsg = `Netlify API returned ${linkRes.status}`;
    let netlifyErrBody: Record<string, unknown> = {};
    try { netlifyErrBody = await linkRes.json() as Record<string, unknown>; } catch { /* ignore */ }
    if (typeof netlifyErrBody.message === "string") netlifyErrMsg += `: ${netlifyErrBody.message}`;
    if (netlifyErrBody.errors) netlifyErrMsg += ` | errors: ${JSON.stringify(netlifyErrBody.errors)}`;

    const manualUrl = `https://app.netlify.com/sites/${siteId}/settings/deploys`;
    if (job_id) await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "warning",
      message: `Manual Netlify repo connection required — ${netlifyErrMsg}. Link the repo at: ${manualUrl}`,
    });
    return ok({
      status: "manual_required",
      message: netlifyErrMsg,
      netlify_site_id: siteId,
      repo: repoSlug,
      netlify_dashboard_url: manualUrl,
      has_published_deploy: false,
      deploy_state: null,
      deploy_id: null,
      deploy_error_message: netlifyErrMsg,
    });
  }

  const siteData = await linkRes.json() as Record<string, unknown>;
  const siteUrl = ((siteData.ssl_url as string | undefined)?.startsWith("https://") ? siteData.ssl_url : null)
    ?? (siteData.url as string | null)
    ?? (instance.frontend_url as string | null)
    ?? "";

  if (job_id) await adminClient.from("platform_provisioning_job_events").insert({
    job_id, event_type: "info",
    message: `Repo ${repoSlug} linked to Netlify site. Triggering deploy…`,
  });

  // ── Step 2: Trigger deploy via POST /sites/{id}/deploys ───────────────────
  let deployId: string | null = null;
  let deployState: string | null = null;
  let deployUrl: string | null = null;
  let deployErrorMsg: string | null = null;
  let deployTriggerStatus = 0;

  try {
    const deployTriggerRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${netlifyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ branch: "main" }),
    });
    deployTriggerStatus = deployTriggerRes.status;
    if (deployTriggerRes.ok) {
      const dd = await deployTriggerRes.json() as Record<string, unknown>;
      deployId = (dd.id as string) ?? null;
      deployState = (dd.state as string) ?? "enqueued";
      deployUrl = (dd.deploy_ssl_url as string) ?? (dd.deploy_url as string) ?? null;
      deployErrorMsg = (dd.error_message as string) ?? null;
    } else {
      let triggerErrBody: Record<string, unknown> = {};
      try { triggerErrBody = await deployTriggerRes.json() as Record<string, unknown>; } catch { /* ignore */ }
      deployErrorMsg = typeof triggerErrBody.message === "string"
        ? `Deploy trigger ${deployTriggerStatus}: ${triggerErrBody.message}`
        : `Deploy trigger returned ${deployTriggerStatus}`;
      deployState = "trigger_failed";
    }
  } catch {
    deployState = "trigger_failed";
    deployErrorMsg = "Network error triggering deploy";
  }

  // ── Step 3: Fetch latest deploys to confirm one exists ────────────────────
  // Wait a moment for Netlify to register the deploy
  await new Promise(r => setTimeout(r, 1500));

  const deploysCheck = await netlifyGet(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=3`,
    netlifyToken,
  );
  const deploysList = Array.isArray(deploysCheck.body) ? deploysCheck.body as Array<Record<string, unknown>> : [];
  const latestDeploy = deploysList[0] ?? null;

  // If we got a deploy from the list but not from the trigger, use list data
  if (!deployId && latestDeploy) {
    deployId = latestDeploy.id as string ?? null;
    deployState = latestDeploy.state as string ?? deployState;
    deployUrl = latestDeploy.deploy_ssl_url as string ?? latestDeploy.deploy_url as string ?? null;
    deployErrorMsg = latestDeploy.error_message as string ?? deployErrorMsg;
  }

  // ── Step 4: Check site for published_deploy ───────────────────────────────
  const siteCheck = await netlifyGet(`https://api.netlify.com/api/v1/sites/${siteId}`, netlifyToken);
  const hasPublishedDeploy = !!(siteCheck.body.published_deploy as Record<string, unknown> | null)?.id;

  // ── Step 5: Update DB — only set last_deployed_at if a deploy actually exists ─
  const confirmedDeployExists = !!deployId;
  const patch: Record<string, string | null> = {};
  if (siteUrl) patch.frontend_url = siteUrl as string;
  if (confirmedDeployExists) patch.last_deployed_at = now;

  if (Object.keys(patch).length > 0) {
    await adminClient.from("platform_instances").update(patch).eq("id", instance_id);
  }

  // Mark provisioning steps/tasks only if deploy confirmed
  if (confirmedDeployExists) {
    await adminClient.from("platform_generated_setup_tasks")
      .update({ status: "completed" })
      .eq("instance_id", instance_id).eq("task_key", "netlify_trigger_deploy")
      .in("status", ["draft", "ready", "copied"]);

    await adminClient.from("platform_provisioning_steps")
      .update({ status: "completed", completed_at: now, external_url: siteUrl || null })
      .eq("instance_id", instance_id).eq("step_key", "deploy_frontend")
      .in("status", ["not_started", "in_progress"]);
  }

  const logMsg = confirmedDeployExists
    ? `Deploy triggered — ID: ${deployId}, state: ${deployState}${deployErrorMsg ? ` | error: ${deployErrorMsg}` : ""}`
    : `Repo linked but no deploy confirmed — deploy trigger returned ${deployTriggerStatus}${deployErrorMsg ? `: ${deployErrorMsg}` : ""}`;

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: confirmedDeployExists ? "success" : "warning", message: logMsg,
    });
  }

  return ok({
    status: confirmedDeployExists ? "deploy_triggered" : "linked_no_deploy",
    netlify_site_id: siteId,
    repo: repoSlug,
    deploy_id: deployId,
    deploy_state: deployState,
    deploy_url: deployUrl ?? siteUrl ?? null,
    deploy_error_message: deployErrorMsg,
    has_published_deploy: hasPublishedDeploy,
    deploy_trigger_http_status: deployTriggerStatus,
    last_deployed_at_set: confirmedDeployExists,
  });
});
