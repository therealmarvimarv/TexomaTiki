import { supabase } from './supabase';
import { FeeLineItem } from '../types';

export interface DbFee {
  name: string;
  fee_type: string;
  amount: number;
  applies_after_guests: number | null;
  apply_to_guest_quote: boolean;
  is_standard: boolean;
}

export interface SeasonalPreset {
  start_date: string;
  end_date: string;
  nightly_rate: number;
  min_nights: number | null;
  priority: number;
}

export interface PricingContext {
  basePrice: number;
  dowRates: { day_of_week: number; rate: number }[];
  dateOverrides: { date: string; rate: number }[];
  seasonalPresets: SeasonalPreset[];
  fees: DbFee[];
  taxRate: number;
}

/**
 * Pricing priority (highest wins):
 * 1. date-specific override (date_price_overrides)
 * 2. seasonal pricing preset (highest priority value wins on overlap)
 * 3. day-of-week rate
 * 4. base price
 */
// Parse YYYY-MM-DD day-of-week without Date object to avoid timezone issues
function dowFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function resolveNightlyRate(
  dateStr: string,
  ctx: Pick<PricingContext, 'basePrice' | 'dowRates' | 'dateOverrides' | 'seasonalPresets'>,
): number {
  // 1. Date-specific override
  const override = ctx.dateOverrides.find((o) => o.date === dateStr);
  if (override) return override.rate;

  // 2. Seasonal preset (highest priority, must be active — caller filters active)
  const matchingPresets = ctx.seasonalPresets.filter((p) => dateStr >= p.start_date && dateStr <= p.end_date);
  if (matchingPresets.length > 0) {
    const best = matchingPresets.reduce((a, b) => (b.priority > a.priority ? b : a));
    return Number(best.nightly_rate);
  }

  // 3. Day-of-week
  const dow = dowFromDateStr(dateStr);
  const dowRate = ctx.dowRates.find((r) => r.day_of_week === dow);
  if (dowRate) return Number(dowRate.rate);

  // 4. Base price
  return ctx.basePrice;
}

export interface PriceBreakdown {
  nights: number;
  subtotal: number;
  pricePerNight: number;
  feeLines: FeeLineItem[];
  taxes: number;
  total: number;
}

export function calculatePricing(
  checkIn: string,
  checkOut: string,
  guests: number,
  ctx: PricingContext,
  pets = 0,
): PriceBreakdown | null {
  const [sy, sm, sd] = checkIn.split('-').map(Number);
  const [ey, em, ed] = checkOut.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return null;

  let subtotal = 0;
  const cur = new Date(start);
  for (let i = 0; i < nights; i++) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    subtotal += resolveNightlyRate(dateStr, ctx);
    cur.setDate(cur.getDate() + 1);
  }

  const pricePerNight = Math.round(subtotal / nights);

  const feeLines: FeeLineItem[] = ctx.fees
    .filter((fee) => fee.apply_to_guest_quote !== false)
    .map((fee) => {
      // Pets fee only applies when the guest brought pets
      if (fee.is_standard && fee.name === 'Pets' && pets === 0) {
        return { name: fee.name, amount: 0 };
      }
      const threshold = fee.applies_after_guests ?? 0;
      const extraGuests = Math.max(0, guests - threshold);
      let amount = 0;
      switch (fee.fee_type) {
        case 'per_stay':             amount = fee.amount; break;
        case 'per_night':            amount = fee.amount * nights; break;
        case 'per_guest_per_stay':   amount = fee.amount * extraGuests; break;
        case 'per_guest_per_night':  amount = fee.amount * extraGuests * nights; break;
      }
      return { name: fee.name, amount };
    })
    .filter((l) => l.amount > 0);

  const feesTotal = feeLines.reduce((sum, l) => sum + l.amount, 0);
  const taxes = (subtotal + feesTotal) * ctx.taxRate;

  return {
    nights,
    subtotal,
    pricePerNight,
    feeLines,
    taxes,
    total: subtotal + feesTotal + taxes,
  };
}

/** Load all pricing context for a property from Supabase. */
export async function loadPricingContext(propertyId: string): Promise<PricingContext> {
  const [dowRes, overrideRes, feesRes, propRes, seasonalRes] = await Promise.all([
    supabase.from('day_of_week_rates').select('day_of_week,rate').eq('property_id', propertyId),
    supabase.from('date_price_overrides').select('date,rate').eq('property_id', propertyId),
    supabase
      .from('property_fees')
      .select('name,fee_type,amount,applies_after_guests,apply_to_guest_quote,is_standard')
      .eq('property_id', propertyId)
      .eq('enabled', true)
      .order('sort_order'),
    supabase.from('properties').select('base_price,tax_rate').eq('id', propertyId).maybeSingle(),
    supabase
      .from('seasonal_pricing_presets')
      .select('start_date,end_date,nightly_rate,min_nights,priority')
      .eq('property_id', propertyId)
      .eq('is_active', true),
  ]);

  return {
    basePrice: Number(propRes.data?.base_price ?? 0),
    taxRate: Number(propRes.data?.tax_rate ?? 0),
    dowRates: (dowRes.data ?? []).map((r) => ({ day_of_week: r.day_of_week, rate: Number(r.rate) })),
    dateOverrides: (overrideRes.data ?? []).map((o) => ({ date: o.date, rate: Number(o.rate) })),
    seasonalPresets: (seasonalRes.data ?? []).map((p) => ({
      start_date: p.start_date,
      end_date: p.end_date,
      nightly_rate: Number(p.nightly_rate),
      min_nights: p.min_nights,
      priority: p.priority,
    })),
    fees: (feesRes.data ?? []).map((f) => ({
      name: f.name,
      fee_type: f.fee_type,
      amount: Number(f.amount),
      applies_after_guests: f.applies_after_guests,
      apply_to_guest_quote: f.apply_to_guest_quote ?? true,
      is_standard: f.is_standard ?? false,
    })),
  };
}
