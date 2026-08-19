import { useState } from 'react';
import { X, Wifi, UtensilsCrossed, Wind, Waves, Car, Dog, Tv, Gamepad2, Bed, Minus, Camera, Bell, BellOff, Flame, Plus, Droplet, Droplets, Fan, ChefHat, Coffee, Monitor, DoorOpen, Armchair, WashingMachine, Refrigerator, Microwave, Zap, Wine, Sparkles, Layers, Shirt, LayoutGrid, BookOpen, Music, Printer, Lock, Cross, Link, Home, Circle, FireExtinguisher, Blend, Table2, type LucideIcon } from 'lucide-react';
import { Amenity } from '../types';

interface Props {
  amenitiesByCategory: Record<string, Amenity[]>;
}

type IconComponent = LucideIcon;

const ICON_MAP: Record<string, IconComponent> = {
  wifi: Wifi,
  'utensils-crossed': UtensilsCrossed,
  'washing-machine': WashingMachine,
  wind: Wind,
  waves: Waves,
  car: Car,
  dog: Dog,
  tv: Tv,
  'gamepad-2': Gamepad2,
  bed: Bed,
  minus: Minus,
  camera: Camera,
  bell: Bell,
  'bell-off': BellOff,
  flame: Flame,
  plus: Plus,
  droplet: Droplet,
  droplets: Droplets,
  fan: Fan,
  'chef-hat': ChefHat,
  coffee: Coffee,
  monitor: Monitor,
  'door-open': DoorOpen,
  armchair: Armchair,
  refrigerator: Refrigerator,
  microwave: Microwave,
  zap: Zap,
  wine: Wine,
  sparkles: Sparkles,
  layers: Layers,
  shirt: Shirt,
  'layout-grid': LayoutGrid,
  'book-open': BookOpen,
  music: Music,
  printer: Printer,
  lock: Lock,
  cross: Cross,
  link: Link,
  home: Home,
  circle: Circle,
  'fire-extinguisher': FireExtinguisher,
  blend: Blend,
  'table-2': Table2,
};

const getIcon = (iconName: string): IconComponent =>
  ICON_MAP[iconName] || Home;

const PREVIEW_NAMES = [
  'Kitchen',
  'Wifi',
  'Dedicated workspace',
  'Free parking on premises',
  'Private hot tub – available all year',
  'Pets allowed',
  '55 inch HDTV with Roku',
  'Free washer – In unit',
  'Exterior security cameras on property',
  'Carbon monoxide alarm',
];

function AmenityRow({ amenity }: { amenity: Amenity }) {
  const Icon = getIcon(amenity.icon);
  const unavailable = amenity.available === false;
  return (
    <div className={`flex items-center gap-4 ${unavailable ? 'text-gray-400' : 'text-gray-800'}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className={`text-sm ${unavailable ? 'line-through' : ''}`}>{amenity.name}</span>
    </div>
  );
}

export default function Amenities({ amenitiesByCategory }: Props) {
  const [showAll, setShowAll] = useState(false);

  const allAmenities = Object.values(amenitiesByCategory).flatMap(items => items);

  // Try the preferred preview names first; fall back to the first available amenities
  const preferredPreview = PREVIEW_NAMES.map(name =>
    allAmenities.find(a => a.name === name)
  ).filter(Boolean) as Amenity[];

  const previewAmenities = preferredPreview.length >= 4
    ? preferredPreview
    : allAmenities.filter(a => a.available !== false).slice(0, 10);

  return (
    <div className="py-8 border-b">
      <h2 className="text-2xl font-semibold mb-6">What this place offers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
        {previewAmenities.map(a => <AmenityRow key={a.id} amenity={a} />)}
      </div>
      <button
        onClick={() => setShowAll(true)}
        className="mt-6 px-6 py-3 border border-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
      >
        Show all {allAmenities.length} amenities
      </button>

      {showAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <h2 className="text-xl font-semibold">All {allAmenities.length} amenities</h2>
              <button
                onClick={() => setShowAll(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6">
              {Object.entries(amenitiesByCategory).map(([category, items]) => (
                <div key={category} className="mb-8 last:mb-0">
                  <h3 className="text-base font-semibold mb-4 text-gray-900">{category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                    {items.map(a => <AmenityRow key={a.id} amenity={a} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
