/*
  # Add neighborhood_highlights and contact_info tables

  1. New Tables
    - `neighborhood_highlights`
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK to properties)
      - `name` (text) — place name
      - `distance` (text) — e.g. "1.5 miles"
      - `category` (text) — swim | outdoor | essentials | dining | entertainment
      - `sort_order` (int)
    - `contact_info`
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK to properties, unique)
      - `email` (text)
      - `phone` (text)
      - `response_time` (text)

  2. Security
    - Enable RLS on both tables
    - Public SELECT so the listing page can read them
    - Authenticated-only INSERT / UPDATE / DELETE

  3. Seed data
    - Seed neighborhood_highlights with the 12 hardcoded proximity items
    - Seed contact_info with the hardcoded values from ContactSection.tsx
*/

-- neighborhood_highlights
CREATE TABLE IF NOT EXISTS neighborhood_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  distance text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'essentials',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE neighborhood_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read neighborhood highlights"
  ON neighborhood_highlights FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert neighborhood highlights"
  ON neighborhood_highlights FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update neighborhood highlights"
  ON neighborhood_highlights FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete neighborhood highlights"
  ON neighborhood_highlights FOR DELETE
  TO authenticated
  USING (true);

-- contact_info
CREATE TABLE IF NOT EXISTS contact_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  response_time text NOT NULL DEFAULT 'Usually within a few hours',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read contact info"
  ON contact_info FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert contact info"
  ON contact_info FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact info"
  ON contact_info FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact info"
  ON contact_info FOR DELETE
  TO authenticated
  USING (true);

-- Seed neighborhood highlights
INSERT INTO neighborhood_highlights (property_id, name, distance, category, sort_order)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  v.name, v.distance, v.category, v.sort_order
FROM (VALUES
  ('Cedar Mills Marina',                 '1.5 miles',  'swim',          1),
  ('Juniper Point Public Use Area',      '1 mile',     'swim',          2),
  ('Cross Timbers Hiking Trail',         '2 miles',    'outdoor',       3),
  ('Cedar Mills Petting Zoo',            '1.5 miles',  'outdoor',       4),
  ('Gas Station',                        '< 1 mile',   'essentials',    5),
  ('Dollar Tree',                        '3 miles',    'essentials',    6),
  ('Pelicans Landing Restaurant',        '1.5 miles',  'dining',        7),
  ('Marshall''s Cafe/Restaurant',        '3 miles',    'dining',        8),
  ('Kitchen 377 (Casino Restaurant)',    '3 miles',    'dining',        9),
  ('Twisted Anchor Grill and Patio',     '15 miles',   'dining',       10),
  ('"The Bar"',                          '3 miles',    'dining',       11),
  ('Megastar Casino',                    '3 miles',    'entertainment',12)
) AS v(name, distance, category, sort_order)
ON CONFLICT DO NOTHING;

-- Seed contact info
INSERT INTO contact_info (property_id, email, phone, response_time)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'hello@tikicottage.com',
  '+1 (555) 123-4567',
  'Usually within a few hours'
)
ON CONFLICT (property_id) DO NOTHING;
