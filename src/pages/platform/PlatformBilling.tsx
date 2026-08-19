import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  CreditCard, RefreshCw, Search, CheckCircle2, Clock, AlertTriangle, XCircle, DollarSign,
  ShieldCheck, ShieldAlert, ShieldOff, Ban, ShieldX,
} from 'lucide-react';

interface BillingRow {
  id: string;
  client_id: string;
  status: string;
  plan_name: string | null;
  billing_cycle: string;
  price_amount: number | null;
  currency: string;
  trial_ends_at: string | null;
  next_invoice_date: string | null;
  payment_method: string;
  updated_at: string;
  platform_clients: {
    company_name: string;
    owner_email: string;
  } | null;
}

interface InstanceAccessSummary {
  client_id: string;
  worst_access: string;
}

const ACCESS_CONFIG: Record<string, { cls: string; icon: React.ReactNode }> = {
  active:     { cls: 'text-green-600',  icon: <ShieldCheck className="w-3 h-3" /> },
  warning:    { cls: 'text-yellow-600', icon: <ShieldAlert className="w-3 h-3" /> },
  restricted: { cls: 'text-orange-600', icon: <ShieldOff className="w-3 h-3" /> },
  suspended:  { cls: 'text-red-600',    icon: <Ban className="w-3 h-3" /> },
  cancelled:  { cls: 'text-gray-400',   icon: <ShieldX className="w-3 h-3" /> },
};

const ACCESS_SEVERITY: Record<string, number> = {
  active: 0, warning: 1, restricted: 2, suspended: 3, cancelled: 4,
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  trial:     { label: 'Trial',     cls: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700',   icon: <CheckCircle2 className="w-3 h-3" /> },
  past_due:  { label: 'Past Due',  cls: 'bg-red-100 text-red-700',       icon: <AlertTriangle className="w-3 h-3" /> },
  suspended: { label: 'Suspended', cls: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500',     icon: <XCircle className="w-3 h-3" /> },
  expired:   { label: 'Expired',   cls: 'bg-gray-100 text-gray-500',     icon: <XCircle className="w-3 h-3" /> },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime', manual: 'Manual',
};

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe', manual_invoice: 'Invoice', cash: 'Cash',
  zelle: 'Zelle', check: 'Check', other: 'Other',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtAmount(amount: number | null, currency: string) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function PlatformBilling() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [subRes, instRes] = await Promise.all([
      supabase
        .from('platform_client_subscriptions')
        .select('id,client_id,status,plan_name,billing_cycle,price_amount,currency,trial_ends_at,next_invoice_date,payment_method,updated_at,platform_clients(company_name,owner_email)')
        .order('updated_at', { ascending: false }),
      supabase
        .from('platform_instances')
        .select('client_id,access_status'),
    ]);
    setRows((subRes.data as unknown as BillingRow[]) ?? []);

    // Build worst-access map per client
    const map: Record<string, string> = {};
    for (const inst of (instRes.data ?? []) as { client_id: string; access_status: string }[]) {
      const cur = map[inst.client_id];
      const sev = ACCESS_SEVERITY[inst.access_status] ?? 0;
      if (!cur || sev > (ACCESS_SEVERITY[cur] ?? 0)) {
        map[inst.client_id] = inst.access_status;
      }
    }
    setAccessMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const co = r.platform_clients?.company_name?.toLowerCase() ?? '';
      const em = r.platform_clients?.owner_email?.toLowerCase() ?? '';
      const pl = r.plan_name?.toLowerCase() ?? '';
      if (!co.includes(q) && !em.includes(q) && !pl.includes(q)) return false;
    }
    return true;
  });

  const active = rows.filter(r => r.status === 'active');
  const mrrUSD = active
    .filter(r => r.billing_cycle === 'monthly' && r.price_amount && r.currency === 'USD')
    .reduce((s, r) => s + (r.price_amount ?? 0), 0);
  const arrUSD = active
    .filter(r => r.billing_cycle === 'yearly' && r.price_amount && r.currency === 'USD')
    .reduce((s, r) => s + (r.price_amount ?? 0) / 12, 0);
  const mrr = mrrUSD + arrUSD;
  const arr = mrr * 12;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Billing</h1>
            <p className="text-sm text-gray-500">{filtered.length} subscription{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active',   value: active.length,              cls: 'bg-green-50' },
          { label: 'Trial',    value: rows.filter(r => r.status === 'trial').length,    cls: 'bg-yellow-50' },
          { label: 'Past Due', value: rows.filter(r => r.status === 'past_due').length, cls: 'bg-red-50' },
          { label: 'Est. MRR (USD)', value: mrr > 0 ? `$${mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—', cls: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-gray-200 p-4 flex flex-col gap-1 ${s.cls}`}>
            <p className="text-xs font-semibold text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search client, plan…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 w-48"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No subscriptions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Plan</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Cycle</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Amount</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Trial Ends</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Next Invoice</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Method</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Access</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => {
                const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.trial;
                const worstAccess = accessMap[r.client_id] ?? 'active';
                const ac = ACCESS_CONFIG[worstAccess] ?? ACCESS_CONFIG.active;
                const isPastDue = r.status === 'past_due';
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${isPastDue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900">{r.platform_clients?.company_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.platform_clients?.owner_email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.plan_name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{CYCLE_LABELS[r.billing_cycle] ?? r.billing_cycle}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-800">{fmtAmount(r.price_amount, r.currency)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(r.trial_ends_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(r.next_invoice_date)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${ac.cls}`}>
                        {ac.icon} {worstAccess}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/platform/clients/${r.client_id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                        View Client
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {arr > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-right">
              Est. ARR (USD active subs): <span className="font-semibold text-gray-800">${arr.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
