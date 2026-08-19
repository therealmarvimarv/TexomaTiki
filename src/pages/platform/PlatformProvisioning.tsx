import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, ClipboardList, ChevronRight, AlertTriangle, UserPlus } from 'lucide-react';
import { ProviderReadinessSummary, ProviderStatus } from './ProvisioningActions';

interface InstanceRow {
  id: string;
  instance_name: string;
  property_name: string | null;
  provisioning_status: string;
  client_id: string;
  client_name: string;
  total: number;
  completed: number;
  failed: number;
}

const STATUS_FILTERS = ['all', 'not_started', 'pending', 'failed', 'deployed'] as const;
type FilterVal = typeof STATUS_FILTERS[number];

const PROV_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  pending:     'bg-yellow-100 text-yellow-800',
  deployed:    'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  suspended:   'bg-orange-100 text-orange-800',
};

export default function PlatformProvisioning() {
  const [rows, setRows] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterVal>('all');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data: instances }, { data: steps }, { data: clients }, { data: providers }] = await Promise.all([
        supabase.from('platform_instances')
          .select('id, instance_name, property_name, provisioning_status, client_id')
          .order('created_at', { ascending: false }),
        supabase.from('platform_provisioning_steps').select('instance_id, status'),
        supabase.from('platform_clients').select('id, owner_name, business_name'),
        supabase.from('platform_provider_integrations').select('provider,display_name,status'),
      ]);
      setProviderStatuses((providers ?? []) as ProviderStatus[]);

      const clientMap: Record<string, string> = {};
      for (const c of clients ?? []) {
        clientMap[c.id] = c.owner_name + (c.business_name ? ` — ${c.business_name}` : '');
      }

      const stepStats: Record<string, { total: number; completed: number; failed: number }> = {};
      for (const s of steps ?? []) {
        if (!stepStats[s.instance_id]) stepStats[s.instance_id] = { total: 0, completed: 0, failed: 0 };
        stepStats[s.instance_id].total++;
        if (s.status === 'completed' || s.status === 'skipped') stepStats[s.instance_id].completed++;
        if (s.status === 'failed') stepStats[s.instance_id].failed++;
      }

      setRows((instances ?? []).map(inst => ({
        ...inst,
        client_name: clientMap[inst.client_id] ?? 'Unknown',
        ...(stepStats[inst.id] ?? { total: 0, completed: 0, failed: 0 }),
      })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = rows.filter(r => filter === 'all' || r.provisioning_status === filter);

  const counts = {
    all: rows.length,
    not_started: rows.filter(r => r.provisioning_status === 'not_started').length,
    pending: rows.filter(r => r.provisioning_status === 'pending').length,
    failed: rows.filter(r => r.provisioning_status === 'failed').length,
    deployed: rows.filter(r => r.provisioning_status === 'deployed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provisioning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track setup progress for each client instance.</p>
        </div>
        <Link
          to="/platform/onboarding/new"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> New Client Onboarding
        </Link>
      </div>

      <ProviderReadinessSummary statuses={providerStatuses} />

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
              filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {filter === 'all'
              ? 'No instances yet. Create a client and add an instance to begin.'
              : `No instances with status "${filter.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
            return (
              <Link
                key={row.id}
                to={`/platform/provisioning/${row.id}`}
                className="bg-white rounded-2xl border p-5 flex items-center gap-4 hover:shadow-sm transition-shadow group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{row.instance_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${PROV_STYLES[row.provisioning_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {row.provisioning_status.replace('_', ' ')}
                    </span>
                    {row.failed > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                        <AlertTriangle className="w-3 h-3" />{row.failed} failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{row.client_name}</p>
                  {row.property_name && <p className="text-xs text-gray-400">{row.property_name}</p>}
                  {row.total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{row.completed} / {row.total} steps</span>
                        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            row.failed > 0 ? 'bg-red-400' : pct === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 flex-shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
