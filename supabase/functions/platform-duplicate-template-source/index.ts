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

function toSafeRepoName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

  // Check GitHub provider is verified
  const { data: githubProvider } = await adminClient
    .from("platform_provider_integrations")
    .select("status")
    .eq("provider", "github")
    .maybeSingle();
  if (!githubProvider || githubProvider.status !== "verified") {
    return err("GitHub/Source Control provider is not verified. Configure it in Platform Integrations first.", 400);
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
    .select("id,instance_name,instance_slug,repo_url,client_id")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);

  // Prevent duplicates
  if (instance.repo_url) {
    return err(`Source repo already exists for this instance: ${instance.repo_url}`, 409);
  }

  // Get credentials (never exposed to frontend)
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const githubTemplateRepo = Deno.env.get("GITHUB_TEMPLATE_REPO");
  const githubOrg = Deno.env.get("GITHUB_ORG");

  if (!githubToken) return err("GITHUB_TOKEN is not configured in edge function secrets.", 500);
  if (!githubTemplateRepo) return err("GITHUB_TEMPLATE_REPO is not configured in edge function secrets.", 500);
  if (!githubOrg) return err("GITHUB_ORG is not configured in edge function secrets.", 500);

  // Parse template owner/repo — GITHUB_TEMPLATE_REPO can be "owner/repo" or just "repo"
  let templateOwner = githubOrg;
  let templateRepo = githubTemplateRepo;
  if (githubTemplateRepo.includes("/")) {
    const parts = githubTemplateRepo.split("/");
    templateOwner = parts[0];
    templateRepo = parts.slice(1).join("/");
  }

  const repoName = toSafeRepoName(instance.instance_slug ?? instance.instance_name);
  const now = new Date().toISOString();

  // Log start
  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id,
      event_type: "info",
      message: `Source duplication started for ${instance.instance_name} (repo: ${githubOrg}/${repoName})`,
    });
  }

  // Call GitHub API — generate repo from template
  let githubRes: Response;
  try {
    githubRes = await fetch(
      `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: githubOrg,
          name: repoName,
          private: true,
          description: `Instance source for ${instance.instance_name}`,
        }),
      },
    );
  } catch {
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id,
        event_type: "error",
        message: `Source duplication failed — network error reaching GitHub API`,
      });
    }
    return err("Network error reaching GitHub API", 502);
  }

  if (!githubRes.ok) {
    let ghErrMsg = `GitHub API returned ${githubRes.status}`;
    try {
      const ghErrBody = await githubRes.json() as Record<string, unknown>;
      if (typeof ghErrBody.message === "string") ghErrMsg += `: ${ghErrBody.message}`;
    } catch { /* ignore */ }
    if (job_id) {
      await adminClient.from("platform_provisioning_job_events").insert({
        job_id,
        event_type: "error",
        message: `Source duplication failed — ${ghErrMsg}`,
      });
    }
    return err(ghErrMsg, 502);
  }

  const repo = await githubRes.json() as Record<string, string>;
  const repoUrl: string = repo.html_url;
  const repoFullName: string = repo.full_name;
  const defaultBranch: string = repo.default_branch ?? "main";

  // Update platform_instances
  await adminClient.from("platform_instances").update({
    repo_url: repoUrl,
    source_template_ref: `${templateOwner}/${templateRepo}`,
    deployment_strategy: "semi_automated",
  }).eq("id", instance_id);

  // Mark generated setup task completed
  await adminClient
    .from("platform_generated_setup_tasks")
    .update({ status: "completed" })
    .eq("instance_id", instance_id)
    .eq("task_key", "github_clone_template")
    .in("status", ["draft", "ready", "copied"]);

  // Mark provisioning step completed
  await adminClient
    .from("platform_provisioning_steps")
    .update({ status: "completed", completed_at: now, external_url: repoUrl })
    .eq("instance_id", instance_id)
    .eq("step_key", "connect_repo")
    .in("status", ["not_started", "in_progress"]);

  // Log success
  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id,
      event_type: "success",
      message: `Source duplicated: ${repoFullName} — ${repoUrl}`,
    });
  }

  return ok({
    repo_url: repoUrl,
    repo_name: repoFullName,
    source_template_ref: `${templateOwner}/${templateRepo}`,
    default_branch: defaultBranch,
  });
});
