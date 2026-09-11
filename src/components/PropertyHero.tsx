import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PropertyImage } from '../types';
import Lightbox from './photos/Lightbox';

interface Props {
  images: PropertyImage[];
  title: string;
}

export default function PropertyHero({ images, title }: Props) {
  const navigate = useNavigate();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const heroImage = images[0];
  const gridImages = images.slice(1, 5);

  function goToPhotos() {
    navigate('/photos');
  }

  const lightboxPhotos = images.map((img) => ({
    src: img.url,
    alt: title,
  }));

  return (
    <div className="relative">
      <div className="grid grid-cols-4 gap-2 h-[480px] rounded-xl overflow-hidden">
        <div className="col-span-4 md:col-span-2 relative group cursor-pointer" onClick={() => setLightboxIndex(0)}>
          <img
            src={heroImage?.url || '/placeholder.jpg'}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />

        </div>

        <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-2">
          {gridImages.map((img, idx) => (
            <div
              key={img.id}
              className="relative group cursor-pointer"
              onClick={() => setLightboxIndex(idx + 1)}
            >
              <img
                src={img.url || '/placeholder.jpg'}
                alt={`${title} ${idx + 2}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={goToPhotos}
        className="absolute bottom-6 right-6 px-4 py-2 bg-white border border-gray-800 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Show all photos
      </button>

      {lightboxIndex !== null && (
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i! - 1 + images.length) % images.length)}
          onNext={() => setLightboxIndex((i) => (i! + 1) % images.length)}
        />
      )}
    </div>
  );
}
