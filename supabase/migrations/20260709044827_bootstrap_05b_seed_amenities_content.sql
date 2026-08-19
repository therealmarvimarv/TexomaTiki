-- Bootstrap Part 5b: Seed — amenities, neighborhood, photo sections, FAQs, house rules,
-- property policies, local recommendations, email templates, automations, settings

DELETE FROM property_amenities WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM amenities;
DELETE FROM amenity_categories;

INSERT INTO amenity_categories (id, name, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Kitchen and dining', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Bathroom', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Bedroom and laundry', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Entertainment', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Heating and cooling', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Home safety', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Internet and office', 7),
  ('c1000000-0000-0000-0000-000000000008', 'Outdoor', 8),
  ('c1000000-0000-0000-0000-000000000009', 'Parking and facilities', 9),
  ('c1000000-0000-0000-0000-000000000010', 'Pets', 10);

INSERT INTO amenities (id, category_id, name, icon) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Kitchen', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Refrigerator', 'refrigerator'),
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Microwave', 'microwave'),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Cooking basics', 'chef-hat'),
  ('a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Dishes and silverware', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'Dishwasher', 'droplets'),
  ('a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001', 'Coffee maker', 'coffee'),
  ('a1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', 'Dining table', 'table-2'),
  ('a1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001', 'Toaster', 'zap'),
  ('a1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 'Blender', 'blend'),
  ('a1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'Wine glasses', 'wine'),
  ('a1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000002', 'Hair dryer', 'wind'),
  ('a1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000002', 'Shampoo', 'droplet'),
  ('a1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000002', 'Hot water', 'droplets'),
  ('a1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000002', 'Shower gel', 'droplet'),
  ('a1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000002', 'Body soap', 'sparkles'),
  ('a1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000002', 'Conditioner', 'droplet'),
  ('a1000000-0000-0000-0000-000000000018', 'c1000000-0000-0000-0000-000000000002', 'Towels', 'layers'),
  ('a1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000003', 'Free washer – In unit', 'washing-machine'),
  ('a1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000003', 'Dryer', 'wind'),
  ('a1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000003', 'Hangers', 'minus'),
  ('a1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000003', 'Bed linens', 'bed'),
  ('a1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000003', 'Extra pillows and blankets', 'bed'),
  ('a1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000003', 'Iron', 'shirt'),
  ('a1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000003', 'Drying rack', 'layout-grid'),
  ('a1000000-0000-0000-0000-000000000026', 'c1000000-0000-0000-0000-000000000003', 'Laundry detergent', 'droplets'),
  ('a1000000-0000-0000-0000-000000000027', 'c1000000-0000-0000-0000-000000000004', '55 inch HDTV with Roku', 'tv'),
  ('a1000000-0000-0000-0000-000000000028', 'c1000000-0000-0000-0000-000000000004', 'Board games', 'gamepad-2'),
  ('a1000000-0000-0000-0000-000000000029', 'c1000000-0000-0000-0000-000000000004', 'Books', 'book-open'),
  ('a1000000-0000-0000-0000-000000000030', 'c1000000-0000-0000-0000-000000000004', 'Sound system', 'music'),
  ('a1000000-0000-0000-0000-000000000031', 'c1000000-0000-0000-0000-000000000004', 'Kayaks', 'waves'),
  ('a1000000-0000-0000-0000-000000000032', 'c1000000-0000-0000-0000-000000000005', 'Air conditioning', 'wind'),
  ('a1000000-0000-0000-0000-000000000033', 'c1000000-0000-0000-0000-000000000005', 'Heating', 'flame'),
  ('a1000000-0000-0000-0000-000000000034', 'c1000000-0000-0000-0000-000000000005', 'Ceiling fan', 'fan'),
  ('a1000000-0000-0000-0000-000000000035', 'c1000000-0000-0000-0000-000000000005', 'Portable fans', 'fan'),
  ('a1000000-0000-0000-0000-000000000036', 'c1000000-0000-0000-0000-000000000005', 'Fireplace', 'flame'),
  ('a1000000-0000-0000-0000-000000000037', 'c1000000-0000-0000-0000-000000000006', 'Exterior security cameras on property', 'camera'),
  ('a1000000-0000-0000-0000-000000000038', 'c1000000-0000-0000-0000-000000000006', 'Smoke alarm', 'bell'),
  ('a1000000-0000-0000-0000-000000000039', 'c1000000-0000-0000-0000-000000000006', 'Carbon monoxide alarm', 'bell-off'),
  ('a1000000-0000-0000-0000-000000000040', 'c1000000-0000-0000-0000-000000000006', 'Fire extinguisher', 'fire-extinguisher'),
  ('a1000000-0000-0000-0000-000000000041', 'c1000000-0000-0000-0000-000000000006', 'First aid kit', 'cross'),
  ('a1000000-0000-0000-0000-000000000042', 'c1000000-0000-0000-0000-000000000006', 'Lockbox', 'lock'),
  ('a1000000-0000-0000-0000-000000000043', 'c1000000-0000-0000-0000-000000000007', 'Wifi', 'wifi'),
  ('a1000000-0000-0000-0000-000000000044', 'c1000000-0000-0000-0000-000000000007', 'Dedicated workspace', 'monitor'),
  ('a1000000-0000-0000-0000-000000000045', 'c1000000-0000-0000-0000-000000000007', 'Printer', 'printer'),
  ('a1000000-0000-0000-0000-000000000046', 'c1000000-0000-0000-0000-000000000008', 'Private hot tub – available all year', 'waves'),
  ('a1000000-0000-0000-0000-000000000047', 'c1000000-0000-0000-0000-000000000008', 'BBQ grill', 'flame'),
  ('a1000000-0000-0000-0000-000000000048', 'c1000000-0000-0000-0000-000000000008', 'Outdoor furniture', 'armchair'),
  ('a1000000-0000-0000-0000-000000000049', 'c1000000-0000-0000-0000-000000000008', 'Outdoor dining area', 'utensils-crossed'),
  ('a1000000-0000-0000-0000-000000000050', 'c1000000-0000-0000-0000-000000000008', 'Lake access', 'waves'),
  ('a1000000-0000-0000-0000-000000000051', 'c1000000-0000-0000-0000-000000000008', 'Fire pit', 'flame'),
  ('a1000000-0000-0000-0000-000000000052', 'c1000000-0000-0000-0000-000000000008', 'Patio', 'door-open'),
  ('a1000000-0000-0000-0000-000000000053', 'c1000000-0000-0000-0000-000000000008', 'Sun loungers', 'armchair'),
  ('a1000000-0000-0000-0000-000000000054', 'c1000000-0000-0000-0000-000000000009', 'Free parking on premises', 'car'),
  ('a1000000-0000-0000-0000-000000000055', 'c1000000-0000-0000-0000-000000000009', 'Private entrance', 'door-open'),
  ('a1000000-0000-0000-0000-000000000056', 'c1000000-0000-0000-0000-000000000009', 'EV charger', 'zap'),
  ('a1000000-0000-0000-0000-000000000057', 'c1000000-0000-0000-0000-000000000010', 'Pets allowed', 'dog'),
  ('a1000000-0000-0000-0000-000000000058', 'c1000000-0000-0000-0000-000000000010', 'Pet bowls', 'circle'),
  ('a1000000-0000-0000-0000-000000000059', 'c1000000-0000-0000-0000-000000000010', 'Pet bed', 'bed'),
  ('a1000000-0000-0000-0000-000000000060', 'c1000000-0000-0000-0000-000000000010', 'Dog leash', 'link');

INSERT INTO property_amenities (property_id, amenity_id)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id FROM amenities;

DELETE FROM neighborhood_highlights WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO neighborhood_highlights (property_id, name, distance, category, sort_order)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.name, v.distance, v.category, v.sort_order
FROM (VALUES
  ('Cedar Mills Marina',              '1.5 miles', 'swim',          1),
  ('Juniper Point Public Use Area',   '1 mile',    'swim',          2),
  ('Cross Timbers Hiking Trail',      '2 miles',   'outdoor',       3),
  ('Cedar Mills Petting Zoo',         '1.5 miles', 'outdoor',       4),
  ('Gas Station',                     '< 1 mile',  'essentials',    5),
  ('Dollar Tree',                     '3 miles',   'essentials',    6),
  ('Pelicans Landing Restaurant',     '1.5 miles', 'dining',        7),
  ('Marshall''s Cafe/Restaurant',     '3 miles',   'dining',        8),
  ('Kitchen 377 (Casino Restaurant)', '3 miles',   'dining',        9),
  ('Twisted Anchor Grill and Patio',  '15 miles',  'dining',       10),
  ('"The Bar"',                       '3 miles',   'dining',       11),
  ('Megastar Casino',                 '3 miles',   'entertainment',12)
) AS v(name, distance, category, sort_order);

INSERT INTO contact_info (property_id, email, phone, response_time)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'hello@tikicottage.com', '+1 (555) 123-4567', 'Usually within a few hours')
ON CONFLICT (property_id) DO NOTHING;

DELETE FROM property_images WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND section_id IS NOT NULL;
DELETE FROM photo_sections WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

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
  ON CONFLICT (property_id, slug) DO NOTHING
  RETURNING id, slug
)
INSERT INTO photo_section_features (section_id, feature, sort_order)
SELECT s.id, f.feature, f.sort_order FROM inserted_sections s
JOIN (VALUES
  ('section-living-room', 'Air conditioning', 1), ('section-living-room', 'Board games', 2),
  ('section-living-room', 'Heating', 3), ('section-living-room', 'Ceiling fan', 4), ('section-living-room', 'TV', 5),
  ('section-kitchen', 'Baking sheet', 1), ('section-kitchen', 'Barbecue utensils', 2),
  ('section-kitchen', 'Coffee', 3), ('section-kitchen', 'Coffee maker', 4), ('section-kitchen', 'Cooking basics', 5),
  ('section-kitchen', 'Dishes and silverware', 6), ('section-kitchen', 'Hot water kettle', 7),
  ('section-kitchen', 'Microwave', 8), ('section-kitchen', 'Refrigerator', 9), ('section-kitchen', 'Oven', 10),
  ('section-kitchen', 'Stove', 11), ('section-kitchen', 'Toaster', 12), ('section-kitchen', 'Wine glasses', 13), ('section-kitchen', 'Blender', 14),
  ('section-bedroom-1', 'Queen bed', 1), ('section-bedroom-1', 'Air conditioning', 2),
  ('section-bedroom-1', 'Bed linens', 3), ('section-bedroom-1', 'Ceiling fan', 4),
  ('section-bedroom-1', 'Extra pillows and blankets', 5), ('section-bedroom-1', 'Heating', 6), ('section-bedroom-1', 'Room-darkening shades', 7),
  ('section-bedroom-2', 'Queen bed', 1), ('section-bedroom-2', 'Air conditioning', 2),
  ('section-bedroom-2', 'Bed linens', 3), ('section-bedroom-2', 'Ceiling fan', 4),
  ('section-bedroom-2', 'Extra pillows and blankets', 5), ('section-bedroom-2', 'Hangers', 6),
  ('section-bedroom-2', 'Room-darkening shades', 7), ('section-bedroom-2', 'Heating', 8),
  ('section-bedroom-3', 'King bed', 1), ('section-bedroom-3', 'Air conditioning', 2),
  ('section-bedroom-3', 'Bed linens', 3), ('section-bedroom-3', 'Ceiling fan', 4),
  ('section-bedroom-3', 'Extra pillows and blankets', 5), ('section-bedroom-3', 'Hangers', 6),
  ('section-bedroom-3', 'Heating', 7), ('section-bedroom-3', 'Room-darkening shades', 8),
  ('section-bathroom-1', 'Air conditioning', 1), ('section-bathroom-1', 'Bathtub', 2),
  ('section-bathroom-1', 'Hair dryer', 3), ('section-bathroom-1', 'Heating', 4), ('section-bathroom-1', 'Hot water', 5),
  ('section-bathroom-2', 'Air conditioning', 1), ('section-bathroom-2', 'Hair dryer', 2), ('section-bathroom-2', 'Hot water', 3),
  ('section-workspace', 'Air conditioning', 1),
  ('section-backyard', 'BBQ grill', 1), ('section-backyard', 'Fire pit', 2), ('section-backyard', 'Hammock', 3),
  ('section-backyard', 'Hot tub', 4), ('section-backyard', 'Outdoor furniture', 5), ('section-backyard', 'Sun loungers', 6)
) AS f(slug, feature, sort_order) ON s.slug = f.slug
ON CONFLICT DO NOTHING;

