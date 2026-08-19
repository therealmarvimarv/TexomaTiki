import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AvailabilityEditor from './AvailabilityEditor';
import CalendarSync from './CalendarSync';
import {
  ChevronLeft, ChevronRight, RefreshCw, ExternalLink, X,
  Calendar as CalendarIcon, Settings, RefreshCcw,
} from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingEvent {
  id: string;
  type: 'booking';
  status: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  pets: number;
  totalPrice: number;
  paymentStatus: string;
}

interface OwnerBlockEvent {
  id: string;
  type: 'owner_block';
  startDate: string;
  endDate: string;
  reason: string | null;
  blockType: string;
}

interface IcalBlockEvent {
  id: string;
  type: 'ical';
  date: string;
  sourceId: string;
  sourceName: string;
  platform: string | null;
}

interface CleaningEvent {
  id: string;
  type: 'cleaning';
  date: string;
  status: string;
  notes: string | null;
  bookingId: string | null;
}

type CalEvent = BookingEvent | OwnerBlockEvent | IcalBlockEvent | CleaningEvent;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function dateStr(d: Date): string {
  // Use local date components to avoid UTC-conversion off-by-one in UTC+ timezones.
  // All calendar cells are built from local year/month/day, so this must stay local too.
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(s: string): string {
  const d = parseDate(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(v: number): string {
  return v == null ? '—' : `$${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function isBetween(day: string, start: string, end: string): boolean {
  return day >= start && day < end;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { bar: string; dot: string; label: string; text: string }> = {
  confirmed:        { bar: 'bg-emerald-500',  dot: 'bg-emerald-500',  label: 'Confirmed',        text: 'text-emerald-700' },
  pending_review:   { bar: 'bg-amber-400',    dot: 'bg-amber-400',    label: 'Pending Review',   text: 'text-amber-700' },
  pending_payment:  { bar: 'bg-blue-400',     dot: 'bg-blue-400',     label: 'Pending Payment',  text: 'text-blue-700' },
  payment_conflict: { bar: 'bg-red-500',      dot: 'bg-red-500',      label: 'Payment Conflict', text: 'text-red-700' },
  cancelled:        { bar: 'bg-gray-300',     dot: 'bg-gray-300',     label: 'Cancelled',        text: 'text-gray-500' },
  expired:          { bar: 'bg-gray-300',     dot: 'bg-gray-300',     label: 'Expired',          text: 'text-gray-500' },
  owner_block:      { bar: 'bg-slate-400',    dot: 'bg-slate-400',    label: 'Owner Block',      text: 'text-slate-700' },
  ical:             { bar: 'bg-purple-400',   dot: 'bg-purple-400',   label: 'iCal Import',      text: 'text-purple-700' },
  cleaning:         { bar: 'bg-yellow-400',   dot: 'bg-yellow-400',   label: 'Cleaning',         text: 'text-yellow-700' },
};

const STATUS_CFG_UNKNOWN = { bar: 'bg-gray-400', dot: 'bg-gray-400', label: 'Unknown', text: 'text-gray-600' };

function cfgFor(e: CalEvent) {
  if (e.type === 'booking') return STATUS_CFG[e.status] ?? STATUS_CFG_UNKNOWN;
  if (e.type === 'owner_block') return STATUS_CFG.owner_block;
  if (e.type === 'ical') return STATUS_CFG.ical;
  if (e.type === 'cleaning') return STATUS_CFG.cleaning;
  return STATUS_CFG_UNKNOWN;
}

function labelFor(e: CalEvent): string {
  if (e.type === 'booking') return e.guestName || 'Guest';
  if (e.type === 'owner_block') return e.reason || 'Owner Block';
  if (e.type === 'ical') return e.sourceName;
  if (e.type === 'cleaning') return 'Cleaning';
  return '';
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const cfg = cfgFor(event);

  return (
    <div className="bg-white rounded-2xl shadow-xl border max-w-sm w-full p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${cfg.dot} flex-shrink-0 mt-0.5`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {event.type === 'booking' && (
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-900 text-base">{event.guestName}</p>
            {event.guestEmail && <p className="text-sm text-gray-500">{event.guestEmail}</p>}
            {event.guestPhone && <p className="text-sm text-gray-500">{event.guestPhone}</p>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-gray-400">Check-in</span><span className="font-medium">{fmtDate(event.checkIn)}</span>
            <span className="text-gray-400">Check-out</span><span className="font-medium">{fmtDate(event.checkOut)}</span>
            <span className="text-gray-400">Nights</span><span className="font-medium">{event.nights}</span>
            <span className="text-gray-400">Guests</span><span className="font-medium">{event.guestCount}{event.pets ? ` + ${event.pets} pet${event.pets > 1 ? 's' : ''}` : ''}</span>
            <span className="text-gray-400">Total</span><span className="font-medium">{fmtMoney(event.totalPrice)}</span>
            <span className="text-gray-400">Payment</span><span className="font-medium capitalize">{event.paymentStatus}</span>
          </div>
          <Link
            to={`/admin/bookings/${event.id}`}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
          >
            View booking detail <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {event.type === 'owner_block' && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-gray-400">Start</span><span className="font-medium">{fmtDate(event.startDate)}</span>
            <span className="text-gray-400">End</span><span className="font-medium">{fmtDate(event.endDate)}</span>
            <span className="text-gray-400">Type</span><span className="font-medium capitalize">{event.blockType.replace(/_/g, ' ')}</span>
          </div>
          {event.reason && <p className="text-gray-600 mt-1">{event.reason}</p>}
        </div>
      )}

      {event.type === 'ical' && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-gray-400">Date</span><span className="font-medium">{fmtDate(event.date)}</span>
            <span className="text-gray-400">Source</span><span className="font-medium">{event.sourceName}</span>
            {event.platform && (
              <><span className="text-gray-400">Platform</span><span className="font-medium capitalize">{event.platform}</span></>
            )}
          </div>
        </div>
      )}

      {event.type === 'cleaning' && (
        <div className="space-y-1 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-gray-400">Date</span><span className="font-medium">{fmtDate(event.date)}</span>
            <span className="text-gray-400">Status</span><span className="font-medium capitalize">{event.status}</span>
          </div>
          {event.notes && <p className="text-gray-600 mt-1">{event.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { key: 'confirmed',        label: 'Confirmed' },
    { key: 'pending_review',   label: 'Pending Review' },
    { key: 'pending_payment',  label: 'Pending Payment' },
    { key: 'payment_conflict', label: 'Payment Conflict' },
    { key: 'owner_block',      label: 'Owner Block' },
    { key: 'ical',             label: 'iCal Import' },
    { key: 'cleaning',         label: 'Cleaning' },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
      {items.map(i => (
        <span key={i.key} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_CFG[i.key].bar}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────

function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Compute month window
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const rangeStart = new Date(year, month - 1, 15); // generous window
  const rangeEnd = new Date(year, month + 2, 15);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const rStart = dateStr(rangeStart);
    const rEnd = dateStr(rangeEnd);

    const [bookingsRes, blocksRes, icalRes, cleaningRes, sourcesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id,status,payment_status,guest_name,guest_email,guest_phone,check_in,check_out,guests,pets,total_price')
        .eq('property_id', PROPERTY_ID)
        .in('status', ['confirmed', 'pending_review', 'pending_payment', 'payment_conflict'])
        .gte('check_out', rStart)
        .lte('check_in', rEnd),
      supabase
        .from('owner_blocks')
        .select('id,start_date,end_date,reason,block_type')
        .eq('property_id', PROPERTY_ID)
        .gte('end_date', rStart)
        .lte('start_date', rEnd),
      supabase
        .from('blocked_dates')
        .select('id,date,source')
        .eq('property_id', PROPERTY_ID)
        .ilike('source', 'import:%')
        .gte('date', rStart)
        .lte('date', rEnd),
      supabase
        .from('cleaning_tasks')
        .select('id,task_date,status,notes,booking_id')
        .eq('property_id', PROPERTY_ID)
        .gte('task_date', rStart)
        .lte('task_date', rEnd),
      supabase
        .from('ical_sources')
        .select('id,name,platform')
        .eq('property_id', PROPERTY_ID),
    ]);

    const all: CalEvent[] = [];

    if (bookingsRes.error) console.error('[AdminCalendar] bookings query error:', bookingsRes.error.message);
    if (blocksRes.error)   console.error('[AdminCalendar] owner_blocks query error:', blocksRes.error.message);
    if (icalRes.error)     console.error('[AdminCalendar] blocked_dates query error:', icalRes.error.message);
    if (cleaningRes.error) console.error('[AdminCalendar] cleaning_tasks query error:', cleaningRes.error.message);
    console.log('[AdminCalendar] range:', rStart, '→', rEnd, '| bookings:', bookingsRes.data?.length ?? 0, '| ical blocks:', icalRes.data?.length ?? 0);

    // Build source lookup: ical_source id → {name, platform}
    const sourceMap = new Map<string, { name: string; platform: string | null }>();
    (sourcesRes.data ?? []).forEach((s: Record<string, unknown>) => {
      sourceMap.set(s.id as string, { name: s.name as string, platform: (s.platform as string) || null });
    });

    (bookingsRes.data ?? []).forEach((b: Record<string, unknown>) => {
      const ci = (b.check_in as string).slice(0, 10);
      const co = (b.check_out as string).slice(0, 10);
      const nights = Math.round(
        (parseDate(co).getTime() - parseDate(ci).getTime()) / 86400000
      );
      all.push({
        id: b.id as string,
        type: 'booking',
        status: b.status as string,
        guestName: b.guest_name as string,
        guestEmail: b.guest_email as string,
        guestPhone: b.guest_phone as string | null,
        checkIn: ci,
        checkOut: co,
        nights,
        guestCount: (b.guests as number) || 0,
        pets: (b.pets as number) || 0,
        totalPrice: b.total_price as number,
        paymentStatus: b.payment_status as string,
      });
    });

    (blocksRes.data ?? []).forEach((b: Record<string, unknown>) => {
      all.push({
        id: b.id as string,
        type: 'owner_block',
        startDate: b.start_date as string,
        endDate: b.end_date as string,
        reason: b.reason as string | null,
        blockType: (b.block_type as string) || 'owner',
      });
    });

    (icalRes.data ?? []).forEach((b: Record<string, unknown>) => {
      const rawSource = (b.source as string) ?? '';
      const sourceUuid = rawSource.startsWith('import:') ? rawSource.slice(7) : rawSource;
      const src = sourceMap.get(sourceUuid);
      all.push({
        id: b.id as string,
        type: 'ical',
        date: (b.date as string).slice(0, 10),
        sourceId: sourceUuid,
        sourceName: src?.name ?? 'Imported Block',
        platform: src?.platform ?? null,
      });
    });

    (cleaningRes.data ?? []).forEach((b: Record<string, unknown>) => {
      all.push({
        id: b.id as string,
        type: 'cleaning',
        date: b.task_date as string,
        status: b.status as string,
        notes: b.notes as string | null,
        bookingId: b.booking_id as string | null,
      });
    });

    setEvents(all);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Close popover on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelected(null);
        setPopoverPos(null);
      }
    }
    if (selected) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [selected]);

  function eventsForDay(day: string): CalEvent[] {
    return events.filter(e => {
      if (e.type === 'booking') return isBetween(day, e.checkIn, e.checkOut);
      if (e.type === 'owner_block') return isBetween(day, e.startDate, e.endDate);
      if (e.type === 'ical') return e.date === day;
      if (e.type === 'cleaning') return e.date === day;
      return false;
    });
  }

  function isFirstDay(day: string, e: CalEvent): boolean {
    if (e.type === 'booking') return e.checkIn === day;
    if (e.type === 'owner_block') return e.startDate === day;
    return true;
  }

  function handleEventClick(e: React.MouseEvent, event: CalEvent) {
    e.stopPropagation();
    if (selected?.id === event.id) {
      setSelected(null);
      setPopoverPos(null);
      return;
    }
    setSelected(event);
    // Position relative to grid
    if (gridRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const gridRect = gridRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom - gridRect.top + 4,
        left: Math.min(rect.left - gridRect.left, gridRect.width - 300),
      });
    }
  }

  // Build calendar grid
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayStr = dateStr(today);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div ref={gridRef} className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 w-44 text-center">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="ml-2 px-3 py-1 text-xs font-medium border rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            Today
          </button>
        </div>
        <button onClick={loadEvents} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Legend />

      {/* Grid */}
      <div className="mt-4 border rounded-xl overflow-hidden bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className={`grid grid-cols-7 ${wi < weeks.length - 1 ? 'border-b' : ''}`}>
            {week.map((day, di) => {
              const ds = day ? dateStr(day) : '';
              const dayEvents = day ? eventsForDay(ds) : [];
              const isToday = ds === todayStr;
              const isCurrentMonth = day?.getMonth() === month;

              return (
                <div
                  key={di}
                  className={`min-h-[80px] sm:min-h-[96px] p-1 sm:p-1.5 ${di < 6 ? 'border-r' : ''} ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-gray-900 text-white'
                          : isCurrentMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(e => {
                          const cfg = cfgFor(e);
                          const isFirst = isFirstDay(ds, e);
                          return (
                            <button
                              key={e.id + ds}
                              onClick={ev => handleEventClick(ev, e)}
                              className={`w-full text-left rounded px-1 py-0.5 text-xs truncate transition-opacity hover:opacity-80 ${cfg.bar} text-white font-medium`}
                              title={isFirst ? labelFor(e) : undefined}
                            >
                              {isFirst ? <span className="truncate">{labelFor(e)}</span> : <span>&nbsp;</span>}
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Popover */}
      {selected && popoverPos && (
        <div
          ref={popoverRef}
          className="absolute z-50"
          style={{ top: popoverPos.top, left: Math.max(0, popoverPos.left) }}
        >
          <EventDetail event={selected} onClose={() => { setSelected(null); setPopoverPos(null); }} />
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {selected && !popoverPos && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <EventDetail event={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}

      {loading && events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type CalTab = 'calendar' | 'availability' | 'sync';

const TABS: { id: CalTab; label: string; icon: React.ElementType }[] = [
  { id: 'calendar',     label: 'Calendar',      icon: CalendarIcon },
  { id: 'availability', label: 'Availability',   icon: Settings },
  { id: 'sync',         label: 'Calendar Sync',  icon: RefreshCcw },
];

export default function AdminCalendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as CalTab | null;
  const [activeTab, setActiveTab] = useState<CalTab>(
    tabParam && ['calendar', 'availability', 'sync'].includes(tabParam) ? tabParam : 'calendar'
  );

  function switchTab(tab: CalTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'calendar' ? {} : { tab });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">View bookings, manage availability, and sync external calendars.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border p-4 sm:p-6">
          <CalendarView />
        </div>
      )}

      {activeTab === 'availability' && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Availability Settings</h3>
          <AvailabilityEditor propertyId={PROPERTY_ID} section={searchParams.get('section') ?? undefined} />
        </div>
      )}

      {activeTab === 'sync' && <CalendarSync />}
    </div>
  );
}
