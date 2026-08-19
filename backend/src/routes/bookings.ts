import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { config } from '../config.js';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });

router.post('/calculate', async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, guests } = req.body;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    const subtotal = Number(property.basePrice) * nights;
    const cleaningFee = Number(property.cleaningFee);
    const taxes = (subtotal + cleaningFee) * (Number(property.taxRate) / 100);
    const total = subtotal + cleaningFee + taxes;

    res.json({
      nights,
      pricePerNight: Number(property.basePrice),
      subtotal,
      cleaningFee,
      taxes,
      total,
    });
  } catch (error) {
    console.error('Calculate pricing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, guests, guestName, guestEmail, guestPhone } = req.body;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const existingBlockedDates = await prisma.blockedDate.findFirst({
      where: {
        propertyId,
        date: {
          gte: checkInDate,
          lt: checkOutDate,
        },
      },
    });

    if (existingBlockedDates) {
      return res.status(400).json({ error: 'Selected dates are not available' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const subtotal = Number(property.basePrice) * nights;
    const cleaningFee = Number(property.cleaningFee);
    const taxes = (subtotal + cleaningFee) * (Number(property.taxRate) / 100);
    const total = subtotal + cleaningFee + taxes;

    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        propertyId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests,
        guestName,
        guestEmail,
        guestPhone: guestPhone || null,
        totalPrice: total,
        status: 'pending',
        holdExpiresAt,
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${property.title} - ${nights} night${nights > 1 ? 's' : ''}`,
              description: `${checkIn} to ${checkOut}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${config.frontendUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/property/${propertyId}`,
      customer_email: guestEmail,
      metadata: {
        bookingId: booking.id,
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id },
    });

    res.json({
      bookingId: booking.id,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          select: {
            title: true,
            location: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as bookingsRouter };
