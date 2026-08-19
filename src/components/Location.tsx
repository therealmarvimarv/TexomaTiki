import { useEffect, useState } from 'react';
import { ChevronRight, X, MapPin, Car, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  propertyId: string;
  neighborhoodText: string;
  latitude?: number;
  longitude?: number;
}

interface NeighborhoodHighlight {
  id: string;
  name: string;
  distance: string;
  category: string;
  sort_order: number;
}

const categoryLabel: Record<string, string> = {
  swim: 'Water & Recreation',
  outdoor: 'Outdoor',
  essentials: 'Essentials',
  dining: 'Dining & Drinks',
  entertainment: 'Entertainment',
};

export default function Location({ propertyId, neighborhoodText, latitude, longitude }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<NeighborhoodHighlight[]>([]);

  useEffect(() => {
    supabase
      .from('neighborhood_highlights')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setItems(data);
      });
  }, [propertyId]);

  const mapUrl = latitude && longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.05},${latitude - 0.05},${longitude + 0.05},${latitude + 0.05}&layer=mapnik&marker=${latitude},${longitude}`
    : null;

  const grouped = items.reduce<Record<string, NeighborhoodHighlight[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="py-8 border-b" id="location">
      <h2 className="text-2xl font-semibold mb-6">Where you'll be</h2>

      {mapUrl && (
        <div className="mb-6 rounded-xl overflow-hidden h-[280px] sm:h-[360px] lg:h-[480px]">
          <iframe
            title="Location map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={mapUrl}
          />
        </div>
      )}

      <p className="text-sm text-gray-500 mb-8">This listing's location is verified.</p>

      <div className="border-t pt-8">
        <h3 className="text-xl font-semibold mb-2">Neighborhood highlights</h3>
        <p className="text-gray-700 mb-1">{neighborhoodText}</p>

        <div className="mt-3 space-y-1 text-gray-700 text-sm">
          <div className="flex items-start gap-2">
            <Car className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
            <div>
              <span className="font-medium">Parking</span> — Driveway &amp; street front parking available
            </div>
          </div>
          {items.length > 0 && (
            <div className="flex items-start gap-2">
              <Navigation className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
              <div>
                <span className="font-medium">Proximity</span> — {items.slice(0, 3).map(i => `${i.name} (${i.distance})`).join(', ')}...
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="mt-4 flex items-center gap-1 text-sm font-semibold underline underline-offset-2 hover:text-gray-500 transition-colors"
        >
          Show more <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <h2 className="text-xl font-semibold">Neighborhood highlights</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6 space-y-7">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-900">Area overview</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{neighborhoodText}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Car className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-900">Parking</span>
                </div>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />Driveway</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />Street front parking also available</li>
                </ul>
              </div>

              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <Navigation className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-900">{categoryLabel[cat] ?? cat}</span>
                  </div>
                  <ul className="space-y-2">
                    {catItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-500 font-medium ml-4 flex-shrink-0">{item.distance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
