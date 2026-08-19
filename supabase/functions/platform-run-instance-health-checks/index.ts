import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: Record<string, unknown>) {
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

type CheckStatus = "passing" | "warning" | "failing" | "not_checked";

interface CheckResult {
  check_key: string;
  status: CheckStatus;
  message: string | null;
}

// ── Automated network checks ──────────────────────────────────────────────────

async function checkOptionsEndpoint(
  supabaseProjectUrl: string,
  frontendUrl: string | null,
): Promise<{ status: CheckStatus; message: string | null }> {
  const fnUrl = `${supabaseProjectUrl}/functions/v1/create-booking-request`;
  const origin = frontendUrl ?? "https://example.com";
  try {
    const res = await fetch(fnUrl, {
      method: "OPTIONS",
      headers: {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200 || res.status === 204) {
      const allowOrigin = res.headers.get("access-control-allow-origin");
      const allowMethods = res.headers.get("access-control-allow-methods");
      if (allowOrigin && allowMethods) {
        return { status: "passing", message: `OPTIONS ${res.status} — CORS headers present` };
      }
      return { status: "warning", message: `OPTIONS ${res.status} but CORS headers missing or incomplete` };
    }
    if (res.status === 404) {
      return { status: "failing", message: `create-booking-request returned 404 — function not deployed to client project` };
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "failing", message: `OPTIONS returned ${res.status} — verify_jwt may still be ON for create-booking-request` };
    }
    return { status: "failing", message: `OPTIONS returned HTTP ${res.status}` };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return { status: "failing", message: "OPTIONS request timed out (8s) — function may not be deployed or project unreachable" };
    }
    return { status: "failing", message: `OPTIONS request failed: ${msg}` };
  }
}

async function checkEdgeFunctionDeployed(
  supabaseProjectUrl: string,
): Promise<{ status: CheckStatus; message: string | null }> {
  // Piggyback on the OPTIONS check — if OPTIONS returns non-404, function exists
  const fnUrl = `${supabaseProjectUrl}/functions/v1/create-booking-request`;
  try {
    const res = await fetch(fnUrl, {
      method: "OPTIONS",
      headers: { "Origin": "https://example.com", "Access-Control-Request-Method": "POST" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return { status: "failing", message: "create-booking-request not found (404) in client project — function not deployed" };
    }
    return { status: "passing", message: `create-booking-request endpoint exists (HTTP ${res.status})` };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    return { status: "failing", message: `Edge function reachability check failed: ${msg}` };
  }
}

async function checkPostBookingRequest(
  supabaseProjectUrl: string,
  anonKey: string | null,
  instanceSlug: string,
): Promise<{ status: CheckStatus; message: string | null }> {
  // We cannot safely clean up test bookings without the client service role key.
  // Instead we do a dry-run OPTIONS + POST with a deliberately-bad payload to confirm
  // the function is live and responding to POSTs (a real 400 means it's reachable).
  // This avoids creating real bookings.
  if (!anonKey) {
    return {
      status: "warning",
      message: "Client anon key not stored — POST check skipped. Confirm manually via live booking flow test.",
    };
  }
  const fnUrl = `${supabaseProjectUrl}/functions/v1/create-booking-request`;
  const testEmail = `healthcheck+${instanceSlug}@example.com`;
  try {
    // Send POST with missing required fields — a deployed function returns 400, not 404
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({ _health_check: true, guest_email: testEmail }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) {
      return { status: "failing", message: "create-booking-request returned 404 on POST — function not deployed" };
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "failing", message: `POST returned ${res.status} — verify_jwt may still be ON` };
    }
    // 400 = function is live, rejected our incomplete payload correctly
    if (res.status === 400 || res.status === 422) {
      return { status: "passing", message: `Function live and responding correctly (HTTP ${res.status} on incomplete payload — expected)` };
    }
    // 200/201 = surprisingly accepted — still counts as deployed
    if (res.status < 300) {
      return { status: "warning", message: `Function accepted health-check POST (HTTP ${res.status}) — verify no orphan booking was created with email ${testEmail}` };
    }
    return { status: "warning", message: `POST returned HTTP ${res.status} — confirm function is operating correctly` };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    return { status: "failing", message: `POST check failed: ${msg}` };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return err("Unauthorized", 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("platform_profiles").select("platform_role").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.platform_role !== "super_admin") return err("Forbidden", 403);

  let body: { instance_id?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }
  if (!body.instance_id) return err("instance_id required", 400);

  const instanceId = body.instance_id;
  const now = new Date().toISOString();
  const actor = user.email ?? "platform_admin";

  // ── Load all relevant data ────────────────────────────────────────────────

  const [instRes, handoffRes] = await Promise.all([
    admin.from("platform_instances")
      .select("id,client_id,repo_url,instance_slug,netlify_site_id,frontend_url,admin_url,supabase_project_ref,supabase_project_url,access_status,billing_enforcement_mode,last_billing_status")
      .eq("id", instanceId).maybeSingle(),
    admin.from("platform_client_handoffs")
      .select("status,admin_invite_status,admin_invite_email")
      .eq("instance_id", instanceId).maybeSingle(),
  ]);

  const inst = instRes.data as Record<string, unknown> | null;
  if (!inst) return err("Instance not found", 404);

  const clientId = inst.client_id as string;
  const handoff = handoffRes.data as Record<string, unknown> | null;

  const { data: sub } = await admin.from("platform_client_subscriptions")
    .select("status").eq("client_id", clientId).maybeSingle() as { data: Record<string, unknown> | null };

  const { data: envVars } = await admin.from("platform_instance_env_requirements")
    .select("env_key,status").eq("instance_id", instanceId) as { data: { env_key: string; status: string }[] | null };

  const envVarsFilled = (envVars ?? []).filter(e => e.status === "set" || e.status === "confirmed").length;
  const envVarsTotal = (envVars ?? []).length;

  // ── Instance fields ───────────────────────────────────────────────────────

  const repoUrl = inst.repo_url as string | null;
  const netlifyId = inst.netlify_site_id as string | null;
  const frontendUrl = inst.frontend_url as string | null;
  const adminUrl = inst.admin_url as string | null;
  const supabaseRef = inst.supabase_project_ref as string | null;
  const clientDbUrl = inst.supabase_project_url as string | null;
  const instanceSlug = (inst.instance_slug as string | null) ?? instanceId.slice(0, 8);
  const accessStatus = inst.access_status as string;
  const billingStatus = (sub?.status as string | null) ?? (inst.last_billing_status as string | null);

  // Derive master platform ref from SUPABASE_URL env (this function runs in the master project)
  const masterPlatformUrl = supabaseUrl;
  const masterPlatformRef = masterPlatformUrl.replace("https://", "").split(".")[0];

  // ── Automated: Database Isolation ─────────────────────────────────────────

  const dbMissing = !supabaseRef && !clientDbUrl;
  const dbMatchesMaster =
    (supabaseRef && masterPlatformRef && supabaseRef === masterPlatformRef) ||
    (clientDbUrl && masterPlatformUrl && clientDbUrl === masterPlatformUrl);

  // ── Automated: Network checks (parallel where possible) ───────────────────

  let optionsResult: { status: CheckStatus; message: string | null } = {
    status: "not_checked",
    message: "No client Supabase URL configured — cannot run automated check",
  };
  let edgeFnResult: { status: CheckStatus; message: string | null } = {
    status: "not_checked",
    message: "No client Supabase URL configured — cannot run automated check",
  };
  let postResult: { status: CheckStatus; message: string | null } = {
    status: "not_checked",
    message: "No client Supabase URL configured — cannot run automated check",
  };

  if (clientDbUrl && !dbMissing && !dbMatchesMaster) {
    // Look up client anon key from env requirements (stored as confirmed value if platform tracks it)
    const anonKeyReq = (envVars ?? []).find(e => e.env_key === "VITE_SUPABASE_ANON_KEY");
    // We don't store actual values — just use null to indicate unavailable
    const clientAnonKey: string | null = null;

    [optionsResult, edgeFnResult, postResult] = await Promise.all([
      checkOptionsEndpoint(clientDbUrl, frontendUrl),
      checkEdgeFunctionDeployed(clientDbUrl),
      checkPostBookingRequest(clientDbUrl, clientAnonKey, instanceSlug),
    ]);

    void anonKeyReq; // suppress unused warning
  }

  // ── Build all check results ───────────────────────────────────────────────

  const results: CheckResult[] = [];

  function push(key: string, status: CheckStatus, message: string | null = null) {
    results.push({ check_key: key, status, message });
  }

  // Deployment
  push("source_repo_connected",
    repoUrl ? "passing" : "failing",
    repoUrl ? null : "No repo URL configured on this instance");

  push("netlify_site_created",
    netlifyId ? "passing" : "failing",
    netlifyId ? null : "Netlify site ID not set");

  if (envVarsTotal === 0) {
    push("netlify_env_vars_set", "warning", "No env var requirements defined for this instance");
  } else if (envVarsFilled === envVarsTotal) {
    push("netlify_env_vars_set", "passing", `All ${envVarsTotal} env vars confirmed`);
  } else {
    push("netlify_env_vars_set", "warning", `${envVarsFilled}/${envVarsTotal} env vars set`);
  }

  push("netlify_latest_deploy_present",
    frontendUrl ? "warning" : "failing",
    frontendUrl ? "Confirm deploy succeeded in Netlify dashboard" : "No frontend URL — deploy may not have run");

  push("frontend_url_reachable",
    frontendUrl ? "warning" : "failing",
    frontendUrl ? "Manually verify frontend is reachable" : "No frontend URL configured");

  push("admin_url_reachable",
    adminUrl ? "warning" : "failing",
    adminUrl ? "Manually verify admin URL is reachable" : "No admin URL configured");

  // Database
  push("supabase_project_created",
    (supabaseRef || clientDbUrl) ? "passing" : "failing",
    (supabaseRef || clientDbUrl) ? null : "Client Supabase project ref/URL not set");

  // AUTOMATED: client_database_isolated
  push("client_database_isolated",
    dbMissing ? "failing" : dbMatchesMaster ? "failing" : "passing",
    dbMissing
      ? "No client database configured — client is on the master platform database"
      : dbMatchesMaster
      ? `Client DB URL/ref matches the master platform — assign an isolated Supabase project (master ref: ${masterPlatformRef})`
      : null);

  // AUTOMATED: client_edge_functions_deployed
  push("client_edge_functions_deployed", edgeFnResult.status, edgeFnResult.message);

  // AUTOMATED: create_booking_request_options_ok
  push("create_booking_request_options_ok", optionsResult.status, optionsResult.message);

  // AUTOMATED: create_booking_request_post_ok
  push("create_booking_request_post_ok", postResult.status, postResult.message);

  // MANUAL: client_database_bootstrapped — do not overwrite if already passing
  const { data: existingBootstrap } = await admin
    .from("platform_instance_health_checks")
    .select("status")
    .eq("instance_id", instanceId)
    .eq("check_key", "client_database_bootstrapped")
    .maybeSingle();
  if (!existingBootstrap || existingBootstrap.status === "not_checked") {
    push("client_database_bootstrapped", "not_checked",
      "Manual: confirm client_database_bootstrap.sql was run with no errors in the client Supabase project");
  }
  // else: skip — preserve manual passing confirmation

  // MANUAL-ONLY checks: load current state and skip overwrite if already passing
  const manualOnlyKeys = [
    "client_transaction_tables_empty",
    "client_auth_urls_configured",
    "client_admin_login_verified",
    "client_storage_ready",
    "client_booking_flow_verified",
    "master_admin_unaffected_verified",
    "provider_secrets_configured_if_enabled",
  ];
  const { data: existingManual } = await admin
    .from("platform_instance_health_checks")
    .select("check_key,status")
    .eq("instance_id", instanceId)
    .in("check_key", manualOnlyKeys);

  const existingManualMap = new Map(
    (existingManual ?? []).map((r: { check_key: string; status: string }) => [r.check_key, r.status])
  );

  const manualDefaults: Record<string, string> = {
    client_transaction_tables_empty: "Manual: confirm bookings, inquiries, payment_events, notification_logs all empty at client DB launch",
    client_auth_urls_configured: "Manual: confirm Supabase Auth Site URL and Redirect URLs are set for the client project",
    client_admin_login_verified: "Manual: confirm client admin user was created in client Auth and /admin login works on deployed site",
    client_storage_ready: "Manual: confirm property-photos storage bucket exists in client project",
    client_booking_flow_verified: "Manual: confirm end-to-end booking submission works on live client site",
    master_admin_unaffected_verified: "Manual: confirm the test booking does NOT appear in the master platform admin",
    provider_secrets_configured_if_enabled: "Manual: confirm client SMTP/Resend and Stripe secrets are configured if email/payments are enabled",
  };

  for (const key of manualOnlyKeys) {
    const current = existingManualMap.get(key);
    if (!current || current === "not_checked") {
      push(key, "not_checked", manualDefaults[key] ?? null);
    }
    // If already passing/warning/failing from manual confirmation, leave it — don't push
  }

  // Legacy checks (not overwritten if already manually confirmed)
  const legacyManual = [
    { key: "database_bootstrap_guided",             msg: "Manually confirm DB bootstrap was guided" },
    { key: "migrations_applied_manual_confirmed",   msg: "Manually confirm migrations were applied" },
    { key: "edge_functions_deployed_manual_confirmed", msg: "Manually confirm edge functions deployed" },
    { key: "storage_configured_manual_confirmed",   msg: "Manually confirm storage bucket configured" },
  ];
  const { data: existingLegacy } = await admin
    .from("platform_instance_health_checks")
    .select("check_key,status")
    .eq("instance_id", instanceId)
    .in("check_key", legacyManual.map(l => l.key));
  const existingLegacyMap = new Map(
    (existingLegacy ?? []).map((r: { check_key: string; status: string }) => [r.check_key, r.status])
  );
  for (const { key, msg } of legacyManual) {
    const current = existingLegacyMap.get(key);
    if (!current || current === "not_checked") {
      push(key, "warning", msg);
    }
  }

  // App Setup — manual, never overwrite
  const appSetup = [
    "property_profile_ready", "pricing_ready", "fees_ready", "photos_ready",
    "email_templates_ready", "calendar_sync_ready", "stripe_guest_payments_ready",
  ];
  const appSetupMsgs: Record<string, string> = {
    property_profile_ready: "Manually confirm property profile is set up",
    pricing_ready: "Manually confirm pricing is configured",
    fees_ready: "Manually confirm fees are configured",
    photos_ready: "Manually confirm photos are uploaded",
    email_templates_ready: "Manually confirm email templates are ready",
    calendar_sync_ready: "Manually confirm calendar sync is configured",
    stripe_guest_payments_ready: "Manually confirm guest Stripe payments configured",
  };
  const { data: existingApp } = await admin
    .from("platform_instance_health_checks")
    .select("check_key,status")
    .eq("instance_id", instanceId)
    .in("check_key", appSetup);
  const existingAppMap = new Map(
    (existingApp ?? []).map((r: { check_key: string; status: string }) => [r.check_key, r.status])
  );
  for (const key of appSetup) {
    const current = existingAppMap.get(key);
    if (!current || current === "not_checked" || current === "warning") {
      push(key, "warning", appSetupMsgs[key] ?? "Manually confirm");
    }
  }

  // Business
  const billingOk = ["active", "trial"].includes(billingStatus ?? "");
  push("billing_status_ok",
    billingOk ? "passing" : billingStatus === "past_due" ? "warning" : "failing",
    billingOk ? `Billing: ${billingStatus}` : `Billing status: ${billingStatus ?? "unknown"}`);

  push("access_status_ok",
    accessStatus === "active" ? "passing" :
    accessStatus === "warning" ? "warning" : "failing",
    accessStatus === "active" ? null : `Instance access is: ${accessStatus}`);

  const handoffStatus = handoff?.status as string | null;
  const handoffOk = ["ready_for_client", "sent", "accepted", "completed"].includes(handoffStatus ?? "");
  push("handoff_ready",
    handoffOk ? "passing" : "warning",
    handoffOk ? `Handoff: ${handoffStatus}` : `Handoff status: ${handoffStatus ?? "not started"}`);

  const adminInviteOk = handoff?.admin_invite_status === "accepted" || handoff?.admin_invite_email;
  push("client_admin_ready",
    adminInviteOk ? "passing" : "warning",
    adminInviteOk ? null : "Admin invite not sent or accepted");

  // ── Persist results (upsert — skip manual-only keys if already passing) ────

  // Keys that should never be auto-downgraded once manually confirmed passing
  const neverDowngrade = new Set([
    ...manualOnlyKeys,
    "client_database_bootstrapped",
    ...legacyManual.map(l => l.key),
    ...appSetup,
  ]);

  // Load current statuses for neverDowngrade keys
  const { data: currentStatuses } = await admin
    .from("platform_instance_health_checks")
    .select("check_key,status")
    .eq("instance_id", instanceId)
    .in("check_key", [...neverDowngrade]);
  const currentStatusMap = new Map(
    (currentStatuses ?? []).map((r: { check_key: string; status: string }) => [r.check_key, r.status])
  );

  for (const r of results) {
    // Skip upsert for manual-only keys that are already passing — preserve manual confirmations
    if (neverDowngrade.has(r.check_key)) {
      const existing = currentStatusMap.get(r.check_key);
      if (existing === "passing") continue;
    }

    await admin.from("platform_instance_health_checks").upsert({
      client_id: clientId,
      instance_id: instanceId,
      check_key: r.check_key,
      check_label: r.check_key.replace(/_/g, " "),
      check_group: "auto",
      status: r.status,
      message: r.message,
      last_checked_at: now,
      checked_by: actor,
    }, { onConflict: "instance_id,check_key", ignoreDuplicates: false });
  }

  // ── Calculate health_status + launch_readiness ────────────────────────────

  const { data: allChecks } = await admin.from("platform_instance_health_checks")
    .select("status,severity").eq("instance_id", instanceId);

  const checks = (allChecks ?? []) as { status: string; severity: string }[];
  const hasCriticalFail = checks.some(c => c.severity === "critical" && c.status === "failing");
  const hasAnyFail = checks.some(c => c.status === "failing");
  const hasAnyWarn = checks.some(c => c.status === "warning" || c.status === "not_checked");

  const healthStatus = hasCriticalFail || hasAnyFail ? "failing" :
    hasAnyWarn ? "warning" : "healthy";

  // Don't downgrade 'launched' readiness status
  const { data: currentInst } = await admin.from("platform_instances")
    .select("launch_readiness_status").eq("id", instanceId).maybeSingle();
  const alreadyLaunched = (currentInst as { launch_readiness_status: string } | null)?.launch_readiness_status === "launched";

  const readiness = alreadyLaunched ? "launched" :
    hasCriticalFail ? "not_ready" :
    hasAnyWarn ? "needs_review" : "ready_to_launch";

  await admin.from("platform_instances").update({
    health_status: healthStatus,
    launch_readiness_status: readiness,
    last_health_check_at: now,
  }).eq("id", instanceId);

  return ok({
    success: true,
    health_status: healthStatus,
    launch_readiness_status: readiness,
    checks_run: results.length,
    critical_failures: checks.filter(c => c.severity === "critical" && c.status === "failing").length,
    warnings: checks.filter(c => c.status === "warning").length,
    automated_checks: {
      client_database_isolated: results.find(r => r.check_key === "client_database_isolated")?.status ?? "not_checked",
      client_edge_functions_deployed: edgeFnResult.status,
      create_booking_request_options_ok: optionsResult.status,
      create_booking_request_post_ok: postResult.status,
    },
  });
});
