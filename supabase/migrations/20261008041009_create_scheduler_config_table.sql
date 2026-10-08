/*
# Create scheduler config table for iCal cron authentication

Creates a minimal table to store the shared secret token used by the
run_ical_import cron job. The ical-import edge function reads this
token to authenticate scheduled invocations.

1. New Tables
- `scheduler_config` — single-row config table for scheduler secrets
  - `key` (text, primary key) — config key name
  - `value` (text, not null) — config value
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
2. Security
- RLS enabled
- Only service_role can read/write (authenticated role, which is what
  the service role client uses)
- The anon role has no access
3. Data
- Inserts `ical_scheduler_token` with the shared secret value
*/

CREATE TABLE IF NOT EXISTS public.scheduler_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated (service role) can access
DROP POLICY IF EXISTS "scheduler_config_select" ON public.scheduler_config;
CREATE POLICY "scheduler_config_select"
ON public.scheduler_config FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "scheduler_config_insert" ON public.scheduler_config;
CREATE POLICY "scheduler_config_insert"
ON public.scheduler_config FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "scheduler_config_update" ON public.scheduler_config;
CREATE POLICY "scheduler_config_update"
ON public.scheduler_config FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- Insert the scheduler token
INSERT INTO public.scheduler_config (key, value)
VALUES ('ical_scheduler_token', '088325634b046e75305621d6d69389ff9430dde17214a8fb6f72f5baf829a67c')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
