import { useState } from 'react';
import { X, Sparkles, CheckCircle, LogIn, MessageSquare, MapPin, Tag } from 'lucide-react';
import { Review } from '../types';

interface Props {
  reviews: Review[];
  rating: number;
  reviewCount: number;
}

const categoryConfig = [
  { key: 'cleanliness', label: 'Cleanliness', Icon: Sparkles },
  { key: 'accuracy', label: 'Accuracy', Icon: CheckCircle },
  { key: 'checkIn', label: 'Check-in', Icon: LogIn },
  { key: 'communication', label: 'Communication', Icon: MessageSquare },
  { key: 'location', label: 'Location', Icon: MapPin },
  { key: 'value', label: 'Value', Icon: Tag },
];

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const truncateAt = 180;
  const needsTruncate = review.comment.length > truncateAt;
  const displayText = expanded || !needsTruncate
    ? review.comment
    : review.comment.slice(0, truncateAt) + '...';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {review.guestAvatar ? (
          <img
            src={review.guestAvatar}
            alt={review.guestName}
            className="w-11 h-11 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gray-800 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {review.guestName[0].toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 leading-tight">{review.guestName}</p>
          <p className="text-sm text-gray-500">
            {new Date(review.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <p className="text-gray-700 leading-relaxed text-sm">
        {displayText}
        {needsTruncate && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-1 font-semibold text-gray-900 underline underline-offset-2 hover:text-gray-600 transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </p>
    </div>
  );
}

export default function Reviews({ reviews, reviewCount }: Props) {
  const [showAll, setShowAll] = useState(false);

  const displayReviews = reviews.slice(0, 6);

  const avgRatings = reviews.length > 0 ? {
    cleanliness: reviews.reduce((acc, r) => acc + r.cleanliness, 0) / reviews.length,
    accuracy: reviews.reduce((acc, r) => acc + r.accuracy, 0) / reviews.length,
    checkIn: reviews.reduce((acc, r) => acc + r.checkIn, 0) / reviews.length,
    communication: reviews.reduce((acc, r) => acc + r.communication, 0) / reviews.length,
    location: reviews.reduce((acc, r) => acc + r.location, 0) / reviews.length,
    value: reviews.reduce((acc, r) => acc + r.value, 0) / reviews.length,
  } : null;

  return (
    <div className="py-10 border-b" id="reviews">
      <h2 className="text-2xl font-semibold text-gray-900 mb-8">
        {reviewCount} reviews
      </h2>

      {avgRatings && (
        <div className="flex flex-col md:flex-row gap-8 mb-10 pb-10 border-b">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {categoryConfig.map(({ key, label, Icon }) => {
              const val = avgRatings[key as keyof typeof avgRatings];
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                    <p className="text-sm text-gray-600">{label}</p>
                  </div>
                  <p className="text-2xl font-semibold text-gray-900">{val.toFixed(1)}</p>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${(val / 5) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mb-8">
        {displayReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {reviews.length > 6 && (
        <button
          onClick={() => setShowAll(true)}
          className="px-6 py-3 border border-gray-900 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
        >
          Show all {reviewCount} reviews
        </button>
      )}

      {showAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-8 py-5 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold">{reviewCount} reviews</h2>
              <button
                onClick={() => setShowAll(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
