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

// Safe wrapper: calls Netlify, returns { ok, status, body } — never leaks token
async function netlifyFetch(
  url: string,
  token: string,
  method = "GET",
  payload?: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
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

  const { data: netlifyProvider } = await adminClient
    .from("platform_provider_integrations")
    .select("status")
    .eq("provider", "netlify")
    .maybeSingle();
  if (!netlifyProvider || netlifyProvider.status !== "verified") {
    return err("Netlify provider is not verified.", 400);
  }

  let body: { instance_id?: string; job_id?: string; env_vars?: Record<string, string> };
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  const { instance_id, job_id, env_vars } = body;
  if (!instance_id) return err("instance_id is required", 400);
  if (!env_vars || Object.keys(env_vars).length === 0) return err("env_vars is required", 400);

  const safeVars = Object.fromEntries(
    Object.entries(env_vars).filter(([k, v]) => k.trim() && String(v).trim()),
  );
  if (Object.keys(safeVars).length === 0) return err("No valid env var entries provided", 400);

  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_name,netlify_site_id")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);
  if (!instance.netlify_site_id) {
    return err("Netlify site not created yet. Run Create Netlify Site first.", 400);
  }

  const netlifyToken = Deno.env.get("NETLIFY_AUTH_TOKEN");
  if (!netlifyToken) return err("NETLIFY_AUTH_TOKEN is not configured.", 500);

  const siteId = instance.netlify_site_id;
  const now = new Date().toISOString();

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "info",
      message: `Setting ${Object.keys(safeVars).length} Netlify env var(s) for ${instance.instance_name}: ${Object.keys(safeVars).join(", ")}`,
    });
  }

  // Step 1: Fetch the Netlify site to get account_id
  const siteRes = await netlifyFetch(
    `https://api.netlify.com/api/v1/sites/${siteId}`,
    netlifyToken,
  );
  if (!siteRes.ok) {
    const msg = `Failed to fetch Netlify site (${siteRes.status}). Check that netlify_site_id is correct.`;
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "error", message: msg,
      });
    }
    return err(msg, 502, { netlify_status: siteRes.status, site_id_used: siteId });
  }
  const siteData = siteRes.body as Record<string, unknown>;
  const accountId = siteData.account_id as string | undefined;
  const accountSlug = siteData.account_slug ?? siteData.account_name ?? "";
  if (!accountId) {
    return err("Could not read account_id from Netlify site response.", 502);
  }

  // Step 2: Fetch existing env var keys for this site
  // Netlify Envelope API: GET /api/v1/accounts/{account_id}/env?site_id={site_id}
  const existingRes = await netlifyFetch(
    `https://api.netlify.com/api/v1/accounts/${accountId}/env?site_id=${siteId}`,
    netlifyToken,
  );
  const existingKeys = new Set<string>();
  if (existingRes.ok && Array.isArray(existingRes.body)) {
    for (const v of existingRes.body as Array<{ key: string }>) {
      if (v.key) existingKeys.add(v.key);
    }
  }

  // Step 3: Split into creates and updates
  const toCreate: Array<{ key: string; values: Array<{ value: string; context: string }> }> = [];
  const toUpdate: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(safeVars)) {
    if (existingKeys.has(key)) {
      toUpdate.push({ key, value });
    } else {
      toCreate.push({ key, values: [{ value, context: "all" }] });
    }
  }

  const errors: string[] = [];

  // Step 4a: Create new vars in one batch POST
  if (toCreate.length > 0) {
    const createRes = await netlifyFetch(
      `https://api.netlify.com/api/v1/accounts/${accountId}/env?site_id=${siteId}`,
      netlifyToken,
      "POST",
      toCreate,
    );
    if (!createRes.ok) {
      const netlifyMsg = (createRes.body as Record<string, unknown>)?.message ?? "";
      errors.push(`Create failed (${createRes.status})${netlifyMsg ? `: ${netlifyMsg}` : ""} — keys: ${toCreate.map(e => e.key).join(", ")}`);
    }
  }

  // Step 4b: Update existing vars individually via PATCH
  for (const { key, value } of toUpdate) {
    const patchRes = await netlifyFetch(
      `https://api.netlify.com/api/v1/accounts/${accountId}/env/${key}?site_id=${siteId}`,
      netlifyToken,
      "PATCH",
      { values: [{ value, context: "all" }] },
    );
    if (!patchRes.ok) {
      const netlifyMsg = (patchRes.body as Record<string, unknown>)?.message ?? "";
      errors.push(`Update failed for key "${key}" (${patchRes.status})${netlifyMsg ? `: ${netlifyMsg}` : ""}`);
    }
  }

  if (errors.length > 0) {
    const errMsg = `Netlify env var errors: ${errors.join(" | ")}`;
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "error", message: errMsg,
      });
    }
    return err(errMsg, 502, {
      netlify_status: "partial_failure",
      site_id_used: siteId,
      account_id_used: accountId,
      account_slug_used: accountSlug,
    });
  }

  // Step 5: Mark env requirement rows as added
  const sentKeys = Object.keys(safeVars);
  await adminClient
    .from("platform_instance_env_requirements")
    .update({ status: "added" })
    .eq("instance_id", instance_id)
    .in("env_key", sentKeys)
    .in("status", ["missing"]);

  await adminClient
    .from("platform_generated_setup_tasks")
    .update({ status: "completed" })
    .eq("instance_id", instance_id)
    .eq("task_key", "netlify_set_env_vars")
    .in("status", ["draft", "ready", "copied"]);

  await adminClient
    .from("platform_provisioning_steps")
    .update({ status: "completed", completed_at: now })
    .eq("instance_id", instance_id)
    .eq("step_key", "configure_env_vars")
    .in("status", ["not_started", "in_progress"]);

  // Step 6: Trigger a new Netlify build so Vite picks up the env vars
  // POST /api/v1/sites/{site_id}/builds
  let deployTriggered = false;
  const buildRes = await netlifyFetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/builds`,
    netlifyToken,
    "POST",
    {},
  );
  deployTriggered = buildRes.ok;

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "success",
      message: `Netlify env vars set successfully: ${sentKeys.join(", ")}${deployTriggered ? " — redeploy triggered" : " — WARNING: redeploy trigger failed"}`,
    });
  }

  return ok({
    keys_set: sentKeys,
    count: sentKeys.length,
    site_id: siteId,
    account_id: accountId,
    account_slug: accountSlug,
    created_count: toCreate.length,
    updated_count: toUpdate.length,
    deploy_triggered: deployTriggered,
  });
});
