import ICAL from 'ical.js';

interface Booking {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
}

export function generateIcalFeed(bookings: Booking[]): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);

  cal.updatePropertyWithValue('prodid', '-//Tiki Cottage//Booking Calendar//EN');
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('method', 'PUBLISH');
  cal.updatePropertyWithValue('x-wr-calname', 'Tiki Cottage Bookings');
  cal.updatePropertyWithValue('x-wr-timezone', 'America/Chicago');

  for (const booking of bookings) {
    const vevent = new ICAL.Component('vevent');
    const event = new ICAL.Event(vevent);

    event.uid = booking.id;
    event.summary = `Blocked - ${booking.guestName}`;
    event.startDate = ICAL.Time.fromJSDate(booking.checkIn, false);
    event.endDate = ICAL.Time.fromJSDate(booking.checkOut, false);
    event.description = 'Reserved via Tiki Cottage website';

    cal.addSubcomponent(vevent);
  }

  return cal.toString();
}
