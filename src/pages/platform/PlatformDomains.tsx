import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Globe, Search, RefreshCw, Plus, CheckCircle2, XCircle, AlertTriangle, Minus, Star, Loader2, ExternalLink, Rocket, Layers } from 'lucide-react';
import { DomainModal, Domain } from './DomainModal';

interface DomainRow extends Domain {
  platform_clients: { company_name: string } | null;
  platform_instances: { instance_name: string; netlify_site_id: string | null } | null;
}

const STATUS_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  not_started:          { cls: 'bg-gray-100 text-gray-500',    icon: <Minus className="w-3 h-3" />,         label: 'Not started' },
  pending_dns:          { cls: 'bg-yellow-100 text-yellow-700',icon: <AlertTriangle className="w-3 h-3" />, label: 'Pending DNS' },
  dns_configured:       { cls: 'bg-blue-100 text-blue-700',    icon: <CheckCircle2 className="w-3 h-3" />,  label: 'DNS configured' },
  connected_to_netlify: { cls: 'bg-teal-100 text-teal-700',    icon: <CheckCircle2 className="w-3 h-3" />,  label: 'Connected' },
  ssl_pending:          { cls: 'bg-yellow-100 text-yellow-700',icon: <AlertTriangle className="w-3 h-3" />, label: 'SSL pending' },
  ssl_active:           { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" />,  label: 'SSL active' },
  live:                 { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" />,  label: 'Live' },
  failed:               { cls: 'bg-red-100 text-red-700',      icon: <XCircle className="w-3 h-3" />,       label: 'Failed' },
};

const FILTER_OPTIONS = [
  { value: 'all',                 label: 'All' },
  { value: 'pending_dns',         label: 'Pending DNS' },
  { value: 'connected_to_netlify',label: 'Connected' },
  { value: 'ssl_pending',         label: 'SSL Pending' },
  { value: 'live',                label: 'Live' },
  { value: 'failed',              label: 'Failed' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlatformDomains() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_instance_domains')
      .select('*,platform_clients(company_name),platform_instances(instance_name,netlify_site_id)')
      .order('updated_at', { ascending: false });
    setDomains((data ?? []) as unknown as DomainRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = domains.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.domain.toLowerCase().includes(q) &&
          !(d.platform_clients?.company_name ?? '').toLowerCase().includes(q) &&
          !(d.platform_instances?.instance_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const metrics = {
    total:   domains.length,
    live:    domains.filter(d => d.status === 'live').length,
    pending: domains.filter(d => ['pending_dns','ssl_pending','not_started'].includes(d.status)).length,
    failed:  domains.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Domains</h1>
            <p className="text-sm text-gray-500">{filtered.length} domain{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: metrics.total,   cls: 'bg-gray-50' },
          { label: 'Live',    value: metrics.live,    cls: 'bg-green-50' },
          { label: 'Pending', value: metrics.pending, cls: 'bg-yellow-50' },
          { label: 'Failed',  value: metrics.failed,  cls: 'bg-red-50' },
        ].map(m => (
          <div key={m.label} className={`${m.cls} rounded-xl border border-gray-200 p-3`}>
            <p className="text-xs text-gray-500">{m.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search domain, client, instance…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 w-52" />
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
        <div className="text-center py-16 text-gray-400">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No domains found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Domain</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">SSL</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">DNS Provider</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Checked</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const sc = STATUS_CFG[d.status] ?? STATUS_CFG.not_started;
                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {d.is_primary && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" title="Primary" />}
                        <span className="text-xs font-mono font-semibold text-gray-900">{d.domain}</span>
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{d.domain_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-800">{d.platform_clients?.company_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{d.platform_instances?.instance_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.ssl_status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.dns_provider ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.last_checked_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditDomain(d); setShowModal(true); }}
                          className="text-xs text-blue-600 hover:underline">Edit</button>
                        {d.instance_id && (
                          <>
                            <Link to={`/platform/clients/${d.client_id}`} title="Client"
                              className="p-1 text-gray-400 hover:text-gray-700"><ExternalLink className="w-3 h-3" /></Link>
                            <Link to={`/platform/provisioning/${d.instance_id}/pack`} title="Deploy Pack"
                              className="p-1 text-gray-400 hover:text-gray-700"><Layers className="w-3 h-3" /></Link>
                            <Link to={`/platform/instances/${d.instance_id}/launch-package`} title="Launch"
                              className="p-1 text-purple-400 hover:text-purple-700"><Rocket className="w-3 h-3" /></Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && editDomain && (
        <DomainModal
          clientId={editDomain.client_id}
          instanceId={editDomain.instance_id}
          netliftySiteDomain={domains.find(d => d.id === editDomain.id)?.platform_instances?.netlify_site_id ?? null}
          domain={editDomain}
          onClose={() => { setShowModal(false); setEditDomain(null); }}
          onSaved={() => { setShowModal(false); setEditDomain(null); load(); }}
        />
      )}
    </div>
  );
}
