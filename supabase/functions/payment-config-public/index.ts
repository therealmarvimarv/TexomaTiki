import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Public, unauthenticated endpoint.
// Returns ONLY payment_mode, stripe_ready, and the active publishable key.
// Never returns secret keys, webhook secrets, or PII.
// BookingCard uses this to decide whether to show "Request to Book" or "Checkout".

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!prop) {
      return new Response(
        JSON.stringify({ payment_mode: "test_manual", stripe_ready: false, publishable_key: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings } = await supabase
      .from("payment_settings")
      .select("payment_mode, stripe_test_enabled, stripe_test_publishable_key, stripe_live_publishable_key")
      .eq("property_id", prop.id)
      .maybeSingle();

    const paymentMode = settings?.payment_mode ?? "test_manual";

    // stripe_ready and publishable_key are determined by the active mode.
    // Secret keys and webhook secrets are never exposed — only vault existence is checked.
    let stripeReady = false;
    let publishableKey = "";

    if (paymentMode === "test_stripe") {
      const pubKey = settings?.stripe_test_publishable_key ?? "";
      if (pubKey.startsWith("pk_test_")) {
        const preview = await supabase.rpc("payment_settings_secret_preview", {
          p_name: "stripe_test_secret_key",
        });
        const keyValid = preview.data !== null && preview.data !== "";
        if (keyValid) {
          stripeReady = true;
          publishableKey = pubKey;
        }
      }
    } else if (paymentMode === "live_stripe") {
      const pubKey = settings?.stripe_live_publishable_key ?? "";
      if (pubKey.startsWith("pk_live_")) {
        const [skPreview, whPreview] = await Promise.all([
          supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_secret_key" }),
          supabase.rpc("payment_settings_secret_preview", { p_name: "stripe_live_webhook_secret" }),
        ]);
        const keyValid = skPreview.data !== null && skPreview.data !== "";
        const whValid = whPreview.data !== null && whPreview.data !== "";
        if (keyValid && whValid) {
          stripeReady = true;
          publishableKey = pubKey;
        }
      }
    }

    return new Response(
      JSON.stringify({
        payment_mode: paymentMode,
        stripe_ready: stripeReady,
        publishable_key: publishableKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("payment-config-public error:", err);
    // Safe fallback: return test_manual on any error
    return new Response(
      JSON.stringify({ payment_mode: "test_manual", stripe_ready: false, publishable_key: "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
