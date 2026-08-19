import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AlertCandidate {
  client_id: string | null;
  instance_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  source_table: string | null;
  source_id: string | null;
  action_url: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient  = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  const { data: profile } = await admin
    .from("platform_profiles").select("platform_role").eq("id", user.id).maybeSingle();
  if (profile?.platform_role !== "super_admin") return err("Forbidden", 403);

  const actor = user.email ?? "system";
  const candidates: AlertCandidate[] = [];

  // ── 1. Urgent open support tickets ────────────────────────────────────────
  const { data: tickets } = await admin
    .from("platform_support_tickets")
    .select("id,client_id,instance_id,title")
    .eq("priority", "urgent")
    .not("status", "in", '("resolved","closed")');

  for (const t of (tickets ?? [])) {
    candidates.push({
      client_id: t.client_id,
      instance_id: t.instance_id,
      alert_type: "urgent_support",
      severity: "critical",
      title: `Urgent support ticket: ${t.title}`,
      message: "A support ticket marked urgent is still open.",
      source_table: "platform_support_tickets",
      source_id: t.id,
      action_url: `/platform/support/${t.id}`,
    });
  }

  // ── 2. Billing past_due ────────────────────────────────────────────────────
  const { data: pastDueSubs } = await admin
    .from("platform_client_subscriptions")
    .select("id,client_id,status")
    .eq("status", "past_due");

  for (const s of (pastDueSubs ?? [])) {
    candidates.push({
      client_id: s.client_id,
      instance_id: null,
      alert_type: "billing_past_due",
      severity: "critical",
      title: "Subscription payment past due",
      message: "Client subscription is past due — payment required.",
      source_table: "platform_client_subscriptions",
      source_id: s.id,
      action_url: `/platform/clients/${s.client_id}`,
    });
  }

  // ── 3. Billing cancelled ───────────────────────────────────────────────────
  const { data: cancelledSubs } = await admin
    .from("platform_client_subscriptions")
    .select("id,client_id")
    .eq("status", "cancelled");

  for (const s of (cancelledSubs ?? [])) {
    candidates.push({
      client_id: s.client_id,
      instance_id: null,
      alert_type: "billing_cancelled",
      severity: "warning",
      title: "Subscription cancelled",
      message: "Client subscription has been cancelled.",
      source_table: "platform_client_subscriptions",
      source_id: s.id,
      action_url: `/platform/clients/${s.client_id}`,
    });
  }

  // ── 4. Access suspended ────────────────────────────────────────────────────
  const { data: suspendedInst } = await admin
    .from("platform_instances")
    .select("id,client_id,instance_name")
    .in("access_status", ["suspended", "cancelled"]);

  for (const i of (suspendedInst ?? [])) {
    candidates.push({
      client_id: i.client_id,
      instance_id: i.id,
      alert_type: "access_suspended",
      severity: "critical",
      title: `Instance access suspended: ${i.instance_name}`,
      message: "Instance access has been suspended or cancelled.",
      source_table: "platform_instances",
      source_id: i.id,
      action_url: `/platform/clients/${i.client_id}`,
    });
  }

  // ── 5. Health failing ──────────────────────────────────────────────────────
  const { data: failingInst } = await admin
    .from("platform_instances")
    .select("id,client_id,instance_name")
    .eq("health_status", "failing");

  for (const i of (failingInst ?? [])) {
    candidates.push({
      client_id: i.client_id,
      instance_id: i.id,
      alert_type: "health_failing",
      severity: "critical",
      title: `Health checks failing: ${i.instance_name}`,
      message: "Instance health checks are failing.",
      source_table: "platform_instances",
      source_id: i.id,
      action_url: `/platform/provisioning/${i.id}/pack`,
    });
  }

  // ── 6. Domain failed ──────────────────────────────────────────────────────
  const { data: failedDomains } = await admin
    .from("platform_instance_domains")
    .select("id,client_id,instance_id,domain")
    .eq("status", "failed");

  for (const d of (failedDomains ?? [])) {
    candidates.push({
      client_id: d.client_id,
      instance_id: d.instance_id,
      alert_type: "domain_failed",
      severity: "warning",
      title: `Domain connection failed: ${d.domain}`,
      message: "Domain failed to connect. Manual intervention required.",
      source_table: "platform_instance_domains",
      source_id: d.id,
      action_url: `/platform/domains`,
    });
  }

  // ── 7. SSL pending ────────────────────────────────────────────────────────
  const { data: sslPending } = await admin
    .from("platform_instance_domains")
    .select("id,client_id,instance_id,domain")
    .eq("status", "ssl_pending")
    .eq("is_primary", true);

  for (const d of (sslPending ?? [])) {
    candidates.push({
      client_id: d.client_id,
      instance_id: d.instance_id,
      alert_type: "ssl_pending",
      severity: "warning",
      title: `SSL pending on primary domain: ${d.domain}`,
      message: "Primary domain SSL certificate is not yet active.",
      source_table: "platform_instance_domains",
      source_id: d.id,
      action_url: `/platform/domains`,
    });
  }

  // ── 8. Stripe webhook events failed ───────────────────────────────────────
  const { data: failedWebhooks } = await admin
    .from("platform_stripe_webhook_events")
    .select("id,client_id,event_type")
    .eq("processing_status", "failed")
    .order("created_at", { ascending: false })
    .limit(20);

  for (const w of (failedWebhooks ?? [])) {
    candidates.push({
      client_id: w.client_id,
      instance_id: null,
      alert_type: "webhook_failed",
      severity: "warning",
      title: `Stripe webhook failed: ${w.event_type}`,
      message: "A Stripe webhook event failed to process.",
      source_table: "platform_stripe_webhook_events",
      source_id: w.id,
      action_url: w.client_id ? `/platform/clients/${w.client_id}` : `/platform/billing`,
    });
  }

  // ── 9. Provisioning failed ────────────────────────────────────────────────
  const { data: failedJobs } = await admin
    .from("platform_provisioning_jobs")
    .select("id,client_id,instance_id")
    .eq("status", "failed");

  for (const j of (failedJobs ?? [])) {
    candidates.push({
      client_id: j.client_id,
      instance_id: j.instance_id,
      alert_type: "provisioning_failed",
      severity: "critical",
      title: "Provisioning job failed",
      message: "A provisioning job has failed and requires attention.",
      source_table: "platform_provisioning_jobs",
      source_id: j.id,
      action_url: `/platform/provisioning/jobs/${j.id}`,
    });
  }

  // ── 10. Lifecycle blocked ─────────────────────────────────────────────────
  const { data: blockedLC } = await admin
    .from("platform_client_lifecycle")
    .select("id,client_id")
    .eq("lifecycle_status", "blocked");

  for (const l of (blockedLC ?? [])) {
    candidates.push({
      client_id: l.client_id,
      instance_id: null,
      alert_type: "lifecycle_blocked",
      severity: "warning",
      title: "Client lifecycle blocked",
      message: "Client lifecycle status is blocked and needs review.",
      source_table: "platform_client_lifecycle",
      source_id: l.id,
      action_url: `/platform/lifecycle`,
    });
  }

  // ── Upsert: skip if active alert already exists for same key ──────────────
  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const { error: upsertErr } = await admin.from("platform_alerts").insert({
      ...c,
      status: "unread",
      created_by: actor,
    });

    if (upsertErr) {
      // unique index violation = already active alert → skip
      if (upsertErr.code === "23505") {
        skipped++;
      }
      // otherwise log but continue
    } else {
      created++;
    }
  }

  return ok({
    success: true,
    created,
    skipped,
    scanned: candidates.length,
    message: `Generated ${created} new alerts, skipped ${skipped} duplicates.`,
  });
});
