import { useEffect } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Megaphone,
  X,
} from 'lucide-react';
import type { AdminUpdateNotice } from '../../config/adminUpdates';

interface WhatsNewModalProps {
  update: AdminUpdateNotice;
  onDismiss: () => void;
  onGoToPricing: () => void;
}

export default function WhatsNewModal({
  update,
  onDismiss,
  onGoToPricing,
}: WhatsNewModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-gray-950/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <div className="relative w-full max-w-[600px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Close */}
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close update notice"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          {/* Content */}
          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start gap-3.5 pr-8">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Megaphone className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.17em] text-blue-600">
                  {update.eyebrow}
                </p>

                <h2
                  id="whats-new-title"
                  className="mt-1 text-xl font-bold leading-[1.2] text-gray-900 sm:text-[22px]"
                >
                  {update.title}
                </h2>

                <p className="mt-2.5 text-[13px] leading-5 text-gray-600">
                  {update.intro}
                </p>
              </div>
            </div>

            {/* Pricing move */}
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                {update.primaryChange.title}
              </h3>

              <p className="mt-2 text-[13px] leading-5 text-gray-600">
                {update.primaryChange.body}
              </p>

              <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-gray-900 shadow-sm">
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-blue-600" />
                <span>Calendar</span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span>Pricing</span>
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-red-700">
                  NEW
                </span>
              </div>

              <p className="mt-3.5 text-[13px] leading-5 text-gray-600">
                {update.primaryChange.reason}
              </p>
            </div>

            {/* Also updated */}
            <div className="mt-5">
              <h3 className="text-[13px] font-semibold text-gray-900">
                Also updated
              </h3>

              <div className="mt-2.5 grid gap-1.5">
                {update.improvements.map(item => (
                  <div
                    key={item}
                    className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <span className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-3 w-3" />
                    </span>

                    <span className="text-[12.5px] leading-5 text-gray-600">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-2.5 border-t border-gray-100 bg-gray-50/70 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Got It
            </button>

            <button
              type="button"
              onClick={onGoToPricing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Go to Pricing
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
