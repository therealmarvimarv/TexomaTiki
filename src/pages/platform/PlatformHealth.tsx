import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Minus, Search, Rocket, ExternalLink,
} from 'lucide-react';

interface HealthRow {
  id: string;
  client_id: string;
  instance_name: string;
  property_name: string | null;
  health_status: string;
  launch_readiness_status: string;
  last_health_check_at: string | null;
  access_status: string;
  last_billing_status: string | null;
  launched_at: string | null;
  netlify_site_id: string | null;
  frontend_url: string | null;
  client_display_name: string | null;
  client_email: string | null;
}

const HEALTH_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  unknown:  { cls: 'bg-gray-100 text-gray-500',    icon: <Minus className="w-3 h-3" />,           label: 'Unknown' },
  healthy:  { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" />,    label: 'Healthy' },
  warning:  { cls: 'bg-yellow-100 text-yellow-700',icon: <AlertTriangle className="w-3 h-3" />,   label: 'Warning' },
  failing:  { cls: 'bg-red-100 text-red-700',      icon: <XCircle className="w-3 h-3" />,         label: 'Failing' },
};

const READINESS_CFG: Record<string, { cls: string; label: string }> = {
  not_ready:       { cls: 'text-red-600',    label: 'Not Ready' },
  needs_review:    { cls: 'text-yellow-600', label: 'Needs Review' },
  ready_to_launch: { cls: 'text-green-600',  label: 'Ready' },
  launched:        { cls: 'text-blue-600',   label: 'Launched' },
};

const ACCESS_CFG: Record<string, string> = {
  active:     'text-green-600',
  warning:    'text-yellow-600',
  restricted: 'text-orange-600',
  suspended:  'text-red-600',
  cancelled:  'text-gray-400',
};

