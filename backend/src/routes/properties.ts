import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateIcalFeed } from '../services/ical-export.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        highlights: { orderBy: { sortOrder: 'asc' } },
        amenities: {
          include: {
            amenity: {
              include: { category: true },
            },
          },
        },
        sleepingArrangements: { orderBy: { sortOrder: 'asc' } },
        reviews: { orderBy: { date: 'desc' } },
      },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const amenitiesByCategory = property.amenities.reduce((acc, pa) => {
      const category = pa.amenity.category.name;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: pa.amenity.id,
        name: pa.amenity.name,
        icon: pa.amenity.icon,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string; icon: string }>>);

    res.json({
      ...property,
      amenitiesByCategory,
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const blockedDates = await prisma.blockedDate.findMany({
      where: {
        propertyId: req.params.id,
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      },
    });

    const blocked = blockedDates.map(bd => bd.date.toISOString().split('T')[0]);

    res.json({ blockedDates: blocked });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/ical.ics', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: req.params.id,
        status: 'paid',
      },
    });

    const icalFeed = generateIcalFeed(bookings);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
    res.send(icalFeed);
  } catch (error) {
    console.error('Generate iCal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as propertiesRouter };
