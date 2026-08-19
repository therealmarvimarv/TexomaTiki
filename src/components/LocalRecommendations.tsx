import { useEffect, useState } from 'react';
import { MapPin, ExternalLink, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Recommendation {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  distance_label: string;
  website_url: string;
  is_featured: boolean;
  sort_order: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Beaches & Outdoors': 'bg-blue-50 text-blue-700',
  'Food & Drinks': 'bg-orange-50 text-orange-700',
  'Shopping': 'bg-emerald-50 text-emerald-700',
  'Family Activities': 'bg-rose-50 text-rose-700',
  'Essentials': 'bg-gray-100 text-gray-600',
};

const CATEGORY_ORDER = ['Beaches & Outdoors', 'Food & Drinks', 'Family Activities', 'Shopping', 'Essentials'];

interface Props {
  propertyId: string;
}

export default function LocalRecommendations({ propertyId }: Props) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    supabase
      .from('local_recommendations')
      .select('id,name,category,description,address,distance_label,website_url,is_featured,sort_order')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('sort_order')
      .then(({ data }) => setItems((data ?? []) as Recommendation[]))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div id="local" className="py-10 border-b">
      <div className="h-7 w-52 bg-gray-100 rounded-lg animate-pulse mb-3" />
      <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (items.length === 0) return null;

  const categories = ['All', ...CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c))];
  const filtered = activeCategory === 'All' ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div id="local" className="py-10 border-b">
      <h2 className="text-2xl font-semibold mb-2">Local recommendations</h2>
      <p className="text-gray-500 text-sm mb-6">Places the host loves near Tiki Cottage.</p>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</h3>
                  {item.is_featured && (
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                  )}
                </div>
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                    CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.category}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed flex-1">{item.description}</p>

            <div className="space-y-1.5 text-xs text-gray-500">
              {item.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{item.address}</span>
                </div>
              )}
              {item.distance_label && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium text-gray-700">{item.distance_label}</span>
                </div>
              )}
            </div>

            {item.website_url && (
              <a
                href={item.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visit website
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
