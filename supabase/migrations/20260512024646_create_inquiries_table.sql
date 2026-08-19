/*
  # Create inquiries table

  ## Summary
  Creates a persistent inquiry/contact log so the admin dashboard can display
  recent contact form submissions. Previously these were fire-and-forget via
  the send-notifications edge function and never stored.

  ## New Tables

  ### `inquiries`
  - `id` (uuid, primary key)
  - `property_id` (uuid, nullable FK → properties) — which property the inquiry is about
  - `sender_name` (text) — display name of the sender
  - `sender_email` (text) — sender's email address
  - `sender_phone` (text, nullable) — sender's phone if provided
  - `message` (text) — full message body
  - `status` (text, default 'new') — new | read | responded | archived
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public can INSERT (contact form submissions)
  - Authenticated admins can SELECT, UPDATE (to change status)
  - Public cannot read or update inquiries
*/

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert inquiries"
  ON inquiries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated admins can read inquiries"
  ON inquiries FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated admins can update inquiry status"
  ON inquiries FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
