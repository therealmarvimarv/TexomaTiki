interface Photo {
  src: string;
  alt: string;
  globalIndex: number;
}

interface Props {
  photos: Photo[];
  featured?: boolean;
  onPhotoClick: (globalIndex: number) => void;
}

export default function PhotoGrid({ photos, featured = false, onPhotoClick }: Props) {
  if (photos.length === 0) return null;

  if (featured) {
    // First section: large hero + 2-column grid below
    const [hero, ...rest] = photos;
    return (
      <div className="space-y-2">
        {/* Hero */}
        <div
          className="w-full aspect-[16/9] overflow-hidden rounded-2xl cursor-pointer group"
          onClick={() => onPhotoClick(hero.globalIndex)}
        >
          <img
            src={hero.src}
            alt={hero.alt}
            className="w-full h-full object-cover group-hover:opacity-95 transition-opacity duration-200"
          />
        </div>
        {/* Remaining in 2-col */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {rest.map((photo) => (
              <PhotoTile key={photo.globalIndex} photo={photo} onPhotoClick={onPhotoClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Standard sections: 2-col grid, every 5th image spans full width
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {photos.map((photo, i) => {
        const fullWidth = photos.length >= 3 && i === 2;
        return (
          <div
            key={photo.globalIndex}
            className={`overflow-hidden rounded-2xl cursor-pointer group ${fullWidth ? 'sm:col-span-2' : ''}`}
            onClick={() => onPhotoClick(photo.globalIndex)}
          >
            <div className={`w-full overflow-hidden ${fullWidth ? 'aspect-[21/9]' : 'aspect-[4/3]'}`}>
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity duration-200"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PhotoTile({
  photo,
  onPhotoClick,
}: {
  photo: Photo;
  onPhotoClick: (i: number) => void;
}) {
  return (
    <div
      className="aspect-[4/3] overflow-hidden rounded-2xl cursor-pointer group"
      onClick={() => onPhotoClick(photo.globalIndex)}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="w-full h-full object-cover group-hover:opacity-95 transition-opacity duration-200"
      />
    </div>
  );
}
