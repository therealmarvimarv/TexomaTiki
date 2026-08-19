import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LifeBuoy, Plus, Search, RefreshCw, AlertTriangle, Clock,
  CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal';

interface Ticket {
  id: string;
  client_id: string;
  instance_id: string | null;
  title: string;
  status: string;
  priority: string;
  category: string;
  due_date: string | null;
  updated_at: string;
  platform_clients: { company_name: string } | null;
  platform_instances: { instance_name: string } | null;
}

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  open:               { cls: 'bg-blue-100 text-blue-700',    label: 'Open' },
  in_progress:        { cls: 'bg-yellow-100 text-yellow-700',label: 'In Progress' },
  waiting_on_client:  { cls: 'bg-orange-100 text-orange-700',label: 'Waiting: Client' },
  waiting_on_me:      { cls: 'bg-purple-100 text-purple-700',label: 'Waiting: Me' },
  resolved:           { cls: 'bg-green-100 text-green-700',  label: 'Resolved' },
  closed:             { cls: 'bg-gray-100 text-gray-500',    label: 'Closed' },
};

const PRIORITY_CFG: Record<string, { cls: string; icon: React.ReactNode }> = {
  low:    { cls: 'text-gray-400',  icon: null },
  normal: { cls: 'text-blue-500',  icon: null },
  high:   { cls: 'text-orange-600',icon: <AlertTriangle className="w-3 h-3" /> },
  urgent: { cls: 'text-red-600',   icon: <AlertTriangle className="w-3 h-3 fill-current" /> },
};

const FILTER_OPTIONS = [
  { value: 'all',              label: 'All' },
  { value: 'open',             label: 'Open' },
  { value: 'in_progress',      label: 'In Progress' },
  { value: 'waiting_on_client',label: 'Waiting: Client' },
  { value: 'urgent',           label: 'Urgent' },
  { value: 'resolved',         label: 'Resolved' },
  { value: 'closed',           label: 'Closed' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PlatformSupport() {
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get('client_id') ?? undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_support_tickets')
      .select('id,client_id,instance_id,title,status,priority,category,due_date,updated_at,platform_clients(company_name),platform_instances(instance_name)')
      .order('updated_at', { ascending: false });
    setTickets((data as unknown as Ticket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = tickets.filter(t => {
    if (filter !== 'all') {
      if (filter === 'urgent') { if (t.priority !== 'urgent') return false; }
      else if (t.status !== filter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) &&
          !(t.platform_clients?.company_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && !['resolved','closed'].includes(t.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Support</h1>
            <p className="text-sm text-gray-500">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',     value: openCount,   cls: 'bg-blue-50',   icon: <Clock className="w-4 h-4 text-blue-600" /> },
          { label: 'Urgent',   value: urgentCount, cls: 'bg-red-50',    icon: <AlertTriangle className="w-4 h-4 text-red-600" /> },
          { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, cls: 'bg-green-50', icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
          { label: 'Closed',   value: tickets.filter(t => t.status === 'closed').length,   cls: 'bg-gray-50',  icon: <XCircle className="w-4 h-4 text-gray-400" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-gray-200 p-3 flex items-center gap-3 ${s.cls}`}>
            {s.icon}
            <div><p className="text-xs text-gray-500">{s.label}</p><p className="text-lg font-bold text-gray-900">{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 w-44" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setFilter(o.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === o.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No tickets found</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 w-4"></th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Title</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Due</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => {
                const sc = STATUS_CFG[t.status] ?? STATUS_CFG.open;
                const pc = PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.normal;
                const overdue = t.due_date && new Date(t.due_date) < new Date() && !['resolved','closed'].includes(t.status);
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`flex items-center justify-center w-4 h-4 ${pc.cls}`}>{pc.icon}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900 line-clamp-1">{t.title}</p>
                      {t.platform_instances && <p className="text-xs text-gray-400">{t.platform_instances.instance_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{t.platform_clients?.company_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{t.category.replace(/_/g, ' ')}</td>
                    <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{fmtDate(t.due_date)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(t.updated_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/platform/support/${t.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTicketModal
          prefillClientId={prefillClientId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
