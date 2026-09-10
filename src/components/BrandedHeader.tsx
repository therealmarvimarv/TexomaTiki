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
        className={`max-w-7xl mx-auto px-6 md:px-24 py-6 md:py-7 flex flex-col md:flex-row items-center gap-6 ${
          hasRightSide ? 'justify-between' : 'justify-center'
        }`}
      >
        {/* Left — Logo */}
        {logoUrl && (
          <div className="flex-shrink-0 w-full md:w-auto max-w-[340px] h-28 flex items-center justify-center md:justify-start">
            <img
              src={logoUrl}
              alt="Property logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        {/* Right — Tagline + Badges */}
        {hasRightSide && (
          <div className="flex flex-col items-center gap-3 w-full md:w-[360px] min-w-0 md:ml-auto">
            {/* Tagline */}
            {taglines.length > 0 && (
              <div
                className="flex items-center justify-center gap-2.5 flex-wrap text-center"
                style={{ color: taglineColor, fontFamily: 'Caveat, Segoe Print, Bradley Hand, cursive' }}
              >
                {taglines.map((t, i) => (
                  <span key={i} className="text-2xl md:text-[27px] font-normal leading-none tracking-wide whitespace-nowrap">
                    {t}
                    {i < taglines.length - 1 && <span className="ml-2.5">·</span>}
                  </span>
                ))}
              </div>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3 justify-items-center w-full">
                {badges.map((key, i) => {
                  const def = getBadgeDef(key);
                  if (!def) return null;
                  const Icon = def.icon;
                  const isFirst = i === 0;
                  return (
                    <div key={key} className="flex flex-col items-center justify-start gap-1 min-w-[58px] text-center">
                      <Icon
                        className="w-5 h-5 md:w-6 md:h-6 stroke-[1.8]"
                        style={isFirst ? { color: taglineColor } : { color: '#17283d' }}
                      />
                      <span className="text-[10px] leading-tight font-medium text-gray-700 whitespace-nowrap">
                        {def.label}
                      </span>
                    </div>
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
