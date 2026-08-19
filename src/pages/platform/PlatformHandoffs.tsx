import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Handshake, ExternalLink, RefreshCw, Search,
  CheckCircle2, Clock, AlertTriangle, Send, Users,
} from 'lucide-react';

interface Handoff {
  id: string;
  instance_id: string;
  status: string;
  client_admin_name: string | null;
  client_admin_email: string | null;
  admin_invite_status: string;
  admin_url: string | null;
  frontend_url: string | null;
  updated_at: string;
  platform_instances: {
    instance_name: string;
    environment: string;
  } | null;
  platform_clients: {
    business_name: string | null;
    owner_name: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  not_started:      { label: 'Not Started',      cls: 'bg-gray-100 text-gray-600',    icon: <Clock className="w-3 h-3" /> },
  preparing:        { label: 'Preparing',         cls: 'bg-blue-100 text-blue-700',    icon: <RefreshCw className="w-3 h-3" /> },
  ready_for_client: { label: 'Ready',             cls: 'bg-teal-100 text-teal-700',    icon: <CheckCircle2 className="w-3 h-3" /> },
  sent:             { label: 'Sent',              cls: 'bg-violet-100 text-violet-700', icon: <Send className="w-3 h-3" /> },
  accepted:         { label: 'Accepted',          cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" /> },
  needs_support:    { label: 'Needs Support',     cls: 'bg-amber-100 text-amber-700',  icon: <AlertTriangle className="w-3 h-3" /> },
  completed:        { label: 'Completed',         cls: 'bg-green-200 text-green-800',  icon: <CheckCircle2 className="w-3 h-3" /> },
};

const INVITE_CONFIG: Record<string, { label: string; cls: string }> = {
  not_sent: { label: 'Not Sent', cls: 'text-gray-400' },
  sent:     { label: 'Sent',     cls: 'text-blue-600' },
  accepted: { label: 'Accepted', cls: 'text-green-600' },
  expired:  { label: 'Expired',  cls: 'text-amber-600' },
  failed:   { label: 'Failed',   cls: 'text-red-600' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_client', label: 'Ready' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'needs_support', label: 'Needs Support' },
  { value: 'completed', label: 'Completed' },
];

export default function PlatformHandoffs() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_client_handoffs')
      .select(`
        id, instance_id, status, client_admin_name, client_admin_email,
        admin_invite_status, admin_url, frontend_url, updated_at,
        platform_instances(instance_name, environment),
        platform_clients(business_name, owner_name)
      `)
      .order('updated_at', { ascending: false });
    setHandoffs((data as unknown as Handoff[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = handoffs.filter(h => {
    if (filter !== 'all' && h.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (h.platform_clients ? (h.platform_clients.business_name || h.platform_clients.owner_name) : '').toLowerCase();
      const inst = h.platform_instances?.instance_name?.toLowerCase() ?? '';
      const email = h.client_admin_email?.toLowerCase() ?? '';
      if (!name.includes(q) && !inst.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const statusCfg = (s: string) => STATUS_CONFIG[s] ?? STATUS_CONFIG.not_started;
  const inviteCfg = (s: string) => INVITE_CONFIG[s] ?? INVITE_CONFIG.not_sent;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Client Handoffs</h1>
            <p className="text-sm text-gray-500">{filtered.length} handoff{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search client, instance, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 w-56"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                filter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
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
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No handoffs found</p>
          {filter === 'all' && (
            <p className="text-xs mt-2 text-gray-300 max-w-xs mx-auto">Handoffs are created automatically when a Launch Package is generated for an instance.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Client / Instance</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Admin Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Invite</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">URLs</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(h => {
                const sc = statusCfg(h.status);
                const ic = inviteCfg(h.admin_invite_status);
                return (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900">{h.platform_clients ? (h.platform_clients.business_name || h.platform_clients.owner_name) : '—'}</p>
                      <p className="text-xs text-gray-400">{h.platform_instances?.instance_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{h.client_admin_email ?? <span className="text-gray-300">—</span>}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${ic.cls}`}>{ic.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {h.frontend_url && (
                          <a href={h.frontend_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            Site <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {h.admin_url && (
                          <a href={h.admin_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-600 hover:underline flex items-center gap-0.5">
                            Admin <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {!h.frontend_url && !h.admin_url && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(h.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/platform/provisioning/${h.instance_id}/pack`}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        View Pack
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
