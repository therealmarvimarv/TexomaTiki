import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Calendar, Clock, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  AlertTriangle, TrendingUp, Loader2, ExternalLink,
  Sparkles, Wrench, Shield, LogOut,
} from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// --- Property-local display helpers ---
// All date-only booking / operations values retain their recorded calendar day.
// True timestamps (inquiries and sync events) use the saved property time zone.
type PropertyDateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
type OverviewPreferences = { timeZone: string; dateFormat: PropertyDateFormat };

const DEFAULT_PREFERENCES: OverviewPreferences = {
  timeZone: 'America/Los_Angeles',
  dateFormat: 'MM/DD/YYYY',
};
const OverviewPreferencesContext = createContext<OverviewPreferences>(DEFAULT_PREFERENCES);
function useOverviewPreferences(): OverviewPreferences {
  return useContext(OverviewPreferencesContext);
}

function validPreferences(row: { timezone?: string | null; date_format?: string | null } | null): OverviewPreferences {
  const timeZoneCandidate = row?.timezone || DEFAULT_PREFERENCES.timeZone;
  let timeZone = DEFAULT_PREFERENCES.timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZoneCandidate });
    timeZone = timeZoneCandidate;
  } catch { /* Invalid IANA zone: retain the documented default. */ }
  const requested = row?.date_format;
  const dateFormat: PropertyDateFormat = requested === 'DD/MM/YYYY' || requested === 'YYYY-MM-DD'
    ? requested : DEFAULT_PREFERENCES.dateFormat;
  return { timeZone, dateFormat };
}

function propertyDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function storedDay(value: string): string {
  // The booking engine stores check-in/check-out as calendar dates represented
  // by TIMESTAMPTZ values; retain the YYYY-MM-DD part without re-zoning them.
  return value.slice(0, 10);
}

function calendarDayPlus(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtCalendarDate(value: string | null | undefined, format: PropertyDateFormat): string {
  if (!value) return '\u2014';
  const iso = storedDay(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '\u2014';
  const [, y, m, d] = match;
  return format === 'YYYY-MM-DD' ? `${y}-${m}-${d}`
    : format === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

function fmtEventDate(timestamp: string, prefs: OverviewPreferences): string {
  const instant = new Date(timestamp);
  return Number.isNaN(instant.getTime()) ? '\u2014'
    : fmtCalendarDate(propertyDay(instant, prefs.timeZone), prefs.dateFormat);
}

function fmtSyncTimestamp(timestamp: string, prefs: OverviewPreferences): string {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return '\u2014';
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: prefs.timeZone, hour: 'numeric', minute: '2-digit',
  }).format(instant);
  return `${fmtEventDate(timestamp, prefs)} ${clock}`;
}

function fmtHeadingDate(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nightsBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h left`;
}

// --- Shared stat card ---

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[184px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 min-[700px]:max-[833px]:p-3 shadow-sm">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${accent ?? 'bg-gray-100'}`}>
        <Icon className="h-4 w-4 text-gray-700" />
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] leading-4 text-gray-500">{label}</p>
        {loading ? (
          <div className="mt-1 h-7 w-16 animate-pulse rounded bg-gray-100" />
        ) : (
          <p className="mt-1 break-words text-2xl min-[700px]:max-[833px]:text-xl font-bold leading-tight text-gray-900">{value}</p>
        )}
        <p className="mt-1 text-xs leading-4 text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

// --- Widget shell ---

