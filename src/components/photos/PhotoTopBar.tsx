import { ArrowLeft, Share2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  saved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
}

export default function PhotoTopBar({ saved, onToggleSave, onShare }: Props) {
  const navigate = useNavigate();

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors group"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>

        <span className="text-base font-semibold text-gray-900 tracking-tight">Photos</span>

        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={onToggleSave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${saved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
            />
            <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
