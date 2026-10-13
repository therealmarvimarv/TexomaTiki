import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Calendar, Clock, DollarSign, MessageSquare, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  AlertTriangle, Users, TrendingUp, Loader2, ExternalLink,
  Sparkles, Wrench, Shield, LogOut,
} from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
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

// ── Shared stat card ──────────────────────────────────────────────────────────

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
    <div className="bg-white rounded-2xl border p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-gray-100'}`}>
        <Icon className="w-5 h-5 text-gray-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Widget shell ──────────────────────────────────────────────────────────────

function Widget({
  title,
  loading,
  error,
  children,
  action,
}: {
  title: string;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-semibold text-gray-900">{title}</h3>
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

// ── 1. Stats summary ──────────────────────────────────────────────────────────

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
    stats?.syncStatus === 'warning' ? 'Needs attention' : 'No sources';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Calendar}
        label="Upcoming Bookings"
        value={loading ? '—' : (stats?.upcomingCount ?? 0)}
        sub="Next confirmed stays"
        accent="bg-blue-50"
        loading={loading}
      />
      <StatCard
        icon={Clock}
        label="Pending Requests"
        value={loading ? '—' : (stats?.pendingCount ?? 0)}
        sub="Awaiting host review"
        accent="bg-yellow-50"
        loading={loading}
      />
      <StatCard
        icon={TrendingUp}
        label="Est. Revenue"
        value={loading ? '—' : fmtMoney(stats?.estimatedRevenueCents ?? 0)}
        sub="Upcoming confirmed + paid"
        accent="bg-green-50"
        loading={loading}
      />
      <StatCard
        icon={RefreshCw}
        label="Calendar Sync"
        value={loading ? '—' : syncLabel}
        sub={stats?.syncStatus === 'none' ? 'No iCal sources' : 'iCal import status'}
        accent={
          stats?.syncStatus === 'healthy' ? 'bg-green-50' :
          stats?.syncStatus === 'error' ? 'bg-red-50' :
          stats?.syncStatus === 'warning' ? 'bg-yellow-50' : 'bg-gray-100'
        }
        loading={loading}
      />
    </div>
  );
}

// ── 2. Upcoming bookings ──────────────────────────────────────────────────────

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
                    {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                    <span className="mx-1.5 text-gray-300">·</span>
                    {nights}n · {b.guests} guest{b.guests !== 1 ? 's' : ''}
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

// ── 3. Pending requests ───────────────────────────────────────────────────────

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
                    {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
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

// ── 4. Revenue estimate ───────────────────────────────────────────────────────

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

  const RANGES: { key: RevenueRange; label: string }[] = [
    { key: 'month', label: 'This Month' },
    { key: 'next30', label: 'Next 30d' },
    { key: 'next90', label: 'Next 90d' },
    { key: 'ytd', label: 'Year to Date' },
  ];

  return (
    <Widget
      title="Revenue Estimate"
      loading={loading}
      error={error}
      action={
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${range === r.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {r.label}
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

// ── 5. Mini calendar ──────────────────────────────────────────────────────────

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
    >
      <div className="space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{monthName}</span>
          <button
            onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
          {/* Empty cells before first day */}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvts = eventsForDate(dateStr);
            const isToday = dateStr === today;
            const isSelected = selected?.date === dateStr;
            return (
              <button
                key={day}
                onClick={() => handleDayClick(dateStr)}
                className={`relative flex flex-col items-center py-1.5 rounded-lg text-xs transition-colors
                  ${isSelected ? 'bg-gray-900 text-white' : isToday ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}
                  ${dayEvts.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span>{day}</span>
                {dayEvts.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvts.slice(0, 3).map((e, idx) => (
                      <span key={idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : eventDot(e.type)}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          {[
            { color: 'bg-green-500', label: 'Confirmed' },
            { color: 'bg-amber-400', label: 'Pending' },
            { color: 'bg-slate-500', label: 'Owner Block' },
            { color: 'bg-gray-400', label: 'Blocked' },
            { color: 'bg-blue-400', label: 'Imported' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Selected day detail */}
        {selected && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{fmtDate(selected.date)}</p>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-700">✕</button>
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

// ── 6. Recent inquiries ───────────────────────────────────────────────────────

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
                  <span className="text-xs text-gray-400 mx-1.5">·</span>
                  <span className="text-xs text-gray-500">{fmtDate(inq.created_at)}</span>
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
          View all inquiries →
        </Link>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-2xl border shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Inquiry Details</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
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
                <dd className="text-gray-900">{fmtDate(detail.created_at)}</dd>
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

// ── 7. Sync health ────────────────────────────────────────────────────────────

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
      action={
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${overallBadge}`}>{overallLabel}</span>
          <Link to="/admin/calendar-sync" className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors">
            Manage <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {sources.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No calendar sync sources connected yet.</p>
          <Link to="/admin/calendar-sync" className="text-xs text-gray-500 hover:text-gray-800 mt-2 inline-block underline">
            Set up Calendar Sync →
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
                return u.hostname + '/…';
              } catch {
                return s.url.slice(0, 30) + '…';
              }
            })();

            return (
              <div key={s.id} className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
                {statusIcon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{maskedUrl}</p>
                  {s.last_error && <p className="text-xs text-red-500 mt-0.5">{s.last_error}</p>}
                  {!s.last_error && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.last_sync_at ? `Synced ${new Date(s.last_sync_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Never synced'}
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

// ── Main Overview ─────────────────────────────────────────────────────────────

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <StatsRow />

      {/* Upcoming + Pending side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingBookings />
        <PendingRequests />
      </div>

      {/* Calendar + Revenue side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniCalendar />
        <RevenueWidget />
      </div>

      {/* Inquiries + Sync health side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentInquiries />
        <SyncHealth />
      </div>

      {/* Owner operations widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OwnerOpsWidgets />
      </div>
    </div>
  );
}

// ── Owner ops widgets ─────────────────────────────────────────────────────────

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

  return (
    <div className="col-span-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Next cleaning */}
        <Link to="/admin/cleaning" className="bg-white rounded-2xl border p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Cleaning</p>
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
        <Link to="/admin/maintenance" className="bg-white rounded-2xl border p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Maintenance</p>
          </div>
          {loading ? <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" /> : (
            <>
              <p className={`text-2xl font-bold ${openMaint > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{openMaint}</p>
              <p className="text-xs text-gray-400 mt-0.5">open task{openMaint !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        {/* Active owner blocks */}
        <Link to="/admin/calendar?tab=availability&section=owner-blocks" className="bg-white rounded-2xl border p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner Blocks</p>
          </div>
          {loading ? <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" /> : (
            <>
              <p className="text-2xl font-bold text-gray-900">{activeBlocks}</p>
              <p className="text-xs text-gray-400 mt-0.5">active block{activeBlocks !== 1 ? 's' : ''}</p>
            </>
          )}
        </Link>

        {/* Upcoming checkouts */}
        <Link to="/admin/bookings" className="bg-white rounded-2xl border p-5 hover:border-gray-300 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Checkouts (7d)</p>
          </div>
          {loading ? <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" /> : upcomingCheckouts.length > 0 ? (
            <div className="space-y-1">
              {upcomingCheckouts.slice(0, 3).map((b, i) => (
                <p key={i} className="text-xs text-gray-700">
                  <span className="font-medium">{fmtShort(b.check_out)}</span> — {b.guest_name}
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
