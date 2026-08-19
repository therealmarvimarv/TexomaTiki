import { Property } from './types';

export const mockProperty: Property = {
  id: '1',
  title: 'Tiki Cottage Lake Texoma – Hot Tub & Fun',
  location: 'Gordonville, Texas, United States',
  maxGuests: 6,
  bedrooms: 3,
  beds: 3,
  bathrooms: 2,
  rating: 4.79,
  reviewCount: 126,
  basePrice: 175,
  cleaningFee: 75,
  taxRate: 0.0825,
  depositPercentage: 20,
  showLocalRecommendations: true,
  showFaq: true,
  showGuestInfo: true,
  description: `Welcome to Tiki Paradise; a tropical rural oasis located a quick drive to Cedar Mills Marina on Lake Texoma!

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

*Grocery, Eatery's, Gas stations all within 2-3 miles of the home.

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
- NO Party's; zero tolerance
- NO Smoking inside
- Please DO NOT FLUSH anything but TOILET PAPER. We are on septic and any clogging guests will be responsible.
- MAX 6 overnight guests
- MAX 10 guests total on site at any time

Failure to comply with house rules will result in fees, cancellation with no refund, and possible removal of your Airbnb account.`,
  hostName: 'Edwin',
  hostYearsHosting: 5,
  hostResponseRate: 100,
  neighborhoodText: 'Sherwood Shores is a small, quiet lakeside community on Lake Texoma, perfect for those seeking a peaceful getaway. The area offers easy access to water activities, fishing, and boating. Local marinas and restaurants are just a short drive away.',
  latitude: 33.8523,
  longitude: -96.4919,
  houseRules: 'Check-in after 4:00 PM. Checkout before 10:00 AM. Maximum 6 guests. No smoking inside. Pets allowed with prior approval. No parties or events. Respect quiet hours (10 PM - 8 AM).',
  cancellationPolicy: 'Free cancellation for 48 hours after booking. Cancel up to 7 days before check-in for a full refund. Cancel within 7 days for a 50% refund. No refund for cancellations within 48 hours of check-in.',
  safetyNotes: 'Carbon monoxide detector installed. Smoke detector installed. Fire extinguisher available. First aid kit provided. Hot tub safety cover included. Lake access requires supervision for children.',
  images: [
    {
      id: '1',
      url: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200',
      sortOrder: 0
    },
    {
      id: '2',
      url: 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 1
    },
    {
      id: '3',
      url: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 2
    },
    {
      id: '4',
      url: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 3
    },
    {
      id: '5',
      url: 'https://images.pexels.com/photos/1358912/pexels-photo-1358912.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 4
    }
  ],
  highlights: [
    {
      id: '1',
      icon: 'door-open',
      text: 'Self check-in',
      subtitle: 'Check yourself in with the smartlock.',
      sortOrder: 0
    },
    {
      id: '2',
      icon: 'bed',
      text: 'Comfy bed for better sleep',
      subtitle: 'The room-darkening shades and extra bedding are loved by guests.',
      sortOrder: 1
    },
    {
      id: '3',
      icon: 'monitor',
      text: 'Dedicated workspace',
      subtitle: 'A room with wifi that\'s well-suited for working.',
      sortOrder: 2
    }
  ],
  amenitiesByCategory: {
    'Kitchen and dining': [
      { id: 'a1', name: 'Kitchen', icon: 'utensils-crossed' },
      { id: 'a2', name: 'Refrigerator', icon: 'refrigerator' },
      { id: 'a3', name: 'Microwave', icon: 'microwave' },
      { id: 'a4', name: 'Cooking basics', icon: 'chef-hat' },
      { id: 'a5', name: 'Dishes and silverware', icon: 'utensils-crossed' },
      { id: 'a6', name: 'Dishwasher', icon: 'droplets' },
      { id: 'a7', name: 'Coffee maker', icon: 'coffee' },
      { id: 'a8', name: 'Dining table', icon: 'table-2' },
      { id: 'a9', name: 'Toaster', icon: 'zap' },
      { id: 'a10', name: 'Blender', icon: 'blend' },
      { id: 'a11', name: 'Wine glasses', icon: 'wine' }
    ],
    'Bathroom': [
      { id: 'b1', name: 'Hair dryer', icon: 'wind' },
      { id: 'b2', name: 'Shampoo', icon: 'droplet' },
      { id: 'b3', name: 'Hot water', icon: 'droplets' },
      { id: 'b4', name: 'Shower gel', icon: 'droplet' },
      { id: 'b5', name: 'Body soap', icon: 'sparkles' },
      { id: 'b6', name: 'Conditioner', icon: 'droplet' },
      { id: 'b7', name: 'Towels', icon: 'layers' }
    ],
    'Bedroom and laundry': [
      { id: 'c1', name: 'Free washer – In unit', icon: 'washing-machine' },
      { id: 'c2', name: 'Dryer', icon: 'wind' },
      { id: 'c3', name: 'Hangers', icon: 'minus' },
      { id: 'c4', name: 'Bed linens', icon: 'bed' },
      { id: 'c5', name: 'Extra pillows and blankets', icon: 'bed' },
      { id: 'c6', name: 'Iron', icon: 'shirt' },
      { id: 'c7', name: 'Drying rack', icon: 'layout-grid' },
      { id: 'c8', name: 'Laundry detergent', icon: 'droplets' }
    ],
    'Entertainment': [
      { id: 'd1', name: '55 inch HDTV with Roku', icon: 'tv' },
      { id: 'd2', name: 'Board games', icon: 'gamepad-2' },
      { id: 'd3', name: 'Books', icon: 'book-open' },
      { id: 'd4', name: 'Sound system', icon: 'music' },
      { id: 'd5', name: 'Kayaks', icon: 'waves' }
    ],
    'Heating and cooling': [
      { id: 'e1', name: 'Air conditioning', icon: 'wind' },
      { id: 'e2', name: 'Heating', icon: 'flame' },
      { id: 'e3', name: 'Ceiling fan', icon: 'fan' },
      { id: 'e4', name: 'Portable fans', icon: 'fan' },
      { id: 'e5', name: 'Fireplace', icon: 'flame' }
    ],
    'Home safety': [
      { id: 'f1', name: 'Exterior security cameras on property', icon: 'camera' },
      { id: 'f2', name: 'Smoke alarm', icon: 'bell' },
      { id: 'f3', name: 'Carbon monoxide alarm', icon: 'bell-off', available: false },
      { id: 'f4', name: 'Fire extinguisher', icon: 'fire-extinguisher' },
      { id: 'f5', name: 'First aid kit', icon: 'cross' },
      { id: 'f6', name: 'Lockbox', icon: 'lock' }
    ],
    'Internet and office': [
      { id: 'g1', name: 'Wifi', icon: 'wifi' },
      { id: 'g2', name: 'Dedicated workspace', icon: 'monitor' },
      { id: 'g3', name: 'Printer', icon: 'printer' }
    ],
    'Outdoor': [
      { id: 'h1', name: 'Private hot tub – available all year', icon: 'waves' },
      { id: 'h2', name: 'BBQ grill', icon: 'flame' },
      { id: 'h3', name: 'Outdoor furniture', icon: 'armchair' },
      { id: 'h4', name: 'Outdoor dining area', icon: 'utensils-crossed' },
      { id: 'h5', name: 'Lake access', icon: 'waves' },
      { id: 'h6', name: 'Fire pit', icon: 'flame' },
      { id: 'h7', name: 'Patio', icon: 'door-open' },
      { id: 'h8', name: 'Sun loungers', icon: 'armchair' }
    ],
    'Parking and facilities': [
      { id: 'i1', name: 'Free parking on premises', icon: 'car' },
      { id: 'i2', name: 'Private entrance', icon: 'door-open' },
      { id: 'i3', name: 'EV charger', icon: 'zap' }
    ],
    'Pets': [
      { id: 'j1', name: 'Pets allowed', icon: 'dog' },
      { id: 'j2', name: 'Pet bowls', icon: 'circle' },
      { id: 'j3', name: 'Pet bed', icon: 'bed' },
      { id: 'j4', name: 'Dog leash', icon: 'link' }
    ]
  },
  sleepingArrangements: [
    {
      id: '1',
      roomName: 'Bedroom 1',
      bedType: 'Queen bed',
      sortOrder: 0,
      imageUrl: 'https://images.pexels.com/photos/1454806/pexels-photo-1454806.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: '2',
      roomName: 'Bedroom 2',
      bedType: 'Queen bed',
      sortOrder: 1,
      imageUrl: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: '3',
      roomName: 'Bedroom 3',
      bedType: 'Full bed',
      sortOrder: 2,
      imageUrl: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800'
    }
  ],
  reviews: [
    {
      id: '1',
      guestName: 'Sarah',
      guestAvatar: '',
      date: '2024-02-15',
      comment: 'Amazing place! The hot tub was absolutely perfect after spending the day on the lake. Edwin was a great host and very responsive. The cottage had everything we needed and more. Highly recommend!',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5
    },
    {
      id: '2',
      guestName: 'Michael',
      guestAvatar: '',
      date: '2024-02-01',
      comment: 'Perfect getaway spot! Clean, comfortable, and the location is ideal for lake activities. The kitchen was well-equipped and we loved the outdoor space. Will definitely be back!',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5
    },
    {
      id: '3',
      guestName: 'Jennifer',
      guestAvatar: '',
      date: '2024-01-20',
      comment: 'We had an incredible time at Tiki Cottage! The property exceeded our expectations. Beautiful views, comfortable beds, and the hot tub was a huge hit with everyone. Great communication from the host.',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5
    },
    {
      id: '4',
      guestName: 'David',
      guestAvatar: '',
      date: '2024-01-10',
      comment: 'Lovely cottage with great amenities. Very clean and well-maintained. Only minor issue was the wifi was a bit slow, but overall a fantastic stay. Would recommend to anyone looking for a peaceful lake retreat.',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 4,
      value: 4
    },
    {
      id: '5',
      guestName: 'Amanda',
      guestAvatar: '',
      date: '2023-12-28',
      comment: 'This was the perfect place for our family vacation! The kids loved being so close to the lake, and the adults appreciated the hot tub and comfortable living spaces. Everything was exactly as described. Thank you Edwin!',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5
    },
    {
      id: '6',
      guestName: 'Robert',
      guestAvatar: '',
      date: '2023-12-15',
      comment: 'Outstanding property! We celebrated our anniversary here and it was perfect. The cottage is beautifully decorated, spotlessly clean, and the hot tub under the stars was so romantic. Can\'t wait to return!',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5
    }
  ]
};
