/*
  # Create notification_logs table

  ## Purpose
  Tracks all email notification attempts made by the app so the admin can see
  what was sent, skipped, or failed — without storing any secrets.

  ## New Tables
  - `notification_logs`
    - `id` (uuid, primary key)
    - `related_type` (text) — e.g. "booking", "inquiry"
    - `related_id` (uuid, nullable) — foreign key to the related row (loose reference, no FK constraint to avoid cascade issues)
    - `channel` (text, default 'email') — channel used, e.g. "email"
    - `provider` (text) — "resend", "smtp", or "disabled"
    - `recipient` (text) — recipient email address
    - `subject` (text) — email subject line
    - `status` (text) — "skipped", "sent", or "failed"
    - `error_message` (text, nullable) — populated when status = "failed"
    - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled — restrictive by default
  - Authenticated users (admins) can SELECT logs
  - Service role inserts logs from edge functions (no insert policy needed for authenticated users)
  - Public/anon users have no access
*/

CREATE TABLE IF NOT EXISTS notification_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type  text        NOT NULL DEFAULT '',
  related_id    uuid        NULL,
  channel       text        NOT NULL DEFAULT 'email',
  provider      text        NOT NULL DEFAULT 'disabled',
  recipient     text        NOT NULL DEFAULT '',
  subject       text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'skipped',
  error_message text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Admins (authenticated users) can read all logs
CREATE POLICY "Authenticated users can read notification logs"
  ON notification_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Index for admin dashboard queries (latest logs, filter by type/status)
CREATE INDEX IF NOT EXISTS notification_logs_created_at_idx ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_related_idx ON notification_logs (related_type, related_id);
CREATE INDEX IF NOT EXISTS notification_logs_status_idx ON notification_logs (status);
