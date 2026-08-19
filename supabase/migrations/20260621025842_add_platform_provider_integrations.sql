-- Phase 7: Provider Integration Readiness

CREATE TABLE IF NOT EXISTS platform_provider_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE
    CHECK (provider IN ('netlify','supabase_management','stripe','resend','twilio','smtp','domain_dns','github')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured','configured','verified','failed')),
  required_env_keys text[] NOT NULL DEFAULT '{}',
  last_checked_at timestamptz,
  last_check_status text,
  last_check_message text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_provider_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_platform_provider_integrations" ON platform_provider_integrations FOR SELECT
  TO authenticated USING (is_platform_super_admin());
CREATE POLICY "insert_platform_provider_integrations" ON platform_provider_integrations FOR INSERT
  TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "update_platform_provider_integrations" ON platform_provider_integrations FOR UPDATE
  TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "delete_platform_provider_integrations" ON platform_provider_integrations FOR DELETE
  TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_platform_provider_integrations_updated_at
  BEFORE UPDATE ON platform_provider_integrations
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- Seed provider rows (key names only, never values)
INSERT INTO platform_provider_integrations (provider, display_name, required_env_keys) VALUES
  ('netlify',             'Netlify',                  ARRAY['NETLIFY_AUTH_TOKEN', 'NETLIFY_TEAM_ID']),
  ('supabase_management', 'Supabase Management',      ARRAY['SUPABASE_ACCESS_TOKEN', 'SUPABASE_ORGANIZATION_ID']),
  ('stripe',             'Stripe',                   ARRAY['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']),
  ('resend',             'Resend',                   ARRAY['RESEND_API_KEY']),
  ('twilio',             'Twilio',                   ARRAY['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']),
  ('smtp',               'SMTP',                     ARRAY['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']),
  ('github',             'GitHub / Source Control',  ARRAY['GITHUB_TOKEN', 'GITHUB_TEMPLATE_REPO', 'GITHUB_ORG']),
  ('domain_dns',         'Domain / DNS',             ARRAY['DNS_PROVIDER', 'DNS_API_TOKEN'])
ON CONFLICT (provider) DO NOTHING;
