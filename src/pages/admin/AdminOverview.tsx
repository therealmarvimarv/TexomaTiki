import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Calendar, Clock, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  AlertTriangle, TrendingUp, Loader2,
  Sparkles, Wrench, Shield, LogOut, ArrowRight, X,
} from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Helpers
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// Shared stat card
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  iconColor,
  loading,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
  iconColor?: string;
  loading?: boolean;
  to?: string;
}) {
  const card = (
    <div className="group h-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${accent ?? 'bg-gray-100'}`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor ?? 'text-gray-700'}`} strokeWidth={1.8} />
        </div>
        {to && (
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
        )}
      </div>

      <div className="mt-4 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
        ) : (
          <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-gray-950">{value}</p>
        )}
        <p className="mt-2 text-xs leading-4 text-gray-400">{sub}</p>
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 rounded-2xl">
      {card}
    </Link>
  ) : card;
}

// Widget shell
function Widget({
  title,
  subtitle,
  loading,
  error,
  children,
  action,
  bodyClassName = 'p-5',
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-gray-100 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-gray-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-4 text-gray-400">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className={bodyClassName}>
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <div className="flex max-w-sm items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// 1. Stats summary
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

function StatsRow() {
  const { stats, loading } = useSummaryStats();
  const syncLabel =
    stats?.syncStatus === 'healthy' ? 'All synced' :
    stats?.syncStatus === 'error' ? 'Sync error' :
    stats?.syncStatus === 'warning' ? 'Attention' : 'No sources';

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatCard
        icon={Calendar}
        label="Upcoming Bookings"
        value={loading ? '-' : (stats?.upcomingCount ?? 0)}
        sub="Next confirmed stays"
        accent="bg-blue-50"
        iconColor="text-blue-600"
        loading={loading}
        to="/admin/bookings"
      />
      <StatCard
        icon={Clock}
        label="Pending Requests"
        value={loading ? '-' : (stats?.pendingCount ?? 0)}
        sub="Awaiting host review"
        accent="bg-amber-50"
        iconColor="text-amber-600"
        loading={loading}
        to="/admin/bookings"
      />
      <StatCard
        icon={TrendingUp}
        label="Est. Revenue"
        value={loading ? '-' : fmtMoney(stats?.estimatedRevenueCents ?? 0)}
        sub="Upcoming confirmed + paid"
        accent="bg-emerald-50"
        iconColor="text-emerald-600"
        loading={loading}
        to="/admin/bookings"
      />
      <StatCard
        icon={RefreshCw}
        label="Calendar Sync"
        value={loading ? '-' : syncLabel}
        sub={stats?.syncStatus === 'none' ? 'No iCal sources' : 'iCal import status'}
        accent={
          stats?.syncStatus === 'healthy' ? 'bg-emerald-50' :
          stats?.syncStatus === 'error' ? 'bg-red-50' :
          stats?.syncStatus === 'warning' ? 'bg-amber-50' : 'bg-gray-100'
        }
        iconColor={
          stats?.syncStatus === 'healthy' ? 'text-emerald-600' :
          stats?.syncStatus === 'error' ? 'text-red-600' :
          stats?.syncStatus === 'warning' ? 'text-amber-600' : 'text-gray-600'
        }
        loading={loading}
        to="/admin/calendar?tab=sync"
      />
    </div>
  );
}

// 2. Upcoming bookings
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
  payment_expires_at?: string | null;
}

