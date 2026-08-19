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

function manualRequired(reason: string, instructions: string[]) {
  return ok({ status: "manual_required", reason, instructions });
}

function toSafeProjectName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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

  // Require Supabase Management provider verified
  const { data: provider } = await adminClient
    .from("platform_provider_integrations")
    .select("status")
    .eq("provider", "supabase_management")
    .maybeSingle();
  if (!provider || provider.status !== "verified") {
    return err("Supabase Management provider is not verified. Configure it in Platform Integrations first.", 400);
  }

  let body: { instance_id?: string; job_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  const { instance_id, job_id } = body;
  if (!instance_id) return err("instance_id is required", 400);

  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_name,instance_slug,supabase_project_ref,supabase_project_url,client_id")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);

  // Prevent duplicate
  if (instance.supabase_project_ref || instance.supabase_project_url) {
    return err(
      `Supabase project already configured for this instance (ref: ${instance.supabase_project_ref ?? "?"}).`,
      409,
    );
  }

  const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const orgId = Deno.env.get("SUPABASE_ORGANIZATION_ID");

  // If missing env vars → manual_required (no secret access)
  if (!accessToken || !orgId) {
    const missing = [!accessToken && "SUPABASE_ACCESS_TOKEN", !orgId && "SUPABASE_ORGANIZATION_ID"]
      .filter(Boolean).join(", ");
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "warning",
        message: `Manual Supabase setup required — missing env vars: ${missing}`,
      });
    }
    return manualRequired(
      `Required env vars not configured: ${missing}`,
      MANUAL_INSTRUCTIONS(instance.instance_name, instance.instance_slug ?? instance.instance_name),
    );
  }

  const projectName = toSafeProjectName(instance.instance_slug ?? instance.instance_name);
  const now = new Date().toISOString();

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "info",
      message: `Supabase project creation started for ${instance.instance_name} (org: ${orgId}, name: ${projectName})`,
    });
  }

  // Attempt to create project via Supabase Management API
  // POST https://api.supabase.com/v1/projects
  let apiRes: Response;
  try {
    apiRes = await fetch("https://api.supabase.com/v1/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: orgId,
        name: projectName,
        db_pass: crypto.randomUUID().replace(/-/g, "") + "Aa1!",
        region: "us-east-1",
        plan: "free",
      }),
    });
  } catch {
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "error",
        message: `Supabase project creation failed — network error reaching Supabase API`,
      });
    }
    return manualRequired(
      "Network error reaching Supabase API. Switch to manual guided setup below.",
      MANUAL_INSTRUCTIONS(instance.instance_name, projectName),
    );
  }

  if (!apiRes.ok) {
    let apiErrMsg = `Supabase Management API returned ${apiRes.status}`;
    try {
      const eb = await apiRes.json() as Record<string, unknown>;
      if (typeof eb.message === "string") apiErrMsg += `: ${eb.message}`;
    } catch { /* ignore */ }

    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id, event_type: "warning",
        message: `Manual Supabase setup required — ${apiErrMsg}`,
      });
    }
    return manualRequired(
      apiErrMsg,
      MANUAL_INSTRUCTIONS(instance.instance_name, projectName),
    );
  }

  const project = await apiRes.json() as Record<string, string>;
  const projectRef: string = project.id ?? project.ref;
  const projectUrl = `https://${projectRef}.supabase.co`;

  // Update platform_instances — only safe non-secret fields
  await adminClient.from("platform_instances").update({
    supabase_project_ref: projectRef,
    supabase_project_url: projectUrl,
  }).eq("id", instance_id);

  // Mark generated setup task completed
  await adminClient
    .from("platform_generated_setup_tasks")
    .update({ status: "completed" })
    .eq("instance_id", instance_id)
    .eq("task_key", "supabase_create_project")
    .in("status", ["draft", "ready", "copied"]);

  // Mark provisioning step completed
  await adminClient
    .from("platform_provisioning_steps")
    .update({ status: "completed", completed_at: now, external_url: projectUrl })
    .eq("instance_id", instance_id)
    .eq("step_key", "create_supabase_project")
    .in("status", ["not_started", "in_progress"]);

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "success",
      message: `Supabase project created (ref: ${projectRef}) — ${projectUrl}`,
    });
  }

  // Return only safe, non-secret fields
  return ok({
    status: "created",
    project_ref: projectRef,
    project_url: projectUrl,
  });
});

function MANUAL_INSTRUCTIONS(instanceName: string, projectSlug: string): string[] {
  return [
    `1. Go to https://supabase.com/dashboard/org and create a new project named "${projectSlug}" (or similar) for instance "${instanceName}".`,
    "2. Once the project is ready, copy the Project Reference (Settings → General).",
    "3. Apply the master template migrations: run each SQL migration file in supabase/migrations/ via the Supabase SQL editor or CLI.",
    "4. Configure Auth: Settings → Auth — set Site URL to the client's Netlify domain.",
    "5. Configure Storage buckets as needed (e.g. property-photos).",
    "6. Deploy Edge Functions: supabase functions deploy --project-ref <REF>",
    "7. Set Edge Function secrets via: supabase secrets set --project-ref <REF> STRIPE_SECRET_KEY=... RESEND_API_KEY=... etc.",
    "8. Copy the Project URL and anon key (Settings → API) into Netlify env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    "9. Once the project ref is available, save it to this instance via the provisioning panel.",
  ];
}
