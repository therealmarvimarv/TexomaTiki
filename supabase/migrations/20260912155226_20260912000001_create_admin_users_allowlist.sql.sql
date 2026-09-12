CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','developer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_admin_users" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.admin_users (user_id, property_id, role) VALUES
  ('cee1f2c2-03f0-44b4-a81b-553b6e4262cd', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin'),
  ('6b31002e-534b-494c-839a-26fd038ce47b', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'developer')
ON CONFLICT (user_id) DO NOTHING;
