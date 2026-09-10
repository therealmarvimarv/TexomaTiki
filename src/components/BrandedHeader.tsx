import {
  PawPrint, Users, Waves, Umbrella, Bath, Mountain, Eye, Flame,
  Trees, Car, Wifi, Zap, Anchor, Laptop, Heart, UsersRound, Leaf,
  MapPin, Lock
} from 'lucide-react';

export const TAGLINE_PRESETS = [
  'Relax', 'Unwind', 'Make Memories', 'Escape', 'Recharge', 'Dream',
  'Explore', 'Disconnect', 'Breathe', 'Soothe', 'Restore', 'Wander',
];

export const BADGE_OPTIONS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'pet_friendly', label: 'Pet Friendly', icon: PawPrint },
  { key: 'family_friendly', label: 'Family Friendly', icon: Users },
  { key: 'lake_access', label: 'Lake Access', icon: Waves },
  { key: 'beach_access', label: 'Beach Access', icon: Umbrella },
  { key: 'pool', label: 'Pool', icon: Waves },
  { key: 'hot_tub', label: 'Hot Tub', icon: Bath },
  { key: 'mountain_views', label: 'Mountain Views', icon: Mountain },
  { key: 'water_views', label: 'Water Views', icon: Eye },
  { key: 'fireplace', label: 'Fireplace', icon: Flame },
  { key: 'outdoor_space', label: 'Outdoor Space', icon: Trees },
  { key: 'free_parking', label: 'Free Parking', icon: Car },
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'ev_charging', label: 'EV Charging', icon: Zap },
  { key: 'boat_friendly', label: 'Boat Friendly', icon: Anchor },
  { key: 'remote_work', label: 'Remote Work Friendly', icon: Laptop },
  { key: 'couples_getaway', label: 'Couples Getaway', icon: Heart },
  { key: 'group_friendly', label: 'Group Friendly', icon: UsersRound },
  { key: 'peaceful_retreat', label: 'Peaceful Retreat', icon: Leaf },
  { key: 'great_location', label: 'Great Location', icon: MapPin },
  { key: 'private_stay', label: 'Private Stay', icon: Lock },
];

export function getBadgeDef(key: string) {
  return BADGE_OPTIONS.find(b => b.key === key);
}

export interface BrandedHeaderData {
  logoUrl: string | null;
  taglines: string[];
  taglineColor: string;
  badges: string[];
  showTaglineBadges: boolean;
}

interface Props {
  data: BrandedHeaderData;
}

export default function BrandedHeader({ data }: Props) {
  const { logoUrl, taglines, taglineColor, badges, showTaglineBadges } = data;
  const hasRightSide = showTaglineBadges && (taglines.length > 0 || badges.length > 0);

  if (!logoUrl && !hasRightSide) return null;

  return (
    <header
      className="w-full bg-white border-b border-gray-100"
      style={{ borderBottomColor: 'rgb(241 245 249)' }}
    >
      <div
        className={`max-w-7xl mx-auto px-6 md:px-24 py-5 flex items-center gap-6 ${
          hasRightSide ? 'justify-between' : 'justify-center'
        }`}
      >
        {/* Left — Logo */}
        {logoUrl && (
          <div className="flex-shrink-0 max-w-[220px] h-16 flex items-center">
            <img
              src={logoUrl}
              alt="Property logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        {/* Right — Tagline + Badges */}
        {hasRightSide && (
          <div className="flex flex-col items-end gap-2 min-w-0">
            {/* Tagline */}
            {taglines.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {taglines.map((t, i) => (
                  <span
                    key={i}
                    className="text-lg md:text-xl font-semibold tracking-wide"
                    style={{ color: taglineColor }}
                  >
                    {t}
                    {i < taglines.length - 1 && (
                      <span className="text-gray-300 ml-2" style={{ color: '#d1d5db' }}>·</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {badges.map((key, i) => {
                  const def = getBadgeDef(key);
                  if (!def) return null;
                  const Icon = def.icon;
                  const isFirst = i === 0;
                  const colorClass = isFirst ? '' : 'text-gray-600';
                  const bgClass = isFirst ? 'border-2' : 'border border-gray-200';
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${bgClass} ${colorClass}`}
                      style={
                        isFirst
                          ? { color: taglineColor, borderColor: taglineColor }
                          : undefined
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {def.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
