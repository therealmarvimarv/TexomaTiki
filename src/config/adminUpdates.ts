export interface AdminUpdateNotice {
  version: string;
  eyebrow: string;
  title: string;
  intro: string;
  primaryChange: {
    title: string;
    body: string;
    destinationLabel: string;
    reason: string;
  };
  improvements: string[];
  showPricingNewBadge: boolean;
}

export const CURRENT_ADMIN_UPDATE: AdminUpdateNotice = {
  version: '1.0.1',
  eyebrow: "WHAT'S NEW",
  title: "We've made a few improvements to your admin dashboard.",
  intro:
    'Your dashboard has been updated to make it easier to manage your property. Nothing has been removed, and your settings are all still there.',
  primaryChange: {
    title: 'Pricing has moved from the Property section to the Calendar section',
    body:
      'Your pricing settings, rates, seasonal pricing, custom date pricing, minimum-stay rules, taxes, and fees are all still there.',
    destinationLabel: 'Calendar > Pricing',
    reason:
      'This brings your rates, availability, calendar sync, and calendar tools together in one place, making everything easier to manage from one place.',
  },
  improvements: [
    'Improved admin navigation with a cleaner, easier-to-use left sidebar',
    'Redesigned the Pricing workspace to make rates and calendar pricing easier to manage',
    'Brought Calendar, Availability, Pricing, and Calendar Sync together in one section',
  ],
  showPricingNewBadge: true,
};

export function getAdminUpdateStorageKey(userId: string): string {
  return `adminUpdateLastSeen:${userId}`;
}
