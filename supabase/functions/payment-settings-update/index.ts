import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const VALID_MODES = ["test_manual", "test_stripe", "live_manual", "live_stripe"];

interface RequestBody {
  payment_mode?: string;
  site_url?: string;
  checkout_expires_minutes?: number;
  stripe_test_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_live_secret_key?: string;
  stripe_live_webhook_secret?: string;
  stripe_test_publishable_key?: string;
  stripe_live_publishable_key?: string;
  clear_stripe_test_keys?: boolean;
  clear_stripe_live_keys?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const {
      payment_mode,
      site_url,
      checkout_expires_minutes,
      stripe_test_secret_key,
      stripe_webhook_secret,
      stripe_live_secret_key,
      stripe_live_webhook_secret,
      stripe_test_publishable_key,
      stripe_live_publishable_key,
      clear_stripe_test_keys,
      clear_stripe_live_keys,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────

    if (payment_mode !== undefined && !VALID_MODES.includes(payment_mode)) {
      return new Response(
        JSON.stringify({ error: `payment_mode must be one of: ${VALID_MODES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Test secret key validation
    if (stripe_test_secret_key !== undefined && stripe_test_secret_key !== "") {
      if (stripe_test_secret_key.startsWith("sk_live_")) {
        return new Response(
          JSON.stringify({ error: "Live Stripe keys are not accepted in the test key field. Use the live key field." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!stripe_test_secret_key.startsWith("sk_test_")) {
        return new Response(
          JSON.stringify({ error: "Invalid Stripe test secret key. Must start with sk_test_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Live secret key validation
    if (stripe_live_secret_key !== undefined && stripe_live_secret_key !== "") {
      if (stripe_live_secret_key.startsWith("sk_test_")) {
        return new Response(
          JSON.stringify({ error: "Test Stripe keys are not accepted in the live key field. Use the test key field." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!stripe_live_secret_key.startsWith("sk_live_")) {
        return new Response(
          JSON.stringify({ error: "Invalid Stripe live secret key. Must start with sk_live_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Webhook secret validation (test)
    if (stripe_webhook_secret !== undefined && stripe_webhook_secret !== "") {
      if (!stripe_webhook_secret.startsWith("whsec_")) {
        return new Response(
          JSON.stringify({ error: "Invalid webhook secret. Must start with whsec_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Webhook secret validation (live)
    if (stripe_live_webhook_secret !== undefined && stripe_live_webhook_secret !== "") {
      if (!stripe_live_webhook_secret.startsWith("whsec_")) {
        return new Response(
          JSON.stringify({ error: "Invalid live webhook secret. Must start with whsec_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Publishable key validation
    if (stripe_test_publishable_key !== undefined && stripe_test_publishable_key !== "") {
      if (!stripe_test_publishable_key.startsWith("pk_test_")) {
        return new Response(
          JSON.stringify({ error: "Invalid test publishable key. Must start with pk_test_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    if (stripe_live_publishable_key !== undefined && stripe_live_publishable_key !== "") {
      if (!stripe_live_publishable_key.startsWith("pk_live_")) {
        return new Response(
          JSON.stringify({ error: "Invalid live publishable key. Must start with pk_live_" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (checkout_expires_minutes !== undefined) {
      const mins = Number(checkout_expires_minutes);
      if (!Number.isInteger(mins) || mins < 30 || mins > 1440) {
        return new Response(
          JSON.stringify({ error: "checkout_expires_minutes must be between 30 and 1440" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Use service_role for vault + DB writes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get first property id
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!prop) {
      return new Response(JSON.stringify({ error: "No property found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check existing live credential state for live_stripe validation ────────
    const { data: currentSettings } = await supabase
      .from("payment_settings")
      .select("id, stripe_test_enabled")
      .eq("property_id", prop.id)
      .maybeSingle();

    // For live_stripe mode: require live secret key + live webhook secret
    // (either already stored or being saved in this request)
    if (payment_mode === "live_stripe") {
      const { data: liveSkExists } = await supabase.rpc("payment_settings_secret_exists", {
        p_name: "stripe_live_secret_key",
      });
      const { data: liveWhExists } = await supabase.rpc("payment_settings_secret_exists", {
        p_name: "stripe_live_webhook_secret",
      });

      const providingLiveSk = stripe_live_secret_key !== undefined && stripe_live_secret_key !== "";
      const providingLiveWh = stripe_live_webhook_secret !== undefined && stripe_live_webhook_secret !== "";

      const hasLiveSk = liveSkExists === true || providingLiveSk;
      const hasLiveWh = liveWhExists === true || providingLiveWh;

      if (!hasLiveSk || !hasLiveWh) {
        const missing: string[] = [];
        if (!hasLiveSk) missing.push("live secret key (sk_live_...)");
        if (!hasLiveWh) missing.push("live webhook secret (whsec_...)");
        return new Response(
          JSON.stringify({
            error: `Cannot switch to live_stripe mode without: ${missing.join(" and ")}. Please enter them first.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // For test_stripe mode: require test secret key
    // (either already stored or being saved in this request)
    if (payment_mode === "test_stripe") {
      const { data: testSkExists } = await supabase.rpc("payment_settings_secret_exists", {
        p_name: "stripe_test_secret_key",
      });
      const providingTestSk = stripe_test_secret_key !== undefined && stripe_test_secret_key !== "";
      if (!testSkExists && !providingTestSk) {
        return new Response(
          JSON.stringify({ error: "Cannot switch to test_stripe mode without a test secret key. Please enter it first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Upsert non-secret settings ────────────────────────────────────────────
    const settingsUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payment_mode !== undefined) settingsUpdate.payment_mode = payment_mode;
    if (site_url !== undefined) settingsUpdate.site_url = site_url;
    if (checkout_expires_minutes !== undefined) settingsUpdate.checkout_expires_minutes = Number(checkout_expires_minutes);
    if (stripe_test_publishable_key !== undefined) settingsUpdate.stripe_test_publishable_key = stripe_test_publishable_key;
    if (stripe_live_publishable_key !== undefined) settingsUpdate.stripe_live_publishable_key = stripe_live_publishable_key;

    // ── Handle vault secret operations ────────────────────────────────────────

    // Clear test keys
    if (clear_stripe_test_keys) {
      await Promise.all([
        supabase.rpc("payment_settings_delete_secret", { p_name: "stripe_test_secret_key" }),
        supabase.rpc("payment_settings_delete_secret", { p_name: "stripe_webhook_secret" }),
      ]);
      settingsUpdate.stripe_test_enabled = false;
    } else {
      if (stripe_test_secret_key !== undefined && stripe_test_secret_key !== "") {
        await supabase.rpc("payment_settings_upsert_secret", {
          p_name: "stripe_test_secret_key",
          p_value: stripe_test_secret_key,
        });
        settingsUpdate.stripe_test_enabled = true;
      }
      if (stripe_webhook_secret !== undefined && stripe_webhook_secret !== "") {
        await supabase.rpc("payment_settings_upsert_secret", {
          p_name: "stripe_webhook_secret",
          p_value: stripe_webhook_secret,
        });
      }
    }

    // Clear live keys
    if (clear_stripe_live_keys) {
      await Promise.all([
        supabase.rpc("payment_settings_delete_secret", { p_name: "stripe_live_secret_key" }),
        supabase.rpc("payment_settings_delete_secret", { p_name: "stripe_live_webhook_secret" }),
      ]);
    } else {
      if (stripe_live_secret_key !== undefined && stripe_live_secret_key !== "") {
        await supabase.rpc("payment_settings_upsert_secret", {
          p_name: "stripe_live_secret_key",
          p_value: stripe_live_secret_key,
        });
      }
      if (stripe_live_webhook_secret !== undefined && stripe_live_webhook_secret !== "") {
        await supabase.rpc("payment_settings_upsert_secret", {
          p_name: "stripe_live_webhook_secret",
          p_value: stripe_live_webhook_secret,
        });
      }
    }

    if (currentSettings) {
      await supabase
        .from("payment_settings")
        .update(settingsUpdate)
        .eq("property_id", prop.id);
    } else {
      await supabase
        .from("payment_settings")
        .insert({ property_id: prop.id, ...settingsUpdate });
    }

    // ── Return updated status ──────────────────────────────────────────────────
    const [testSkExists, testWhExists, testSkPrev, testWhPrev, liveSkExists, liveWhExists, liveSkPrev, liveWhPrev] = await Promise.all([
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_test_secret_key" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_webhook_secret" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_test_secret_key" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_webhook_secret" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_live_secret_key" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_live_webhook_secret" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_secret_key" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_webhook_secret" }),
    ]);

    const { data: updatedSettings } = await supabase
      .from("payment_settings")
      .select("payment_mode, site_url, checkout_expires_minutes, stripe_test_publishable_key, stripe_live_publishable_key")
      .eq("property_id", prop.id)
      .maybeSingle();

    const testKeyConfigured = testSkExists.data === true &&
      testSkPrev.data !== null && testSkPrev.data !== "";
    const testWebhookConfigured = testWhExists.data === true &&
      testWhPrev.data !== null && testWhPrev.data !== "";
    const liveKeyConfigured = liveSkExists.data === true &&
      liveSkPrev.data !== null && liveSkPrev.data !== "";
    const liveWebhookConfigured = liveWhExists.data === true &&
      liveWhPrev.data !== null && liveWhPrev.data !== "";

    return new Response(
      JSON.stringify({
        ok: true,
        payment_mode: updatedSettings?.payment_mode ?? "test_manual",
        stripe_test_configured: testKeyConfigured,
        webhook_secret_configured: testWebhookConfigured,
        stripe_live_configured: liveKeyConfigured,
        live_webhook_secret_configured: liveWebhookConfigured,
        secret_key_preview: testSkPrev.data ?? null,
        webhook_secret_preview: testWhPrev.data ?? null,
        live_secret_key_preview: liveSkPrev.data ?? null,
        live_webhook_secret_preview: liveWhPrev.data ?? null,
        stripe_test_publishable_key: updatedSettings?.stripe_test_publishable_key ?? "",
        stripe_live_publishable_key: updatedSettings?.stripe_live_publishable_key ?? "",
        site_url: updatedSettings?.site_url ?? "",
        checkout_expires_minutes: updatedSettings?.checkout_expires_minutes ?? 30,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("payment-settings-update error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
