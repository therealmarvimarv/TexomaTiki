import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  description: string;
}

const PREVIEW_LENGTH = 300;

export default function Description({ description }: Props) {
  const [showModal, setShowModal] = useState(false);
  const shouldTruncate = description.length > PREVIEW_LENGTH;
  const preview = shouldTruncate ? description.slice(0, PREVIEW_LENGTH) : description;

  return (
    <div className="py-8 border-b">
      <div className="whitespace-pre-line text-gray-700 leading-relaxed">
        {preview}
        {shouldTruncate && '...'}
      </div>
      {shouldTruncate && (
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 font-semibold underline hover:text-gray-500 transition-colors"
        >
          Show more
        </button>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b shrink-0">
              <h2 className="text-xl font-semibold">About this space</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6">
              <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
