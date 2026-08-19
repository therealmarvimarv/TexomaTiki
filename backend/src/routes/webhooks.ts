import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { config } from '../config.js';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

    if (bookingId) {
      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        });

        if (booking) {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: 'paid',
              paidAt: new Date(),
              stripePaymentIntentId: session.payment_intent as string,
            },
          });

          const checkInDate = new Date(booking.checkIn);
          const checkOutDate = new Date(booking.checkOut);
          const dates = [];
          const currentDate = new Date(checkInDate);

          while (currentDate < checkOutDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }

          for (const date of dates) {
            await prisma.blockedDate.upsert({
              where: {
                propertyId_date: {
                  propertyId: booking.propertyId,
                  date: date,
                },
              },
              update: {},
              create: {
                propertyId: booking.propertyId,
                date: date,
                source: 'booking',
                bookingId: booking.id,
              },
            });
          }

          console.log(`Booking ${bookingId} marked as paid and dates blocked`);
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    }
  }

  res.json({ received: true });
});

export { router as webhookRouter };
