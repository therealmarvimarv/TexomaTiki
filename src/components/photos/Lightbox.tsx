import { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxPhoto {
  src: string;
  alt: string;
}

interface Props {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Lightbox({ photos, index, onClose, onPrev, onNext }: Props) {
  const [loaded, setLoaded] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    },
    [onClose, onPrev, onNext]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  const photo = photos[index];

  // Reset loaded state when index changes
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  // Preload previous and next images
  useEffect(() => {
    if (photos.length <= 1) return;
    const prevIdx = (index - 1 + photos.length) % photos.length;
    const nextIdx = (index + 1) % photos.length;
    const prevImg = new Image();
    prevImg.src = photos[prevIdx].src;
    const nextImg = new Image();
    nextImg.src = photos[nextIdx].src;
  }, [index, photos]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/70 text-sm font-medium">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center relative px-3 sm:px-20 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center min-h-[50vh] sm:min-h-[583px]">
          {/* Loading placeholder */}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}

          <img
            key={index}
            src={photo.src}
            alt={photo.alt}
            onLoad={() => setLoaded(true)}
            className={`max-h-[72vh] max-w-full sm:max-h-[583px] sm:max-w-[1036px] w-auto h-auto object-contain rounded-xl select-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
          />

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute top-1/2 -translate-y-1/2 left-3 sm:left-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute top-1/2 -translate-y-1/2 right-3 sm:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Caption */}
      <div
        className="text-center pb-6 px-4 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/60 text-sm">{photo.alt}</p>
      </div>
    </div>
  );
}
