import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const body = await req.json();
    const {
      email_provider,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_from,
      admin_email,
      smtp_username,
      smtp_password,
      clear_credentials,
    } = body;

    // Validate provider
    const validProviders = ["disabled", "smtp", "resend"];
    if (!email_provider || !validProviders.includes(email_provider)) {
      return new Response(JSON.stringify({ error: "email_provider must be disabled, smtp, or resend" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (email_provider === "smtp") {
      if (!smtp_host?.trim()) {
        return new Response(JSON.stringify({ error: "smtp_host is required for SMTP provider" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const port = parseInt(String(smtp_port ?? "587"), 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return new Response(JSON.stringify({ error: "smtp_port must be a valid port number (1–65535)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (smtp_from && !EMAIL_RE.test(smtp_from.trim())) {
        return new Response(JSON.stringify({ error: "smtp_from must be a valid email address" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!admin_email?.trim()) {
        return new Response(JSON.stringify({ error: "admin_email is required for SMTP provider" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!EMAIL_RE.test(admin_email.trim())) {
        return new Response(JSON.stringify({ error: "admin_email must be a valid email address" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load property
    const { data: prop } = await supabase
      .from("properties").select("id").limit(1).maybeSingle();
    if (!prop) {
      return new Response(JSON.stringify({ error: "No property found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const port = parseInt(String(smtp_port ?? "587"), 10);
    const normalizedPort = isNaN(port) ? 587 : port;

    // Upsert non-secret settings
    const { error: upsertErr } = await supabase
      .from("email_settings")
      .upsert({
        property_id: prop.id,
        email_provider: email_provider,
        smtp_host: smtp_host?.trim() ?? "",
        smtp_port: normalizedPort,
        smtp_secure: smtp_secure === true || smtp_secure === "true",
        smtp_from: smtp_from?.trim() ?? "",
        admin_email: admin_email?.trim() ?? "",
      }, { onConflict: "property_id" });

    if (upsertErr) {
      console.error("email_settings upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: "Failed to save settings" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usernameKey = `email_smtp_username_${prop.id}`;
    const passwordKey = `email_smtp_password_${prop.id}`;

    if (clear_credentials === true) {
      // Delete vault secrets so status shows Not Configured
      await supabase.rpc("email_settings_delete_secret", { p_name: usernameKey });
      await supabase.rpc("email_settings_delete_secret", { p_name: passwordKey });
    } else {
      // Store credentials if provided
      if (smtp_username?.trim()) {
        await supabase.rpc("email_settings_upsert_secret", {
          p_name: usernameKey,
          p_value: smtp_username.trim(),
        });
      }
      if (smtp_password?.trim()) {
        await supabase.rpc("email_settings_upsert_secret", {
          p_name: passwordKey,
          p_value: smtp_password.trim(),
        });
      }
    }

    // Return safe status
    const { data: usernamePreview } = await supabase
      .rpc("email_settings_secret_preview", { p_name: usernameKey });
    const { data: usernameExists } = await supabase
      .rpc("email_settings_secret_exists", { p_name: usernameKey });
    const { data: passwordExists } = await supabase
      .rpc("email_settings_secret_exists", { p_name: passwordKey });

    return new Response(JSON.stringify({
      ok: true,
      // Use "provider" to match EmailStatus interface read by the admin UI
      provider: email_provider,
      email_provider,
      smtp_host: smtp_host?.trim() ?? "",
      smtp_port: normalizedPort,
      smtp_secure: smtp_secure === true || smtp_secure === "true",
      smtp_from: smtp_from?.trim() ?? "",
      admin_email: admin_email?.trim() ?? "",
      smtp_username_preview: usernamePreview ?? null,
      smtp_username_configured: usernameExists === true,
      smtp_password_configured: passwordExists === true,
      configured: email_provider !== "disabled" && usernameExists === true && passwordExists === true,
      smtp_configured: email_provider === "smtp" && usernameExists === true && passwordExists === true,
      missing_fields: [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("email-settings-update error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
