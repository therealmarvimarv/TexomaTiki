import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { loadPricingContext, calculatePricing as calcPricing, resolveNightlyRate, PricingContext } from '../lib/pricing';
import { PriceCalculation } from '../types';
import DateRangePicker from './DateRangePicker';
import { ChevronUp, ChevronDown, Minus, Plus, Loader2 } from 'lucide-react';

// VITE_BOOKING_PAYMENT_MODE is kept as a build-time fallback.
// At runtime, BookingCard fetches the live payment_mode from the backend so
// admin changes take effect without a redeploy.
const VITE_MODE_FALLBACK = import.meta.env.VITE_BOOKING_PAYMENT_MODE ?? 'test_manual';

type PaymentMode = 'test_manual' | 'test_stripe' | 'live_manual' | 'live_stripe';

const VITE_PAYMENT_MODE: PaymentMode =
  (VITE_MODE_FALLBACK === 'test_stripe' || VITE_MODE_FALLBACK === 'live_stripe' ||
   VITE_MODE_FALLBACK === 'live_manual' || VITE_MODE_FALLBACK === 'test_manual')
    ? VITE_MODE_FALLBACK
    : 'test_manual';

interface Props {
  propertyId: string;
  basePrice: number;
  cleaningFee: number;
  taxRate: number;
  maxGuests?: number;
}

