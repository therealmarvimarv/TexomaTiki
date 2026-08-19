import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tikicottage.com' },
    update: {},
    create: {
      email: 'admin@tikicottage.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('Created admin user:', admin.email);

  const property = await prisma.property.upsert({
    where: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    update: {},
    create: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      title: 'Tiki Cottage Lake Texoma – Hot Tub & Fun',
      location: 'Entire home in Gordonville, Texas',
      maxGuests: 6,
      bedrooms: 3,
      beds: 3,
      bathrooms: 2,
      rating: 4.79,
      reviewCount: 126,
      description: `Welcome to Tiki Cottage, your perfect lakeside getaway! This charming home offers everything you need for an unforgettable vacation at Lake Texoma.

Our cottage features comfortable sleeping arrangements for up to 6 guests, with three cozy bedrooms. Relax in the private hot tub year-round, enjoy the 55" HDTV with Roku streaming, and take advantage of free parking right on the premises.

Located in the peaceful community of Sherwood Shores, you're less than a mile from Cedar Mills Marina, making it easy to access the lake for boating, fishing, and water sports. The cottage is perfect for families, small groups, or couples looking for a romantic retreat.

The space has been thoughtfully designed to provide all the comforts of home while giving you that vacation feel. Whether you're lounging in the hot tub under the stars, cooking in the fully equipped kitchen, or exploring the beautiful Lake Texoma area, you'll find everything you need for a memorable stay.`,
      hostName: 'Edwin',
      hostYearsHosting: 5,
      hostResponseRate: 100,
      neighborhoodText: 'Sherwood Shores is a small, peaceful rural lake town located near Cedar Mills Marina (less than 1 mile away). The area offers a quiet, relaxing atmosphere with easy access to all Lake Texoma has to offer. You\'ll find local restaurants, boat rentals, and fishing spots nearby. The community is friendly and welcoming to visitors.',
      houseRules: `• Check-in: 4:00 PM - 10:00 PM
• Checkout: 11:00 AM
• No smoking inside the property
• No parties or events
• Pets allowed (additional fee may apply)
• Quiet hours: 10:00 PM - 8:00 AM
• Maximum occupancy: 6 guests`,
      cancellationPolicy: `Free cancellation for 48 hours after booking. After that, cancel up to 7 days before check-in and get a 50% refund of the nightly rate (minus service fees). No refund if you cancel less than 7 days before check-in.`,
      safetyNotes: `• Exterior security cameras are present on the property (covering entrance and driveway only, not interior spaces)
• Carbon monoxide detector installed
• Smoke detector installed
• Hot tub - use at your own risk, no lifeguard on duty
• Nearby lake - supervise children at all times`,
      latitude: 33.9178,
      longitude: -96.8347,
      basePrice: 175,
      cleaningFee: 75,
      taxRate: 8.25,
      depositPercentage: 100,
      isActive: true,
    },
  });

  console.log('Created property:', property.title);

  const images = [
    { url: '/uploads/hero-1.jpg', sortOrder: 1 },
    { url: '/uploads/grid-1.jpg', sortOrder: 2 },
    { url: '/uploads/grid-2.jpg', sortOrder: 3 },
    { url: '/uploads/grid-3.jpg', sortOrder: 4 },
    { url: '/uploads/grid-4.jpg', sortOrder: 5 },
  ];

  for (const image of images) {
    await prisma.propertyImage.create({
      data: {
        propertyId: property.id,
        ...image,
      },
    });
  }

  const highlights = [
    { icon: 'bed', text: 'Comfy bed for better sleep', sortOrder: 1 },
    { icon: 'briefcase', text: 'Dedicated workspace', sortOrder: 2 },
    { icon: 'waves', text: 'Private hot tub (available all year)', sortOrder: 3 },
    { icon: 'car', text: 'Free parking on premises', sortOrder: 4 },
    { icon: 'wifi', text: 'Wifi', sortOrder: 5 },
    { icon: 'dog', text: 'Pets allowed', sortOrder: 6 },
    { icon: 'tv', text: '55" HDTV with Roku', sortOrder: 7 },
    { icon: 'washing-machine', text: 'Washer in unit', sortOrder: 8 },
    { icon: 'camera', text: 'Exterior security cameras on property', sortOrder: 9 },
  ];

  for (const highlight of highlights) {
    await prisma.highlight.create({
      data: {
        propertyId: property.id,
        ...highlight,
      },
    });
  }

  const categories = [
    { id: 'cat-essentials', name: 'Essentials', sortOrder: 1 },
    { id: 'cat-features', name: 'Features', sortOrder: 2 },
    { id: 'cat-entertainment', name: 'Entertainment', sortOrder: 3 },
    { id: 'cat-outdoors', name: 'Outdoor', sortOrder: 4 },
  ];

  for (const category of categories) {
    await prisma.amenityCategory.create({
      data: category,
    });
  }

  const amenities = [
    { categoryId: 'cat-essentials', name: 'Wifi', icon: 'wifi' },
    { categoryId: 'cat-essentials', name: 'Kitchen', icon: 'utensils' },
    { categoryId: 'cat-essentials', name: 'Washer', icon: 'washing-machine' },
    { categoryId: 'cat-essentials', name: 'Dryer', icon: 'wind' },
    { categoryId: 'cat-essentials', name: 'Air conditioning', icon: 'snowflake' },
    { categoryId: 'cat-essentials', name: 'Heating', icon: 'flame' },
    { categoryId: 'cat-features', name: 'Private hot tub', icon: 'waves' },
    { categoryId: 'cat-features', name: 'Free parking', icon: 'car' },
    { categoryId: 'cat-features', name: 'Self check-in with smart lock', icon: 'key' },
    { categoryId: 'cat-features', name: 'Pets allowed', icon: 'dog' },
    { categoryId: 'cat-entertainment', name: '55" HDTV', icon: 'tv' },
    { categoryId: 'cat-entertainment', name: 'Roku streaming', icon: 'play' },
    { categoryId: 'cat-outdoors', name: 'Patio', icon: 'home' },
    { categoryId: 'cat-outdoors', name: 'BBQ grill', icon: 'flame' },
  ];

  for (const amenity of amenities) {
    const created = await prisma.amenity.create({
      data: amenity,
    });

    await prisma.propertyAmenity.create({
      data: {
        propertyId: property.id,
        amenityId: created.id,
      },
    });
  }

  const sleepingArrangements = [
    { roomName: 'Bedroom 1', bedType: '1 queen bed', imageUrl: '/uploads/bedroom-1.jpg', sortOrder: 1 },
    { roomName: 'Bedroom 2', bedType: '1 queen bed', imageUrl: '/uploads/bedroom-2.jpg', sortOrder: 2 },
    { roomName: 'Bedroom 3', bedType: '1 full bed', imageUrl: '/uploads/bedroom-3.jpg', sortOrder: 3 },
  ];

  for (const arrangement of sleepingArrangements) {
    await prisma.sleepingArrangement.create({
      data: {
        propertyId: property.id,
        ...arrangement,
      },
    });
  }

  const reviews = [
    {
      guestName: 'Sarah',
      date: new Date('2024-02-15'),
      comment: 'Amazing place! The hot tub was wonderful and the cottage was very clean. Edwin was a great host and very responsive. Highly recommend!',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 5,
    },
    {
      guestName: 'Michael',
      date: new Date('2024-01-28'),
      comment: 'Perfect getaway spot. Close to the marina and very peaceful. The place had everything we needed.',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 4,
      value: 5,
    },
    {
      guestName: 'Jennifer',
      date: new Date('2024-01-10'),
      comment: 'Loved the Tiki Cottage! Great location near the lake. The hot tub was a nice touch after a day on the water.',
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 4,
    },
  ];

  for (const review of reviews) {
    await prisma.review.create({
      data: {
        propertyId: property.id,
        ...review,
      },
    });
  }

  const icalSources = [
    {
      name: 'Airbnb',
      url: 'https://www.airbnb.com/calendar/ical/837748540190701465.ics?t=89ac8163e6ad47f38af90de1d988317e&locale=en',
      enabled: true,
    },
    {
      name: 'Booking.com',
      url: 'https://ical.booking.com/v1/export/t/07c2b968-4e67-44b3-9a77-9f69be97e76e.ics',
      enabled: true,
    },
    {
      name: 'VRBO',
      url: 'http://www.vrbo.com/icalendar/4965049725b14ac58a7ce67ee3852af7.ics?nonTentative',
      enabled: true,
    },
  ];

  for (const source of icalSources) {
    await prisma.icalSource.create({
      data: {
        propertyId: property.id,
        ...source,
      },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
