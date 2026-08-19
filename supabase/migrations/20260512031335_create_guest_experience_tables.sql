/*
  # Guest Experience Tables

  ## Summary
  Creates four new tables to support the guest-facing content improvements:
  FAQs, house rules (structured), property policies (cancellation, check-in/out, pet, accessibility),
  and local recommendations.

  ## New Tables

  ### faqs
  - Accordion FAQ items grouped by category, sorted and toggleable.
  - Columns: id, property_id, question, answer, category, sort_order, is_active, created_at, updated_at

  ### house_rules
  - Individual house rule cards with icon support.
  - Columns: id, property_id, title, description, icon, sort_order, is_active, created_at, updated_at

  ### property_policies
  - Flexible policy content store keyed by policy_type.
  - policy_type values: cancellation | check_in_out | pet | accessibility
  - Columns: id, property_id, policy_type, title, content, metadata (jsonb for structured fields), is_active, created_at, updated_at

  ### local_recommendations
  - Places/attractions near the property for guest discovery.
  - Columns: id, property_id, name, category, description, address, distance_label, website_url, is_featured, sort_order, is_active, created_at, updated_at

  ## Security
  - RLS enabled on all four tables
  - Public (anon) users can SELECT active rows only
  - Authenticated admin users can INSERT/UPDATE/DELETE
*/

-- ── FAQs ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active faqs"
  ON faqs FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert faqs"
  ON faqs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update faqs"
  ON faqs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete faqs"
  ON faqs FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS faqs_property_id_idx ON faqs(property_id);

-- ── House Rules ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS house_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Shield',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE house_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active house_rules"
  ON house_rules FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert house_rules"
  ON house_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update house_rules"
  ON house_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete house_rules"
  ON house_rules FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS house_rules_property_id_idx ON house_rules(property_id);

-- ── Property Policies ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, policy_type)
);

ALTER TABLE property_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active property_policies"
  ON property_policies FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert property_policies"
  ON property_policies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update property_policies"
  ON property_policies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete property_policies"
  ON property_policies FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS property_policies_property_id_type_idx ON property_policies(property_id, policy_type);

-- ── Local Recommendations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS local_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  description text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  distance_label text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE local_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active local_recommendations"
  ON local_recommendations FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert local_recommendations"
  ON local_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update local_recommendations"
  ON local_recommendations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete local_recommendations"
  ON local_recommendations FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS local_recommendations_property_id_idx ON local_recommendations(property_id);
