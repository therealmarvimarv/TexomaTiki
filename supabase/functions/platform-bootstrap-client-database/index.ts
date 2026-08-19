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

  let body: { instance_id?: string; job_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  const { instance_id, job_id } = body;
  if (!instance_id) return err("instance_id is required", 400);

  const { data: instance } = await adminClient
    .from("platform_instances")
    .select("id,instance_name,instance_slug,supabase_project_ref,supabase_project_url")
    .eq("id", instance_id)
    .maybeSingle();
  if (!instance) return err("Instance not found", 404);
  if (!instance.supabase_project_ref || !instance.supabase_project_url) {
    return err("Supabase project not created yet. Run Set Up Isolated Database first.", 400);
  }

  const ref = instance.supabase_project_ref;
  const projectUrl = instance.supabase_project_url;
  const now = new Date().toISOString();

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "info",
      message: `Database bootstrap started for ${instance.instance_name} (ref: ${ref})`,
    });
  }

  // The Supabase Management API does not expose a safe endpoint for executing
  // arbitrary SQL migrations, deploying edge functions, or configuring auth
  // settings — those require the CLI or direct psql access with the database
  // password. Returning manual_required is the honest, safe response.

  const instructions = buildInstructions(ref, projectUrl, instance.instance_slug ?? instance.instance_name);

  if (job_id) {
    await adminClient.from("platform_provisioning_job_events").insert({
      job_id, event_type: "warning",
      message: `Manual database bootstrap required for ${instance.instance_name} (ref: ${ref}). Follow the provided setup checklist.`,
    });
  }

  return ok({
    status: "manual_required",
    project_ref: ref,
    project_url: projectUrl,
    instructions,
  });
});

function buildInstructions(ref: string, projectUrl: string, slug: string): Record<string, unknown>[] {
  return [
    {
      step: 1,
      title: "Install Supabase CLI and authenticate",
      commands: [
        "npm install -g supabase",
        `supabase login`,
      ],
      notes: "Run once per machine. Your personal access token is used — never share it.",
    },
    {
      step: 2,
      title: "Link to client project and apply master migrations",
      commands: [
        `supabase link --project-ref ${ref}`,
        "supabase db push",
      ],
      notes: "Run from the root of the master template repo. This applies all migrations in supabase/migrations/ to the new project.",
    },
    {
      step: 3,
      title: "Configure Auth settings",
      commands: [],
      notes: `Go to ${projectUrl}/auth/providers — set Site URL to the client's Netlify domain (e.g. https://${slug}.netlify.app). Disable email confirmation for initial testing if needed.`,
    },
    {
      step: 4,
      title: "Create storage buckets",
      commands: [
        `# In Supabase dashboard: Storage → New Bucket`,
        `# Bucket name: property-photos`,
        `# Public: false (access via RLS/signed URLs)`,
      ],
      notes: `Go to ${projectUrl}/storage/buckets and create the required buckets.`,
    },
    {
      step: 5,
      title: "Deploy Edge Functions",
      commands: [
        `supabase functions deploy --project-ref ${ref}`,
      ],
      notes: "Deploys all edge functions from the supabase/functions/ directory of the master template.",
    },
    {
      step: 6,
      title: "Set Edge Function secrets",
      commands: [
        `supabase secrets set --project-ref ${ref} \\`,
        `  STRIPE_SECRET_KEY=[PASTE_VALUE] \\`,
        `  STRIPE_WEBHOOK_SECRET=[PASTE_VALUE] \\`,
        `  RESEND_API_KEY=[PASTE_VALUE]`,
      ],
      notes: "Never paste these values into the platform dashboard. Run the CLI command locally.",
    },
    {
      step: 7,
      title: "Copy Project URL and anon key to Netlify env vars",
      commands: [],
      notes: `Go to ${projectUrl}/settings/api and copy:\n• Project URL → set as VITE_SUPABASE_URL in Netlify\n• anon (public) key → set as VITE_SUPABASE_ANON_KEY in Netlify\nUse the Netlify Env Vars card in this platform to set them securely.`,
    },
    {
      step: 8,
      title: "Create first admin user",
      commands: [],
      notes: `Go to ${projectUrl}/auth/users → Invite User. Use the property owner's email. The admin dashboard is at the client Netlify URL + /admin.`,
    },
    {
      step: 9,
      title: "Verify guest booking flow",
      commands: [],
      notes: "Visit the client's frontend URL and submit a test booking request. Confirm the booking appears in the admin dashboard and emails send correctly.",
    },
  ];
}
