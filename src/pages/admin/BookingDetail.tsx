import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, AlertTriangle, X, CreditCard, Loader2, Plus, Trash2 } from 'lucide-react';

interface BookingRow {
  id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guests: number;
  pets: number;
  special_requests: string | null;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_price: number;
  amount_subtotal: number | null;
  amount_fees: number | null;
  amount_tax: number | null;
  amount_total: number | null;
  amount_paid: number;
  deposit_required: number;
  security_deposit: number;
  refunded_amount: number;
  currency: string;
  payment_notes: string | null;
  payment_due_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  payment_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  declined_at: string | null;
  refunded_at: string | null;
  paid_at: string | null;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending_review: 'bg-blue-100 text-blue-700',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  declined: 'bg-orange-100 text-orange-700',
  payment_failed: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
  payment_conflict: 'bg-rose-100 text-rose-800',
};

const PAYMENT_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  unpaid: 'bg-gray-100 text-gray-500',
  partially_paid: 'bg-amber-100 text-amber-700',
  expired: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
  partially_refunded: 'bg-blue-50 text-blue-600',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  manual: 'Manual',
  cash: 'Cash',
  check: 'Check',
  zelle: 'Zelle',
  venmo: 'Venmo',
  paypal: 'PayPal',
  other: 'Other',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtMoney(cents: number | null | undefined, fallbackDollars?: number): string {
  if (cents != null) return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (fallbackDollars != null) return `$${Number(fallbackDollars).toFixed(2)}`;
  return '—';
}

