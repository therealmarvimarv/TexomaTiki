import { Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Clock, Calendar } from 'lucide-react';

export default function InquirySuccess() {
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

      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-10 h-10 text-blue-600" strokeWidth={1.75} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">Message Sent!</h1>
          <p className="text-gray-600 leading-relaxed mb-8 max-w-sm mx-auto">
            Thanks for reaching out. Your message has been sent to the host. We'll get back to you as
            soon as possible.
          </p>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 text-left mb-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">What to expect</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Inquiry received</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your message has been delivered to the host.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Response on the way</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    The host typically responds within 24 hours. Check your inbox for a reply.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Ready to book?</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Once you're ready, submit a booking request and the host will confirm availability.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center w-full py-3 px-6 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-700 transition-colors"
            >
              Back to Texoma Tiki
            </Link>
            <Link
              to="/#booking"
              className="flex items-center justify-center gap-2 w-full py-3 px-6 border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Check availability &amp; book
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
