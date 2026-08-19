import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function BookingCancelled() {
  const [params] = useSearchParams();
  // booking_id is set by create-checkout-session in the cancel_url.
  // We don't do anything with it on the frontend — webhook handles expiry.
  const hasBookingId = !!params.get('booking_id');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-9 h-9 text-gray-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout Not Completed</h1>
        <p className="text-gray-500 leading-relaxed mb-2">
          Your checkout session was cancelled. Your booking was not confirmed and you have not been charged.
        </p>
        {hasBookingId && (
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Any pending reservation will expire automatically — no action needed.
          </p>
        )}
        {!hasBookingId && (
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Return to the property page to start a new booking.
          </p>
        )}

        <div className="space-y-3">
          <Link
            to="/#booking"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-700 transition-colors"
          >
            Try Again
          </Link>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Property
          </Link>
        </div>
      </div>
    </div>
  );
}
