import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Use service_role client for vault access
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

    // Get payment settings row (may not exist yet)
    const { data: settings } = await supabase
      .from("payment_settings")
      .select("payment_mode, site_url, checkout_expires_minutes, stripe_test_enabled, stripe_test_publishable_key, stripe_live_publishable_key")
      .eq("property_id", prop.id)
      .maybeSingle();

    // Check vault secret existence and previews for all 4 secrets
    const [
      testSkExists, testWhExists, testSkPreview, testWhPreview,
      liveSkExists, liveWhExists, liveSkPreview, liveWhPreview,
    ] = await Promise.all([
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_test_secret_key" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_webhook_secret" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_test_secret_key" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_webhook_secret" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_live_secret_key" }),
      supabase.rpc("payment_settings_secret_exists", { p_name: "stripe_live_webhook_secret" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_secret_key" }),
      supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_webhook_secret" }),
    ]);

    // Treat as configured only when vault row exists AND preview is non-null/non-empty.
    const testKeyConfigured = testSkExists.data === true &&
      testSkPreview.data !== null && testSkPreview.data !== "";
    const testWebhookConfigured = testWhExists.data === true &&
      testWhPreview.data !== null && testWhPreview.data !== "";
    const liveKeyConfigured = liveSkExists.data === true &&
      liveSkPreview.data !== null && liveSkPreview.data !== "";
    const liveWebhookConfigured = liveWhExists.data === true &&
      liveWhPreview.data !== null && liveWhPreview.data !== "";

    const paymentMode = settings?.payment_mode ?? "test_manual";
    const siteUrl = settings?.site_url ?? "";
    const expiresMinutes = settings?.checkout_expires_minutes ?? 30;

    // Determine overall status based on the active mode
    const isLiveMode = paymentMode === "live_stripe" || paymentMode === "live_manual";
    const isStripeMode = paymentMode === "test_stripe" || paymentMode === "live_stripe";

    let stripeStatus: string;
    if (isStripeMode) {
      const keyOk = isLiveMode ? liveKeyConfigured : testKeyConfigured;
      const whOk = isLiveMode ? liveWebhookConfigured : testWebhookConfigured;
      if (!keyOk && !whOk) {
        stripeStatus = "not_configured";
      } else if (keyOk && whOk) {
        stripeStatus = "ready";
      } else if (keyOk && !whOk) {
        stripeStatus = "missing_webhook_secret";
      } else {
        stripeStatus = "partial";
      }
    } else {
      stripeStatus = "not_configured";
    }

    const webhookEndpointUrl = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

    return new Response(
      JSON.stringify({
        payment_mode: paymentMode,
        stripe_test_configured: testKeyConfigured,
        webhook_secret_configured: testWebhookConfigured,
        stripe_live_configured: liveKeyConfigured,
        live_webhook_secret_configured: liveWebhookConfigured,
        stripe_status: stripeStatus,
        secret_key_preview: testSkPreview.data ?? null,
        webhook_secret_preview: testWhPreview.data ?? null,
        live_secret_key_preview: liveSkPreview.data ?? null,
        live_webhook_secret_preview: liveWhPreview.data ?? null,
        stripe_test_publishable_key: settings?.stripe_test_publishable_key ?? "",
        stripe_live_publishable_key: settings?.stripe_live_publishable_key ?? "",
        site_url: siteUrl,
        checkout_expires_minutes: expiresMinutes,
        webhook_endpoint_url: webhookEndpointUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("payment-settings-status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