function amountDue(b: BookingRow): number {
  return b.amount_total ?? Math.round(Number(b.total_price) * 100);
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-yellow-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manual payment modal ──────────────────────────────────────────────────────

const MANUAL_METHODS = ['cash', 'zelle', 'venmo', 'paypal', 'other'] as const;

interface ManualPaymentModalProps {
  amountDueCents: number;
  currentPaidCents: number;
  onConfirm: (method: string, amountCents: number, note: string) => void;
  onCancel: () => void;
  saving: boolean;
}

function ManualPaymentModal({ amountDueCents, currentPaidCents, onConfirm, onCancel, saving }: ManualPaymentModalProps) {
  const remaining = Math.max(0, amountDueCents - currentPaidCents);
  const [method, setMethod] = useState('cash');
  const [amountStr, setAmountStr] = useState((remaining / 100).toFixed(2));
  const [note, setNote] = useState('');

  const amountCents = Math.round(parseFloat(amountStr || '0') * 100);
  const valid = amountCents > 0 && !isNaN(amountCents);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Record Manual Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">This does not process a charge — record only.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Payment method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {MANUAL_METHODS.map(m => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Amount received ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">
              Balance remaining: {fmtMoney(remaining)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Cash received at check-in"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(method, amountCents, note)}
            disabled={!valid || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border p-5">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">{children}</dl>;
}

function Field({ label, value, mono, span }: { label: string; value: React.ReactNode; mono?: boolean; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium mt-0.5 ${mono ? 'font-mono text-xs text-gray-700 break-all' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface InternalNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

type ModalAction = 'approve' | 'confirm' | 'cancel' | 'decline' | 'refund' | null;

export default function BookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Payment notes edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Internal notes
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');

  async function load() {
    if (!bookingId) return;
    const [bookingRes, notesRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle(),
      supabase.from('booking_internal_notes').select('*').eq('booking_id', bookingId).order('created_at'),
    ]);
    if (bookingRes.error) setError('Failed to load booking.');
    const row = bookingRes.data as BookingRow | null;
    setBooking(row);
    if (row) setNotesValue(row.payment_notes ?? '');
    setInternalNotes((notesRes.data ?? []) as InternalNote[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [bookingId]);

  async function addInternalNote() {
    if (!newNote.trim() || !bookingId) return;
    setAddingNote(true);
    const { data, error: err } = await supabase
      .from('booking_internal_notes')
      .insert({ booking_id: bookingId, note: newNote.trim() })
      .select().maybeSingle();
    if (!err && data) {
      setInternalNotes(prev => [...prev, data as InternalNote]);
      setNewNote('');
    }
    setAddingNote(false);
  }

  async function saveEditNote() {
    if (!editNoteId || !editNoteValue.trim()) return;
    const now = new Date().toISOString();
    await supabase.from('booking_internal_notes')
      .update({ note: editNoteValue.trim(), updated_at: now })
      .eq('id', editNoteId);
    setInternalNotes(prev => prev.map(n => n.id === editNoteId ? { ...n, note: editNoteValue.trim(), updated_at: now } : n));
    setEditNoteId(null);
    setEditNoteValue('');
  }

  async function deleteInternalNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await supabase.from('booking_internal_notes').delete().eq('id', id);
    setInternalNotes(prev => prev.filter(n => n.id !== id));
  }

  const nights = booking
    ? Math.round((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const status = booking?.status ?? '';

  const MODAL_CONFIG: Record<NonNullable<ModalAction>, { title: string; message: string; confirmLabel: string; danger: boolean }> = {
    approve: {
      title: 'Approve Booking Request',
      message: 'If Stripe payments are configured, a payment link will be sent to the guest to complete their booking. Otherwise, the dates will be reserved and you can collect payment manually.',
      confirmLabel: 'Approve & Send Payment Link',
      danger: false,
    },
    confirm: {
      title: 'Confirm Booking',
      message: 'This will confirm the booking, block the dates on the calendar, and create a cleaning task.',
      confirmLabel: 'Confirm Booking',
      danger: false,
    },
    cancel: {
      title: 'Cancel Booking',
      message: 'This will cancel the booking, release the blocked dates, and mark the cleaning task as skipped.',
      confirmLabel: 'Cancel Booking',
      danger: true,
    },
    decline: {
      title: 'Decline Booking',
      message: 'This will decline the pending booking request. The dates will remain available.',
      confirmLabel: 'Decline Booking',
      danger: true,
    },
    refund: {
      title: 'Mark as Refunded',
      message: 'This marks the booking as refunded in the system. Ensure you have already issued the refund separately.',
      confirmLabel: 'Mark Refunded',
      danger: false,
    },
  };

  async function performAction(action: ModalAction) {
    if (!booking || !action) return;
    setActionLoading(true);
    setError('');
    setModalAction(null);

    if (action === 'refund') {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from('bookings').update({
        status: 'refunded',
        payment_status: 'refunded',
        refunded_at: now,
        refunded_amount: booking.amount_paid ?? 0,
      }).eq('id', booking.id);
      if (updateError) { setError('Action failed. Please try again.'); setActionLoading(false); return; }
      await load();
      setActionLoading(false);
      return;
    }

    // approve / confirm / cancel / decline → admin-booking-action edge function
    const edgeAction = action as 'approve' | 'confirm' | 'cancel' | 'decline';
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-booking-action`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: booking.id, action: edgeAction }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Action failed. Please try again.');
      setActionLoading(false);
      return;
    }

    await load();
    setActionLoading(false);
  }

  async function saveNotes() {
    if (!booking) return;
    setNotesSaving(true);
    await supabase.from('bookings').update({ payment_notes: notesValue }).eq('id', booking.id);
    setNotesSaving(false);
    setEditingNotes(false);
    setBooking(b => b ? { ...b, payment_notes: notesValue } : b);
  }

  async function handleManualPayment(method: string, amountCents: number, note: string) {
    if (!booking) return;
    setManualSaving(true);

    const due = amountDue(booking);
    const newPaid = (booking.amount_paid ?? 0) + amountCents;
    let newPaymentStatus: string;
    if (newPaid <= 0) newPaymentStatus = 'unpaid';
    else if (newPaid >= due) newPaymentStatus = 'paid';
    else newPaymentStatus = 'partially_paid';

    const combinedNote = [booking.payment_notes, note ? `[Manual ${PAYMENT_METHOD_LABELS[method] ?? method}] ${note}` : '']
      .filter(Boolean).join('\n');

    const updates: Record<string, unknown> = {
      payment_method: method,
      amount_paid: newPaid,
      payment_status: newPaymentStatus,
      payment_notes: combinedNote || null,
    };
    if (newPaymentStatus === 'paid' && !booking.paid_at) {
      updates.paid_at = new Date().toISOString();
    }

    const { error: err } = await supabase.from('bookings').update(updates).eq('id', booking.id);
    if (err) setError('Failed to record payment.');
    setManualSaving(false);
    setShowManualPayment(false);
    await load();
  }

  async function handleArchive() {
    if (!booking) return;
    setArchiving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;
    const { error: err } = await supabase.from('bookings').update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: 'manual',
    }).eq('id', booking.id);
    if (err) setError('Failed to archive booking.');
    else await load();
    setArchiving(false);
  }

  async function handleRestore() {
    if (!booking) return;
    setArchiving(true);
    const { error: err } = await supabase.from('bookings').update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    }).eq('id', booking.id);
    if (err) setError('Failed to restore booking.');
    else await load();
    setArchiving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Booking not found.</p>
        <Link to="/admin/bookings" className="text-sm font-medium underline">Back to bookings</Link>
      </div>
    );
  }

  const canConfirm = status === 'pending_review' || status === 'pending_payment' || status === 'pending';
  const canCancel = status === 'confirmed' || status === 'pending_review' || status === 'pending_payment';
  const canDecline = status === 'pending_review' || status === 'pending_payment';
  const canRefund = status === 'confirmed' || status === 'cancelled';
  const canRecordManual = status !== 'refunded' && status !== 'declined' && status !== 'expired';
  const due = amountDue(booking);

  return (
    <div className="max-w-3xl">
      {/* Modals */}
      {modalAction && (
        <ConfirmModal
          {...MODAL_CONFIG[modalAction]}
          onConfirm={() => performAction(modalAction)}
          onCancel={() => setModalAction(null)}
        />
      )}
      {showManualPayment && (
        <ManualPaymentModal
          amountDueCents={due}
          currentPaidCents={booking.amount_paid ?? 0}
          onConfirm={handleManualPayment}
          onCancel={() => setShowManualPayment(false)}
          saving={manualSaving}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/bookings" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Bookings
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{booking.guest_name}</h2>
          <p className="text-sm text-gray-500 mt-1">{booking.guest_email}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700'}`}>
            {status.replace(/_/g, ' ')}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PAYMENT_BADGE[booking.payment_status] ?? 'bg-gray-100 text-gray-700'}`}>
            {booking.payment_status.replace(/_/g, ' ')}
          </span>
          {booking.archived_at && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              Archived
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <X className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {status === 'payment_conflict' && (
        <div className="mb-5 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3.5">
          <p className="text-rose-800 text-sm font-semibold">Payment received but booking could not be auto-confirmed.</p>
          <p className="text-rose-700 text-sm mt-1">
            This booking requires manual review. Possible causes include an amount mismatch, date conflict at the time of payment, or a blocked-date insert error. Verify the payment in Stripe, resolve any date conflicts, then confirm or refund manually.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Guest Info */}
        <Section title="Guest Info">
          <FieldGrid>
            <Field label="Name" value={booking.guest_name} />
            <Field label="Email" value={<a href={`mailto:${booking.guest_email}`} className="hover:underline">{booking.guest_email}</a>} />
            <Field label="Phone" value={booking.guest_phone} />
            <Field label="Guests" value={booking.guests} />
            <Field label="Pets" value={booking.pets ?? 0} />
            {booking.special_requests && (
              <Field label="Special Requests" value={booking.special_requests} span />
            )}
          </FieldGrid>
        </Section>

        {/* Stay Info */}
        <Section title="Stay Info">
          <FieldGrid>
            <Field label="Check-in" value={fmtDate(booking.check_in)} />
            <Field label="Check-out" value={fmtDate(booking.check_out)} />
            <Field label="Nights" value={nights} />
            <Field label="Created" value={fmtDateTime(booking.created_at)} />
            <Field label="Confirmed" value={fmtDateTime(booking.confirmed_at)} />
            <Field label="Cancelled" value={fmtDateTime(booking.cancelled_at)} />
            <Field label="Declined" value={fmtDateTime(booking.declined_at)} />
            <Field label="Refunded" value={fmtDateTime(booking.refunded_at)} />
          </FieldGrid>
        </Section>

        {/* Payment Details */}
        <Section title="Payment Details">
          <FieldGrid>
            <Field
              label="Payment Status"
              value={
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${PAYMENT_BADGE[booking.payment_status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {booking.payment_status.replace(/_/g, ' ')}
                </span>
              }
            />
            <Field
              label="Payment Method"
              value={booking.payment_method ? PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method : '—'}
            />
            <Field label="Nightly Subtotal" value={fmtMoney(booking.amount_subtotal)} />
            <Field label="Fees" value={fmtMoney(booking.amount_fees)} />
            <Field label="Taxes" value={fmtMoney(booking.amount_tax)} />
            <Field label="Total (Amount Due)" value={<span className="font-bold">{fmtMoney(due)}</span>} />
            <Field label="Amount Paid" value={<span className="font-bold text-green-700">{fmtMoney(booking.amount_paid ?? 0)}</span>} />
            <Field
              label="Balance Remaining"
              value={
                <span className={due - (booking.amount_paid ?? 0) > 0 ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold'}>
                  {fmtMoney(Math.max(0, due - (booking.amount_paid ?? 0)))}
                </span>
              }
            />
            <Field label="Deposit Required" value={fmtMoney(booking.deposit_required ?? 0)} />
            <Field label="Security Deposit" value={fmtMoney(booking.security_deposit ?? 0)} />
            <Field label="Refunded Amount" value={fmtMoney(booking.refunded_amount ?? 0)} />
            <Field label="Currency" value={(booking.currency ?? 'usd').toUpperCase()} />
            <Field label="Paid At" value={fmtDateTime(booking.paid_at)} />
            <Field label="Refunded At" value={fmtDateTime(booking.refunded_at)} />
            <Field label="Payment Due At" value={fmtDateTime(booking.payment_due_at)} />
          </FieldGrid>
        </Section>

        {/* Stripe Info — only shown when at least one Stripe field is populated */}
        {(booking.stripe_checkout_session_id || booking.stripe_payment_intent_id || booking.stripe_customer_id) && (
        <Section title="Stripe">
          <dl className="space-y-3 text-sm">
            {([
              ['Checkout Session ID', booking.stripe_checkout_session_id],
              ['Payment Intent ID', booking.stripe_payment_intent_id],
              ['Customer ID', booking.stripe_customer_id],
              ['Session Expires', fmtDateTime(booking.payment_expires_at)],
            ] as [string, string | null][]).map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-gray-500 flex-shrink-0">{label}</dt>
                <dd className="font-mono text-xs text-gray-700 text-right break-all">{val ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Section>
        )}

        {/* Payment Notes */}
        <Section title="Payment Notes">
          {editingNotes ? (
            <div className="space-y-3">
              <textarea
                rows={4}
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                placeholder="Internal notes about this booking's payment…"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {notesSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Notes
                </button>
                <button
                  onClick={() => { setEditingNotes(false); setNotesValue(booking.payment_notes ?? ''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {booking.payment_notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{booking.payment_notes}</p>
              ) : (
                <p className="text-sm text-gray-400 mb-3">No payment notes.</p>
              )}
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {booking.payment_notes ? 'Edit Notes' : 'Add Notes'}
              </button>
            </div>
          )}
        </Section>

        {/* Internal Notes — admin only, never guest-visible */}
        <Section title="Internal Notes">
          <div className="space-y-3">
            {internalNotes.length === 0 && (
              <p className="text-sm text-gray-400">No internal notes yet.</p>
            )}
            {internalNotes.map(n => (
              <div key={n.id} className="bg-gray-50 rounded-lg px-4 py-3">
                {editNoteId === n.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                      value={editNoteValue}
                      onChange={e => setEditNoteValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEditNote} className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-700">Save</button>
                      <button onClick={() => { setEditNoteId(null); setEditNoteValue(''); }} className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.note}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {n.updated_at !== n.created_at && ' (edited)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => { setEditNoteId(n.id); setEditNoteValue(n.note); }} className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100">Edit</button>
                      <button onClick={() => deleteInternalNote(n.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="space-y-2 pt-1">
              <textarea
                rows={2}
                placeholder="Add an internal note…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={addInternalNote}
                disabled={addingNote || !newNote.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {addingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add note
              </button>
            </div>
          </div>
        </Section>

        {/* Admin Controls */}
        {(canConfirm || canCancel || canDecline || canRefund || canRecordManual) && (
          <Section title="Admin Actions">
            <div className="flex gap-3 flex-wrap">
              {status === 'pending_review' && (
                <button
                  onClick={() => setModalAction('approve')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Approve & Send Payment Link
                </button>
              )}
              {(status === 'pending_payment' || status === 'pending') && (
                <button
                  onClick={() => setModalAction('confirm')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Confirm Booking
                </button>
              )}
              {canDecline && (
                <button
                  onClick={() => setModalAction('decline')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                >
                  Decline Booking
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setModalAction('cancel')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              )}
              {canRefund && (
                <button
                  onClick={() => setModalAction('refund')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  Mark Refunded
                </button>
              )}
              {canRecordManual && (
                <button
                  onClick={() => setShowManualPayment(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Record Manual Payment
                </button>
              )}
            </div>
            {status === 'pending_payment' && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Payment link sent — awaiting guest payment.
                  {booking.payment_expires_at && (
                    <> Link expires {new Date(booking.payment_expires_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</>
                  )}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Confirming a booking blocks the dates on the calendar and creates a cleaning task. Cancelling releases the dates.
            </p>
          </Section>
        )}

        {/* Archive / Restore */}
        <Section title="Archive">
          {booking.archived_at ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                This booking was archived on{' '}
                <span className="font-medium text-gray-700">{fmtDateTime(booking.archived_at)}</span>
                {booking.archive_reason === 'auto_30_days_after_checkout' && ' (auto-archived 30 days after checkout)'}.
                It is hidden from the Active bookings list.
              </p>
              <button
                onClick={handleRestore}
                disabled={archiving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {archiving ? 'Restoring…' : 'Restore Booking'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Archive this booking to hide it from the active booking list. The record is kept and can be restored at any time.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Archive this booking? It will be hidden from the active booking list but kept in records.')) {
                    handleArchive();
                  }
                }}
                disabled={archiving}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {archiving ? 'Archiving…' : 'Archive Booking'}
              </button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