function UpcomingBookings() {
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
      subtitle="Your next confirmed guest stays"
      loading={loading}
      error={error}
      action={
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {bookings.length === 0 ? (
        <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
            <Calendar className="h-[18px] w-[18px] text-blue-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">No upcoming bookings</p>
          <p className="mt-1 text-xs text-gray-400">Confirmed stays will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {bookings.map(b => {
            const nights = nightsBetween(b.check_in, b.check_out);
            const total = b.amount_total != null ? fmtMoney(b.amount_total) : `$${Number(b.total_price).toFixed(2)}`;
            return (
              <Link
                key={b.id}
                to={`/admin/bookings/${b.id}`}
                className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Calendar className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{b.guest_name}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {fmtDate(b.check_in)} - {fmtDate(b.check_out)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {nights} night{nights !== 1 ? 's' : ''} | {b.guests} guest{b.guests !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 pl-2">
                  <span className="text-sm font-semibold text-gray-900">{total}</span>
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// 3. Pending requests
function PendingRequests() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('bookings')
      .select('id,guest_name,check_in,check_out,guests,amount_total,total_price,status,payment_status,payment_expires_at' as string)
      .eq('property_id', PROPERTY_ID)
      .in('status', ['pending_review', 'pending_payment'])
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
      subtitle="Bookings waiting for review or payment"
      loading={loading}
      error={error}
      action={
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {bookings.length === 0 ? (
        <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <CheckCircle2 className="h-[18px] w-[18px] text-amber-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">You're all caught up</p>
          <p className="mt-1 text-xs text-gray-400">No booking requests need attention.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {bookings.map(b => {
            const total = b.amount_total != null ? fmtMoney(b.amount_total) : `$${Number(b.total_price).toFixed(2)}`;
            const expires = b.payment_expires_at;
            const isPayment = b.status === 'pending_payment';
            return (
              <Link
                key={b.id}
                to={`/admin/bookings/${b.id}`}
                className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50"
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isPayment ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  <Clock className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{b.guest_name}</p>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPayment ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {isPayment ? 'Payment' : 'Review'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {fmtDate(b.check_in)} - {fmtDate(b.check_out)}
                  </p>
                  {expires && (
                    <p className={`mt-0.5 text-[11px] ${timeUntil(expires) === 'Expired' ? 'text-red-500' : 'text-amber-600'}`}>
                      {timeUntil(expires)}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 pl-2">
                  <span className="text-sm font-semibold text-gray-900">{total}</span>
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// 4. Revenue estimate
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

    const totalCents = (rows ?? []).reduce((sum, row) => sum + (row.amount_total ?? Math.round(Number(row.total_price) * 100)), 0);
    setData({ totalCents, count: (rows ?? []).length });
    setLoading(false);
  }, []);

  useEffect(() => { fetchRevenue(range); }, [range, fetchRevenue]);

  const avg = data && data.count > 0 ? data.totalCents / data.count : 0;

  const RANGES: { key: RevenueRange; label: string }[] = [
    { key: 'month', label: 'This Month' },
    { key: 'next30', label: 'Next 30d' },
    { key: 'next90', label: 'Next 90d' },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <Widget
      title="Revenue Estimate"
      subtitle="Confirmed and paid bookings"
      loading={loading}
      error={error}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
          {RANGES.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-all ${
                range === item.key
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-700">Revenue in selected period</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">{fmtMoney(data?.totalCents ?? 0)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              <TrendingUp className="h-5 w-5" strokeWidth={1.8} />
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-gray-500">Confirmed but unpaid bookings are excluded.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-xs font-medium text-gray-500">Bookings</p>
            <p className="mt-1 text-xl font-bold text-gray-950">{data?.count ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-xs font-medium text-gray-500">Avg booking value</p>
            <p className="mt-1 text-xl font-bold text-gray-950">{fmtMoney(avg)}</p>
          </div>
        </div>
      </div>
    </Widget>
  );
}

// 5. Mini calendar
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
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DayDetail | null>(null);

  useEffect(() => {
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
      if (bRes.error || bdRes.error) { setError('Could not load calendar.'); setLoading(false); return; }
      const evts: CalEvent[] = [];

      for (const b of (bRes.data ?? [])) {
        const ci = new Date(b.check_in);
        const co = new Date(b.check_out);
        const cur = new Date(ci);
        while (cur < co) {
          const dateStr = cur.toISOString().split('T')[0];
          if (dateStr >= firstDay && dateStr <= lastDay) {
            evts.push({
              date: dateStr,
              type: b.status === 'confirmed' ? 'confirmed' : 'pending',
              label: b.guest_name,
              bookingId: b.id,
            });
          }
          cur.setDate(cur.getDate() + 1);
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
        const cur = new Date(ob.start_date + 'T00:00:00');
        const end = new Date(ob.end_date + 'T00:00:00');
        while (cur < end) {
          const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
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
          cur.setDate(cur.getDate() + 1);
        }
      }

      setEvents(evts);
      setLoading(false);
    });
  }, [year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date().toISOString().split('T')[0];

  function eventsForDate(dateStr: string): CalEvent[] {
    return events.filter(e => e.date === dateStr);
  }

  function eventDot(type: CalEvent['type']) {
    switch (type) {
      case 'confirmed': return 'bg-emerald-500';
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
      subtitle="Bookings, blocks, and imported availability"
      loading={loading}
      error={error}
      action={
        <Link
          to="/admin/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          Open calendar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-2 py-1.5">
          <button
            type="button"
            onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{monthName}</span>
          <button
            type="button"
            onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
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
                type="button"
                key={day}
                onClick={() => handleDayClick(dateStr)}
                className={`relative flex min-h-[42px] flex-col items-center justify-center rounded-xl text-xs transition-all ${
                  isSelected
                    ? 'bg-gray-950 font-semibold text-white shadow-sm'
                    : isToday
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : dayEvts.length > 0
                    ? 'text-gray-800 hover:bg-gray-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{day}</span>
                {dayEvts.length > 0 && (
                  <div className="mt-1 flex gap-0.5">
                    {dayEvts.slice(0, 3).map((e, idx) => (
                      <span key={idx} className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : eventDot(e.type)}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-gray-100 pt-3">
          {[
            { color: 'bg-emerald-500', label: 'Confirmed' },
            { color: 'bg-amber-400', label: 'Pending' },
            { color: 'bg-slate-500', label: 'Owner Block' },
            { color: 'bg-gray-400', label: 'Blocked' },
            { color: 'bg-blue-400', label: 'Imported' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}
        </div>

        {selected && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{fmtDate(selected.date)}</p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
                aria-label="Close day details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {selected.events.map((e, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${eventDot(e.type)}`} />
                    <span className="truncate text-gray-700">
                      {e.label ?? (e.type === 'ical' ? 'Imported calendar block' : e.type === 'owner_block' ? 'Owner Block' : 'Blocked by host')}
                    </span>
                  </div>
                  {e.bookingId && (
                    <Link
                      to={`/admin/bookings/${e.bookingId}`}
                      className="flex-shrink-0 text-xs font-medium text-gray-500 hover:text-gray-900"
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

// 6. Recent inquiries
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

  const btnClass = 'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900';

  return (
    <Widget
      title="Recent Inquiries"
      subtitle="Latest guest messages saved by the platform"
      loading={loading}
      error={error}
      action={
        <Link
          to="/admin/email?tab=inquiries"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {inquiries.length === 0 ? (
        <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <CheckCircle2 className="h-[18px] w-[18px] text-gray-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">No recent inquiries</p>
          <p className="mt-1 text-xs text-gray-400">New guest messages will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inquiries.map(inq => (
            <div key={inq.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{inq.sender_name}</p>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${INQUIRY_STATUS_STYLES[inq.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inq.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{inq.sender_email}</p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-gray-400">{fmtDate(inq.created_at)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-600">{inq.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {inq.status === 'new' && (
                  <button type="button" onClick={() => markRead(inq.id)} className={btnClass}>
                    Mark read
                  </button>
                )}
                <button type="button" onClick={() => setDetail(inq)} className={btnClass}>
                  Details
                </button>
                <button type="button" onClick={() => copyEmail(inq.sender_email, inq.id)} className={btnClass}>
                  {copied === inq.id ? 'Copied!' : 'Copy email'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-gray-950/50" onClick={() => setDetail(null)}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h3 className="font-semibold text-gray-950">Inquiry Details</h3>
                  <p className="mt-0.5 text-xs text-gray-400">Received {fmtDate(detail.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close inquiry details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-5 text-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Name</p>
                    <p className="mt-1 text-gray-900">{detail.sender_name}</p>
                  </div>
                  {detail.sender_phone && (
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Phone</p>
                      <p className="mt-1 text-gray-900">{detail.sender_phone}</p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Email</p>
                  <p className="mt-1 break-all text-gray-900">{detail.sender_email}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Message</p>
                  <p className="mt-2 whitespace-pre-wrap leading-6 text-gray-700">{detail.message}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => copyEmail(detail.sender_email, detail.id)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {copied === detail.id ? 'Copied!' : 'Copy email'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}

// 7. Sync health
interface IcalSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
}

function SyncHealth() {
  const [sources, setSources] = useState<IcalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase
      .from('ical_sources')
      .select('id,name,url,enabled,last_sync_at,last_error')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: true });
    if (err) setError('Could not load calendar sync status.');
    setSources((data ?? []) as IcalSource[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSyncOne(sourceId: string) {
    setSyncing(sourceId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      });
      await load();
    } finally {
      setSyncing(null);
    }
  }

  const overallStatus = sources.length === 0 ? 'none' :
    sources.some(s => s.last_error) ? 'error' :
    sources.some(s => s.enabled && !s.last_sync_at) ? 'warning' : 'healthy';

  const overallBadge = {
    none: 'bg-gray-100 text-gray-600',
    healthy: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
  }[overallStatus];

  const overallLabel = {
    none: 'No sources',
    healthy: 'Healthy',
    warning: 'Needs attention',
    error: 'Failed',
  }[overallStatus];

  return (
    <Widget
      title="Calendar Sync Health"
      subtitle="Status of connected external calendars"
      loading={loading}
      error={error}
      action={
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${overallBadge}`}>{overallLabel}</span>
          <Link
            to="/admin/calendar?tab=sync"
            className="hidden items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 sm:inline-flex"
          >
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    >
      {sources.length === 0 ? (
        <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <RefreshCw className="h-[18px] w-[18px] text-gray-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">No calendar sources connected</p>
          <Link
            to="/admin/calendar?tab=sync"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            Set up Calendar Sync <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(source => {
            const statusIcon = source.last_error
              ? <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
              : source.last_sync_at
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />;

            const maskedUrl = (() => {
              try {
                const u = new URL(source.url);
                return `${u.hostname}/...`;
              } catch {
                return `${source.url.slice(0, 30)}...`;
              }
            })();

            return (
              <div key={source.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  {statusIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{source.name}</p>
                    {!source.enabled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Disabled</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400">{maskedUrl}</p>
                  {source.last_error ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-red-500">{source.last_error}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-400">
                      {source.last_sync_at
                        ? `Synced ${new Date(source.last_sync_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                        : 'Never synced'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSyncOne(source.id)}
                  disabled={syncing === source.id || !source.enabled}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Sync now"
                  aria-label={`Sync ${source.name}`}
                >
                  <RefreshCw className={`h-4 w-4 ${syncing === source.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// Main Overview
export default function AdminOverview() {
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Admin Dashboard</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">Overview</h2>
          <p className="mt-1 text-sm text-gray-500">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/calendar"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            Bookings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <StatsRow />

      <OwnerOpsWidgets />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <UpcomingBookings />
        <PendingRequests />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <MiniCalendar />
        <RevenueWidget />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <RecentInquiries />
        <SyncHealth />
      </div>
    </div>
  );
}

// Owner ops widgets
function OwnerOpsWidgets() {
  const [nextCleaning, setNextCleaning] = useState<{ task_date: string; assigned_to: string; guest_name: string | null } | null>(null);
  const [openMaint, setOpenMaint] = useState(0);
  const [activeBlocks, setActiveBlocks] = useState(0);
  const [upcomingCheckouts, setUpcomingCheckouts] = useState<{ guest_name: string; check_out: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
      const c = cleaning.data as any;
      setNextCleaning(c ? { task_date: c.task_date, assigned_to: c.assigned_to, guest_name: c.bookings?.guest_name ?? null } : null);
      setOpenMaint(maint.count ?? 0);
      setActiveBlocks(blocks.count ?? 0);
      setUpcomingCheckouts((checkouts.data ?? []) as { guest_name: string; check_out: string }[]);
      setLoading(false);
    });
  }, []);

  const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const cardClass = 'group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md';

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Property Operations</h3>
          <p className="mt-0.5 text-xs text-gray-400">A quick look at the work around your next stays</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Link to="/admin/cleaning" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Sparkles className="h-[18px] w-[18px]" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Next Cleaning</p>
          {loading ? (
            <div className="mt-2 h-6 w-24 animate-pulse rounded bg-gray-100" />
          ) : nextCleaning ? (
            <>
              <p className="mt-1 text-lg font-bold text-gray-950">{fmtShort(nextCleaning.task_date)}</p>
              <p className="mt-1 truncate text-xs text-gray-500">
                {nextCleaning.assigned_to || 'Unassigned'}
                {nextCleaning.guest_name ? ` | after ${nextCleaning.guest_name}` : ''}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-gray-500">No upcoming cleanings</p>
          )}
        </Link>

        <Link to="/admin/maintenance" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wrench className="h-[18px] w-[18px]" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Maintenance</p>
          {loading ? (
            <div className="mt-2 h-6 w-12 animate-pulse rounded bg-gray-100" />
          ) : (
            <>
              <p className={`mt-1 text-2xl font-bold ${openMaint > 0 ? 'text-amber-700' : 'text-gray-950'}`}>{openMaint}</p>
              <p className="mt-1 text-xs text-gray-400">open task{openMaint !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        <Link to="/admin/calendar?tab=availability&section=owner-blocks" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <Shield className="h-[18px] w-[18px]" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Owner Blocks</p>
          {loading ? (
            <div className="mt-2 h-6 w-12 animate-pulse rounded bg-gray-100" />
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold text-gray-950">{activeBlocks}</p>
              <p className="mt-1 text-xs text-gray-400">active block{activeBlocks !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        <Link to="/admin/bookings" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <LogOut className="h-[18px] w-[18px]" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Checkouts | 7 Days</p>
          {loading ? (
            <div className="mt-2 h-6 w-20 animate-pulse rounded bg-gray-100" />
          ) : upcomingCheckouts.length > 0 ? (
            <div className="mt-2 space-y-1">
              {upcomingCheckouts.slice(0, 2).map((booking, index) => (
                <p key={index} className="truncate text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">{fmtShort(booking.check_out)}</span> | {booking.guest_name}
                </p>
              ))}
              {upcomingCheckouts.length > 2 && (
                <p className="text-[11px] text-gray-400">+{upcomingCheckouts.length - 2} more</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-gray-500">No checkouts this week</p>
          )}
        </Link>
      </div>
    </section>
  );
}
