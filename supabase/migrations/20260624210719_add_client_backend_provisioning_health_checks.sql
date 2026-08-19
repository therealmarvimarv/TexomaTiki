-- Add client backend provisioning health check keys to seed function and existing instances

CREATE OR REPLACE FUNCTION seed_instance_health_checks(p_instance_id uuid, p_client_id uuid)
  RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  checks JSONB := '[
    {"key":"source_repo_connected",               "label":"Source Repo Connected",                        "group":"Deployment",    "severity":"critical"},
    {"key":"netlify_site_created",                "label":"Netlify Site Created",                         "group":"Deployment",    "severity":"critical"},
    {"key":"netlify_env_vars_set",                "label":"Netlify Env Vars Configured",                  "group":"Deployment",    "severity":"critical"},
    {"key":"netlify_latest_deploy_present",       "label":"Netlify Deploy Exists",                        "group":"Deployment",    "severity":"warning"},
    {"key":"frontend_url_reachable",              "label":"Frontend URL Reachable",                       "group":"Deployment",    "severity":"warning"},
    {"key":"admin_url_reachable",                 "label":"Admin URL Reachable",                          "group":"Deployment",    "severity":"warning"},
    {"key":"supabase_project_created",            "label":"Client Supabase Project Created",              "group":"Database",      "severity":"critical"},
    {"key":"client_database_isolated",            "label":"Client Database Isolated",                     "group":"Database",      "severity":"critical"},
    {"key":"client_database_bootstrapped",        "label":"Client Bootstrap SQL Applied",                 "group":"Database",      "severity":"critical"},
    {"key":"client_transaction_tables_empty",     "label":"Transaction Tables Empty",                     "group":"Database",      "severity":"warning"},
    {"key":"client_auth_urls_configured",         "label":"Auth URLs Configured",                         "group":"Database",      "severity":"warning"},
    {"key":"client_admin_login_verified",         "label":"Client Admin Login Verified",                  "group":"Database",      "severity":"critical"},
    {"key":"client_storage_ready",               "label":"Storage Bucket Ready",                          "group":"Database",      "severity":"warning"},
    {"key":"client_edge_functions_deployed",      "label":"Client Edge Functions Deployed",               "group":"Database",      "severity":"critical"},
    {"key":"create_booking_request_options_ok",   "label":"Booking Function CORS/OPTIONS OK",             "group":"Database",      "severity":"critical"},
    {"key":"create_booking_request_post_ok",      "label":"Booking Function POST OK",                     "group":"Database",      "severity":"critical"},
    {"key":"client_booking_flow_verified",        "label":"Live Booking Flow Verified",                   "group":"Database",      "severity":"critical"},
    {"key":"master_admin_unaffected_verified",    "label":"Master Admin Unaffected Verified",             "group":"Database",      "severity":"critical"},
    {"key":"provider_secrets_configured_if_enabled","label":"Email/Stripe Secrets Configured If Enabled", "group":"Database",      "severity":"warning"},
    {"key":"database_bootstrap_guided",           "label":"DB Bootstrap Guided",                          "group":"Database",      "severity":"warning"},
    {"key":"migrations_applied_manual_confirmed", "label":"Migrations Applied (confirmed)",               "group":"Database",      "severity":"critical"},
    {"key":"edge_functions_deployed_manual_confirmed","label":"Edge Functions Deployed (confirmed)",       "group":"Database",      "severity":"warning"},
    {"key":"storage_configured_manual_confirmed", "label":"Storage Configured (confirmed)",               "group":"Database",      "severity":"info"},
    {"key":"property_profile_ready",              "label":"Property Profile Set Up",                      "group":"App Setup",     "severity":"warning"},
    {"key":"pricing_ready",                       "label":"Pricing Configured",                           "group":"App Setup",     "severity":"warning"},
    {"key":"fees_ready",                          "label":"Fees Configured",                              "group":"App Setup",     "severity":"info"},
    {"key":"photos_ready",                        "label":"Photos Uploaded",                              "group":"App Setup",     "severity":"info"},
    {"key":"email_templates_ready",               "label":"Email Templates Ready",                        "group":"App Setup",     "severity":"warning"},
    {"key":"calendar_sync_ready",                 "label":"Calendar Sync Configured",                     "group":"App Setup",     "severity":"info"},
    {"key":"stripe_guest_payments_ready",         "label":"Guest Stripe Payments Configured",             "group":"App Setup",     "severity":"warning"},
    {"key":"billing_status_ok",                   "label":"Billing Status OK",                            "group":"Business",      "severity":"critical"},
    {"key":"access_status_ok",                    "label":"Instance Access OK",                           "group":"Business",      "severity":"critical"},
    {"key":"handoff_ready",                       "label":"Handoff Package Ready",                        "group":"Business",      "severity":"warning"},
    {"key":"client_admin_ready",                  "label":"Client Admin Invited",                         "group":"Business",      "severity":"warning"}
  ]';
  rec JSONB;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(checks)
  LOOP
    INSERT INTO platform_instance_health_checks
      (client_id, instance_id, check_key, check_label, check_group, severity)
    VALUES (
      p_client_id, p_instance_id,
      rec->>'key', rec->>'label', rec->>'group', rec->>'severity'
    )
    ON CONFLICT (instance_id, check_key) DO UPDATE
      SET check_label = EXCLUDED.check_label,
          check_group = EXCLUDED.check_group,
          severity    = EXCLUDED.severity;
  END LOOP;
END;
$$;

-- Backfill all existing instances with any missing new checks
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, client_id FROM platform_instances LOOP
    PERFORM seed_instance_health_checks(r.id, r.client_id);
  END LOOP;
END;
$$;
