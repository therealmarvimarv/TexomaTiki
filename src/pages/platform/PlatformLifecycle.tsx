import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { GitBranch, Search, RefreshCw, Loader2, ExternalLink, Rocket, Layers, LifeBuoy, AlertTriangle } from 'lucide-react';
import {
  LIFECYCLE_STAGES, STAGE_LABELS, STAGE_COLORS, STATUS_COLORS,
  recommendLifecycle, LifecycleRecommendation,
} from './lifecycleLogic';

interface LifecycleRow {
  client_id: string;
  lifecycle_stage: string;
  lifecycle_status: string;
  reason: string | null;
  updated_at: string;
  client_display_name: string;
  client_email: string;
  client_status: string;
}

interface EnrichedRow extends LifecycleRow {
  instance_id: string | null;
  sub_status: string | null;
  access_status: string | null;
  health_status: string | null;
  launch_readiness: string | null;
  provisioning_status: string | null;
  handoff_status: string | null;
  launched_at: string | null;
  has_instance: boolean;
  urgent_tickets: number;
  recommendation: LifecycleRecommendation;
  rec_differs: boolean;
  // client fields (flattened, no join)
  client_display_name: string;
  client_email: string;
  client_status: string;
}

const FILTER_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'blocked',         label: 'Blocked' },
  { value: 'onboarding',      label: 'Onboarding' },
  { value: 'provisioning',    label: 'Provisioning' },
  { value: 'ready_to_launch', label: 'Ready to Launch' },
  { value: 'active',          label: 'Active' },
  { value: 'past_due',        label: 'Past Due' },
  { value: 'suspended',       label: 'Suspended' },
  { value: 'cancelled',       label: 'Cancelled' },
  { value: 'archived',        label: 'Archived' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PlatformLifecycle() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [lcRes, clientsRes, instRes, subsRes, handoffsRes, ticketsRes] = await Promise.all([
      supabase.from('platform_client_lifecycle')
        .select('client_id,lifecycle_stage,lifecycle_status,reason,updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('platform_clients').select('id,business_name,owner_name,owner_email,status'),
      supabase.from('platform_instances').select('id,client_id,access_status,health_status,launch_readiness_status,provisioning_status,launched_at'),
      supabase.from('platform_client_subscriptions').select('client_id,status'),
      supabase.from('platform_client_handoffs').select('instance_id,status'),
      supabase.from('platform_support_tickets').select('client_id,priority').not('status','in','(resolved,closed)'),
    ]);

    const rawClients = (clientsRes.data ?? []) as { id: string; business_name: string | null; owner_name: string; owner_email: string; status: string }[];
    const clientMap = new Map(rawClients.map(c => [c.id, c]));

    const instances = (instRes.data ?? []) as { id: string; client_id: string; access_status: string; health_status: string; launch_readiness_status: string; provisioning_status: string; launched_at: string | null }[];
    const subs = (subsRes.data ?? []) as { client_id: string; status: string }[];
    const handoffs = (handoffsRes.data ?? []) as { instance_id: string; status: string }[];
    const tickets = (ticketsRes.data ?? []) as { client_id: string; priority: string }[];

    const subByClient = Object.fromEntries(subs.map(s => [s.client_id, s.status]));
    const handoffByInstance = Object.fromEntries(handoffs.map(h => [h.instance_id, h.status]));
    const healthOrder = ['failing','warning','unknown','healthy'];
    const accessOrder = ['cancelled','suspended','restricted','warning','active'];

    let lcRows = (lcRes.data ?? []) as { client_id: string; lifecycle_stage: string; lifecycle_status: string; reason: string | null; updated_at: string }[];

    // Fallback: if no lifecycle rows exist, synthesize from clients + instances
    if (lcRows.length === 0 && rawClients.length > 0) {
      lcRows = rawClients.map(c => ({
        client_id: c.id,
        lifecycle_stage: 'onboarding',
        lifecycle_status: 'on_track',
        reason: null,
        updated_at: new Date().toISOString(),
      }));
    }

    const enriched: EnrichedRow[] = lcRows.map(lc => {
      const clientId = lc.client_id;
      const client = clientMap.get(clientId);
      const clientInstances = instances.filter(i => i.client_id === clientId);
      const primaryInst = [...clientInstances].sort((a, b) =>
        healthOrder.indexOf(a.health_status) - healthOrder.indexOf(b.health_status))[0] ?? null;
      const worstAccess = [...clientInstances].sort((a, b) =>
        accessOrder.indexOf(a.access_status) - accessOrder.indexOf(b.access_status))[0]?.access_status ?? null;

      const urgentTickets = tickets.filter(t => t.client_id === clientId && t.priority === 'urgent').length;
      const recommendation = recommendLifecycle({
        clientStatus: client?.status ?? 'lead',
        subStatus: subByClient[clientId] ?? null,
        accessStatus: worstAccess,
        healthStatus: primaryInst?.health_status ?? null,
        launchReadiness: primaryInst?.launch_readiness_status ?? null,
        provisioningStatus: primaryInst?.provisioning_status ?? null,
        handoffStatus: primaryInst ? handoffByInstance[primaryInst.id] : null,
        launchedAt: primaryInst?.launched_at ?? null,
        hasInstance: clientInstances.length > 0,
        urgentTickets,
      });

      return {
        ...lc,
        client_display_name: client ? (client.business_name || client.owner_name) : clientId.slice(0, 8),
        client_email: client?.owner_email ?? '',
        client_status: client?.status ?? 'lead',
        instance_id: primaryInst?.id ?? null,
        sub_status: subByClient[clientId] ?? null,
        access_status: worstAccess,
        health_status: primaryInst?.health_status ?? null,
        launch_readiness: primaryInst?.launch_readiness_status ?? null,
        provisioning_status: primaryInst?.provisioning_status ?? null,
        handoff_status: primaryInst ? handoffByInstance[primaryInst.id] : null,
        launched_at: primaryInst?.launched_at ?? null,
        has_instance: clientInstances.length > 0,
        urgent_tickets: urgentTickets,
        recommendation,
        rec_differs: recommendation.stage !== lc.lifecycle_stage || recommendation.status !== lc.lifecycle_status,
      };
    });

    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    switch (filter) {
      case 'needs_attention': return r.lifecycle_status === 'needs_attention';
      case 'blocked':         return r.lifecycle_status === 'blocked';
      default:
        if (filter !== 'all' && r.lifecycle_stage !== filter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.client_display_name.toLowerCase().includes(q) &&
          !r.client_email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stageCounts = LIFECYCLE_STAGES.reduce((acc, s) => {
    acc[s] = rows.filter(r => r.lifecycle_stage === s).length;
    return acc;
  }, {} as Record<string, number>);
  const recDiffersCount = rows.filter(r => r.rec_differs).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Client Lifecycle</h1>
            <p className="text-sm text-gray-500">{filtered.length} client{filtered.length !== 1 ? 's' : ''}{recDiffersCount > 0 ? ` · ${recDiffersCount} need review` : ''}</p>
          </div>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stage counts */}
      <div className="flex gap-1.5 flex-wrap">
        {LIFECYCLE_STAGES.filter(s => stageCounts[s] > 0).map(s => {
          const cfg = STAGE_COLORS[s];
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                filter === s ? 'border-gray-700 ' + cfg.bg + ' ' + cfg.text : 'border-transparent ' + cfg.bg + ' ' + cfg.text + ' opacity-70 hover:opacity-100'
              }`}>
              {STAGE_LABELS[s]} {stageCounts[s]}
            </button>
          );
        })}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search client, email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 w-44" />
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
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No clients found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Recommended</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Billing</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Access</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Health</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Support</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => {
                const sc = STAGE_COLORS[r.lifecycle_stage] ?? STAGE_COLORS.onboarding;
                const stc = STATUS_COLORS[r.lifecycle_status] ?? STATUS_COLORS.on_track;
                const recSc = STAGE_COLORS[r.recommendation.stage] ?? STAGE_COLORS.onboarding;
                return (
                  <tr key={r.client_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900">{r.client_display_name}</p>
                      <p className="text-xs text-gray-400">{r.client_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>
                        {STAGE_LABELS[r.lifecycle_stage] ?? r.lifecycle_stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stc.bg} ${stc.text}`}>
                        {r.lifecycle_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.rec_differs ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${recSc.bg} ${recSc.text}`}>
                            {STAGE_LABELS[r.recommendation.stage]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">On track</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{r.sub_status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{r.access_status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{r.health_status ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.urgent_tickets > 0 ? (
                        <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                          <LifeBuoy className="w-3 h-3" /> {r.urgent_tickets}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(r.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/platform/clients/${r.client_id}`} title="Client"
                          className="p-1 text-gray-400 hover:text-gray-700"><ExternalLink className="w-3 h-3" /></Link>
                        {r.instance_id && (
                          <>
                            <Link to={`/platform/provisioning/${r.instance_id}/pack`} title="Deploy"
                              className="p-1 text-gray-400 hover:text-gray-700"><Layers className="w-3 h-3" /></Link>
                            <Link to={`/platform/instances/${r.instance_id}/launch-package`} title="Launch"
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
    </div>
  );
}
