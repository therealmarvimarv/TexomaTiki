import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Property } from '../../types';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import PhotosEditor from './PhotosEditor';
import PricingEditor from './PricingEditor';
import FeesEditor from './FeesEditor';
import ContentEditor from './ContentEditor';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

type Tab = 'basic' | 'highlights' | 'amenities' | 'neighborhood' | 'contact' | 'photos' | 'pricing' | 'policies' | 'sections';

// ── Highlights ────────────────────────────────────────────────────────────────

const AVAILABLE_ICONS = [
  'bed', 'briefcase', 'waves', 'car', 'wifi', 'dog', 'tv',
  'washing-machine', 'camera', 'door-open', 'monitor', 'lock',
  'home', 'star', 'heart', 'coffee', 'flame', 'wind', 'droplet',
  'umbrella', 'sun', 'moon', 'tree', 'fish',
];

interface Highlight {
  id: string;
  icon: string;
  text: string;
  subtitle: string;
  sort_order: number;
}

function HighlightsEditor({ propertyId }: { propertyId: string }) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('highlights')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setHighlights(data.map(h => ({ ...h, subtitle: h.subtitle ?? '' })));
      });
  }, [propertyId]);

  const update = (id: string, field: keyof Highlight, value: string | number) => {
    setHighlights(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    for (const h of highlights) {
      await supabase
        .from('highlights')
        .update({ icon: h.icon, text: h.text, subtitle: h.subtitle || null, sort_order: h.sort_order })
        .eq('id', h.id);
    }
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Property Highlights</h3>
          <p className="text-sm text-gray-500 mt-0.5">The three feature callouts shown below the host section.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {highlights.map((h, idx) => (
          <div key={h.id} className="bg-gray-50 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Highlight {idx + 1}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Icon</label>
                <select
                  value={h.icon}
                  onChange={e => update(h.id, 'icon', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  {AVAILABLE_ICONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Sort Order</label>
                <input
                  type="number"
                  value={h.sort_order}
                  onChange={e => update(h.id, 'sort_order', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Heading</label>
              <input
                type="text"
                value={h.text}
                onChange={e => update(h.id, 'text', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Subtitle <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={h.subtitle}
                onChange={e => update(h.id, 'subtitle', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Amenities ─────────────────────────────────────────────────────────────────

interface AmenityCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface AmenityRow {
  id: string;
  name: string;
  icon: string;
  category_id: string;
  enabled: boolean;
}

const ALL_ICONS = [
  'wifi', 'utensils-crossed', 'washing-machine', 'wind', 'waves', 'car', 'dog',
  'tv', 'gamepad-2', 'bed', 'minus', 'camera', 'bell', 'bell-off', 'flame',
  'plus', 'droplet', 'droplets', 'fan', 'chef-hat', 'coffee', 'monitor',
  'door-open', 'armchair', 'refrigerator', 'microwave', 'zap', 'wine',
  'sparkles', 'layers', 'shirt', 'layout-grid', 'book-open', 'music',
  'printer', 'lock', 'cross', 'link', 'home', 'circle', 'fire-extinguisher',
  'blend', 'table-2', 'star', 'heart', 'sun', 'moon',
];

function AmenitiesEditor({ propertyId }: { propertyId: string }) {
  const [categories, setCategories] = useState<AmenityCategory[]>([]);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newItem, setNewItem] = useState<{ categoryId: string; name: string; icon: string }>({ categoryId: '', name: '', icon: 'home' });
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const load = async () => {
    const [catRes, amenRes, propAmenRes] = await Promise.all([
      supabase.from('amenity_categories').select('*').order('sort_order'),
      supabase.from('amenities').select('*').order('name'),
      supabase.from('property_amenities').select('amenity_id').eq('property_id', propertyId),
    ]);

    const enabledIds = new Set((propAmenRes.data ?? []).map((r: any) => r.amenity_id));
    setCategories(catRes.data ?? []);
    setAmenities((amenRes.data ?? []).map((a: any) => ({ ...a, enabled: enabledIds.has(a.id) })));
  };

  useEffect(() => { load(); }, [propertyId]);

  const toggle = (id: string) => {
    setAmenities(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    await supabase.from('property_amenities').delete().eq('property_id', propertyId);
    const enabled = amenities.filter(a => a.enabled);
    if (enabled.length > 0) {
      await supabase.from('property_amenities').insert(
        enabled.map(a => ({ property_id: propertyId, amenity_id: a.id }))
      );
    }
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  const addAmenity = async (categoryId: string) => {
    if (!newItem.name.trim()) return;
    const { data, error } = await supabase
      .from('amenities')
      .insert({ name: newItem.name.trim(), icon: newItem.icon, category_id: categoryId })
      .select()
      .maybeSingle();
    if (!error && data) {
      setAmenities(prev => [...prev, { ...data, enabled: true }]);
      setNewItem({ categoryId: '', name: '', icon: 'home' });
      setAddingTo(null);
    }
  };

  const deleteAmenity = async (id: string) => {
    await supabase.from('amenities').delete().eq('id', id);
    setAmenities(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">What This Place Offers</h3>
          <p className="text-sm text-gray-500 mt-0.5">Toggle amenities on/off or add new ones. Checked items appear on the listing.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map(cat => {
          const catAmenities = amenities.filter(a => a.category_id === cat.id);
          return (
            <div key={cat.id} className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">{cat.name}</h4>
                <button
                  onClick={() => setAddingTo(addingTo === cat.id ? null : cat.id)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add item
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catAmenities.map(a => (
                  <div key={a.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      id={`amenity-${a.id}`}
                      checked={a.enabled}
                      onChange={() => toggle(a.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-pink-500 cursor-pointer"
                    />
                    <label htmlFor={`amenity-${a.id}`} className="text-sm text-gray-700 flex-1 cursor-pointer select-none">
                      {a.name}
                    </label>
                    <button
                      onClick={() => deleteAmenity(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {addingTo === cat.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    placeholder="Amenity name"
                    value={newItem.name}
                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500"
                    onKeyDown={e => e.key === 'Enter' && addAmenity(cat.id)}
                  />
                  <select
                    value={newItem.icon}
                    onChange={e => setNewItem({ ...newItem, icon: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    {ALL_ICONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => addAmenity(cat.id)}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingTo(null)}
                    className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Neighborhood Highlights ───────────────────────────────────────────────────

const NEIGHBORHOOD_CATEGORIES = [
  { value: 'swim', label: 'Water & Recreation' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'essentials', label: 'Essentials' },
  { value: 'dining', label: 'Dining & Drinks' },
  { value: 'entertainment', label: 'Entertainment' },
];

interface NeighborhoodItem {
  id: string;
  name: string;
  distance: string;
  category: string;
  sort_order: number;
  isNew?: boolean;
}

function NeighborhoodEditor({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<NeighborhoodItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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

  const update = (id: string, field: keyof NeighborhoodItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    const tempId = `new-${Date.now()}`;
    setItems(prev => [...prev, {
      id: tempId,
      name: '',
      distance: '',
      category: 'essentials',
      sort_order: prev.length + 1,
      isNew: true,
    }]);
  };

  const removeItem = async (item: NeighborhoodItem) => {
    if (!item.isNew) {
      await supabase.from('neighborhood_highlights').delete().eq('id', item.id);
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');

    const existing = items.filter(i => !i.isNew);
    const newItems = items.filter(i => i.isNew && i.name.trim());

    for (const item of existing) {
      await supabase
        .from('neighborhood_highlights')
        .update({ name: item.name, distance: item.distance, category: item.category, sort_order: item.sort_order })
        .eq('id', item.id);
    }

    if (newItems.length > 0) {
      const { data } = await supabase
        .from('neighborhood_highlights')
        .insert(newItems.map(i => ({
          property_id: propertyId,
          name: i.name,
          distance: i.distance,
          category: i.category,
          sort_order: i.sort_order,
        })))
        .select();

      if (data) {
        const tempIds = newItems.map(i => i.id);
        setItems(prev => {
          const kept = prev.filter(i => !tempIds.includes(i.id));
          return [...kept, ...data];
        });
      }
    }

    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  const grouped = NEIGHBORHOOD_CATEGORIES.map(cat => ({
    ...cat,
    items: items.filter(i => i.category === cat.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Neighborhood Highlights</h3>
          <p className="text-sm text-gray-500 mt-0.5">Nearby places shown in the location modal on the listing page.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Place
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(cat => cat.items.length === 0 ? null : (
          <div key={cat.value} className="bg-gray-50 rounded-xl p-5">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm">{cat.label}</h4>
            <div className="space-y-2">
              {cat.items.map(item => (
                <div key={item.id} className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Place name"
                    value={item.name}
                    onChange={e => update(item.id, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Distance"
                    value={item.distance}
                    onChange={e => update(item.id, 'distance', e.target.value)}
                    className="w-28 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  />
                  <select
                    value={item.category}
                    onChange={e => update(item.id, 'category', e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    {NEIGHBORHOOD_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeItem(item)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* New items not yet assigned to a category bucket */}
        {items.filter(i => i.isNew).length > 0 && (
          <div className="bg-blue-50 rounded-xl p-5">
            <h4 className="font-semibold text-blue-700 mb-3 text-sm">New items (unsaved)</h4>
            <div className="space-y-2">
              {items.filter(i => i.isNew).map(item => (
                <div key={item.id} className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Place name"
                    value={item.name}
                    onChange={e => update(item.id, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Distance"
                    value={item.distance}
                    onChange={e => update(item.id, 'distance', e.target.value)}
                    className="w-28 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  />
                  <select
                    value={item.category}
                    onChange={e => update(item.id, 'category', e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    {NEIGHBORHOOD_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeItem(item)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No places added yet. Click "Add Place" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contact Info ──────────────────────────────────────────────────────────────

interface ContactInfo {
  email: string;
  phone: string;
  response_time: string;
}

function ContactEditor({ propertyId }: { propertyId: string }) {
  const [info, setInfo] = useState<ContactInfo>({ email: '', phone: '', response_time: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('contact_info')
      .select('email, phone, response_time')
      .eq('property_id', propertyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInfo(data);
      });
  }, [propertyId]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    const { error } = await supabase
      .from('contact_info')
      .upsert({ property_id: propertyId, ...info, updated_at: new Date().toISOString() }, { onConflict: 'property_id' });
    setSaving(false);
    setMsg(error ? 'Error saving' : 'Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Get In Touch</h3>
          <p className="text-sm text-gray-500 mt-0.5">Contact details displayed in the "Get in touch" section.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm font-medium ${msg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email address</label>
          <input
            type="email"
            value={info.email}
            onChange={e => setInfo({ ...info, email: e.target.value })}
            placeholder="hello@yourproperty.com"
            className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone number</label>
          <input
            type="text"
            value={info.phone}
            onChange={e => setInfo({ ...info, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Response time message</label>
          <input
            type="text"
            value={info.response_time}
            onChange={e => setInfo({ ...info, response_time: e.target.value })}
            placeholder="Usually within a few hours"
            className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">Shown as the "Response time" under the contact details.</p>
        </div>
      </div>
    </div>
  );
}

// ── Pricing tabs wrapper ──────────────────────────────────────────────────────

function PricingTabs({ propertyId, basePrice, taxRate }: { propertyId: string; basePrice: number; taxRate: number }) {
  const [pricingTab, setPricingTab] = useState<'rates' | 'fees'>('rates');
  const PRICING_TABS = [
    { id: 'rates' as const, label: 'Rates' },
    { id: 'fees' as const, label: 'Fees' },
  ];
  return (
    <div>
      <div className="flex gap-1 mb-6 border-b">
        {PRICING_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setPricingTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              pricingTab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pricingTab === 'rates' && <PricingEditor propertyId={propertyId} basePrice={basePrice} taxRate={taxRate} />}
      {pricingTab === 'fees' && <FeesEditor propertyId={propertyId} />}
    </div>
  );
}

// ── Sections Visibility ───────────────────────────────────────────────────────

interface SectionFlags {
  show_local_recommendations: boolean;
  show_faq: boolean;
  show_guest_info: boolean;
}

function SectionsEditor({ propertyId }: { propertyId: string }) {
  const [flags, setFlags] = useState<SectionFlags>({
    show_local_recommendations: true,
    show_faq: true,
    show_guest_info: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('properties')
      .select('show_local_recommendations,show_faq,show_guest_info')
      .eq('id', propertyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFlags(data as SectionFlags);
      });
  }, [propertyId]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    const { error } = await supabase
      .from('properties')
      .update({ ...flags, updated_at: new Date().toISOString() })
      .eq('id', propertyId);
    setSaving(false);
    setMsg(error ? 'Error saving' : 'Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  const SECTION_ITEMS = [
    {
      key: 'show_local_recommendations' as keyof SectionFlags,
      label: 'Local Recommendations',
      description: 'Show the local places section on the listing page.',
    },
    {
      key: 'show_faq' as keyof SectionFlags,
      label: 'Frequently Asked Questions',
      description: 'Show the FAQ accordion section on the listing page.',
    },
    {
      key: 'show_guest_info' as keyof SectionFlags,
      label: 'Guest Information',
      description: 'Show house rules, check-in/out, pet policy, and accessibility notes.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Section Visibility</h3>
          <p className="text-sm text-gray-500 mt-0.5">Control which sections appear on the public listing page.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm font-medium ${msg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {SECTION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            </div>
            <button
              role="switch"
              aria-checked={flags[item.key]}
              onClick={() => setFlags((f) => ({ ...f, [item.key]: !f[item.key] }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                flags[item.key] ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  flags[item.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Toggling a section off hides it from guests immediately. Content is preserved and can be re-enabled at any time.
      </p>

      <hr className="border-gray-200" />

      <ContentEditor />
    </div>
  );
}

// ── Main PropertyEditor ───────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'neighborhood', label: 'Neighborhood' },
  { id: 'contact', label: 'Contact' },
  { id: 'photos', label: 'Photos' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'policies', label: 'Policies' },
  { id: 'sections', label: 'Sections & Content' },
];

export default function PropertyEditor() {
  const [property, setProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('basic');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('properties')
      .select('*')
      .eq('id', PROPERTY_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setProperty({
          id: data.id,
          title: data.title,
          location: data.location,
          maxGuests: data.max_guests,
          bedrooms: data.bedrooms,
          beds: data.beds,
          bathrooms: data.bathrooms,
          rating: Number(data.rating),
          reviewCount: data.review_count,
          description: data.description,
          hostName: data.host_name,
          hostYearsHosting: data.host_years_hosting,
          hostResponseRate: data.host_response_rate,
          neighborhoodText: data.neighborhood_text,
          houseRules: data.house_rules,
          cancellationPolicy: data.cancellation_policy,
          safetyNotes: data.safety_notes,
          latitude: data.latitude ? Number(data.latitude) : undefined,
          longitude: data.longitude ? Number(data.longitude) : undefined,
          basePrice: Number(data.base_price),
          cleaningFee: Number(data.cleaning_fee),
          taxRate: Number(data.tax_rate),
          depositPercentage: data.deposit_percentage,
          images: [],
          highlights: [],
          sleepingArrangements: [],
          reviews: [],
          amenitiesByCategory: {},
        });
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    setMsg('');
    const { error } = await supabase
      .from('properties')
      .update({
        title: property.title,
        location: property.location,
        max_guests: property.maxGuests,
        bedrooms: property.bedrooms,
        beds: property.beds,
        bathrooms: property.bathrooms,
        description: property.description,
        host_name: property.hostName,
        host_years_hosting: property.hostYearsHosting,
        host_response_rate: property.hostResponseRate,
        neighborhood_text: property.neighborhoodText,
        house_rules: property.houseRules,
        cancellation_policy: property.cancellationPolicy,
        safety_notes: property.safetyNotes,
        latitude: property.latitude,
        longitude: property.longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', property.id);

    setSaving(false);
    setMsg(error ? 'Error saving' : 'Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  const handleAddImageUrl = async () => {
    const url = prompt('Enter image URL:');
    if (!url || !property) return;
    const sortOrder = property.images.length;
    const { data, error } = await supabase
      .from('property_images')
      .insert({ property_id: property.id, url, sort_order: sortOrder })
      .select()
      .maybeSingle();
    if (!error && data) {
      setProperty({ ...property, images: [...property.images, { id: data.id, url: data.url, sortOrder: data.sort_order }] });
    }
  };

  const handleImageDelete = async (imageId: string) => {
    if (!property) return;
    await supabase.from('property_images').delete().eq('id', imageId);
    setProperty({ ...property, images: property.images.filter((img) => img.id !== imageId) });
  };

  useEffect(() => {
    if (!property) return;
    supabase
      .from('property_images')
      .select('*')
      .eq('property_id', property.id)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setProperty((prev) => prev ? { ...prev, images: data.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sort_order })) } : prev);
        }
      });
  }, [property?.id]);

  if (!property) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit Property</h2>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Basic Info */}
          {tab === 'basic' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>
                <div className="flex items-center gap-3">
                  {msg && <span className={`text-sm font-medium ${msg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={property.title}
                  onChange={(e) => setProperty({ ...property, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <input
                  type="text"
                  value={property.location}
                  onChange={(e) => setProperty({ ...property, location: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                {(['maxGuests', 'bedrooms', 'beds', 'bathrooms'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-2 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                    <input
                      type="number"
                      value={property[field]}
                      onChange={(e) => setProperty({ ...property, [field]: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={property.description}
                  onChange={(e) => setProperty({ ...property, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Host Name</label>
                  <input
                    type="text"
                    value={property.hostName}
                    onChange={(e) => setProperty({ ...property, hostName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Years Hosting</label>
                  <input
                    type="number"
                    value={property.hostYearsHosting}
                    onChange={(e) => setProperty({ ...property, hostYearsHosting: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

            </div>
          )}

          {/* Highlights */}
          {tab === 'highlights' && <HighlightsEditor propertyId={property.id} />}

          {/* Amenities */}
          {tab === 'amenities' && <AmenitiesEditor propertyId={property.id} />}

          {/* Neighborhood */}
          {tab === 'neighborhood' && <NeighborhoodEditor propertyId={property.id} />}

          {/* Contact */}
          {tab === 'contact' && <ContactEditor propertyId={property.id} />}

          {/* Photos */}
          {tab === 'photos' && <PhotosEditor propertyId={property.id} />}

          {/* Pricing */}
          {tab === 'pricing' && <PricingTabs propertyId={property.id} basePrice={property.basePrice} taxRate={property.taxRate} />}

          {/* Sections & Content */}
          {tab === 'sections' && <SectionsEditor propertyId={property.id} />}

          {/* Policies */}
          {tab === 'policies' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Policies</h3>
                <div className="flex items-center gap-3">
                  {msg && <span className={`text-sm font-medium ${msg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">House Rules</label>
                <textarea
                  value={property.houseRules}
                  onChange={(e) => setProperty({ ...property, houseRules: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cancellation Policy</label>
                <textarea
                  value={property.cancellationPolicy}
                  onChange={(e) => setProperty({ ...property, cancellationPolicy: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Safety Notes</label>
                <textarea
                  value={property.safetyNotes}
                  onChange={(e) => setProperty({ ...property, safetyNotes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
