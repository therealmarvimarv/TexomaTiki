import { Highlight } from '../types';
import * as Icons from 'lucide-react';

interface Props {
  hostName: string;
  hostYearsHosting: number;
  hostResponseRate: number;
  highlights: Highlight[];
}

const getIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    bed: Icons.Bed,
    briefcase: Icons.Briefcase,
    waves: Icons.Waves,
    car: Icons.Car,
    wifi: Icons.Wifi,
    dog: Icons.Dog,
    tv: Icons.Tv,
    'washing-machine': Icons.WashingMachine,
    camera: Icons.Camera,
    'door-open': Icons.DoorOpen,
    monitor: Icons.Monitor,
    lock: Icons.Lock,
  };
  return iconMap[iconName] || Icons.Home;
};

export default function HostSection({ hostName, hostYearsHosting, hostResponseRate, highlights }: Props) {
  return (
    <div className="py-8 border-b">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-2xl font-semibold">
          {hostName[0]}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Hosted by {hostName}</h2>
          <p className="text-gray-600">{hostYearsHosting} years hosting · {hostResponseRate}% response rate</p>
        </div>
      </div>

      <hr className="border-gray-200 mb-6" />

      <div className="space-y-5">
        {highlights.map((highlight) => {
          const Icon = getIcon(highlight.icon.toLowerCase());
          return (
            <div key={highlight.id} className="flex gap-4">
              <Icon className="w-6 h-6 flex-shrink-0 text-gray-700 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">{highlight.text}</p>
                {highlight.subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{highlight.subtitle}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
