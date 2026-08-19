import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Property } from '../types';
import PropertyHero from '../components/PropertyHero';
import PropertySummary from '../components/PropertySummary';
import HostSection from '../components/HostSection';
import Description from '../components/Description';
import SleepingArrangements from '../components/SleepingArrangements';
import Amenities from '../components/Amenities';
import Location from '../components/Location';
import ContactSection from '../components/ContactSection';
import ThingsToKnow from '../components/ThingsToKnow';
import FAQSection from '../components/FAQSection';
import GuestInfoSection from '../components/GuestInfoSection';
import LocalRecommendations from '../components/LocalRecommendations';
import BookingCard from '../components/BookingCard';
import StickyNav from '../components/StickyNav';

const DEFAULT_PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function fetchProperty(id: string): Promise<Property> {
  const { data: prop, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !prop) throw new Error('Property not found');

  const [imagesRes, highlightsRes, sleepingRes, reviewsRes, amenitiesRes] = await Promise.all([
    supabase.from('property_images').select('*').eq('property_id', id).is('section_id', null).order('sort_order'),
    supabase.from('highlights').select('*').eq('property_id', id).order('sort_order'),
    supabase.from('sleeping_arrangements').select('*').eq('property_id', id).order('sort_order'),
    supabase.from('reviews').select('*').eq('property_id', id).order('date', { ascending: false }),
    supabase
      .from('property_amenities')
      .select('amenity_id, amenities(id, name, icon, category_id, amenity_categories(name))')
      .eq('property_id', id),
  ]);

  const amenitiesByCategory: Record<string, { id: string; name: string; icon: string }[]> = {};
  for (const row of amenitiesRes.data ?? []) {
    const amenity = row.amenities as any;
    if (!amenity) continue;
    const categoryName = (amenity as any).amenity_categories?.name ?? 'Other';
    if (!amenitiesByCategory[categoryName]) amenitiesByCategory[categoryName] = [];
    amenitiesByCategory[categoryName].push({ id: amenity.id, name: amenity.name, icon: amenity.icon });
  }

  return {
    id: prop.id,
    title: prop.title,
    location: prop.location,
    maxGuests: prop.max_guests,
    bedrooms: prop.bedrooms,
    beds: prop.beds,
    bathrooms: prop.bathrooms,
    rating: Number(prop.rating),
    reviewCount: prop.review_count,
    description: prop.description,
    hostName: prop.host_name,
    hostYearsHosting: prop.host_years_hosting,
    hostResponseRate: prop.host_response_rate,
    neighborhoodText: prop.neighborhood_text,
    houseRules: prop.house_rules,
    cancellationPolicy: prop.cancellation_policy,
    safetyNotes: prop.safety_notes,
    latitude: prop.latitude ? Number(prop.latitude) : undefined,
    longitude: prop.longitude ? Number(prop.longitude) : undefined,
    basePrice: Number(prop.base_price),
    cleaningFee: Number(prop.cleaning_fee),
    taxRate: Number(prop.tax_rate),
    depositPercentage: prop.deposit_percentage,
    showLocalRecommendations: prop.show_local_recommendations ?? true,
    showFaq: prop.show_faq ?? true,
    showGuestInfo: prop.show_guest_info ?? true,
    images: (imagesRes.data ?? []).map((i) => ({ id: i.id, url: i.url, sortOrder: i.sort_order })),
    highlights: (highlightsRes.data ?? []).map((h) => ({ id: h.id, icon: h.icon, text: h.text, subtitle: h.subtitle ?? undefined, sortOrder: h.sort_order })),
    sleepingArrangements: (sleepingRes.data ?? []).map((s) => ({
      id: s.id,
      roomName: s.room_name,
      bedType: s.bed_type,
      imageUrl: s.image_url ?? undefined,
      sortOrder: s.sort_order,
    })),
    reviews: (reviewsRes.data ?? []).map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      guestAvatar: r.guest_avatar ?? undefined,
      date: r.date,
      comment: r.comment,
      cleanliness: r.cleanliness,
      accuracy: r.accuracy,
      checkIn: r.check_in,
      communication: r.communication,
      location: r.location,
      value: r.value,
    })),
    amenitiesByCategory,
  };
}

export default function PropertyPage() {
  const { id } = useParams();
  const propertyId = id || DEFAULT_PROPERTY_ID;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetchProperty(propertyId)
      .then(setProperty)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading property…</p>
      </div>
    );
  }

  if (fetchError || !property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Property unavailable</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            We couldn't load this property right now. Please try again or contact the host directly.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StickyNav />

      <div className="max-w-7xl mx-auto px-6 md:px-24 py-8">
        <div id="photos" className="mb-8">
          <PropertyHero images={property.images} title={property.title} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16" id="booking">
          <div className="lg:col-span-7">
            <PropertySummary
              title={property.title}
              location={property.location}
              maxGuests={property.maxGuests}
              bedrooms={property.bedrooms}
              beds={property.beds}
              bathrooms={property.bathrooms}
            />

            <HostSection
              hostName={property.hostName}
              hostYearsHosting={property.hostYearsHosting}
              hostResponseRate={property.hostResponseRate}
              highlights={property.highlights}
            />

            <Description description={property.description} />

            <SleepingArrangements arrangements={property.sleepingArrangements} />

            <div id="amenities">
              <Amenities amenitiesByCategory={property.amenitiesByCategory} />
            </div>
          </div>

          <div className="lg:col-span-5 self-start sticky top-24">
            <BookingCard
              propertyId={property.id}
              basePrice={Number(property.basePrice)}
              cleaningFee={Number(property.cleaningFee)}
              taxRate={Number(property.taxRate)}
              maxGuests={property.maxGuests}
            />
          </div>
        </div>

        <Location
          propertyId={propertyId}
          neighborhoodText={property.neighborhoodText}
          latitude={property.latitude}
          longitude={property.longitude}
        />

        {property.showLocalRecommendations && (
          <LocalRecommendations propertyId={propertyId} />
        )}

        {property.showGuestInfo && (
          <GuestInfoSection propertyId={propertyId} />
        )}

        <ThingsToKnow
          houseRules={property.houseRules}
          cancellationPolicy={property.cancellationPolicy}
          safetyNotes={property.safetyNotes}
        />

        {property.showFaq && (
          <FAQSection propertyId={propertyId} />
        )}

        <div id="contact">
          <ContactSection propertyId={propertyId} />
        </div>
      </div>
    </div>
  );
}
