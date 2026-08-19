import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PropertyImage } from '../types';

interface Props {
  images: PropertyImage[];
  onClose: () => void;
}

export default function PhotoGallery({ images, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const next = () => setCurrentIndex((i) => (i + 1) % images.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-6 text-white">
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close gallery"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative px-16">
        <button
          onClick={prev}
          className="absolute left-6 p-3 bg-white rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <img
          src={images[currentIndex]?.url}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-[80vh] object-contain"
        />

        <button
          onClick={next}
          className="absolute right-6 p-3 bg-white rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <div className="p-6 overflow-x-auto">
        <div className="flex gap-2 justify-center">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 ${
                idx === currentIndex ? 'ring-2 ring-white' : 'opacity-60'
              }`}
            >
              <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
