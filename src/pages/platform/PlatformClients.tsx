import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { DeleteClientModal } from './DeleteClientModal';
import {
  Plus, Pencil, ChevronRight, Loader2, X, Save, AlertCircle, Search, UserPlus, Trash2, CheckCircle,
} from 'lucide-react';

export interface PlatformClient {
  id: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  business_name: string | null;
  status: string;
  plan_name: string | null;
  billing_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  signup_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  lead:      'bg-gray-100 text-gray-700',
  trial:     'bg-yellow-100 text-yellow-800',
  active:    'bg-green-100 text-green-800',
  past_due:  'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_OPTIONS = ['lead', 'trial', 'active', 'past_due', 'suspended', 'cancelled'];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = {
  owner_name: '', owner_email: '', owner_phone: '', business_name: '',
  status: 'lead', plan_name: '', billing_status: '', notes: '', signup_date: '',
  stripe_customer_id: '', stripe_subscription_id: '',
};

type FormState = typeof EMPTY_FORM;

interface ClientModalProps {
  client: PlatformClient | null;
  onClose: () => void;
  onSaved: (c: PlatformClient) => void;
}

function ClientModal({ client, onClose, onSaved }: ClientModalProps) {
  const [form, setForm] = useState<FormState>(() => client ? {
    owner_name: client.owner_name,
    owner_email: client.owner_email,
    owner_phone: client.owner_phone ?? '',
    business_name: client.business_name ?? '',
    status: client.status,
    plan_name: client.plan_name ?? '',
    billing_status: client.billing_status ?? '',
    notes: client.notes ?? '',
    signup_date: client.signup_date ?? '',
    stripe_customer_id: client.stripe_customer_id ?? '',
    stripe_subscription_id: client.stripe_subscription_id ?? '',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.owner_name.trim() || !form.owner_email.trim()) {
      setError('Owner name and email are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      owner_name: form.owner_name.trim(),
      owner_email: form.owner_email.trim(),
      owner_phone: form.owner_phone.trim() || null,
      business_name: form.business_name.trim() || null,
      status: form.status,
      plan_name: form.plan_name.trim() || null,
      billing_status: form.billing_status.trim() || null,
      notes: form.notes.trim() || null,
      signup_date: form.signup_date || null,
      stripe_customer_id: form.stripe_customer_id.trim() || null,
      stripe_subscription_id: form.stripe_subscription_id.trim() || null,
    };
    if (client) {
      const { data, error: e } = await supabase
        .from('platform_clients').update(payload).eq('id', client.id).select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      onSaved(data as PlatformClient);
    } else {
      const { data, error: e } = await supabase
        .from('platform_clients').insert(payload).select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      onSaved(data as PlatformClient);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">{client ? 'Edit Client' : 'Add Client'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Owner Name *</label>
              <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className={inputCls} placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Owner Email *</label>
              <input type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} className={inputCls} placeholder="jane@example.com" />
            </div>
            <div>
              <label className={labelCls}>Owner Phone</label>
              <input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} className={inputCls} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={labelCls}>Business Name</label>
              <input value={form.business_name} onChange={e => set('business_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Plan Name</label>
              <input value={form.plan_name} onChange={e => set('plan_name', e.target.value)} className={inputCls} placeholder="Starter, Pro, etc." />
            </div>
            <div>
              <label className={labelCls}>Billing Status</label>
              <input value={form.billing_status} onChange={e => set('billing_status', e.target.value)} className={inputCls} placeholder="active, paused, etc." />
            </div>
            <div>
              <label className={labelCls}>Signup Date</label>
              <input type="date" value={form.signup_date} onChange={e => set('signup_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stripe Customer ID</label>
              <input value={form.stripe_customer_id} onChange={e => set('stripe_customer_id', e.target.value)} className={inputCls} placeholder="cus_..." />
            </div>
            <div>
              <label className={labelCls}>Stripe Subscription ID</label>
              <input value={form.stripe_subscription_id} onChange={e => set('stripe_subscription_id', e.target.value)} className={inputCls} placeholder="sub_..." />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} rows={3} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {client ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformClients() {
  const location = useLocation();
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; client: PlatformClient | null }>({ open: false, client: null });
  const [deleteTarget, setDeleteTarget] = useState<PlatformClient | null>(null);
  const [deletedBanner, setDeletedBanner] = useState(() => !!(location.state as { deleted?: boolean } | null)?.deleted);

  useEffect(() => {
    supabase
      .from('platform_clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients((data as PlatformClient[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = clients.filter(c =>
    !search ||
    c.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_email.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = (saved: PlatformClient) => {
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setModal({ open: false, client: null });
  };

  return (
    <div className="space-y-6">
      {deletedBanner && (
        <div className="flex items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            Client permanently deleted from Platform Dashboard.
          </div>
          <button onClick={() => setDeletedBanner(false)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} total client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/platform/onboarding/new"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> New Client Onboarding
          </Link>
          <button
            onClick={() => setModal({ open: true, client: null })}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Quick Add
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or business..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-sm text-gray-400">
          {search ? 'No clients match your search.' : 'No clients yet. Add your first client.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Signup</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{client.owner_name}</div>
                      <div className="text-xs text-gray-500">{client.owner_email}</div>
                      {client.business_name && <div className="text-xs text-gray-400">{client.business_name}</div>}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={client.status} /></td>
                    <td className="px-4 py-3.5 text-gray-600 hidden sm:table-cell">{client.plan_name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">{fmtDate(client.signup_date)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal({ open: true, client })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(client)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete client"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/platform/clients/${client.id}`}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          title="View detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal.open && (
        <ClientModal
          client={modal.client}
          onClose={() => setModal({ open: false, client: null })}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteClientModal
          clientId={deleteTarget.id}
          clientName={deleteTarget.owner_name}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeletedBanner(true);
          }}
        />
      )}
    </div>
  );
}