const FILTER_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'healthy',         label: 'Healthy' },
  { value: 'warning',         label: 'Warning' },
  { value: 'failing',         label: 'Failing' },
  { value: 'not_ready',       label: 'Not Ready' },
  { value: 'needs_review',    label: 'Needs Review' },
  { value: 'ready_to_launch', label: 'Ready to Launch' },
  { value: 'launched',        label: 'Launched' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PlatformHealth() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [checkCounts, setCheckCounts] = useState<Record<string, { critical: number; warn: number }>>({});
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);

    // Three independent queries — no embedded joins
    const [instRes, clientsRes, checksRes] = await Promise.all([
      supabase
        .from('platform_instances')
        .select('id,client_id,instance_name,property_name,health_status,launch_readiness_status,last_health_check_at,access_status,last_billing_status,launched_at,netlify_site_id,frontend_url'),
      supabase
        .from('platform_clients')
        .select('id,business_name,owner_name,owner_email'),
      supabase
        .from('platform_instance_health_checks')
        .select('instance_id,status,severity'),
    ]);

    const instData = instRes.data ?? [];
    const clientData = clientsRes.data ?? [];
    const checksData = checksRes.data ?? [];

    setClientError(clientsRes.error?.message ?? null);

    // Merge clients via JS map
    const clientMap = new Map<string, { display_name: string; owner_email: string }>();
    for (const c of clientData as { id: string; business_name: string | null; owner_name: string; owner_email: string }[]) {
      clientMap.set(c.id, { display_name: c.business_name || c.owner_name, owner_email: c.owner_email });
    }

    const instances: HealthRow[] = (instData as Record<string, unknown>[]).map(r => {
      const client = clientMap.get(r.client_id as string);
      return {
        id: r.id as string,
        client_id: r.client_id as string,
        instance_name: r.instance_name as string,
        property_name: r.property_name as string | null,
        health_status: (r.health_status as string) ?? 'unknown',
        launch_readiness_status: (r.launch_readiness_status as string) ?? 'not_ready',
        last_health_check_at: r.last_health_check_at as string | null,
        access_status: (r.access_status as string) ?? 'active',
        last_billing_status: r.last_billing_status as string | null,
        launched_at: r.launched_at as string | null,
        netlify_site_id: r.netlify_site_id as string | null,
        frontend_url: r.frontend_url as string | null,
        client_display_name: client?.display_name ?? null,
        client_email: client?.owner_email ?? null,
      };
    });

    // Per-instance check counts
    const counts: Record<string, { critical: number; warn: number }> = {};
    for (const c of checksData as { instance_id: string; status: string; severity: string }[]) {
      if (!counts[c.instance_id]) counts[c.instance_id] = { critical: 0, warn: 0 };
      if (c.status === 'failing' && c.severity === 'critical') counts[c.instance_id].critical++;
      if (c.status === 'warning') counts[c.instance_id].warn++;
    }

    setRows(instances);
    setCheckCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (filter !== 'all') {
      if (['healthy','warning','failing','unknown'].includes(filter) && r.health_status !== filter) return false;
      if (['not_ready','needs_review','ready_to_launch','launched'].includes(filter) && r.launch_readiness_status !== filter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const name = (r.instance_name ?? '').toLowerCase();
      const client = (r.client_display_name ?? '').toLowerCase();
      const email = (r.client_email ?? '').toLowerCase();
      if (!name.includes(q) && !client.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    healthy: rows.filter(r => r.health_status === 'healthy').length,
    warning: rows.filter(r => r.health_status === 'warning').length,
    failing: rows.filter(r => r.health_status === 'failing').length,
    launched: rows.filter(r => r.launch_readiness_status === 'launched').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Instance Health</h1>
            <p className="text-sm text-gray-500">{filtered.length} instance{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {clientError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">Client query error: {clientError}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Healthy',  value: stats.healthy,  cls: 'bg-green-50',  icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
          { label: 'Warning',  value: stats.warning,  cls: 'bg-yellow-50', icon: <AlertTriangle className="w-4 h-4 text-yellow-600" /> },
          { label: 'Failing',  value: stats.failing,  cls: 'bg-red-50',    icon: <XCircle className="w-4 h-4 text-red-600" /> },
          { label: 'Launched', value: stats.launched, cls: 'bg-blue-50',   icon: <Rocket className="w-4 h-4 text-blue-600" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-gray-200 p-4 flex items-center gap-3 ${s.cls}`}>
            {s.icon}
            <div>
              <p className="text-xs font-semibold text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search instance, client…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 w-48" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No instances found</p>
          {rows.length === 0 && (
            <p className="text-xs mt-1 text-red-400">0 rows returned from platform_instances</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Instance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Health</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Readiness</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Checks</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Access</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Billing</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Last Checked</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const hCfg = HEALTH_CFG[r.health_status] ?? HEALTH_CFG.unknown;
                  const rCfg = READINESS_CFG[r.launch_readiness_status] ?? READINESS_CFG.not_ready;
                  const cnts = checkCounts[r.id] ?? { critical: 0, warn: 0 };
                  const accessCls = ACCESS_CFG[r.access_status] ?? 'text-gray-500';
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.health_status === 'failing' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-900">{r.instance_name}</p>
                        <p className="text-xs text-gray-400">{r.client_display_name ?? '—'}</p>
                        {r.property_name && <p className="text-xs text-gray-300">{r.property_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${hCfg.cls}`}>
                          {hCfg.icon} {hCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${rCfg.cls}`}>{rCfg.label}</span>
                        {r.launched_at && <p className="text-xs text-gray-400">{fmtDate(r.launched_at)}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {cnts.critical > 0 && <span className="text-red-600">{cnts.critical} crit</span>}
                        {cnts.critical > 0 && cnts.warn > 0 && <span className="text-gray-300 mx-1">·</span>}
                        {cnts.warn > 0 && <span className="text-yellow-600">{cnts.warn} warn</span>}
                        {cnts.critical === 0 && cnts.warn === 0 && <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium capitalize ${accessCls}`}>
                        {r.access_status}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                        {r.last_billing_status?.replace('_', ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(r.last_health_check_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/platform/instances/${r.id}/launch-package`}
                            className="text-xs text-purple-600 hover:underline whitespace-nowrap font-medium">
                            Launch
                          </Link>
                          <Link to={`/platform/provisioning/${r.id}/pack`}
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                            Deploy
                          </Link>
                          <Link to={`/platform/clients/${r.client_id}`}
                            className="text-xs text-gray-500 hover:underline whitespace-nowrap flex items-center gap-0.5">
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
