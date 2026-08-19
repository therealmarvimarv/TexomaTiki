/*
  # Restore exact mockData content

  1. Adds missing subtitle column to highlights
  2. Updates property core fields to exact mockData values
  3. Replaces images, highlights, sleeping arrangements, reviews with exact mockData content
*/

-- Add missing subtitle column to highlights
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS subtitle text;

-- Update property core fields to exactly match mockData
UPDATE properties SET
  title = 'Tiki Cottage Lake Texoma – Hot Tub & Fun',
  location = 'Gordonville, Texas, United States',
  max_guests = 6,
  bedrooms = 3,
  beds = 3,
  bathrooms = 2,
  rating = 4.79,
  review_count = 126,
  description = 'Welcome to Tiki Paradise; a tropical rural oasis located a quick drive to Cedar Mills Marina on Lake Texoma!

We partner with great people who do fishing tours, sunset cruises, rent golf carts and water toys! Off-season mid-term available.

Unique & charming; fully equipped for you to indulge in indoor comfort, & outdoor entertainment.

Escape the hustle and bustle of the city to Tiki Paradise that includes a hot tub and amazing backyard! For the fire pit feel free to bring some wood.

The space
3 Bedrooms | 2 Bathrooms | Sleeps 6

BEDROOMS (3)
- Master Room #1 : King bed
- Bedroom #2 : Queen bed
- Bedroom #3 : Queen bed
* Plush bedding
* Bedside tables, lamps, closets

BACKYARD
- Hot Tub
- Tiki Bar
- Grill
- Fire Pit
- Hammock
*Backyard is NOT fully fenced and will not enclose pet*

KITCHEN
- Appliances : fridge, microwave, stove, oven, freezer
- Cooking essentials and dining utensils provided (mixology tools also)
- 4 top Breakfast bar
- Tiki bar seats 4

LIVING ROOM
- Cozy couch
- Love Seat
- Armchairs
- Smart TV

LAUNDRY
- On site
- Washer + Dryer
- Detergent provided

PARKING
- Driveway
- Street front parking also available

SECURITY
- 2 cameras outside (front & back)

AREA
- Rural, but all modern amenities are available. If there is anything you need let us know!

PROXIMITY
- Megastar Casino : (3 miles)
- Cedar Mills Petting Zoo: (1.5 miles)
- Dollar Tree: (3 miles), limited but will have food for prep, snacks, firewood and nick-nacks.
- Gas station: (< 1 mile) has limited food some too and firewood.
- Pelicans Landing Restaurant : (1.5 miles)
- Kitchen 377 (Casino Restaurant): (3 miles)
- Twisted Anchor Grill and Patio: (15 miles)
- "The Bar" Bar : (3 miles)
- Place to Swim and Fish: Cedar Mills Marina : (1.5 miles)
- Juniper Point Public Use Area : (1 mile)
- Cross Timbers Hiking Trail : (2 miles)

*Grocery, Eatery''s, Gas stations all within 2-3 miles of the home.

Guest access
Convenient self-check-in via Smart lock code.
4pm check-in time.

The home is entirely private and to yourself.
- No shared spaces.

Parking
- Driveway

Other things to note
HOT TUB
- 3-4 people at a time MAX
- Make sure to rinse and do not leave overly dirty. Any damage or exceeding dirty water may result additional charges.

PETS
- Each pet has a $60 pet fee
- Must pick up after your pet or we have a $20 per bag fee
- NO pets on furniture or an additional cleaning fee will be submitted.
*Backyard is NOT fully fenced and will not enclose pet*

HOUSE RULES
By booking and confirming your reservation you agree to the following Strict House Rules:
- NO Party''s; zero tolerance
- NO Smoking inside
- Please DO NOT FLUSH anything but TOILET PAPER. We are on septic and any clogging guests will be responsible.
- MAX 6 overnight guests
- MAX 10 guests total on site at any time

