import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Download } from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface BookingRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  amount_subtotal: number | null;
  amount_fees: number | null;
  amount_tax: number | null;
  amount_total: number | null;
  total_price: number;
  amount_paid: number | null;
  refunded_amount: number | null;
  payment_method: string | null;
  status: string;
  payment_status: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  archived_at: string | null;
}

const STATUS_FILTERS = [
  'all', 'pending_review', 'pending_payment', 'confirmed', 'declined', 'expired', 'cancelled', 'payment_failed', 'payment_conflict', 'refunded',
] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

type ViewFilter = 'active' | 'archived' | 'all';

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending_review: 'Pending Review',
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  payment_failed: 'Payment Failed',
  payment_conflict: 'Payment Conflict',
  refunded: 'Refunded',
};

const BOOKING_STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending_review: 'bg-blue-100 text-blue-700',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
  declined: 'bg-orange-100 text-orange-700',
  payment_failed: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
  payment_conflict: 'bg-rose-100 text-rose-800',
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  unpaid: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
};

function nights(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default function BookingsManager() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active');

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id,guest_name,guest_email,guest_phone,check_in,check_out,guests,amount_subtotal,amount_fees,amount_tax,amount_total,total_price,amount_paid,refunded_amount,payment_method,status,payment_status,confirmed_at,cancelled_at,created_at,archived_at')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setBookings((data ?? []) as BookingRow[]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Apply view filter first, then status filter
  const viewFiltered = viewFilter === 'active'
    ? bookings.filter(b => b.archived_at == null)
    : viewFilter === 'archived'
      ? bookings.filter(b => b.archived_at != null)
      : bookings;

  const filtered = statusFilter === 'all'
    ? viewFiltered
    : viewFiltered.filter(b => b.status === statusFilter);

  function exportCSV() {
    const rows = filtered;
    const fmtMoney = (cents: number | null | undefined, dollars?: number) => {
      if (cents != null) return (cents / 100).toFixed(2);
      if (dollars != null) return Number(dollars).toFixed(2);
      return '';
    };
    const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US') : '';
    const headers = [
      'Booking ID','Guest Name','Guest Email','Guest Phone',
      'Check-in','Check-out','Nights','Guests',
      'Status','Payment Status','Payment Method',
      'Subtotal','Fees','Taxes','Total','Amount Paid','Refunded',
      'Created','Confirmed','Cancelled','Archived',
    ];
    const csvRows = rows.map(b => {
      const n = nights(b.check_in, b.check_out);
      const total = b.amount_total ?? Math.round(Number(b.total_price) * 100);
      return [
        b.id,
        b.guest_name,
        b.guest_email,
        b.guest_phone ?? '',
        fmtDate(b.check_in),
        fmtDate(b.check_out),
        n,
        b.guests,
        b.status,
        b.payment_status ?? '',
        b.payment_method ?? '',
        fmtMoney(b.amount_subtotal),
        fmtMoney(b.amount_fees),
        fmtMoney(b.amount_tax),
        fmtMoney(total),
        fmtMoney(b.amount_paid ?? 0),
        fmtMoney(b.refunded_amount ?? 0),
        fmtDate(b.created_at),
        fmtDate(b.confirmed_at),
        fmtDate(b.cancelled_at),
        fmtDate(b.archived_at),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${viewFilter}-${statusFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const VIEW_FILTERS: { id: ViewFilter; label: string }[] = [
    { id: 'active',   label: 'Active'   },
    { id: 'archived', label: 'Archived' },
    { id: 'all',      label: 'All'      },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Bookings</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* View filter */}
      <div className="flex gap-1 mb-4">
        {VIEW_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setViewFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              viewFilter === id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {label}
            {id === 'archived' && (
              <span className="ml-1.5 text-xs opacity-60">
                {bookings.filter(b => b.archived_at != null).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {FILTER_LABELS[s]}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {viewFiltered.filter((b) => b.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Guest</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Check-in</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Check-out</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Nights</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Total</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Paid</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Method</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Payment</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Created</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b) => {
                const totalDisplay = b.amount_total != null
                  ? `$${(b.amount_total / 100).toFixed(2)}`
                  : `$${Number(b.total_price).toFixed(2)}`;
                const paidDisplay = b.amount_paid != null && b.amount_paid > 0
                  ? `$${(b.amount_paid / 100).toFixed(2)}`
                  : null;
                const n = nights(b.check_in, b.check_out);

                return (
                  <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${b.archived_at ? 'opacity-70' : ''}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{b.guest_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.guest_email}</p>
                      {b.archived_at && (
                        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {new Date(b.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {new Date(b.check_out).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-gray-700">{n}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{totalDisplay}</td>
                    <td className="px-5 py-4 text-gray-700">
                      {paidDisplay ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs capitalize">
                      {b.payment_method ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${BOOKING_STATUS_STYLES[b.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {b.payment_status ? (
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_STYLES[b.payment_status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {b.payment_status}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        to={`/admin/bookings/${b.id}`}
                        className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            {viewFilter === 'archived'
              ? 'No archived bookings.'
              : statusFilter === 'all'
                ? 'No bookings yet'
                : `No ${FILTER_LABELS[statusFilter].toLowerCase()} bookings`}
          </div>
        )}
      </div>
    </div>
  );
}
