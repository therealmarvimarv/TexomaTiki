import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

const CATEGORY_ORDER = [
  'Booking',
  'Payments',
  'Check-in / Check-out',
  'Pets',
  'Cancellations',
  'House Rules',
  'Local Area',
];

interface Props {
  propertyId: string;
}

export default function FAQSection({ propertyId }: Props) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    supabase
      .from('faqs')
      .select('id,question,answer,category,sort_order')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setFaqs((data ?? []) as FAQ[]);
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div id="faq" className="py-10 border-b">
      <div className="h-7 w-56 bg-gray-100 rounded-lg animate-pulse mb-3" />
      <div className="h-4 w-72 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (faqs.length === 0) return null;

  const categories = ['All', ...CATEGORY_ORDER.filter((c) => faqs.some((f) => f.category === c))];
  const filtered = activeCategory === 'All' ? faqs : faqs.filter((f) => f.category === activeCategory);

  return (
    <div id="faq" className="py-10 border-b">
      <h2 className="text-2xl font-semibold mb-2">Frequently asked questions</h2>
      <p className="text-gray-500 text-sm mb-6">Everything you need to know before your stay.</p>

      {/* Category tabs */}
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

      {/* Accordion */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {filtered.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id} className="bg-white">
              <button
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-gray-900 leading-snug">{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  <span className="inline-block mt-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {faq.category}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