Failure to comply with house rules will result in fees, cancellation with no refund, and possible removal of your Airbnb account.',
  host_name = 'Edwin',
  host_years_hosting = 5,
  host_response_rate = 100,
  neighborhood_text = 'Sherwood Shores is a small, quiet lakeside community on Lake Texoma, perfect for those seeking a peaceful getaway. The area offers easy access to water activities, fishing, and boating. Local marinas and restaurants are just a short drive away.',
  latitude = 33.8523,
  longitude = -96.4919,
  house_rules = 'Check-in after 4:00 PM. Checkout before 10:00 AM. Maximum 6 guests. No smoking inside. Pets allowed with prior approval. No parties or events. Respect quiet hours (10 PM - 8 AM).',
  cancellation_policy = 'Free cancellation for 48 hours after booking. Cancel up to 7 days before check-in for a full refund. Cancel within 7 days for a 50% refund. No refund for cancellations within 48 hours of check-in.',
  safety_notes = 'Carbon monoxide detector installed. Smoke detector installed. Fire extinguisher available. First aid kit provided. Hot tub safety cover included. Lake access requires supervision for children.',
  base_price = 175,
  cleaning_fee = 75,
  tax_rate = 0.0825,
  deposit_percentage = 20
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Replace images with exact mockData URLs
DELETE FROM property_images WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO property_images (property_id, url, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800', 2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800', 3),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://images.pexels.com/photos/1358912/pexels-photo-1358912.jpeg?auto=compress&cs=tinysrgb&w=800', 4);

-- Replace highlights with exact mockData content
DELETE FROM highlights WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO highlights (property_id, icon, text, subtitle, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'door-open', 'Self check-in', 'Check yourself in with the smartlock.', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'bed', 'Comfy bed for better sleep', 'The room-darkening shades and extra bedding are loved by guests.', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'monitor', 'Dedicated workspace', 'A room with wifi that''s well-suited for working.', 2);

-- Replace sleeping arrangements with exact mockData content
DELETE FROM sleeping_arrangements WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO sleeping_arrangements (property_id, room_name, bed_type, image_url, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 1', 'Queen bed', 'https://images.pexels.com/photos/1454806/pexels-photo-1454806.jpeg?auto=compress&cs=tinysrgb&w=800', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 2', 'Queen bed', 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bedroom 3', 'Full bed', 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800', 2);

-- Replace reviews with exact mockData content
DELETE FROM reviews WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
INSERT INTO reviews (property_id, guest_name, guest_avatar, date, comment, cleanliness, accuracy, check_in, communication, location, value) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sarah', '', '2024-02-15', 'Amazing place! The hot tub was absolutely perfect after spending the day on the lake. Edwin was a great host and very responsive. The cottage had everything we needed and more. Highly recommend!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Michael', '', '2024-02-01', 'Perfect getaway spot! Clean, comfortable, and the location is ideal for lake activities. The kitchen was well-equipped and we loved the outdoor space. Will definitely be back!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Jennifer', '', '2024-01-20', 'We had an incredible time at Tiki Cottage! The property exceeded our expectations. Beautiful views, comfortable beds, and the hot tub was a huge hit with everyone. Great communication from the host.', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'David', '', '2024-01-10', 'Lovely cottage with great amenities. Very clean and well-maintained. Only minor issue was the wifi was a bit slow, but overall a fantastic stay. Would recommend to anyone looking for a peaceful lake retreat.', 5, 5, 5, 5, 4, 4),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Amanda', '', '2023-12-28', 'This was the perfect place for our family vacation! The kids loved being so close to the lake, and the adults appreciated the hot tub and comfortable living spaces. Everything was exactly as described. Thank you Edwin!', 5, 5, 5, 5, 5, 5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Robert', '', '2023-12-15', 'Outstanding property! We celebrated our anniversary here and it was perfect. The cottage is beautifully decorated, spotlessly clean, and the hot tub under the stars was so romantic. Can''t wait to return!', 5, 5, 5, 5, 5, 5);
