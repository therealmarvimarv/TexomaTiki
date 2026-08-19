import { useEffect, useCallback } from 'react';
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
        className="flex-1 flex items-center justify-center relative px-14 sm:px-20 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={index}
          src={photo.src}
          alt={photo.alt}
          className="max-h-full max-w-full object-contain rounded-xl select-none"
          draggable={false}
        />

        {/* Prev */}
        {photos.length > 1 && (
          <button
            onClick={onPrev}
            className="absolute left-3 sm:left-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Next */}
        {photos.length > 1 && (
          <button
            onClick={onNext}
            className="absolute right-3 sm:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
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
