import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load property
    const { data: prop } = await supabase
      .from("properties").select("id").limit(1).maybeSingle();

    let settings: {
      email_provider: string;
      smtp_host: string;
      smtp_port: number;
      smtp_secure: boolean;
      smtp_from: string;
      admin_email: string;
    } | null = null;

    if (prop) {
      const { data } = await supabase
        .from("email_settings")
        .select("email_provider,smtp_host,smtp_port,smtp_secure,smtp_from,admin_email")
        .eq("property_id", prop.id)
        .maybeSingle();
      settings = data ?? null;
    }

    // Resolve effective values (DB → env fallback)
    const provider = settings?.email_provider
      ?? (Deno.env.get("EMAIL_PROVIDER") ?? "disabled").toLowerCase().trim();
    const smtpHost = settings?.smtp_host || Deno.env.get("SMTP_HOSTNAME") || "";
    const smtpPort = settings?.smtp_port ?? parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10);
    const smtpSecure = settings?.smtp_secure ?? (Deno.env.get("SMTP_SECURE") === "true");
    const smtpFrom = settings?.smtp_from || Deno.env.get("SMTP_FROM") || "";
    const adminEmail = settings?.admin_email || Deno.env.get("ADMIN_EMAIL") || "";

    // Secret presence checks (no values returned)
    const smtpUsernameKey = prop ? `email_smtp_username_${prop.id}` : "";
    const smtpPasswordKey = prop ? `email_smtp_password_${prop.id}` : "";

    let smtpUsernamePreview: string | null = null;
    let smtpUsernameConfigured = false;
    let smtpPasswordConfigured = false;

    let configWarning: string | null = null;

    if (prop) {
      const { data: usernamePreviewData, error: previewErr } = await supabase
        .rpc("email_settings_secret_preview", { p_name: smtpUsernameKey });
      const { data: usernameExists, error: usernameErr } = await supabase
        .rpc("email_settings_secret_exists", { p_name: smtpUsernameKey });
      const { data: passwordExists, error: passwordErr } = await supabase
        .rpc("email_settings_secret_exists", { p_name: smtpPasswordKey });

      const vaultError = previewErr ?? usernameErr ?? passwordErr;
      if (vaultError) {
        console.error("[email-settings-status] vault RPC error:", vaultError.message);
        configWarning = "Could not verify saved SMTP credentials";
      }

      smtpUsernamePreview = usernamePreviewData ?? null;
      // Fall back to env presence when vault check failed (vaultError case)
      smtpUsernameConfigured = usernameExists === true || !!Deno.env.get("SMTP_USERNAME");
      smtpPasswordConfigured = passwordExists === true || !!Deno.env.get("SMTP_PASSWORD");
    } else {
      smtpUsernameConfigured = !!Deno.env.get("SMTP_USERNAME");
      smtpPasswordConfigured = !!Deno.env.get("SMTP_PASSWORD");
    }

    // Determine configured state
    const missingFields: string[] = [];
    if (provider === "smtp") {
      if (!smtpHost) missingFields.push("smtp_host");
      if (!adminEmail) missingFields.push("admin_email");
      if (!smtpUsernameConfigured) missingFields.push("smtp_username");
      if (!smtpPasswordConfigured) missingFields.push("smtp_password");
    } else if (provider === "resend") {
      if (!adminEmail) missingFields.push("admin_email");
    }

    const smtpConfigured = provider === "smtp" && missingFields.length === 0;
    const configured = provider !== "disabled" && missingFields.length === 0;

    return new Response(JSON.stringify({
      provider,
      configured,
      smtp_configured: smtpConfigured,
      missing_fields: missingFields,
      config_warning: configWarning,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      smtp_from: smtpFrom,
      admin_email: adminEmail,
      smtp_username_preview: smtpUsernamePreview,
      smtp_username_configured: smtpUsernameConfigured,
      smtp_password_configured: smtpPasswordConfigured,
      // Keep legacy fields for backwards compat with existing UI
      fromEmail: smtpFrom,
      adminEmail: adminEmail,
      missingVars: missingFields,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("email-settings-status error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