function Widget({
  title,
  loading,
  error,
  children,
  action,
  compactTabletHeader = false,
  stackNarrowTabletHeader = false,
  compactNarrowTabletHeader = false,
}: {
  title: string;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compactTabletHeader?: boolean;
  stackNarrowTabletHeader?: boolean;
  compactNarrowTabletHeader?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b ${compactTabletHeader ? 'min-[834px]:px-3 min-[834px]:py-3 min-[960px]:px-5 min-[960px]:py-4' : ''} ${stackNarrowTabletHeader ? 'min-[700px]:max-[833px]:flex-col min-[700px]:max-[833px]:items-stretch min-[700px]:max-[833px]:px-0 min-[700px]:max-[833px]:py-0' : ''} ${compactNarrowTabletHeader ? 'min-[700px]:max-[833px]:px-2 min-[700px]:max-[833px]:py-3' : ''}`}>
        <h3 className={`font-semibold text-gray-900 ${compactTabletHeader ? 'min-[834px]:text-[13px] min-[960px]:text-base' : ''} ${stackNarrowTabletHeader ? 'min-[700px]:max-[833px]:px-3 min-[700px]:max-[833px]:py-3 min-[700px]:max-[833px]:text-sm' : ''} ${compactNarrowTabletHeader ? 'min-[700px]:max-[833px]:text-[11px] min-[700px]:max-[833px]:whitespace-nowrap' : ''}`}>{title}</h3>
        {action}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 py-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// --- 1. Stats summary ---

interface SummaryStats {
  upcomingCount: number;
  pendingCount: number;
  estimatedRevenueCents: number;
  syncStatus: 'healthy' | 'warning' | 'error' | 'none';
}

function useSummaryStats() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('property_id', PROPERTY_ID).eq('status', 'confirmed').gte('check_in', now).is('archived_at', null),
      supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('property_id', PROPERTY_ID).in('status', ['pending_review', 'pending_payment']).is('archived_at', null),
      supabase.from('bookings').select('amount_total')
        .eq('property_id', PROPERTY_ID).eq('status', 'confirmed').eq('payment_status', 'paid')
        .gte('check_in', now).is('archived_at', null),
      supabase.from('ical_sources').select('last_sync_at,last_error,enabled')
        .eq('property_id', PROPERTY_ID),
    ]).then(([upcoming, pending, rev, sources]) => {
      const revTotal = (rev.data ?? []).reduce((s, r) => s + (r.amount_total ?? 0), 0);
      const srcs = sources.data ?? [];
      let syncStatus: SummaryStats['syncStatus'] = 'none';
      if (srcs.length > 0) {
        if (srcs.some(s => s.last_error)) syncStatus = 'error';
        else if (srcs.some(s => s.enabled && !s.last_sync_at)) syncStatus = 'warning';
        else syncStatus = 'healthy';
      }
      setStats({
        upcomingCount: upcoming.count ?? 0,
        pendingCount: pending.count ?? 0,
        estimatedRevenueCents: revTotal,
        syncStatus,
      });
    }).finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

function StatsRow({ currentSyncStatus }: { currentSyncStatus: SummaryStats['syncStatus'] | null }) {
  const { stats, loading } = useSummaryStats();
  // Only the Calendar Sync card receives the refreshed status. Other stat cards remain unchanged.
  const syncStatus = currentSyncStatus ?? stats?.syncStatus;
  const syncLabel =
    syncStatus === 'healthy' ? 'All synced' :
    syncStatus === 'error' ? 'Sync error' :
    syncStatus === 'warning' ? 'Needs attention' : 'No sources';

  return (
    <div className="grid grid-cols-2 min-[700px]:grid-cols-4 min-[834px]:grid-cols-4 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Calendar}
        label="Upcoming Bookings"
        value={loading ? '\u2014' : (stats?.upcomingCount ?? 0)}
        sub="Next confirmed stays"
        accent="bg-blue-50"
        loading={loading}
      />
      <StatCard
        icon={Clock}
        label="Pending Requests"
        value={loading ? '\u2014' : (stats?.pendingCount ?? 0)}
        sub="Awaiting host review"
        accent="bg-yellow-50"
        loading={loading}
      />
      <StatCard
        icon={TrendingUp}
        label="Est. Revenue"
        value={loading ? '\u2014' : fmtMoney(stats?.estimatedRevenueCents ?? 0)}
        sub="Upcoming confirmed + paid"
        accent="bg-green-50"
        loading={loading}
      />
      <StatCard
        icon={RefreshCw}
        label="Calendar Sync"
        value={loading ? '\u2014' : syncLabel}
        sub={syncStatus === 'none' ? 'No iCal sources' : 'iCal import status'}
        accent={
          syncStatus === 'healthy' ? 'bg-green-50' :
          syncStatus === 'error' ? 'bg-red-50' :
          syncStatus === 'warning' ? 'bg-yellow-50' : 'bg-gray-100'
        }
        loading={loading}
      />
    </div>
  );
}

// --- 2. Upcoming bookings ---

interface BookingRow {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  amount_total: number | null;
  total_price: number;
  status: string;
  payment_status: string;
}

function UpcomingBookings() {
  const { dateFormat } = useOverviewPreferences();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date().toISOString();
    supabase.from('bookings')
      .select('id,guest_name,check_in,check_out,guests,amount_total,total_price,status,payment_status')
      .eq('property_id', PROPERTY_ID)
      .eq('status', 'confirmed')
      .is('archived_at', null)
      .gte('check_in', now)
      .order('check_in', { ascending: true })
      .limit(5)
      .then(({ data, error: err }) => {
        if (err) setError('Could not load upcoming bookings.');
        setBookings((data ?? []) as BookingRow[]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Widget
      title="Upcoming Bookings"
      loading={loading}
      error={error}
      action={
        <Link to="/admin/bookings" className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      }
    >
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No upcoming confirmed bookings yet.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const nights = nightsBetween(b.check_in, b.check_out);
            const total = b.amount_total != null ? fmtMoney(b.amount_total) : `$${Number(b.total_price).toFixed(2)}`;
            return (
              <div key={b.id} className="flex items-start justify-between gap-3 py-2.5 border-b last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{b.guest_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtCalendarDate(b.check_in, dateFormat)} &#8594; {fmtCalendarDate(b.check_out, dateFormat)}
                    <span className="mx-1.5 text-gray-300">&#183;</span>
                    {nights}n &#183; {b.guests} guest{b.guests !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">{total}</span>
                  <Link
                    to={`/admin/bookings/${b.id}`}
                    className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// --- 3. Pending requests ---

function PendingRequests() {
  const { dateFormat } = useOverviewPreferences();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('bookings')
      .select('id,guest_name,check_in,check_out,guests,amount_total,total_price,status,payment_status,payment_expires_at' as string)
      .eq('property_id', PROPERTY_ID)
      .in('status', ['pending_review', 'pending_payment'])
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error: err }) => {
        if (err) setError('Could not load pending requests.');
        setBookings((data ?? []) as BookingRow[]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Widget
      title="Pending Requests"
      loading={loading}
      error={error}
      action={
        <Link to="/admin/bookings" className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      }
    >
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No pending booking requests.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const total = (b as any).amount_total != null ? fmtMoney((b as any).amount_total) : `$${Number(b.total_price).toFixed(2)}`;
            const expires = (b as any).payment_expires_at;
            return (
              <div key={b.id} className="flex items-start justify-between gap-3 py-2.5 border-b last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{b.guest_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtCalendarDate(b.check_in, dateFormat)} &#8594; {fmtCalendarDate(b.check_out, dateFormat)}
                  </p>
                  {expires && (
                    <span className="inline-block mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {timeUntil(expires)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">{total}</span>
                  <Link
                    to={`/admin/bookings/${b.id}`}
                    className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// --- 4. Revenue estimate ---

type RevenueRange = 'month' | 'next30' | 'next90' | 'ytd';

function RevenueWidget() {
  const [range, setRange] = useState<RevenueRange>('month');
  const [data, setData] = useState<{ totalCents: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRevenue = useCallback(async (r: RevenueRange) => {
    setLoading(true);
    setError('');
    const now = new Date();
    let from: string, to: string;

    if (r === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    } else if (r === 'next30') {
      from = now.toISOString();
      const end = new Date(now); end.setDate(end.getDate() + 30);
      to = end.toISOString();
    } else if (r === 'next90') {
      from = now.toISOString();
      const end = new Date(now); end.setDate(end.getDate() + 90);
      to = end.toISOString();
    } else {
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    }

    const { data: rows, error: err } = await supabase.from('bookings')
      .select('amount_total,total_price')
      .eq('property_id', PROPERTY_ID)
      .eq('status', 'confirmed')
      .eq('payment_status', 'paid')
      .gte('check_in', from)
      .lte('check_in', to);

    if (err) { setError('Could not load revenue data.'); setLoading(false); return; }

    const totalCents = (rows ?? []).reduce((s, r) => s + (r.amount_total ?? Math.round(Number(r.total_price) * 100)), 0);
    setData({ totalCents, count: (rows ?? []).length });
    setLoading(false);
  }, []);

  useEffect(() => { fetchRevenue(range); }, [range, fetchRevenue]);

  const avg = data && data.count > 0 ? data.totalCents / data.count : 0;

  const RANGES: { key: RevenueRange; topLabel: string; bottomLabel: string }[] = [
    { key: 'month', topLabel: 'This', bottomLabel: 'Month' },
    { key: 'next30', topLabel: 'Next', bottomLabel: '30d' },
    { key: 'next90', topLabel: 'Next', bottomLabel: '90d' },
    { key: 'ytd', topLabel: 'This', bottomLabel: 'Year' },
  ];

  return (
    <Widget
      title="Revenue Estimate"
      loading={loading}
      error={error}
      compactTabletHeader
      stackNarrowTabletHeader
      action={
        <div className="flex gap-1 min-[700px]:max-[833px]:w-full min-[700px]:max-[833px]:justify-between min-[700px]:max-[833px]:gap-0.5 min-[700px]:max-[833px]:border-t min-[700px]:max-[833px]:px-2 min-[700px]:max-[833px]:py-2">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`text-xs px-2.5 py-1 min-[700px]:max-[833px]:px-1 min-[700px]:max-[833px]:text-[9px] min-[834px]:px-1 min-[834px]:text-[9px] min-[960px]:px-1.5 min-[960px]:text-[10px] lg:px-2.5 lg:text-xs whitespace-nowrap rounded-lg transition-colors ${range === r.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <span className="block leading-tight">{r.topLabel}</span>
              <span className="block leading-tight">{r.bottomLabel}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-bold text-gray-900">{fmtMoney(data?.totalCents ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Confirmed + paid bookings only. Confirmed but unpaid bookings are excluded.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-gray-500">Bookings</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{data?.count ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg booking value</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{fmtMoney(avg)}</p>
          </div>
        </div>
      </div>
    </Widget>
  );
}

// --- 5. Mini calendar ---

interface CalEvent {
  date: string;
  type: 'confirmed' | 'pending' | 'blocked' | 'ical' | 'owner_block';
  label?: string;
  bookingId?: string;
}

interface DayDetail {
  date: string;
  events: CalEvent[];
}

function MiniCalendar() {
  const prefs = useOverviewPreferences();
  const [year, setYear] = useState(() => Number(propertyDay(new Date(), DEFAULT_PREFERENCES.timeZone).slice(0, 4)));
  const [month, setMonth] = useState(() => Number(propertyDay(new Date(), DEFAULT_PREFERENCES.timeZone).slice(5, 7)) - 1);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DayDetail | null>(null);

  // Align the initially displayed month after the saved time zone is loaded.
  useEffect(() => {
    const date = propertyDay(new Date(), prefs.timeZone);
    setYear(Number(date.slice(0, 4)));
    setMonth(Number(date.slice(5, 7)) - 1);
  }, [prefs.timeZone]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${year}-${pad(month + 1)}-01`;
    const lastDay = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

    Promise.all([
      supabase.from('bookings')
        .select('id,guest_name,check_in,check_out,status')
        .eq('property_id', PROPERTY_ID)
        .in('status', ['confirmed', 'pending_review', 'pending_payment'])
        .gte('check_out', firstDay)
        .lte('check_in', lastDay + 'T23:59:59'),
      supabase.from('blocked_dates')
        .select('date,source')
        .eq('property_id', PROPERTY_ID)
        .gte('date', firstDay)
        .lte('date', lastDay),
      supabase.from('owner_blocks')
        .select('id,start_date,end_date,block_type,reason')
        .eq('property_id', PROPERTY_ID)
        .lte('start_date', lastDay)
        .gt('end_date', firstDay),
    ]).then(([bRes, bdRes, obRes]) => {
      if (!active) return;
      if (bRes.error || bdRes.error) { setError('Could not load calendar.'); setLoading(false); return; }
      const evts: CalEvent[] = [];

      for (const b of (bRes.data ?? [])) {
        const ci = storedDay(b.check_in);
        const co = storedDay(b.check_out);
        for (let dateStr = ci; dateStr < co; dateStr = calendarDayPlus(dateStr, 1)) {
          if (dateStr >= firstDay && dateStr <= lastDay) {
            evts.push({
              date: dateStr,
              type: b.status === 'confirmed' ? 'confirmed' : 'pending',
              label: b.guest_name,
              bookingId: b.id,
            });
          }
        }
      }

      for (const bd of (bdRes.data ?? [])) {
        const existsAsBooking = evts.some(e => e.date === bd.date && (e.type === 'confirmed' || e.type === 'pending'));
        if (!existsAsBooking) {
          evts.push({
            date: bd.date,
            type: bd.source === 'booking' ? 'blocked' : 'ical',
          });
        }
      }

      for (const ob of (obRes.data ?? [])) {
        for (let ds = ob.start_date; ds < ob.end_date; ds = calendarDayPlus(ds, 1)) {
          if (ds >= firstDay && ds <= lastDay) {
            const taken = evts.some(e => e.date === ds && (e.type === 'confirmed' || e.type === 'pending'));
            if (!taken) {
              evts.push({
                date: ds,
                type: 'owner_block',
                label: ob.reason || (ob.block_type ? ob.block_type.replace(/_/g, ' ') : 'Owner Block'),
              });
            }
          }
        }
      }

      setEvents(evts);
      setLoading(false);
    });
    return () => { active = false; };
  }, [year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = propertyDay(new Date(), prefs.timeZone);

  function eventsForDate(dateStr: string): CalEvent[] {
    return events.filter(e => e.date === dateStr);
  }

  function eventDot(type: CalEvent['type']) {
    switch (type) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-amber-400';
      case 'blocked': return 'bg-gray-400';
      case 'ical': return 'bg-blue-400';
      case 'owner_block': return 'bg-slate-500';
    }
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function handleDayClick(dateStr: string) {
    const evts = eventsForDate(dateStr);
    if (evts.length === 0) { setSelected(null); return; }
    setSelected({ date: dateStr, events: evts });
  }

  return (
    <Widget
      title="Calendar Preview"
      loading={loading}
      error={error}
      compactTabletHeader
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[94px] text-center text-xs font-semibold text-gray-900 2xl:text-sm">{monthName}</span>
          <button
            type="button"
            onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_clamp(96px,23%,120px)] items-stretch gap-3">
          <div className="min-w-0">
            <div className="grid grid-cols-7 gap-x-0 gap-y-0">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="py-1 text-center text-[10px] font-medium text-gray-400 2xl:text-[11px]">{d}</div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvts = eventsForDate(dateStr);
                const isToday = dateStr === today;
                const isSelected = selected?.date === dateStr;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(dateStr)}
                    aria-label={fmtCalendarDate(dateStr, prefs.dateFormat)}
                    aria-pressed={isSelected}
                    className={`relative flex min-h-[24px] flex-col items-center justify-center rounded-lg text-[11px] transition-colors 2xl:min-h-[26px] 2xl:text-xs
                      ${isSelected ? 'bg-gray-900 text-white' : isToday ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                      ${dayEvts.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span>{day}</span>
                    {dayEvts.length > 0 && (
                      <div className="mt-0.5 flex gap-0.5">
                        {dayEvts.slice(0, 3).map((e, idx) => (
                          <span key={idx} className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : eventDot(e.type)}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend remains to the right of the calendar on laptops and larger displays. */}
          <div className="flex min-w-0 flex-col gap-1.5 border-l border-gray-200 py-1 pl-3">
            {[
              { color: 'bg-green-500', label: 'Confirmed' },
              { color: 'bg-amber-400', label: 'Pending' },
              { color: 'bg-slate-500', label: 'Owner Block' },
              { color: 'bg-gray-400', label: 'Blocked' },
              { color: 'bg-blue-400', label: 'Imported' },
            ].map(l => (
              <div key={l.label} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] leading-4 text-gray-500 2xl:text-xs">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${l.color}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Existing selected-day details and direct booking links are unchanged. */}
        {selected && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{fmtCalendarDate(selected.date, prefs.dateFormat)}</p>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-700">&#10005;</button>
            </div>
            <div className="space-y-2">
              {selected.events.map((e, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${eventDot(e.type)}`} />
                    <span className="text-gray-700">{e.label ?? (e.type === 'ical' ? 'Imported calendar block' : e.type === 'owner_block' ? 'Owner Block' : 'Blocked by host')}</span>
                  </div>
                  {e.bookingId && (
                    <Link
                      to={`/admin/bookings/${e.bookingId}`}
                      className="text-xs text-gray-500 hover:text-gray-800 underline flex-shrink-0"
                    >
                      View
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Widget>
  );
}

// --- 6. Recent inquiries ---

interface InquiryRow {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  status: string;
  created_at: string;
}

const INQUIRY_STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  read: 'bg-gray-100 text-gray-600',
  responded: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
};

function RecentInquiries() {
  const prefs = useOverviewPreferences();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<InquiryRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase
      .from('inquiries')
      .select('id,sender_name,sender_email,sender_phone,message,status,created_at')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: false })
      .limit(3);
    if (err) setError('Could not load inquiries.');
    setInquiries((data ?? []) as InquiryRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await supabase.from('inquiries').update({ status: 'read' }).eq('id', id);
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'read' } : i));
  }

  async function copyEmail(email: string, inqId: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(inqId);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  }

  const btnClass = 'text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors';

  return (
    <Widget title="Recent Inquiries" loading={loading} error={error}>
      <p className="text-xs text-gray-400 -mt-1 mb-4">
        New guest inquiries are emailed to you and saved here as a reminder.
      </p>
      {inquiries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No recent inquiries.</p>
      ) : (
        <div className="space-y-4">
          {inquiries.map(inq => (
            <div key={inq.id} className="pb-4 border-b last:border-b-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <span className="font-medium text-sm text-gray-900">{inq.sender_name}</span>
                  <span className="text-xs text-gray-400 mx-1.5">&#183;</span>
                  <span className="text-xs text-gray-500">{fmtEventDate(inq.created_at, prefs)}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${INQUIRY_STATUS_STYLES[inq.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {inq.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{inq.sender_email}</p>
              <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">{inq.message}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {inq.status === 'new' && (
                  <button onClick={() => markRead(inq.id)} className={btnClass}>
                    Mark read
                  </button>
                )}
                <button onClick={() => setDetail(inq)} className={btnClass}>
                  Details
                </button>
                <button onClick={() => copyEmail(inq.sender_email, inq.id)} className={btnClass}>
                  {copied === inq.id ? 'Copied!' : 'Copy email'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t mt-2">
        <Link to="/admin/email?tab=inquiries" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
          View all inquiries &#8594;
        </Link>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-2xl border shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Inquiry Details</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">&#10005;</button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Name</dt>
                <dd className="text-gray-900">{detail.sender_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Email</dt>
                <dd className="text-gray-900 font-mono text-xs">{detail.sender_email}</dd>
              </div>
              {detail.sender_phone && (
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">Phone</dt>
                  <dd className="text-gray-900">{detail.sender_phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Received</dt>
                <dd className="text-gray-900">{fmtEventDate(detail.created_at, prefs)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Message</dt>
                <dd className="text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.message}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t">
              <button
                onClick={() => copyEmail(detail.sender_email, detail.id)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {copied === detail.id ? 'Copied!' : 'Copy email'}
              </button>
              <button
                onClick={() => setDetail(null)}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}

// --- 7. Sync health ---

interface IcalSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
}

function SyncHealth({ onStatusRefreshed }: { onStatusRefreshed: (status: SummaryStats['syncStatus']) => void }) {
  const prefs = useOverviewPreferences();
  const [sources, setSources] = useState<IcalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});

  async function load() {
    const { data, error: err } = await supabase
      .from('ical_sources')
      .select('id,name,url,enabled,last_sync_at,last_error')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: true });
    // Clear a previous load error as soon as a subsequent query succeeds.
    setError(err ? 'Could not load calendar sync status.' : '');
    setSources((data ?? []) as IcalSource[]);
    if (!err) {
      // Reuse this successful source refresh to update the small Overview status card.
      // No extra database requests, and no changes to the manual import or cron.
      const refreshed = (data ?? []) as IcalSource[];
      const status: SummaryStats['syncStatus'] = refreshed.length === 0 ? 'none' :
        refreshed.some(s => s.last_error) ? 'error' :
        refreshed.some(s => s.enabled && !s.last_sync_at) ? 'warning' : 'healthy';
      onStatusRefreshed(status);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSyncOne(sourceId: string) {
    setSyncing(sourceId);
    setSyncErrors(previous => ({ ...previous, [sourceId]: '' }));
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      });
      // The importer returns { synced: [{ name, dates, error? }] } even when
      // an individual feed fails (HTTP 200). HTTP failures return { error }.
      const result = await response.json().catch(() => null) as {
        error?: string;
        synced?: { name: string; dates: number; error?: string }[];
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || `Calendar sync request failed (HTTP ${response.status}).`);
      }
      if (!Array.isArray(result?.synced) || result.synced.length === 0) {
        throw new Error('Calendar sync did not return a result for this source.');
      }
      const sourceError = result.synced.find(item => item?.error)?.error;
      if (sourceError) throw new Error(sourceError);
    } catch (err) {
      const message = err instanceof TypeError
        ? 'Could not contact calendar sync. Check your connection and try again.'
        : err instanceof Error ? err.message : 'Calendar sync failed. Please try again.';
      setSyncErrors(previous => ({ ...previous, [sourceId]: message }));
    } finally {
      // Refresh existing database-backed status on success AND failure.
      try {
        await load();
      } catch {
        setSyncErrors(previous => ({
          ...previous,
          [sourceId]: previous[sourceId] || 'Could not refresh calendar sync status.',
        }));
      } finally {
        setSyncing(null);
      }
    }
  }

  const overallStatus = sources.length === 0 ? 'none' :
    sources.some(s => s.last_error) ? 'error' :
    sources.some(s => s.enabled && !s.last_sync_at) ? 'warning' : 'healthy';

  const overallBadge = {
    none: 'bg-gray-100 text-gray-500',
    healthy: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }[overallStatus];

  const overallLabel = {
    none: 'No sources',
    healthy: 'Healthy',
    warning: 'Needs Attention',
    error: 'Failed',
  }[overallStatus];

  return (
    <Widget
      title="Calendar Sync Health"
      loading={loading}
      error={error}
      compactNarrowTabletHeader
      action={
        <div className="flex items-center gap-2 min-[700px]:max-[833px]:gap-1 min-[700px]:max-[833px]:shrink-0">
          <span className={`text-xs px-2.5 py-1 min-[700px]:max-[833px]:px-1 min-[700px]:max-[833px]:py-0.5 min-[700px]:max-[833px]:text-[9px] rounded-full font-medium ${overallBadge}`}>{overallLabel}</span>
          <Link to="/admin/calendar-sync" className="text-xs min-[700px]:max-[833px]:text-[9px] text-gray-500 hover:text-gray-800 flex items-center gap-1 min-[700px]:max-[833px]:gap-0.5 transition-colors">
            Manage <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {sources.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No calendar sync sources connected yet.</p>
          <Link to="/admin/calendar-sync" className="text-xs text-gray-500 hover:text-gray-800 mt-2 inline-block underline">
            Set up Calendar Sync &#8594;
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(s => {
            const statusIcon = s.last_error
              ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              : s.last_sync_at
              ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;

            const maskedUrl = (() => {
              try {
                const u = new URL(s.url);
                return u.hostname + '/\u2026';
              } catch {
                return s.url.slice(0, 30) + '\u2026';
              }
            })();

            return (
              <div key={s.id} className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
                {statusIcon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{maskedUrl}</p>
                  {s.last_error && <p className="text-xs text-red-500 mt-0.5">{s.last_error}</p>}
                  {syncErrors[s.id] && syncErrors[s.id] !== s.last_error && (
                    <p className="text-xs text-red-600 mt-0.5" role="alert">Sync now: {syncErrors[s.id]}</p>
                  )}
                  {!s.last_error && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.last_sync_at ? `Synced ${fmtSyncTimestamp(s.last_sync_at, prefs)}` : 'Never synced'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSyncOne(s.id)}
                  disabled={syncing === s.id || !s.enabled}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors flex-shrink-0"
                  title="Sync now"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 ${syncing === s.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// --- Main Overview ---

export default function AdminOverview() {
  const [prefs, setPrefs] = useState<OverviewPreferences>(DEFAULT_PREFERENCES);
  const [currentSyncStatus, setCurrentSyncStatus] = useState<SummaryStats['syncStatus'] | null>(null);

  useEffect(() => {
    let active = true;
    supabase.from('account_settings')
      .select('timezone,date_format')
      .eq('property_id', PROPERTY_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active && !error) setPrefs(validPreferences(data));
        if (error) console.error('Overview: could not load Account Preferences', error);
      });
    return () => { active = false; };
  }, []);

  return (
    <OverviewPreferencesContext.Provider value={prefs}>
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-sm text-gray-500 mt-1">
          {fmtHeadingDate(propertyDay(new Date(), prefs.timeZone))}
        </p>
      </div>

      {/* Stats row */}
      <StatsRow currentSyncStatus={currentSyncStatus} />

      {/* Upcoming + Pending side by side */}
      <div className="grid grid-cols-1 min-[834px]:grid-cols-2 lg:grid-cols-2 gap-6">
        <UpcomingBookings />
        <PendingRequests />
      </div>

      {/* Calendar + Revenue side by side */}
      <div className="grid grid-cols-1 min-[700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] min-[834px]:grid-cols-2 lg:grid-cols-2 gap-6 min-[700px]:max-[833px]:gap-4">
        <MiniCalendar />
        <RevenueWidget />
      </div>

      {/* Inquiries + Sync health side by side */}
      <div className="grid grid-cols-1 min-[700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] min-[834px]:grid-cols-2 lg:grid-cols-2 gap-6 min-[700px]:max-[833px]:gap-4">
        <RecentInquiries />
        <SyncHealth onStatusRefreshed={setCurrentSyncStatus} />
      </div>

      {/* Owner operations widgets */}
      <div className="grid grid-cols-1 min-[834px]:grid-cols-2 lg:grid-cols-2 gap-6">
        <OwnerOpsWidgets />
      </div>
    </div>
    </OverviewPreferencesContext.Provider>
  );
}

// --- Owner ops widgets ---

function OwnerOpsWidgets() {
  const prefs = useOverviewPreferences();
  const [nextCleaning, setNextCleaning] = useState<{ task_date: string; assigned_to: string; guest_name: string | null } | null>(null);
  const [openMaint, setOpenMaint] = useState(0);
  const [activeBlocks, setActiveBlocks] = useState(0);
  const [upcomingCheckouts, setUpcomingCheckouts] = useState<{ guest_name: string; check_out: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const today = propertyDay(new Date(), prefs.timeZone);
    const in7 = calendarDayPlus(today, 7);
    Promise.all([
      supabase.from('cleaning_tasks').select('task_date,assigned_to,bookings(guest_name)')
        .eq('property_id', PROPERTY_ID)
        .in('status', ['needed', 'scheduled', 'in_progress'])
        .gte('task_date', today)
        .order('task_date').limit(1).maybeSingle(),
      supabase.from('maintenance_notes').select('id', { count: 'exact', head: true })
        .eq('property_id', PROPERTY_ID).in('status', ['open', 'in_progress']),
      supabase.from('owner_blocks').select('id', { count: 'exact', head: true })
        .eq('property_id', PROPERTY_ID).gte('end_date', today),
      supabase.from('bookings').select('guest_name,check_out')
        .eq('property_id', PROPERTY_ID).eq('status', 'confirmed')
        .gte('check_out', today).lte('check_out', in7).order('check_out').limit(5),
    ]).then(([cleaning, maint, blocks, checkouts]) => {
      if (!active) return;
      const c = cleaning.data as any;
      setNextCleaning(c ? { task_date: c.task_date, assigned_to: c.assigned_to, guest_name: c.bookings?.guest_name ?? null } : null);
      setOpenMaint(maint.count ?? 0);
      setActiveBlocks(blocks.count ?? 0);
      setUpcomingCheckouts((checkouts.data ?? []) as { guest_name: string; check_out: string }[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [prefs.timeZone]);

  const fmtShort = (d: string) => fmtCalendarDate(d, prefs.dateFormat);

  return (
    <div className="col-span-full">
      <div className="grid grid-cols-2 min-[700px]:grid-cols-4 min-[834px]:grid-cols-4 lg:grid-cols-4 gap-4 min-[700px]:max-[833px]:gap-2">
        {/* Next cleaning */}
        <Link to="/admin/cleaning" className="bg-white rounded-2xl border p-5 min-[700px]:max-[833px]:p-2.5 min-[834px]:p-4 min-[960px]:p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-xs min-[700px]:max-[833px]:text-[10px] font-medium text-gray-500 uppercase tracking-wide">Next Cleaning</p>
          </div>
          {loading ? <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" /> : nextCleaning ? (
            <>
              <p className="text-lg font-bold text-gray-900">{fmtShort(nextCleaning.task_date)}</p>
              {nextCleaning.assigned_to && <p className="text-xs text-gray-500 mt-0.5">{nextCleaning.assigned_to}</p>}
              {nextCleaning.guest_name && <p className="text-xs text-gray-400">after {nextCleaning.guest_name}</p>}
            </>
          ) : <p className="text-sm text-gray-400">No upcoming cleanings</p>}
        </Link>

        {/* Open maintenance */}
        <Link to="/admin/maintenance" className="bg-white rounded-2xl border p-5 min-[700px]:max-[833px]:p-2.5 min-[834px]:p-4 min-[960px]:p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs min-[700px]:max-[833px]:text-[10px] font-medium text-gray-500 uppercase tracking-wide">Maintenance</p>
          </div>
          {loading ? <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" /> : (
            <>
              <p className={`text-2xl font-bold ${openMaint > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{openMaint}</p>
              <p className="text-xs text-gray-400 mt-0.5">open task{openMaint !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        {/* Active owner blocks */}
        <Link to="/admin/calendar?tab=availability&section=owner-blocks" className="bg-white rounded-2xl border p-5 min-[700px]:max-[833px]:p-2.5 min-[834px]:p-4 min-[960px]:p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xs min-[700px]:max-[833px]:text-[10px] font-medium text-gray-500 uppercase tracking-wide">Owner Blocks</p>
          </div>
          {loading ? <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" /> : (
            <>
              <p className="text-2xl font-bold text-gray-900">{activeBlocks}</p>
              <p className="text-xs text-gray-400 mt-0.5">active block{activeBlocks !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        {/* Upcoming checkouts */}
        <Link to="/admin/bookings" className="bg-white rounded-2xl border p-5 min-[700px]:max-[833px]:p-2.5 min-[834px]:p-4 min-[960px]:p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs min-[700px]:max-[833px]:text-[10px] font-medium text-gray-500 uppercase tracking-wide">Checkouts (7d)</p>
          </div>
          {loading ? <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" /> : upcomingCheckouts.length > 0 ? (
            <div className="space-y-1">
              {upcomingCheckouts.slice(0, 3).map((b, i) => (
                <p key={i} className="text-xs text-gray-700">
                  <span className="font-medium">{fmtShort(b.check_out)}</span> &mdash; {b.guest_name}
                </p>
              ))}
              {upcomingCheckouts.length > 3 && <p className="text-xs text-gray-400">+{upcomingCheckouts.length - 3} more</p>}
            </div>
          ) : <p className="text-sm text-gray-400">No checkouts this week</p>}
        </Link>
      </div>
    </div>
  );
}