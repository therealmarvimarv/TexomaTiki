import PhotoGrid from './PhotoGrid';

interface Photo {
  src: string;
  alt: string;
  globalIndex: number;
}

interface Props {
  id: string;
  title: string;
  features?: string[];
  photos: Photo[];
  featured?: boolean;
  onPhotoClick: (globalIndex: number) => void;
}

export default function PhotoSection({ id, title, features, photos, featured = false, onPhotoClick }: Props) {
  return (
    <section id={id} className="scroll-mt-48">
      <h2 className={`font-bold text-gray-900 ${featured ? 'text-3xl' : 'text-xl'} ${features && features.length > 0 ? 'mb-2' : 'mb-4'}`}>
        {title}
      </h2>

      {features && features.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {features.map((f) => (
            <span
              key={f}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <PhotoGrid photos={photos} featured={featured} onPhotoClick={onPhotoClick} />
    </section>
  );
}