function guestSummary(adults: number, children: number, infants: number, pets: number): string {
  const parts: string[] = [];
  const guestCount = adults + children;
  parts.push(`${guestCount} guest${guestCount !== 1 ? 's' : ''}`);
  if (infants > 0) parts.push(`${infants} infant${infants !== 1 ? 's' : ''}`);
  if (pets > 0) parts.push(`${pets} pet${pets !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

interface CounterRowProps {
  label: string;
  sublabel: React.ReactNode;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
}

function CounterRow({ label, sublabel, value, onDecrement, onIncrement, decrementDisabled, incrementDisabled }: CounterRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      <div>
        <div className="font-semibold text-gray-900 text-sm">{label}</div>
        <div className="text-gray-500 text-sm">{sublabel}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={decrementDisabled}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-4 text-center text-sm font-medium text-gray-900">{value}</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={incrementDisabled}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function BookingCard({ propertyId, basePrice, cleaningFee, taxRate, maxGuests = 6 }: Props) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [pricing, setPricing] = useState<PriceCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [error, setError] = useState('');
  const [pricingCtx, setPricingCtx] = useState<PricingContext | null>(null);
  const [pricingMap, setPricingMap] = useState<Record<string, number>>({});
  const [displayedPrice, setDisplayedPrice] = useState(basePrice);
  const [displayPriceMode, setDisplayPriceMode] = useState<'base' | 'average'>('base');
  const [minNightsMap, setMinNightsMap] = useState<Record<string, number>>({});
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(VITE_PAYMENT_MODE);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live payment mode from backend — overrides build-time env var
  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-config-public`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const pm = data?.payment_mode;
        if (pm === 'test_stripe' || pm === 'live_stripe' || pm === 'test_manual' || pm === 'live_manual') {
          setPaymentMode(pm);
        }
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [ctx, propRes, availRes, unavailRes] = await Promise.all([
        loadPricingContext(propertyId),
        supabase.from('properties').select('display_price_mode,min_nights').eq('id', propertyId).maybeSingle(),
        supabase.from('date_availability_overrides').select('date,min_nights').eq('property_id', propertyId),
        // Sanitized view: no guest PII, no payment data — dates + type only
        supabase.from('public_availability').select('date').eq('property_id', propertyId),
      ]);
      if (cancelled) return;

      // Build a pre-resolved price map for the date-range picker
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizon = new Date(today);
      horizon.setMonth(horizon.getMonth() + 18);
      const priceMap: Record<string, number> = {};
      const cur = new Date(today);
      while (cur <= horizon) {
        const [y, m, d] = [cur.getFullYear(), cur.getMonth() + 1, cur.getDate()];
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        priceMap[dateStr] = resolveNightlyRate(dateStr, ctx);
        cur.setDate(cur.getDate() + 1);
      }

      const globalMin = propRes.data?.min_nights ?? 1;
      const mnMap: Record<string, number> = {};
      const mnCur = new Date(today);
      while (mnCur <= horizon) {
        const [y, m, d] = [mnCur.getFullYear(), mnCur.getMonth() + 1, mnCur.getDate()];
        mnMap[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = globalMin;
        mnCur.setDate(mnCur.getDate() + 1);
      }
      for (const o of (availRes.data ?? [])) {
        if (o.min_nights !== null) mnMap[o.date] = o.min_nights;
      }

      const mode = (propRes.data?.display_price_mode ?? 'base') as 'base' | 'average';
      let headline = basePrice;
      if (mode === 'average' && ctx.dowRates.length > 0) {
        const filled = ctx.dowRates.filter((r) => r.rate > 0);
        if (filled.length > 0) headline = Math.round(filled.reduce((s, r) => s + r.rate, 0) / filled.length);
      }

      // Build blocked dates set from sanitized public_availability view
      const blocked = new Set<string>();
      for (const row of (unavailRes.data ?? [])) {
        blocked.add(typeof row.date === 'string' ? row.date : (row.date as Date).toISOString().split('T')[0]);
      }

      setPricingCtx(ctx);
      setPricingMap(priceMap);
      setMinNightsMap(mnMap);
      setDisplayPriceMode(mode);
      setDisplayedPrice(headline);
      setBlockedDates(blocked);
    }
    load();
    return () => { cancelled = true; };
  }, [propertyId, basePrice]);

  const totalNonInfant = adults + children;

  useEffect(() => {
    if (checkIn && checkOut && pricingCtx) {
      const result = calcPricing(checkIn, checkOut, totalNonInfant, pricingCtx, pets);
      setPricing(result);
    } else {
      setPricing(null);
    }
  }, [checkIn, checkOut, cleaningFee, pricingCtx, totalNonInfant, pets]);

  useEffect(() => {
    if (!guestDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGuestDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [guestDropdownOpen]);

  const atMax = totalNonInfant >= maxGuests;

  // Manual mode: create pending_review booking request
  const handleManualRequest = async () => {
    if (!checkIn || !checkOut || !guestName || !guestEmail || !pricing) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            propertyId,
            checkIn,
            checkOut,
            guests: totalNonInfant,
            pets,
            guestName,
            guestEmail,
            guestPhone: guestPhone || undefined,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError('Those dates are no longer available. Please choose different dates.');
        } else {
          setError(data.error ?? 'Unable to submit booking request. Please try again.');
        }
        return;
      }

      window.location.href = `/booking/request-success?booking_id=${data.bookingId}`;
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Stripe test mode: create pending_payment booking + redirect to Stripe Checkout
  const handleStripeCheckout = async () => {
    if (!checkIn || !checkOut || !guestName || !guestEmail || !pricing) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            property_id: propertyId,
            check_in: checkIn,
            check_out: checkOut,
            guests: totalNonInfant,
            pets,
            guest_name: guestName,
            guest_email: guestEmail,
            guest_phone: guestPhone || undefined,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError('Those dates are no longer available. Please choose different dates.');
        } else if (data.code === 'STRIPE_NOT_CONFIGURED') {
          setError('Online payment is not configured yet. Please contact the host to book.');
        } else {
          setError(data.error ?? 'Unable to start checkout. Please try again.');
        }
        return;
      }

      // Redirect to Stripe Checkout — amount is set server-side, not by frontend
      window.location.href = data.url;
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isStripeMode = paymentMode === 'test_stripe' || paymentMode === 'live_stripe';
  const handleSubmit = isStripeMode ? handleStripeCheckout : handleManualRequest;

  const minDate = new Date().toISOString().split('T')[0];

  const submitLabel = isStripeMode ? 'Continue to Secure Payment' : 'Request to Book';
  const submitLoadingLabel = isStripeMode ? 'Redirecting to payment…' : 'Submitting request…';
  const submitSubcopy = isStripeMode
    ? 'Secure test payment through Stripe'
    : 'No payment required — the host will review your request';

  return (
    <div>
      <div className="border rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <span className="text-2xl font-semibold">${displayedPrice}</span>
          <span className="text-gray-600">{displayPriceMode === 'average' ? ' avg / night' : ' / night'}</span>
        </div>

        <div className="border rounded-lg mb-4">
          <div className="grid grid-cols-2 border-b">
            <div className="p-3 border-r">
              <label className="block text-xs font-semibold mb-1">CHECK-IN</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={minDate}
                className="w-full text-sm outline-none"
              />
            </div>
            <div className="p-3">
              <label className="block text-xs font-semibold mb-1">CHECKOUT</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || minDate}
                className="w-full text-sm outline-none"
              />
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setGuestDropdownOpen(o => !o)}
              className="w-full p-3 text-left flex items-center justify-between focus:outline-none"
            >
              <div>
                <div className="text-xs font-semibold text-gray-800 tracking-wide">GUESTS</div>
                <div className="text-sm text-gray-800 mt-0.5">
                  {guestSummary(adults, children, infants, pets)}
                </div>
              </div>
              {guestDropdownOpen
                ? <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
              }
            </button>

            {guestDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 px-5 pb-4 pt-1">
                <CounterRow
                  label="Adults"
                  sublabel="Age 13+"
                  value={adults}
                  onDecrement={() => setAdults(a => Math.max(1, a - 1))}
                  onIncrement={() => setAdults(a => a + 1)}
                  decrementDisabled={adults <= 1}
                  incrementDisabled={atMax}
                />
                <CounterRow
                  label="Children"
                  sublabel="Ages 2–12"
                  value={children}
                  onDecrement={() => setChildren(c => Math.max(0, c - 1))}
                  onIncrement={() => setChildren(c => c + 1)}
                  decrementDisabled={children <= 0}
                  incrementDisabled={atMax}
                />
                <CounterRow
                  label="Infants"
                  sublabel="Under 2"
                  value={infants}
                  onDecrement={() => setInfants(i => Math.max(0, i - 1))}
                  onIncrement={() => setInfants(i => i + 1)}
                  decrementDisabled={infants <= 0}
                  incrementDisabled={false}
                />
                <CounterRow
                  label="Pets"
                  sublabel={
                    <span className="text-gray-500">
                      Service animals always welcome —{' '}
                      <a href="/#contact" className="underline hover:text-gray-800 transition-colors">contact the host</a>
                    </span>
                  }
                  value={pets}
                  onDecrement={() => setPets(p => Math.max(0, p - 1))}
                  onIncrement={() => setPets(p => p + 1)}
                  decrementDisabled={pets <= 0}
                  incrementDisabled={false}
                />

                <p className="text-gray-500 text-sm mt-4 leading-relaxed">
                  This place has a maximum of {maxGuests} guest{maxGuests !== 1 ? 's' : ''}, not
                  including infants. If you're bringing more than 2 pets, please let your host know.
                </p>

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => setGuestDropdownOpen(false)}
                    className="font-semibold text-sm text-gray-900 hover:underline"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co); }}
          pricingMap={Object.keys(pricingMap).length > 0 ? pricingMap : undefined}
          minNightsMap={minNightsMap}
          blockedDates={blockedDates.size > 0 ? blockedDates : undefined}
        />

        {!showGuestForm && checkIn && checkOut && (
          <button
            onClick={() => setShowGuestForm(true)}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all"
          >
            Reserve
          </button>
        )}

        {showGuestForm && (
          <div className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="Full name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
            />
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !guestName || !guestEmail}
              className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {submitLoadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
            <p className="text-center text-xs text-gray-400">
              {submitSubcopy}
            </p>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mb-4">
          {isStripeMode ? 'Secure checkout — no surprises' : 'Free to request — no payment now'}
        </p>

        {pricing && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="underline">
                ${pricing.pricePerNight} x {pricing.nights} night{pricing.nights > 1 ? 's' : ''}
              </span>
              <span>${pricing.subtotal.toFixed(2)}</span>
            </div>
            {pricing.feeLines.map(line => (
              <div key={line.name} className="flex justify-between text-sm">
                <span className="underline">{line.name}</span>
                <span>${line.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="underline">Taxes</span>
              <span>${pricing.taxes.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-3 border-t">
              <span>Total</span>
              <span>${pricing.total.toFixed(2)}</span>
            </div>
            {isStripeMode && (
              <p className="text-xs text-gray-400 text-center">
                Final amount confirmed at checkout
              </p>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          Prices include all fees
        </div>
      </div>
    </div>
  );
}