DO $$
DECLARE pid uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; sid uuid;
BEGIN
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-living-room' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2631746/pexels-photo-2631746.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-kitchen' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/3935350/pexels-photo-3935350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1599791/pexels-photo-1599791.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1329711/pexels-photo-1329711.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/3773907/pexels-photo-3773907.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2946901/pexels-photo-2946901.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bedroom-3' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-1' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1454804/pexels-photo-1454804.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2507016/pexels-photo-2507016.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-bathroom-2' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1910472/pexels-photo-1910472.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-workspace' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1181360/pexels-photo-1181360.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-backyard' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2373098/pexels-photo-2373098.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1588880/pexels-photo-1588880.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2132180/pexels-photo-2132180.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1480162/pexels-photo-1480162.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-patio' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-exterior' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3) ON CONFLICT DO NOTHING; END IF;
  SELECT id INTO sid FROM photo_sections WHERE property_id = pid AND slug = 'section-additional' LIMIT 1;
  IF sid IS NOT NULL THEN INSERT INTO property_images (property_id, section_id, url, sort_order) VALUES
    (pid, sid, 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop', 1),
    (pid, sid, 'https://images.pexels.com/photos/1430677/pexels-photo-1430677.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 2),
    (pid, sid, 'https://images.pexels.com/photos/2346046/pexels-photo-2346046.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 3),
    (pid, sid, 'https://images.pexels.com/photos/1268558/pexels-photo-1268558.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop', 4) ON CONFLICT DO NOTHING; END IF;
END $$;

DO $$
DECLARE prop_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
DELETE FROM faqs WHERE property_id = prop_id;
DELETE FROM house_rules WHERE property_id = prop_id;
DELETE FROM local_recommendations WHERE property_id = prop_id;

INSERT INTO faqs (property_id, question, answer, category, sort_order) VALUES
  (prop_id, 'How do I book Tiki Cottage?', 'Select your check-in and check-out dates, enter the number of guests and pets, then click "Reserve." You will be directed to a secure payment page to complete your booking.', 'Booking', 10),
  (prop_id, 'When is my booking confirmed?', 'Your booking is confirmed once your payment is successfully processed. You will receive a confirmation email with your booking details shortly after payment.', 'Booking', 20),
  (prop_id, 'Can I modify my booking after it is confirmed?', 'Please contact the host directly to request changes to your reservation. Modifications are subject to availability and the host''s approval.', 'Booking', 30),
  (prop_id, 'What payment methods are accepted?', 'We accept all major credit and debit cards through our secure Stripe checkout. Card details are never stored on our servers.', 'Payments', 10),
  (prop_id, 'Is my payment secure?', 'Yes. All payments are processed through Stripe, a PCI-compliant payment provider. Your card information is encrypted and handled securely.', 'Payments', 20),
  (prop_id, 'When will I be charged?', 'Your card is charged in full at the time of booking. No payment is held in reserve — the full amount is collected when you complete checkout.', 'Payments', 30),
  (prop_id, 'What time is check-in?', 'Check-in is at 4:00 PM. Early check-in may be available depending on prior bookings — please contact the host to inquire.', 'Check-in / Check-out', 10),
  (prop_id, 'What time is check-out?', 'Check-out is at 11:00 AM. Late check-out may be available depending on upcoming reservations — please contact the host to ask.', 'Check-in / Check-out', 20),
  (prop_id, 'How do I access the property?', 'Detailed access instructions including directions and entry information will be sent to your email after your booking is confirmed. Do not share this information.', 'Check-in / Check-out', 30),
  (prop_id, 'Is parking available?', 'Yes, parking is available on the property. Specific parking details will be included in your arrival instructions.', 'Check-in / Check-out', 40),
  (prop_id, 'Are pets allowed?', 'Pets may be allowed depending on the booking. Please add any pets to your booking request and review the pet policy for details on fees and restrictions.', 'Pets', 10),
  (prop_id, 'Is there a pet fee?', 'A pet fee may apply. The exact fee will be shown during booking if pets are included in your reservation.', 'Pets', 20),
  (prop_id, 'What is the cancellation policy?', 'Cancellation terms depend on the timing of your cancellation relative to your check-in date. Please contact the host as soon as possible if you need to cancel.', 'Cancellations', 10),
  (prop_id, 'What happens if I need to cancel last minute?', 'Late cancellations may not be eligible for a refund. Please review the cancellation policy and reach out to the host promptly if your plans change.', 'Cancellations', 20),
  (prop_id, 'Is the property family-friendly?', 'Yes, Tiki Cottage is family-friendly and suitable for guests of all ages. Please note house rules regarding supervision of children near the water.', 'House Rules', 10),
  (prop_id, 'Is smoking allowed?', 'Smoking is not permitted anywhere inside the property. Designated outdoor areas may be available — please ask the host.', 'House Rules', 20),
  (prop_id, 'How close is the cottage to local attractions?', 'Tiki Cottage is conveniently located near Lake Texoma with easy access to marinas, parks, dining, and outdoor activities. See the Local Recommendations section for nearby places.', 'Local Area', 10),
  (prop_id, 'Is the property near the water?', 'Yes, Tiki Cottage is near Lake Texoma. Please review water safety guidelines and supervise children near the water at all times.', 'Local Area', 20);

INSERT INTO house_rules (property_id, title, description, icon, sort_order) VALUES
  (prop_id, 'No smoking indoors', 'Smoking is not permitted anywhere inside the property. Please smoke outdoors and dispose of materials properly.', 'Cigarette', 10),
  (prop_id, 'No parties or events', 'Parties, large gatherings, and events are not permitted. Please keep the number of guests to the reserved amount.', 'PartyPopper', 20),
  (prop_id, 'Quiet hours', 'Please observe quiet hours from 10 PM to 8 AM out of respect for neighbors.', 'Moon', 30),
  (prop_id, 'Pets must follow pet policy', 'If pets are included in your booking, please follow the pet policy rules including cleanup and furniture guidelines.', 'PawPrint', 40),
  (prop_id, 'Respect the property', 'Please treat the property with care. Guests are responsible for any damages caused during their stay.', 'Shield', 50),
  (prop_id, 'No unauthorized guests', 'Only guests listed in the booking may stay overnight. Visitors must be approved in advance.', 'Users', 60),
  (prop_id, 'Check-in and check-out times', 'Please arrive no earlier than your check-in time and depart by check-out time to allow the property to be prepared for the next guest.', 'Clock', 70),
  (prop_id, 'Leave it clean', 'Please leave the property in a tidy condition. Take out trash, do the dishes, and remove all personal belongings before departing.', 'Sparkles', 80);

INSERT INTO property_policies (property_id, policy_type, title, content, metadata) VALUES
  (prop_id, 'cancellation', 'Cancellation Policy', 'Cancellation terms vary depending on the timing of your request relative to your check-in date. Please contact the host as soon as possible if you need to cancel or change your stay. Late cancellations may not be eligible for a full refund. In the event of severe weather or emergency, please reach out directly and we will do our best to work with you.', '{"contact_instruction": "Contact the host directly to discuss your cancellation."}'),
  (prop_id, 'check_in_out', 'Check-In & Check-Out', 'Check-in is at 4:00 PM and check-out is at 11:00 AM. Early check-in or late check-out may be available depending on surrounding reservations — please contact the host in advance to request. Detailed access instructions will be sent to your email after your booking is confirmed.', '{"check_in_time": "4:00 PM", "check_out_time": "11:00 AM"}'),
  (prop_id, 'pet', 'Pet Policy', 'Pets may be allowed depending on the booking. Please include pets when submitting your booking request. A pet fee may apply. All pets must be kept on a leash or under supervision on the property grounds. Please clean up after your pets and do not allow pets on furniture or bedding unless agreed with the host. Any damage caused by pets is the responsibility of the guest.', '{"pets_allowed": true, "max_pets": 2}'),
  (prop_id, 'accessibility', 'Accessibility Notes', 'We want guests to have accurate expectations before booking. Tiki Cottage is a single-story property with level entry from the main parking area. The primary bedroom and main bathroom are on the ground floor. There are a few steps at the front entry. The property has not been independently certified for ADA compliance. Please contact the host directly with any specific accessibility questions before booking.', '{"single_story": true, "step_free_entry": false}')
ON CONFLICT (property_id, policy_type) DO NOTHING;

INSERT INTO local_recommendations (property_id, name, category, description, address, distance_label, website_url, is_featured, sort_order) VALUES
  (prop_id, 'Lake Texoma State Park', 'Beaches & Outdoors', 'Beautiful state park with swimming beaches, hiking trails, and picnic areas right on the lake.', 'Lake Texoma, OK', '5 min drive', 'https://www.travelok.com/state-parks/lake-texoma', true, 10),
  (prop_id, 'Highport Marina', 'Beaches & Outdoors', 'Full-service marina with boat rentals, fishing charters, and lake access.', 'Pottsboro, TX', '10 min drive', '', true, 20),
  (prop_id, 'Lake Texoma Fishing', 'Beaches & Outdoors', 'World-class striped bass fishing. Guided charters available year-round.', 'Lake Texoma', '5 min drive', '', false, 30),
  (prop_id, 'Catfish Bay Marina', 'Beaches & Outdoors', 'Popular local marina with boat launches, camping, and lakeside dining.', 'Kingston, OK', '15 min drive', '', false, 40),
  (prop_id, 'The Dock Restaurant', 'Food & Drinks', 'Casual lakeside dining with fresh seafood, burgers, and sunset views.', 'Pottsboro, TX', '10 min drive', '', true, 50),
  (prop_id, 'Catfish Bay Café', 'Food & Drinks', 'Local favorite for catfish, BBQ, and Southern comfort food.', 'Kingston, OK', '15 min drive', '', false, 60),
  (prop_id, 'Lone Star Coffee', 'Food & Drinks', 'Cozy local coffee shop with espresso drinks, pastries, and Wi-Fi.', 'Pottsboro, TX', '8 min drive', '', false, 70),
  (prop_id, 'Walmart Supercenter', 'Shopping', 'Full-service grocery and general merchandise store for any supplies you need.', 'Pottsboro, TX', '12 min drive', '', false, 80),
  (prop_id, 'Brookshire''s Grocery', 'Shopping', 'Local grocery store with fresh produce, deli, and essentials.', 'Durant, OK', '20 min drive', '', false, 90),
  (prop_id, 'Tanglewood Resort', 'Family Activities', 'Family resort with pools, mini golf, boat rentals, and activities for all ages.', 'Pottsboro, TX', '12 min drive', 'https://www.tanglewoodresort.com', true, 100),
  (prop_id, 'Eisenhower State Park', 'Beaches & Outdoors', 'Scenic park with hiking, picnicking, and access to the lake shoreline.', 'Denison, TX', '20 min drive', '', false, 110),
  (prop_id, 'Pottsboro Animal Clinic', 'Essentials', 'Veterinary clinic for pet emergencies or health needs during your stay.', 'Pottsboro, TX', '10 min drive', '', false, 120),
  (prop_id, 'Medical Center of Southeastern Oklahoma', 'Essentials', 'Full-service hospital for medical emergencies.', 'Durant, OK', '25 min drive', '', false, 130);
END $$;
