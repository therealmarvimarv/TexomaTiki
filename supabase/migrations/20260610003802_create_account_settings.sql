
CREATE TABLE account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid REFERENCES auth.users(id),
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'Owner/Admin',
  owner_name text,
  owner_email text,
  owner_phone text,
  business_name text,
  business_address text,
  support_email text,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  currency text NOT NULL DEFAULT 'USD',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  account_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_account_settings" ON account_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_account_settings" ON account_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_account_settings" ON account_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_account_settings" ON account_settings
  FOR DELETE TO authenticated USING (true);
