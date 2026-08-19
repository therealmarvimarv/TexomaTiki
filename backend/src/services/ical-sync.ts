import { PrismaClient } from '@prisma/client';
import ICAL from 'ical.js';
import cron from 'node-cron';

const prisma = new PrismaClient();

export async function syncIcalFeeds() {
  console.log('Starting iCal sync...');

  const sources = await prisma.icalSource.findMany({
    where: { enabled: true },
  });

  for (const source of sources) {
    try {
      const response = await fetch(source.url);
      const icalData = await response.text();

      const jcalData = ICAL.parse(icalData);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      const blockedDates: Date[] = [];

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        const startDate = event.startDate.toJSDate();
        const endDate = event.endDate.toJSDate();

        const currentDate = new Date(startDate);
        while (currentDate < endDate) {
          blockedDates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      for (const date of blockedDates) {
        await prisma.blockedDate.upsert({
          where: {
            propertyId_date: {
              propertyId: source.propertyId,
              date: date,
            },
          },
          update: {
            source: `ical:${source.name}`,
          },
          create: {
            propertyId: source.propertyId,
            date: date,
            source: `ical:${source.name}`,
          },
        });
      }

      await prisma.icalSource.update({
        where: { id: source.id },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      console.log(`Synced ${source.name}: ${blockedDates.length} dates blocked`);
    } catch (error: any) {
      console.error(`Error syncing ${source.name}:`, error);

      await prisma.icalSource.update({
        where: { id: source.id },
        data: {
          lastError: error.message,
        },
      });
    }
  }

  console.log('iCal sync completed');
}

export function startIcalSync() {
  cron.schedule('*/30 * * * *', () => {
    syncIcalFeeds();
  });

  syncIcalFeeds();
}
