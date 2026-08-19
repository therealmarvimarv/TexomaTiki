export interface Property {
  id: string;
  title: string;
  location: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  rating: number;
  reviewCount: number;
  description: string;
  hostName: string;
  hostYearsHosting: number;
  hostResponseRate: number;
  neighborhoodText: string;
  houseRules: string;
  cancellationPolicy: string;
  safetyNotes: string;
  latitude?: number;
  longitude?: number;
  basePrice: number;
  cleaningFee: number;
  taxRate: number;
  depositPercentage: number;
  showLocalRecommendations: boolean;
  showFaq: boolean;
  showGuestInfo: boolean;
  images: PropertyImage[];
  highlights: Highlight[];
  amenitiesByCategory: Record<string, Amenity[]>;
  sleepingArrangements: SleepingArrangement[];
  reviews: Review[];
}

export interface PropertyImage {
  id: string;
  url: string;
  sortOrder: number;
  sectionId?: string;
}

export interface Highlight {
  id: string;
  icon: string;
  text: string;
  subtitle?: string;
  sortOrder: number;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
  available?: boolean;
}

export interface SleepingArrangement {
  id: string;
  roomName: string;
  bedType: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface Review {
  id: string;
  guestName: string;
  guestAvatar?: string;
  date: string;
  comment: string;
  cleanliness: number;
  accuracy: number;
  checkIn: number;
  communication: number;
  location: number;
  value: number;
}

export interface Booking {
  id: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  specialRequests?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  amountSubtotal?: number;
  amountFees?: number;
  amountTax?: number;
  amountTotal?: number;
  currency: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  paymentExpiresAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  declinedAt?: string;
  refundedAt?: string;
  createdAt: string;
}

export interface FeeLineItem {
  name: string;
  amount: number;
}

export interface PriceCalculation {
  nights: number;
  pricePerNight: number;
  subtotal: number;
  feeLines: FeeLineItem[];
  taxes: number;
  total: number;
}
