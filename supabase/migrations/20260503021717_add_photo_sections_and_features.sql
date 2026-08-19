/*
  # Add photo_sections and photo_section_features tables

  1. New Tables
    - `photo_sections`
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK to properties)
      - `title` (text) — display name, e.g. "Living Room"
      - `slug` (text) — hash-nav ID, e.g. "section-living-room"
      - `sort_order` (int)
    - `photo_section_features`
      - `id` (uuid, primary key)
      - `section_id` (uuid, FK to photo_sections)
      - `feature` (text)
      - `sort_order` (int)

  2. Modify Tables
    - Add `section_id` (uuid, nullable FK to photo_sections) to `property_images`

  3. Security
    - Enable RLS on both new tables
    - Public SELECT; authenticated INSERT/UPDATE/DELETE

  4. Seed data
    - 11 photo sections matching the hardcoded PhotoTourPage sections
    - All features per section
    - All existing Pexels photo URLs linked to their sections
*/

-- photo_sections
CREATE TABLE IF NOT EXISTS photo_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photo_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read photo sections"
  ON photo_sections FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can insert photo sections"
  ON photo_sections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update photo sections"
  ON photo_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete photo sections"
  ON photo_sections FOR DELETE TO authenticated USING (true);

-- photo_section_features
CREATE TABLE IF NOT EXISTS photo_section_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES photo_sections(id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE photo_section_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read photo section features"
  ON photo_section_features FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can insert photo section features"
  ON photo_section_features FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update photo section features"
  ON photo_section_features FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete photo section features"
  ON photo_section_features FOR DELETE TO authenticated USING (true);

-- Add section_id to property_images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'property_images' AND column_name = 'section_id'
  ) THEN
    ALTER TABLE property_images
      ADD COLUMN section_id uuid REFERENCES photo_sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed photo sections
