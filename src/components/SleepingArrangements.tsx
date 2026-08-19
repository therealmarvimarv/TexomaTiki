import { useNavigate } from 'react-router-dom';
import { SleepingArrangement } from '../types';

interface Props {
  arrangements: SleepingArrangement[];
}

// Map room names to photo section IDs
function getSectionId(roomName: string, index: number): string {
  const lower = roomName.toLowerCase();
  if (lower.includes('bedroom') || lower.includes('bed room')) {
    const match = lower.match(/(\d+)/);
    const num = match ? match[1] : String(index + 1);
    return `section-bedroom-${num}`;
  }
  return 'section-additional';
}

export default function SleepingArrangements({ arrangements }: Props) {
  const navigate = useNavigate();

  function handleRoomClick(sectionId: string) {
    navigate(`/photos#${sectionId}`);
  }

  return (
    <div className="py-8 border-b">
      <h2 className="text-2xl font-semibold mb-6">Where you'll sleep</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {arrangements.map((arrangement, index) => {
          const sectionId = getSectionId(arrangement.roomName, index);
          return (
            <button
              key={arrangement.id}
              onClick={() => handleRoomClick(sectionId)}
              className="border rounded-xl p-6 text-left hover:border-gray-400 hover:shadow-sm transition-all group cursor-pointer"
            >
              {arrangement.imageUrl && (
                <img
                  src={arrangement.imageUrl}
                  alt={arrangement.roomName}
                  className="w-full h-40 object-cover rounded-lg mb-4 group-hover:opacity-90 transition-opacity"
                />
              )}
              <h3 className="font-semibold mb-1 group-hover:text-gray-600 transition-colors">
                {arrangement.roomName}
              </h3>
              <p className="text-gray-600 text-sm">{arrangement.bedType}</p>
              <p className="text-xs text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">
                View photos →
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
