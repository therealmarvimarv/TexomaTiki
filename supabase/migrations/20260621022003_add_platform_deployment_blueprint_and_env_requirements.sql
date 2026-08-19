-- ── Platform Template Versions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_template_versions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version                     text NOT NULL,
  title                       text NOT NULL DEFAULT '',
  description                 text,
  git_ref                     text,
  netlify_site_id             text,
  supabase_migration_version  text,
  status                      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  release_notes               text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmpl_ver_select" ON platform_template_versions
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "tmpl_ver_insert" ON platform_template_versions
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "tmpl_ver_update" ON platform_template_versions
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "tmpl_ver_delete" ON platform_template_versions
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_tmpl_ver_updated_at
  BEFORE UPDATE ON platform_template_versions
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Platform Deployment Blueprints ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_deployment_blueprints (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id  uuid REFERENCES platform_template_versions(id) ON DELETE SET NULL,
  title                text NOT NULL DEFAULT '',
  description          text,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_deployment_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blueprint_select" ON platform_deployment_blueprints
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "blueprint_insert" ON platform_deployment_blueprints
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "blueprint_update" ON platform_deployment_blueprints
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "blueprint_delete" ON platform_deployment_blueprints
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_blueprint_updated_at
  BEFORE UPDATE ON platform_deployment_blueprints
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Platform Deployment Blueprint Steps ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_deployment_blueprint_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES platform_deployment_blueprints(id) ON DELETE CASCADE,
  step_key     text NOT NULL,
  step_label   text NOT NULL,
  step_group   text NOT NULL,
  instructions text,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_deployment_blueprint_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bp_steps_select" ON platform_deployment_blueprint_steps
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "bp_steps_insert" ON platform_deployment_blueprint_steps
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "bp_steps_update" ON platform_deployment_blueprint_steps
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "bp_steps_delete" ON platform_deployment_blueprint_steps
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_bp_steps_updated_at
  BEFORE UPDATE ON platform_deployment_blueprint_steps
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Platform Instance Env Requirements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_instance_env_requirements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  env_key     text NOT NULL,
  label       text NOT NULL DEFAULT '',
  provider    text NOT NULL DEFAULT 'app'
    CHECK (provider IN ('netlify', 'supabase', 'stripe', 'resend', 'twilio', 'app')),
  required    boolean NOT NULL DEFAULT true,
  status      text NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'added', 'verified', 'not_needed')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_instance_env_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "env_req_select" ON platform_instance_env_requirements
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "env_req_insert" ON platform_instance_env_requirements
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "env_req_update" ON platform_instance_env_requirements
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "env_req_delete" ON platform_instance_env_requirements
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE TRIGGER trg_env_req_updated_at
  BEFORE UPDATE ON platform_instance_env_requirements
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- ── Auto-create default env requirements for new instances ─────────────────────
CREATE OR REPLACE FUNCTION create_default_env_requirements()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO platform_instance_env_requirements
    (instance_id, env_key, label, provider, required)
  VALUES
    (NEW.id, 'VITE_SUPABASE_URL',        'Supabase URL (public)',          'netlify',  true),
    (NEW.id, 'VITE_SUPABASE_ANON_KEY',   'Supabase Anon Key (public)',     'netlify',  true),
    (NEW.id, 'SUPABASE_SERVICE_ROLE_KEY','Supabase Service Role Key',      'supabase', true),
    (NEW.id, 'STRIPE_SECRET_KEY',        'Stripe Secret Key',              'stripe',   true),
    (NEW.id, 'STRIPE_WEBHOOK_SECRET',    'Stripe Webhook Secret',          'stripe',   true),
    (NEW.id, 'RESEND_API_KEY',           'Resend API Key',                 'resend',   true),
    (NEW.id, 'SMTP_HOST',                'SMTP Host',                      'app',      false),
    (NEW.id, 'SMTP_PORT',                'SMTP Port',                      'app',      false),
    (NEW.id, 'SMTP_USER',                'SMTP Username',                  'app',      false),
    (NEW.id, 'SMTP_PASS',                'SMTP Password',                  'app',      false),
    (NEW.id, 'TWILIO_ACCOUNT_SID',       'Twilio Account SID',             'twilio',   false),
    (NEW.id, 'TWILIO_AUTH_TOKEN',        'Twilio Auth Token',              'twilio',   false),
    (NEW.id, 'TWILIO_PHONE_NUMBER',      'Twilio Phone Number',            'twilio',   false),
    (NEW.id, 'SITE_URL',                 'Production Site URL',            'netlify',  true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_env_requirements
  AFTER INSERT ON platform_instances
  FOR EACH ROW EXECUTE FUNCTION create_default_env_requirements();

-- ── Seed: template version + blueprint + steps ─────────────────────────────────
DO $$
DECLARE
  v_template_id  uuid;
  v_blueprint_id uuid;
BEGIN
  INSERT INTO platform_template_versions (version, title, description, status)
  VALUES (
    '1.0.0',
    'Master Template v1.0.0',
    'Initial release of the Tiki Cottage direct-booking platform template.',
    'active'
  )
  RETURNING id INTO v_template_id;

  INSERT INTO platform_deployment_blueprints (template_version_id, title, description, is_active)
  VALUES (
    v_template_id,
    'Client Instance Deployment Blueprint',
    'Step-by-step playbook for deploying a new isolated client instance from the master template.',
    true
  )
  RETURNING id INTO v_blueprint_id;

  INSERT INTO platform_deployment_blueprint_steps
    (blueprint_id, step_key, step_label, step_group, instructions, sort_order)
  VALUES
    -- Preparation
    (v_blueprint_id, 'prep_confirm_client',   'Confirm client record',                'Preparation', 'Verify client name, email, phone, and business name are complete in platform_clients.', 10),
    (v_blueprint_id, 'prep_confirm_billing',  'Confirm subscription/payment status',  'Preparation', 'Ensure the client plan and billing status are set. Confirm any trial or payment terms.', 20),
    (v_blueprint_id, 'prep_confirm_instance', 'Confirm instance name and custom domain','Preparation','Agree on the instance slug, property name, and desired custom domain before proceeding.', 30),
    (v_blueprint_id, 'prep_confirm_version',  'Confirm target template version',       'Preparation', 'Confirm which template version will be deployed. Use the current active version unless a specific version was requested.', 40),
    -- Project Duplication
    (v_blueprint_id, 'dup_clone_template',    'Duplicate or clone master template source',    'Project Duplication', 'Fork or duplicate the master template repository into a new isolated client repository. Do not share or link the master source.', 50),
    (v_blueprint_id, 'dup_create_project',    'Create isolated client app project',           'Project Duplication', 'Create the new project folder or repo. Confirm it is completely isolated from the master and from other clients.', 60),
    (v_blueprint_id, 'dup_set_slug',          'Set instance slug/name',                       'Project Duplication', 'Update project name, package.json name, and any hardcoded references to match this client instance.', 70),
    (v_blueprint_id, 'dup_confirm_isolation', 'Confirm no master/client data is mixed',       'Project Duplication', 'Double-check that no master DB credentials, secrets, or data are present in the new project. Each instance must have its own Supabase project and secrets.', 80),
    -- Supabase
    (v_blueprint_id, 'sb_create_project',    'Create isolated Supabase project',           'Supabase', 'Create a new Supabase project for this client. Use a unique project name and region. Do not reuse the master or platform project.', 90),
    (v_blueprint_id, 'sb_apply_migrations',  'Apply all master template migrations',       'Supabase', 'Run all migrations from the master template against the new Supabase project in order. Verify each migration applies cleanly.', 100),
    (v_blueprint_id, 'sb_verify_rls',        'Verify RLS policies',                        'Supabase', 'Confirm all RLS policies are active on every table. Test with anon and authenticated roles.', 110),
    (v_blueprint_id, 'sb_configure_auth',    'Configure Auth',                             'Supabase', 'Enable email/password auth. Disable email confirmation for internal admin accounts. Configure redirect URLs to match the new domain.', 120),
    (v_blueprint_id, 'sb_configure_storage', 'Configure Storage buckets',                  'Supabase', 'Create the property-photos bucket and any other required buckets. Set appropriate public/private policies.', 130),
    (v_blueprint_id, 'sb_add_secrets',       'Add Edge Function secrets',                  'Supabase', 'Go to Supabase Dashboard → Edge Functions → Secrets. Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, SITE_URL, and any other required secrets. Never store these values in platform notes.', 140),
    (v_blueprint_id, 'sb_deploy_functions',  'Deploy Edge Functions',                      'Supabase', 'Deploy all edge functions from the client project to the new Supabase project. Verify each function deploys without error.', 150),
    (v_blueprint_id, 'sb_verify_availability','Verify public availability works',          'Supabase', 'Test the public_availability view returns correct data for anonymous requests. Check blocked dates and availability logic.', 160),
    -- Netlify
    (v_blueprint_id, 'net_create_site',      'Create new Netlify site',                    'Netlify', 'Create a new Netlify site for this client. Use a clear site name matching the instance slug.', 170),
    (v_blueprint_id, 'net_connect_source',   'Connect duplicated project/source',          'Netlify', 'Connect the new Netlify site to the client project repository. Do not connect to the master template repo.', 180),
    (v_blueprint_id, 'net_add_env_vars',     'Add environment variables',                  'Netlify', 'Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SITE_URL to Netlify environment variables. Use the new client Supabase project values — not the master. Never paste these in platform notes.', 190),
    (v_blueprint_id, 'net_deploy',           'Deploy frontend',                            'Netlify', 'Trigger the first deploy. Review the build log for errors. Confirm the build completes successfully.', 200),
    (v_blueprint_id, 'net_verify_build',     'Verify production build',                    'Netlify', 'Visit the Netlify deploy preview URL. Confirm the property page loads, photos load, and the booking form is functional.', 210),
    -- Domain
    (v_blueprint_id, 'dom_add_domain',       'Add custom domain',                          'Domain', 'Add the client custom domain in Netlify Domains settings. Record the Netlify DNS target.', 220),
    (v_blueprint_id, 'dom_configure_dns',    'Configure DNS',                              'Domain', 'Update the client DNS records to point to Netlify. Add a CNAME or A record as instructed. Allow propagation time.', 230),
    (v_blueprint_id, 'dom_verify_ssl',       'Verify SSL',                                 'Domain', 'Confirm Netlify has provisioned an SSL certificate for the custom domain. The padlock should show in the browser.', 240),
    (v_blueprint_id, 'dom_confirm_frontend', 'Confirm frontend URL',                       'Domain', 'Visit the custom domain. Confirm the property page loads correctly over HTTPS.', 250),
    (v_blueprint_id, 'dom_confirm_admin',    'Confirm admin URL',                          'Domain', 'Visit <custom-domain>/admin/login. Confirm admin login works correctly over HTTPS.', 260),
    -- Initial App Setup
    (v_blueprint_id, 'app_create_admin',     'Create first admin user',                    'Initial App Setup', 'Use Supabase Dashboard → Authentication → Users to create the client admin account. Set a strong temporary password. Share securely — not in platform notes.', 270),
    (v_blueprint_id, 'app_account_settings', 'Fill Account settings',                      'Initial App Setup', 'Log in as admin. Go to Admin → Account Settings. Fill in the property owner name, contact info, and notification preferences.', 280),
    (v_blueprint_id, 'app_property_info',    'Fill Listing/Property info',                 'Initial App Setup', 'Go to Admin → Property Editor. Fill in property name, description, location, amenities, sleeping arrangements, and house rules.', 290),
    (v_blueprint_id, 'app_photos',           'Upload photos',                              'Initial App Setup', 'Go to Admin → Photos. Upload property photos, organized by section. Set a cover photo.', 300),
    (v_blueprint_id, 'app_pricing_fees',     'Configure pricing/fees',                     'Initial App Setup', 'Go to Admin → Pricing Editor and Fees Editor. Set base nightly rate, day-of-week rates, cleaning fee, and any additional fees.', 310),
    (v_blueprint_id, 'app_email_provider',   'Configure email provider',                   'Initial App Setup', 'Go to Admin → Email Settings. Enter Resend API key or SMTP credentials. Send a test notification to confirm delivery. Store API keys in Supabase Vault — not in platform notes.', 320),
    (v_blueprint_id, 'app_stripe',           'Configure Stripe/test payment',              'Initial App Setup', 'Go to Admin → Payments. Enter Stripe publishable key. Configure the Stripe webhook endpoint using the new Supabase Edge Function URL. Test a checkout session in Stripe test mode.', 330),
    (v_blueprint_id, 'app_ical',             'Configure iCal sync',                        'Initial App Setup', 'Go to Admin → Calendar Sync. Add any external calendar feed URLs (Airbnb, VRBO, etc.). Export iCal token and share with client if needed.', 340),
    -- Launch QA
    (v_blueprint_id, 'qa_date_picker',       'Test guest date picker',                     'Launch QA', 'Visit the property page as a guest. Select available dates. Confirm unavailable/blocked dates are not selectable.', 350),
    (v_blueprint_id, 'qa_booking_request',   'Test booking request',                       'Launch QA', 'Submit a test booking request as a guest. Confirm it appears in Admin → Bookings with status pending.', 360),
    (v_blueprint_id, 'qa_approval',          'Test admin approval/payment link',           'Launch QA', 'Approve the test booking in Admin. Confirm the guest receives a payment link email. Confirm the payment link opens a Stripe Checkout session.', 370),
    (v_blueprint_id, 'qa_stripe_webhook',    'Test Stripe webhook',                        'Launch QA', 'Complete the Stripe test payment. Confirm the booking status updates to confirmed and the dates are blocked on the calendar.', 380),
    (v_blueprint_id, 'qa_email_templates',   'Test email templates',                       'Launch QA', 'Review all automated emails: booking request, approval, payment confirmation, cancellation. Confirm subject lines, body content, and branding look correct.', 390),
    (v_blueprint_id, 'qa_automations',       'Test email automations',                     'Launch QA', 'Check Admin → Email Automations. Verify pre-arrival, post-stay, and reminder automations are enabled and trigger correctly.', 400),
    (v_blueprint_id, 'qa_calendar_blocking', 'Test calendar blocking',                     'Launch QA', 'Confirm confirmed booking dates are blocked for new requests. Test that the iCal export reflects blocked dates.', 410),
    (v_blueprint_id, 'qa_mobile',            'Test mobile layout',                         'Launch QA', 'Open the property page and admin on a mobile device or browser dev tools. Confirm all key flows work at mobile viewport.', 420),
    (v_blueprint_id, 'qa_handoff',           'Final client handoff',                       'Launch QA', 'Deliver login credentials securely. Share admin URL, property URL, and iCal export URL. Confirm client can log in and navigate the admin dashboard.', 430);

END;
$$;
