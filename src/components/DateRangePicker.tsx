import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  checkIn: string;
  checkOut: string;
  onSelect: (checkIn: string, checkOut: string) => void;
  pricingMap?: Record<string, number>;
  minNightsMap?: Record<string, number>;
  blockedDates?: Set<string>;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isBetween(day: Date, start: Date, end: Date) {
  return day > start && day < end;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface MonthGridProps {
  year: number;
  month: number;
  checkIn: Date | null;
  checkOut: Date | null;
  hovered: Date | null;
  today: Date;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  pricingMap?: Record<string, number>;
  minNightsMap?: Record<string, number>;
  blockedDates?: Set<string>;
  selecting: 'checkIn' | 'checkOut';
}

function MonthGrid({ year, month, checkIn, checkOut, hovered, today, onDayClick, onDayHover, pricingMap, minNightsMap, blockedDates, selecting }: MonthGridProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const rangeEnd = checkIn && !checkOut && hovered ? hovered : checkOut;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const hasPricing = !!pricingMap;
  const hasSubLabel = hasPricing || !!minNightsMap;
  const cellHeight = hasSubLabel ? 'h-9' : 'h-6';

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-0 tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className={cellHeight} />;

          const dateStr = formatDate(day);
          const isBlocked = blockedDates?.has(dateStr) ?? false;
          const isPast = (day < today && !sameDay(day, today)) || isBlocked;
          const isStart = checkIn ? sameDay(day, checkIn) : false;
          const isEnd = checkOut ? sameDay(day, checkOut) : false;
          const isToday = sameDay(day, today);

          const effectiveEnd = checkIn && rangeEnd
            ? (checkIn < rangeEnd ? rangeEnd : null)
            : null;
          const effectiveStart = checkIn && rangeEnd
            ? (checkIn < rangeEnd ? checkIn : null)
            : null;

          const inRange = !!(effectiveStart && effectiveEnd && isBetween(day, effectiveStart, effectiveEnd));
          const isRangeStart = isStart && !!rangeEnd && checkIn && rangeEnd > checkIn;
          const isRangeEnd = isEnd && !!checkIn && checkOut && checkOut > checkIn;
          const price = pricingMap?.[dateStr];
          const isHovered = hovered ? sameDay(day, hovered) : false;
          const effectiveMinNights = minNightsMap?.[dateStr] ?? 1;

          const showMinNightsWarning = selecting === 'checkIn' && isHovered && effectiveMinNights > 1 && !isPast;

          return (
            <div
              key={i}
              className={`relative ${cellHeight} flex flex-col items-center ${(hasPricing || hasSubLabel) ? 'justify-start pt-0.5' : 'justify-center'}`}
              onClick={() => !isPast && onDayClick(day)}
              onMouseEnter={() => !isPast && onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
            >
              {inRange && (
                <div className="absolute inset-y-0 left-0 right-0 bg-rose-50" />
              )}
              {isRangeStart && (
                <div className="absolute inset-y-0 left-1/2 right-0 bg-rose-50" />
              )}
              {isRangeEnd && (
                <div className="absolute inset-y-0 left-0 right-1/2 bg-rose-50" />
              )}

              {showMinNightsWarning && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap bg-amber-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                  {effectiveMinNights} night min
                </div>
              )}

              <span
                className={[
                  'relative z-10 w-5 h-5 flex items-center justify-center text-[10px] rounded-full transition-colors',
                  isPast
                    ? isBlocked
                      ? 'text-gray-300 cursor-not-allowed line-through'
                      : 'text-gray-300 cursor-not-allowed'
                    : (isStart || isEnd)
                      ? 'bg-gray-900 text-white font-semibold cursor-pointer'
                      : inRange
                        ? 'text-gray-800 cursor-pointer hover:bg-rose-100'
                        : showMinNightsWarning
                          ? 'text-amber-700 cursor-pointer ring-1 ring-amber-400 bg-amber-50'
                          : isToday
                            ? 'text-rose-500 font-semibold cursor-pointer hover:bg-gray-100'
                            : 'text-gray-700 cursor-pointer hover:bg-gray-100',
                ].join(' ')}
              >
                {day.getDate()}
              </span>

              {hasSubLabel && !isPast && (
                <span className="relative z-10 text-[8px] leading-none mt-0.5 text-center w-full px-0.5 truncate text-gray-500">
                  {price !== undefined ? `$${price}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ checkIn, checkOut, onSelect, pricingMap, minNightsMap, blockedDates }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered, setHovered] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [minNightsError, setMinNightsError] = useState<string | null>(null);

  const ciDate = parseDate(checkIn);
  const coDate = parseDate(checkOut);

  const month2 = viewMonth === 11 ? 0 : viewMonth + 1;
  const year2 = viewMonth === 11 ? viewYear + 1 : viewYear;

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (day: Date) => {
    const str = formatDate(day);
    if (blockedDates?.has(str)) return;
    if (selecting === 'checkIn' || !ciDate) {
      onSelect(str, '');
      setSelecting('checkOut');
      setMinNightsError(null);
    } else {
      if (day <= ciDate) {
        onSelect(str, '');
        setSelecting('checkOut');
        setMinNightsError(null);
      } else {
        // Check no blocked dates fall within the range
        const hasBlockedInRange = blockedDates && (() => {
          const cur = new Date(ciDate);
          cur.setDate(cur.getDate() + 1);
          while (cur < day) {
            if (blockedDates.has(formatDate(cur))) return true;
            cur.setDate(cur.getDate() + 1);
          }
          return false;
        })();
        if (hasBlockedInRange) {
          setMinNightsError('Your selected range includes unavailable dates');
          return;
        }
        const nights = Math.round((day.getTime() - ciDate.getTime()) / 86400000);
        const ciStr = formatDate(ciDate);
        const requiredMin = minNightsMap?.[ciStr] ?? 1;
        if (nights < requiredMin) {
          setMinNightsError(`Minimum stay is ${requiredMin} night${requiredMin !== 1 ? 's' : ''} from this date`);
          return;
        }
        onSelect(checkIn, str);
        setSelecting('checkIn');
        setMinNightsError(null);
      }
    }
  };

  const handleClear = () => {
    onSelect('', '');
    setSelecting('checkIn');
    setMinNightsError(null);
  };

  const info = (() => {
    if (!ciDate || !coDate) return null;
    const nights = Math.round((coDate.getTime() - ciDate.getTime()) / 86400000);
    if (nights <= 0) return null;
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { nights, label: `${fmt(ciDate)} \u2013 ${fmt(coDate)}` };
  })();

  return (
    <div className="mt-5">
      <div className="mb-3">
        {info ? (
          <>
            <div className="text-base font-semibold text-gray-900">
              {info.nights} night{info.nights !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{info.label}</div>
          </>
        ) : minNightsError ? (
          <div className="text-sm font-medium text-amber-600">{minNightsError}</div>
        ) : (
          <div className="text-sm text-gray-500">
            {selecting === 'checkIn' ? 'Select a check-in date' : 'Select a checkout date'}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50">
          <button
            onClick={handlePrev}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="w-3 h-3 text-gray-600" />
          </button>
          <span className="text-[11px] font-semibold text-gray-700">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={handleNext}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
          >
            <ChevronRight className="w-3 h-3 text-gray-600" />
          </button>
        </div>

        <div className="px-2 py-1.5">
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            checkIn={ciDate}
            checkOut={coDate}
            hovered={hovered}
            today={today}
            onDayClick={handleDayClick}
            onDayHover={setHovered}
            pricingMap={pricingMap}
            minNightsMap={minNightsMap}
            blockedDates={blockedDates}
            selecting={selecting}
          />
        </div>

        <div className="border-t border-dashed border-gray-200 mx-2" />

        <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50">
          <div className="w-5" />
          <span className="text-[11px] font-semibold text-gray-700">
            {MONTH_NAMES[month2]} {year2}
          </span>
          <div className="w-5" />
        </div>

        <div className="px-2 py-1.5">
          <MonthGrid
            year={year2}
            month={month2}
            checkIn={ciDate}
            checkOut={coDate}
            hovered={hovered}
            today={today}
            onDayClick={handleDayClick}
            onDayHover={setHovered}
            pricingMap={pricingMap}
            minNightsMap={minNightsMap}
            blockedDates={blockedDates}
            selecting={selecting}
          />
        </div>

        <div className="flex justify-end px-2 py-1 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleClear}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline transition-colors"
          >
            Clear dates
          </button>
        </div>
      </div>
    </div>
  );
}