WITH inserted_sections AS (
  INSERT INTO photo_sections (property_id, title, slug, sort_order)
  VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Living Room',       'section-living-room',  1),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Kitchen',      'section-kitchen',       2),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 1',         'section-bedroom-1',     3),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 2',         'section-bedroom-2',     4),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 3',         'section-bedroom-3',     5),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Bathroom 1',   'section-bathroom-1',    6),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Full Bathroom 2',   'section-bathroom-2',    7),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Workspace',         'section-workspace',     8),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Backyard',          'section-backyard',      9),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Patio',             'section-patio',        10),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Exterior',          'section-exterior',     11),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Additional Photos', 'section-additional',   12)
  ON CONFLICT DO NOTHING
  RETURNING id, slug
)
-- Seed features
INSERT INTO photo_section_features (section_id, feature, sort_order)
SELECT s.id, f.feature, f.sort_order
FROM inserted_sections s
JOIN (VALUES
  ('section-living-room', 'Air conditioning',              1),
  ('section-living-room', 'Board games',                   2),
  ('section-living-room', 'Heating',                       3),
  ('section-living-room', 'Ceiling fan',                   4),
  ('section-living-room', 'TV',                            5),
  ('section-kitchen',     'Baking sheet',                  1),
  ('section-kitchen',     'Barbecue utensils',             2),
  ('section-kitchen',     'Coffee',                        3),
  ('section-kitchen',     'Coffee maker',                  4),
  ('section-kitchen',     'Cooking basics',                5),
  ('section-kitchen',     'Dishes and silverware',         6),
  ('section-kitchen',     'Hot water kettle',              7),
  ('section-kitchen',     'Microwave',                     8),
  ('section-kitchen',     'Refrigerator',                  9),
  ('section-kitchen',     'Oven',                         10),
  ('section-kitchen',     'Stove',                        11),
  ('section-kitchen',     'Toaster',                      12),
  ('section-kitchen',     'Wine glasses',                 13),
  ('section-kitchen',     'Blender',                      14),
  ('section-bedroom-1',   'Queen bed',                     1),
  ('section-bedroom-1',   'Air conditioning',              2),
  ('section-bedroom-1',   'Bed linens',                    3),
  ('section-bedroom-1',   'Ceiling fan',                   4),
  ('section-bedroom-1',   'Extra pillows and blankets',    5),
  ('section-bedroom-1',   'Heating',                       6),
  ('section-bedroom-1',   'Room-darkening shades',         7),
  ('section-bedroom-2',   'Queen bed',                     1),
  ('section-bedroom-2',   'Air conditioning',              2),
  ('section-bedroom-2',   'Bed linens',                    3),
  ('section-bedroom-2',   'Ceiling fan',                   4),
  ('section-bedroom-2',   'Extra pillows and blankets',    5),
  ('section-bedroom-2',   'Hangers',                       6),
  ('section-bedroom-2',   'Room-darkening shades',         7),
  ('section-bedroom-2',   'Heating',                       8),
  ('section-bedroom-3',   'King bed',                      1),
  ('section-bedroom-3',   'Air conditioning',              2),
  ('section-bedroom-3',   'Bed linens',                    3),
  ('section-bedroom-3',   'Ceiling fan',                   4),
  ('section-bedroom-3',   'Extra pillows and blankets',    5),
  ('section-bedroom-3',   'Hangers',                       6),
  ('section-bedroom-3',   'Heating',                       7),
  ('section-bedroom-3',   'Room-darkening shades',         8),
  ('section-bathroom-1',  'Air conditioning',              1),
  ('section-bathroom-1',  'Bathtub',                       2),
  ('section-bathroom-1',  'Hair dryer',                    3),
  ('section-bathroom-1',  'Heating',                       4),
  ('section-bathroom-1',  'Hot water',                     5),
  ('section-bathroom-2',  'Air conditioning',              1),
  ('section-bathroom-2',  'Hair dryer',                    2),
  ('section-bathroom-2',  'Hot water',                     3),
  ('section-workspace',   'Air conditioning',              1),
  ('section-backyard',    'BBQ grill',                     1),
  ('section-backyard',    'Fire pit',                      2),
  ('section-backyard',    'Hammock',                       3),
  ('section-backyard',    'Hot tub',                       4),
  ('section-backyard',    'Outdoor furniture',             5),
  ('section-backyard',    'Sun loungers',                  6)
) AS f(slug, feature, sort_order) ON s.slug = f.slug
ON CONFLICT DO NOTHING;

-- Seed photos linked to their sections
-- We need to re-query section IDs since the CTE is done; use a DO block
DO $$
DECLARE
  pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  sid uuid;
BEGIN
  -- Living Room
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-living-room' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/2631746/pexels-photo-2631746.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
      (pid, sid, 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Full Kitchen
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-kitchen' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/3935350/pexels-photo-3935350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/1599791/pexels-photo-1599791.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
      (pid, sid, 'https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bedroom 1
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/1329711/pexels-photo-1329711.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bedroom 2
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/3773907/pexels-photo-3773907.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/2946901/pexels-photo-2946901.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bedroom 3
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-3' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bathroom 1
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1454804/pexels-photo-1454804.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/2507016/pexels-photo-2507016.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bathroom 2
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1910472/pexels-photo-1910472.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Workspace
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-workspace' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/1181360/pexels-photo-1181360.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Backyard
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-backyard' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/2373098/pexels-photo-2373098.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/1588880/pexels-photo-1588880.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/2132180/pexels-photo-2132180.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
      (pid, sid, 'https://images.pexels.com/photos/1480162/pexels-photo-1480162.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Patio
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-patio' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Exterior
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-exterior' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Additional
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-additional' LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
      (pid, sid, 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
      (pid, sid, 'https://images.pexels.com/photos/1430677/pexels-photo-1430677.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
      (pid, sid, 'https://images.pexels.com/photos/2346046/pexels-photo-2346046.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
      (pid, sid, 'https://images.pexels.com/photos/1268558/pexels-photo-1268558.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
