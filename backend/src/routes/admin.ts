import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { syncIcalFeeds } from '../services/ical-sync.js';
import { UploadedFile } from 'express-fileupload';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/properties/:id', async (req: AuthRequest, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        highlights: { orderBy: { sortOrder: 'asc' } },
        amenities: { include: { amenity: { include: { category: true } } } },
        sleepingArrangements: { orderBy: { sortOrder: 'asc' } },
        reviews: { orderBy: { date: 'desc' } },
        icalSources: true,
      },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/properties/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const property = await prisma.property.update({
      where: { id },
      data: {
        title: data.title,
        location: data.location,
        maxGuests: data.maxGuests,
        bedrooms: data.bedrooms,
        beds: data.beds,
        bathrooms: data.bathrooms,
        description: data.description,
        hostName: data.hostName,
        hostYearsHosting: data.hostYearsHosting,
        hostResponseRate: data.hostResponseRate,
        neighborhoodText: data.neighborhoodText,
        houseRules: data.houseRules,
        cancellationPolicy: data.cancellationPolicy,
        safetyNotes: data.safetyNotes,
        latitude: data.latitude,
        longitude: data.longitude,
        basePrice: data.basePrice,
        cleaningFee: data.cleaningFee,
        taxRate: data.taxRate,
        depositPercentage: data.depositPercentage,
      },
    });

    res.json(property);
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/properties/:id/images', async (req: AuthRequest, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const image = req.files.image as UploadedFile;
    const propertyId = req.params.id;

    const maxOrder = await prisma.propertyImage.findFirst({
      where: { propertyId },
      orderBy: { sortOrder: 'desc' },
    });

    const sortOrder = (maxOrder?.sortOrder || 0) + 1;
    const fileName = `${Date.now()}-${image.name}`;
    const uploadPath = path.join(process.cwd(), 'uploads', fileName);

    await image.mv(uploadPath);

    const propertyImage = await prisma.propertyImage.create({
      data: {
        propertyId,
        url: `/uploads/${fileName}`,
        sortOrder,
      },
    });

    res.json(propertyImage);
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/images/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.propertyImage.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/images/reorder', async (req: AuthRequest, res) => {
  try {
    const { images } = req.body;

    for (const img of images) {
      await prisma.propertyImage.update({
        where: { id: img.id },
        data: { sortOrder: img.sortOrder },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/bookings', async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        property: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ical/sync', async (req: AuthRequest, res) => {
  try {
    await syncIcalFeeds();
    res.json({ success: true });
  } catch (error) {
    console.error('Sync iCal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/amenities', async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.amenityCategory.findMany({
      include: {
        amenities: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    console.error('Get amenities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as adminRouter };
