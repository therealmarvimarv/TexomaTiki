import { useEffect, useState } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { CheckCircle, Calendar, Mail, ArrowLeft, MessageSquare, Clock, Users } from 'lucide-react';

interface BookingInfo {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_email: string;
  amount_total: number | null;
  total_price: number;
  status: string;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'TBD';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function nights(checkIn: string | null | undefined, checkOut: string | null | undefined) {
  if (!checkIn || !checkOut) return null;
  try {
    const n = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
    );
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function lookupBooking(bookingId: string): Promise<BookingInfo | null> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${baseUrl}/functions/v1/booking-lookup?booking_id=${encodeURIComponent(bookingId)}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.booking ?? null;
}

export default function BookingRequestSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking_id');
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    lookupBooking(bookingId)
      .then(data => setBooking(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const totalDisplay = booking
    ? booking.amount_total != null
      ? `$${(booking.amount_total / 100).toFixed(2)}`
      : booking.total_price != null
        ? `$${Number(booking.total_price).toFixed(2)}`
        : null
    : null;

  const nightCount = nights(booking?.check_in, booking?.check_out);

  if (!bookingId) return <Navigate to="/" replace />;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to property
            </Link>
            <span className="text-sm font-semibold text-gray-700">Texoma Tiki</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h1>
            <p className="text-gray-500 leading-relaxed mb-6">
              Your booking request has been received. The host will review it shortly.
              You'll receive an email confirmation soon.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-700 transition-colors"
            >
              Back to Texoma Tiki
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to property
          </Link>
          <span className="text-sm font-semibold text-gray-700">Texoma Tiki</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Success banner */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-11 h-11 text-blue-600" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Request Received!</h1>
            <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
              Your booking request has been submitted. The host will review it and confirm availability shortly.
              No payment is required at this time.
            </p>
          </div>

          {/* Booking detail card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            {loading ? (
              <div className="p-8 flex items-center justify-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                <span className="text-sm">Loading your booking details&hellip;</span>
              </div>
            ) : booking ? (
              <>
                <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      Booking Request #{booking.id?.slice(0, 8).toUpperCase() ?? 'PENDING'}
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Pending host review
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  <div className="px-6 py-4 flex items-start gap-4">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Requested Stay</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(booking.check_in)}</p>
                      <p className="text-sm text-gray-500">to {formatDate(booking.check_out)}</p>
                      {nightCount != null && (
                        <p className="text-xs text-gray-400 mt-1">
                          {nightCount} night{nightCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {booking.guests != null && (
                    <div className="px-6 py-4 flex items-start gap-4">
                      <Users className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Guests</p>
                        <p className="text-sm text-gray-900">
                          {booking.guests} guest{booking.guests !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {booking.guest_email && (
                    <div className="px-6 py-4 flex items-start gap-4">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Confirmation sent to
                        </p>
                        <p className="text-sm text-gray-900">{booking.guest_email}</p>
                      </div>
                    </div>
                  )}

                  {totalDisplay && (
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Estimated total</span>
                        <span className="text-base font-bold text-gray-900">{totalDisplay}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        This is an estimate. Final total will be confirmed by the host.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="px-6 py-8 text-center">
                <Mail className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1 font-medium">Your request was received.</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Check your email for a confirmation, or contact the host if you have questions.
                </p>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">What happens next</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Request submitted</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your booking request has been received by the host.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Host review</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    The host will review your request and confirm or decline within 24 hours.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Confirmation email</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Once confirmed, you'll receive the next steps for your stay.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-700 transition-colors"
            >
              Back to Texoma Tiki
            </Link>
            <Link
              to="/#contact"
              className="flex items-center justify-center gap-2 w-full py-3 px-6 border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Contact the host
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
