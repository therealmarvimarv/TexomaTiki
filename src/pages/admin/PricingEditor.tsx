import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, X, Moon, Plus, Save, Trash2 } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

interface DayOfWeekRate {
  id?: string;
  day_of_week: number;
  rate: string;
}

interface DateOverride {
  id: string;
  date: string;
  rate: number;
}

interface DateAvailabilityOverride {
  id: string;
  date: string;
  min_nights: number;
}

interface SelectedDay {
  date: string;
  rate: string;
  existingId?: string;
}

interface MinNightsPopover {
  date: string;
  value: string;
  existingId?: string;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function PricingEditor({ propertyId, basePrice, taxRate }: { propertyId: string; basePrice: number; taxRate: number }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [dowRates, setDowRates] = useState<DayOfWeekRate[]>(
    Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, rate: '' }))
  );
  const [dowEnabled, setDowEnabled] = useState(false);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [availOverrides, setAvailOverrides] = useState<DateAvailabilityOverride[]>([]);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [minNightsPopover, setMinNightsPopover] = useState<MinNightsPopover | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [savingDow, setSavingDow] = useState(false);
  const [savingMinNights, setSavingMinNights] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Seasonal presets
  interface SeasonalPreset { id: string; name: string; start_date: string; end_date: string; nightly_rate: number; min_nights: number | null; priority: number; is_active: boolean; }
  const [presets, setPresets] = useState<SeasonalPreset[]>([]);
  const [presetEditId, setPresetEditId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<Partial<SeasonalPreset>>({});
  const [presetSaving, setPresetSaving] = useState(false);

  // Base settings
  const [basePriceInput, setBasePriceInput] = useState(String(basePrice));
  const [taxRateInput, setTaxRateInput] = useState(String(Math.round(taxRate * 100)));
  const [displayPriceMode, setDisplayPriceMode] = useState<'base' | 'average'>('base');
  const [savingBase, setSavingBase] = useState(false);

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

  const saveBaseSettings = async () => {
    const price = parseFloat(basePriceInput);
    const tax = parseFloat(taxRateInput);
    if (isNaN(price) || price <= 0 || isNaN(tax) || tax < 0) return;
    setSavingBase(true);
    await supabase
      .from('properties')
      .update({ base_price: price, tax_rate: tax / 100, display_price_mode: displayPriceMode })
      .eq('id', propertyId);
    setSavingBase(false);
    flash('Saved');
  };

  const dowAverage = (() => {
    if (!dowEnabled) return null;
    const filled = dowRates.filter(r => r.rate && parseFloat(r.rate) > 0);
    if (filled.length === 0) return null;
    const sum = filled.reduce((acc, r) => acc + parseFloat(r.rate), 0);
    return Math.round(sum / filled.length);
  })();

  const load = useCallback(async () => {
    setLoading(true);
    const [dowRes, overrideRes, propRes, availRes, presetsRes] = await Promise.all([
      supabase.from('day_of_week_rates').select('*').eq('property_id', propertyId).order('day_of_week'),
      supabase.from('date_price_overrides').select('*').eq('property_id', propertyId),
      supabase.from('properties').select('display_price_mode').eq('id', propertyId).maybeSingle(),
      supabase.from('date_availability_overrides').select('*').eq('property_id', propertyId),
      supabase.from('seasonal_pricing_presets').select('*').eq('property_id', propertyId).order('start_date'),
    ]);

    if (propRes.data?.display_price_mode) {
      setDisplayPriceMode(propRes.data.display_price_mode as 'base' | 'average');
    }

    const dbRates = dowRes.data ?? [];
    setDowEnabled(dbRates.length > 0);
    setDowRates(Array.from({ length: 7 }, (_, i) => {
      const found = dbRates.find(r => r.day_of_week === i);
      return { id: found?.id, day_of_week: i, rate: found ? String(found.rate) : '' };
    }));

    setOverrides((overrideRes.data ?? []).map(r => ({
      id: r.id,
      date: r.date,
      rate: Number(r.rate),
    })));

    setAvailOverrides((availRes.data ?? []).map(r => ({
      id: r.id,
      date: r.date,
      min_nights: r.min_nights,
    })));

    setPresets((presetsRes.data ?? []) as SeasonalPreset[]);

    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const resolvePrice = (dateStr: string): number => {
    const override = overrides.find(o => o.date === dateStr);
    if (override) return override.rate;

    const activePresets = presets.filter(p => p.is_active && dateStr >= p.start_date && dateStr <= p.end_date);
    if (activePresets.length > 0) {
      const best = activePresets.reduce((a, b) => b.priority > a.priority ? b : a);
      return best.nightly_rate;
    }

    if (dowEnabled) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const rate = dowRates.find(r => r.day_of_week === dow);
      if (rate && rate.rate) return parseFloat(rate.rate);
    }

    return basePrice;
  };

  const saveDowRates = async () => {
    setSavingDow(true);
    if (!dowEnabled) {
      await supabase.from('day_of_week_rates').delete().eq('property_id', propertyId);
      setDowRates(prev => prev.map(r => ({ ...r, id: undefined })));
    } else {
      for (const row of dowRates) {
        const rate = parseFloat(row.rate);
        if (isNaN(rate) || rate <= 0) continue;
        if (row.id) {
          await supabase.from('day_of_week_rates').update({ rate }).eq('id', row.id);
        } else {
          const { data } = await supabase
            .from('day_of_week_rates')
            .upsert({ property_id: propertyId, day_of_week: row.day_of_week, rate }, { onConflict: 'property_id,day_of_week' })
            .select()
            .maybeSingle();
          if (data) {
            setDowRates(prev => prev.map(r => r.day_of_week === row.day_of_week ? { ...r, id: data.id } : r));
          }
        }
      }
    }
    setSavingDow(false);
    flash('Rates saved');
  };

  const openDayEditor = (dateStr: string) => {
    const existing = overrides.find(o => o.date === dateStr);
    setSelectedDay({
      date: dateStr,
      rate: existing ? String(existing.rate) : String(resolvePrice(dateStr)),
      existingId: existing?.id,
    });
    setMinNightsPopover(null);
  };

  const saveDateOverride = async () => {
    if (!selectedDay) return;
    const rate = parseFloat(selectedDay.rate);
    if (isNaN(rate) || rate <= 0) return;

    if (selectedDay.existingId) {
      await supabase.from('date_price_overrides').update({ rate }).eq('id', selectedDay.existingId);
      setOverrides(prev => prev.map(o => o.id === selectedDay.existingId ? { ...o, rate } : o));
    } else {
      const { data } = await supabase
        .from('date_price_overrides')
        .upsert({ property_id: propertyId, date: selectedDay.date, rate }, { onConflict: 'property_id,date' })
        .select()
        .maybeSingle();
      if (data) {
        setOverrides(prev => [...prev.filter(o => o.date !== selectedDay.date), { id: data.id, date: data.date, rate: Number(data.rate) }]);
      }
    }
    setSelectedDay(null);
    flash('Price saved');
  };

  const deleteDateOverride = async (id: string, date: string) => {
    await supabase.from('date_price_overrides').delete().eq('id', id);
    setOverrides(prev => prev.filter(o => o.id !== id));
    if (selectedDay?.date === date) setSelectedDay(null);
  };

  const openMinNightsPopover = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = availOverrides.find(o => o.date === dateStr);
    setMinNightsPopover({
      date: dateStr,
      value: existing ? String(existing.min_nights) : '',
      existingId: existing?.id,
    });
    setSelectedDay(null);
  };

  const saveMinNightsOverride = async () => {
    if (!minNightsPopover) return;
    setSavingMinNights(true);
    const val = parseInt(minNightsPopover.value);

    if (!minNightsPopover.value.trim() || isNaN(val) || val <= 0) {
      // treat empty/0 as "remove override"
      if (minNightsPopover.existingId) {
        await supabase.from('date_availability_overrides').delete().eq('id', minNightsPopover.existingId);
        setAvailOverrides(prev => prev.filter(o => o.id !== minNightsPopover.existingId));
      }
      setSavingMinNights(false);
      setMinNightsPopover(null);
      flash('Override removed');
      return;
    }

    if (minNightsPopover.existingId) {
      await supabase.from('date_availability_overrides').update({ min_nights: val, updated_at: new Date().toISOString() }).eq('id', minNightsPopover.existingId);
      setAvailOverrides(prev => prev.map(o => o.id === minNightsPopover.existingId ? { ...o, min_nights: val } : o));
    } else {
      const { data } = await supabase
        .from('date_availability_overrides')
        .upsert({ property_id: propertyId, date: minNightsPopover.date, min_nights: val, updated_at: new Date().toISOString() }, { onConflict: 'property_id,date' })
        .select()
        .maybeSingle();
      if (data) {
        setAvailOverrides(prev => [
          ...prev.filter(o => o.date !== minNightsPopover.date),
          { id: data.id, date: data.date, min_nights: data.min_nights },
        ]);
      }
    }
    setSavingMinNights(false);
    setMinNightsPopover(null);
    flash('Min nights saved');
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const renderCalendar = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div className="flex-1">
        <div className="grid grid-cols-7 mb-1">
          {DAY_ABBR.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="bg-white h-16" />;

            const dateStr = formatDate(year, month, day);
            const isPast = dateStr < todayStr;
            const price = resolvePrice(dateStr);
            const hasOverride = overrides.some(o => o.date === dateStr);
            const availOverride = availOverrides.find(o => o.date === dateStr);
            const isSelected = selectedDay?.date === dateStr;
            const isToday = dateStr === todayStr;
            const isHovered = hoveredDate === dateStr;
            const isMinNightsOpen = minNightsPopover?.date === dateStr;

            return (
              <div
                key={i}
                className="relative"
                onMouseEnter={() => !isPast && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <button
                  onClick={() => !isPast && openDayEditor(dateStr)}
                  disabled={isPast}
                  className={[
                    'w-full h-16 flex flex-col items-start justify-start p-1.5 text-left transition-colors',
                    isPast ? 'opacity-40 cursor-not-allowed bg-white' : 'hover:bg-blue-50 cursor-pointer bg-white',
                    isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : '',
                    isMinNightsOpen ? 'bg-teal-50 ring-2 ring-inset ring-teal-400' : '',
                    hasOverride && !isSelected && !isMinNightsOpen ? 'bg-amber-50' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={[
                    'text-sm font-medium leading-none',
                    isToday ? 'w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs' : 'text-gray-900',
                  ].join(' ')}>
                    {day}
                  </span>
                  {!isPast && (
                    <span className={[
                      'text-xs mt-auto font-medium',
                      hasOverride ? 'text-amber-700' : 'text-gray-500',
                    ].join(' ')}>
                      ${price}
                    </span>
                  )}
                  {/* Min nights chip — always visible if override exists */}
                  {!isPast && availOverride && (
                    <span className="absolute top-1 right-1 flex items-center gap-0.5 bg-teal-100 text-teal-700 text-[10px] font-semibold px-1 py-0.5 rounded leading-none">
                      <Moon className="w-2.5 h-2.5" strokeWidth={2} />
                      {availOverride.min_nights}
                    </span>
                  )}
                </button>

                {/* Hover min-nights trigger — only shown on hover when no override */}
                {!isPast && isHovered && !availOverride && !isMinNightsOpen && (
                  <button
                    onClick={(e) => openMinNightsPopover(dateStr, e)}
                    className="absolute top-1 right-1 flex items-center gap-0.5 bg-gray-100 hover:bg-teal-100 text-gray-400 hover:text-teal-600 text-[10px] font-semibold px-1 py-0.5 rounded leading-none transition-colors"
                    title="Set custom minimum nights"
                  >
                    <Moon className="w-2.5 h-2.5" strokeWidth={2} />
                    min
                  </button>
                )}

                {/* Click existing chip to edit */}
                {!isPast && availOverride && (
                  <button
                    onClick={(e) => openMinNightsPopover(dateStr, e)}
                    className="absolute top-1 right-1 flex items-center gap-0.5 bg-teal-100 hover:bg-teal-200 text-teal-700 text-[10px] font-semibold px-1 py-0.5 rounded leading-none transition-colors"
                    title="Edit minimum nights override"
                  >
                    <Moon className="w-2.5 h-2.5" strokeWidth={2} />
                    {availOverride.min_nights}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return <div className="py-8 text-gray-400 text-sm">Loading…</div>;

  const month2 = viewMonth === 11 ? 0 : viewMonth + 1;
  const year2 = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Left: Calendar ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Pricing Calendar</h3>
            {msg && <span className="text-sm text-green-600 font-medium ml-2">{msg}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700 w-36 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Two-month calendar */}
        <div className="space-y-6">
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            {renderCalendar(viewYear, viewMonth)}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">
              {MONTH_NAMES[month2]} {year2}
            </div>
            {renderCalendar(year2, month2)}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
            Custom date price
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-100 border border-teal-300 inline-block" />
            Custom min nights
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block" />
            Day-of-week / base rate
          </span>
        </div>
      </div>

      {/* ── Right: Settings panel ───────────────────────────────────────────── */}
      <div className="w-full lg:w-72 lg:flex-shrink-0 space-y-5">

        {/* Base settings */}
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900">Base settings</div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Default nightly rate</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={basePriceInput}
                onChange={e => setBasePriceInput(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tax rate</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRateInput}
                onChange={e => setTaxRateInput(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>

          {/* Display price mode toggle */}
          <div className="pt-1 border-t">
            <div className="text-xs text-gray-500 mb-2">Displayed price on booking card</div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setDisplayPriceMode('base')}
                className={`flex-1 py-2 transition-colors ${
                  displayPriceMode === 'base'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Default rate
              </button>
              <button
                onClick={() => setDisplayPriceMode('average')}
                className={`flex-1 py-2 transition-colors border-l border-gray-200 ${
                  displayPriceMode === 'average'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Nightly avg
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {displayPriceMode === 'average'
                ? dowAverage !== null
                  ? `Shows $${dowAverage}/night (avg of day-of-week rates)`
                  : 'No day-of-week rates set — will show base rate'
                : `Shows $${basePriceInput || basePrice}/night (fixed)`}
            </p>
          </div>

          <button
            onClick={saveBaseSettings}
            disabled={savingBase}
            className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {savingBase ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Day-of-week rates */}
        <div className="bg-white border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Nightly rate</div>
              <div className="text-xs text-gray-500 mt-0.5">This is your nightly rate before any adjustments.</div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-b">
            <span className="text-sm text-gray-700 font-medium">Customize by day of week</span>
            <button
              onClick={() => setDowEnabled(e => !e)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {dowEnabled
                ? <ToggleRight className="w-8 h-8 text-blue-600" />
                : <ToggleLeft className="w-8 h-8" />
              }
            </button>
          </div>

          <div className={`space-y-2 ${!dowEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
            {dowRates.map(row => (
              <div key={row.day_of_week} className="flex items-center gap-2">
                <label className="text-sm text-gray-600 w-28 flex-shrink-0">{DAY_NAMES[row.day_of_week]} rate</label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.rate}
                    onChange={e => setDowRates(prev => prev.map(r => r.day_of_week === row.day_of_week ? { ...r, rate: e.target.value } : r))}
                    placeholder={String(basePrice)}
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Changes do not apply to existing bookings, pending booking requests, or dates with custom rates.
          </p>

          <button
            onClick={saveDowRates}
            disabled={savingDow}
            className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {savingDow ? 'Saving…' : 'Save rates'}
          </button>
        </div>

        {/* Selected day price override editor */}
        {selectedDay && (
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Custom price for this date</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={selectedDay.rate}
                  onChange={e => setSelectedDay(d => d ? { ...d, rate: e.target.value } : d)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveDateOverride()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveDateOverride}
                className="flex-1 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Save
              </button>
              {selectedDay.existingId && (
                <button
                  onClick={() => deleteDateOverride(selectedDay.existingId!, selectedDay.date)}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* Min nights popover panel */}
        {minNightsPopover && (
          <div className="bg-white border border-teal-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-teal-600" strokeWidth={1.75} />
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(minNightsPopover.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <button onClick={() => setMinNightsPopover(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Set a custom minimum stay starting on this date. Leave blank or set to 0 to remove the override.
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Minimum nights</label>
              <input
                type="number"
                min="0"
                step="1"
                value={minNightsPopover.value}
                onChange={e => setMinNightsPopover(p => p ? { ...p, value: e.target.value } : p)}
                placeholder="e.g. 3"
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-300"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveMinNightsOverride()}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveMinNightsOverride}
                disabled={savingMinNights}
                className="flex-1 py-1.5 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors disabled:opacity-50"
              >
                {savingMinNights ? 'Saving…' : 'Save'}
              </button>
              {minNightsPopover.existingId && (
                <button
                  onClick={() => {
                    setMinNightsPopover(p => p ? { ...p, value: '' } : p);
                    saveMinNightsOverride();
                  }}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recent overrides list */}
        {overrides.length > 0 && (
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Custom date prices</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...overrides].sort((a, b) => a.date.localeCompare(b.date)).map(o => (
                <div key={o.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">
                    {new Date(o.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-700">${o.rate}</span>
                    <button
                      onClick={() => deleteDateOverride(o.id, o.date)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Seasonal Pricing Presets ─────────────────────────────────────────── */}
      <div className="mt-8 border-t pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Seasonal Pricing</h3>
            <p className="text-xs text-gray-500 mt-0.5">Date-specific overrides still win. Seasonal presets win over day-of-week rates.</p>
          </div>
          <button
            onClick={() => { setPresetEditId('new'); setPresetDraft({ is_active: true, priority: 0, min_nights: null }); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add preset
          </button>
        </div>

        {presetEditId === 'new' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3 mb-4">
            <p className="text-sm font-semibold text-gray-900">New seasonal preset</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Summer Season, Holiday Week" value={presetDraft.name ?? ''} onChange={e => setPresetDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={presetDraft.start_date ?? ''} onChange={e => setPresetDraft(d => ({ ...d, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={presetDraft.end_date ?? ''} onChange={e => setPresetDraft(d => ({ ...d, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nightly rate ($)</label>
                <input type="number" min="1" step="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 250" value={presetDraft.nightly_rate ?? ''} onChange={e => setPresetDraft(d => ({ ...d, nightly_rate: parseFloat(e.target.value) || undefined }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min nights (optional)</label>
                <input type="number" min="1" step="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="—" value={presetDraft.min_nights ?? ''} onChange={e => setPresetDraft(d => ({ ...d, min_nights: parseInt(e.target.value) || null }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                <input type="number" min="0" step="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0" value={presetDraft.priority ?? 0} onChange={e => setPresetDraft(d => ({ ...d, priority: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={presetDraft.is_active ?? true} onChange={e => setPresetDraft(d => ({ ...d, is_active: e.target.checked }))} className="rounded" />
              Active
            </label>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!presetDraft.name || !presetDraft.start_date || !presetDraft.end_date || !presetDraft.nightly_rate) return;
                  setPresetSaving(true);
                  const { data, error } = await supabase.from('seasonal_pricing_presets').insert({
                    property_id: propertyId,
                    name: presetDraft.name,
                    start_date: presetDraft.start_date,
                    end_date: presetDraft.end_date,
                    nightly_rate: presetDraft.nightly_rate,
                    min_nights: presetDraft.min_nights ?? null,
                    priority: presetDraft.priority ?? 0,
                    is_active: presetDraft.is_active ?? true,
                  }).select().maybeSingle();
                  if (!error && data) { setPresets(prev => [...prev, data as SeasonalPreset].sort((a, b) => a.start_date.localeCompare(b.start_date))); flash('Preset saved'); }
                  setPresetEditId(null); setPresetDraft({}); setPresetSaving(false);
                }}
                disabled={presetSaving || !presetDraft.name || !presetDraft.start_date || !presetDraft.end_date || !presetDraft.nightly_rate}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={() => { setPresetEditId(null); setPresetDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {presets.map(preset => (
            <div key={preset.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {presetEditId === preset.id ? (
                <div className="p-4 bg-blue-50 space-y-3">
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={presetDraft.name ?? ''} onChange={e => setPresetDraft(d => ({ ...d, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={presetDraft.start_date ?? ''} onChange={e => setPresetDraft(d => ({ ...d, start_date: e.target.value }))} />
                    <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={presetDraft.end_date ?? ''} onChange={e => setPresetDraft(d => ({ ...d, end_date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" min="1" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rate $" value={presetDraft.nightly_rate ?? ''} onChange={e => setPresetDraft(d => ({ ...d, nightly_rate: parseFloat(e.target.value) || undefined }))} />
                    <input type="number" min="1" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Min nights" value={presetDraft.min_nights ?? ''} onChange={e => setPresetDraft(d => ({ ...d, min_nights: parseInt(e.target.value) || null }))} />
                    <input type="number" min="0" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Priority" value={presetDraft.priority ?? 0} onChange={e => setPresetDraft(d => ({ ...d, priority: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={presetDraft.is_active ?? true} onChange={e => setPresetDraft(d => ({ ...d, is_active: e.target.checked }))} className="rounded" />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setPresetSaving(true);
                        await supabase.from('seasonal_pricing_presets').update({ name: presetDraft.name, start_date: presetDraft.start_date, end_date: presetDraft.end_date, nightly_rate: presetDraft.nightly_rate, min_nights: presetDraft.min_nights ?? null, priority: presetDraft.priority ?? 0, is_active: presetDraft.is_active, updated_at: new Date().toISOString() }).eq('id', preset.id);
                        setPresets(prev => prev.map(p => p.id === preset.id ? { ...p, ...presetDraft } as SeasonalPreset : p));
                        flash('Saved'); setPresetEditId(null); setPresetDraft({}); setPresetSaving(false);
                      }}
                      disabled={presetSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => { setPresetEditId(null); setPresetDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">{preset.name}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${preset.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {preset.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {preset.priority > 0 && <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Priority {preset.priority}</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(preset.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(preset.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      <span className="font-medium text-gray-700">${preset.nightly_rate}/night</span>
                      {preset.min_nights ? ` · min ${preset.min_nights} nights` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={async () => {
                        const next = !preset.is_active;
                        await supabase.from('seasonal_pricing_presets').update({ is_active: next }).eq('id', preset.id);
                        setPresets(prev => prev.map(p => p.id === preset.id ? { ...p, is_active: next } : p));
                      }}
                      className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {preset.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => { setPresetEditId(preset.id); setPresetDraft({ name: preset.name, start_date: preset.start_date, end_date: preset.end_date, nightly_rate: preset.nightly_rate, min_nights: preset.min_nights, priority: preset.priority, is_active: preset.is_active }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                    <button onClick={async () => { if (!confirm('Delete this preset?')) return; await supabase.from('seasonal_pricing_presets').delete().eq('id', preset.id); setPresets(prev => prev.filter(p => p.id !== preset.id)); }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {presets.length === 0 && !presetEditId && (
            <div className="text-center py-8 text-gray-400 text-sm border border-gray-100 rounded-xl">No seasonal presets. Add one above.</div>
          )}
        </div>
      </div>
    </div>
  );
}
