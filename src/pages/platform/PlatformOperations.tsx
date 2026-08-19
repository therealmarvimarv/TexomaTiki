import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Layers, RefreshCw, Search, AlertTriangle, CheckCircle2, XCircle,
  Minus, Loader2, ExternalLink, LifeBuoy, Rocket, Activity,
  ChevronRight,
} from 'lucide-react';
import { STAGE_LABELS, STAGE_COLORS, STATUS_COLORS, recommendLifecycle } from './lifecycleLogic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  display_name: string;
  owner_name: string;
  owner_email: string;
  status: string;
  plan_name: string | null;
  // subscription
  sub_status: string | null;
  sub_period_ends: string | null;
  // instance (worst/primary)
  instance_id: string | null;
  instance_name: string | null;
  access_status: string | null;
  health_status: string | null;
  launch_readiness: string | null;
  provisioning_status: string | null;
  last_health_check: string | null;
  launched_at: string | null;
  // handoff
  handoff_status: string | null;
  // support
  open_tickets: number;
  urgent_tickets: number;
  latest_ticket_at: string | null;
  // derived
  recommended_action: string;
  needs_attention: boolean;
  // lifecycle
  lifecycle_stage: string | null;
  lifecycle_status: string | null;
  rec_lifecycle_stage: string;
  rec_lifecycle_differs: boolean;
  // alerts
  critical_alerts: number;
  total_alerts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recommendedAction(r: Omit<ClientRow, 'recommended_action' | 'needs_attention'>): string {
  if ((r as ClientRow).critical_alerts > 0) return 'Review critical alert';
  if (r.urgent_tickets > 0) return 'Handle urgent support ticket';
  if (['past_due', 'expired'].includes(r.sub_status ?? '')) return 'Review billing / payment issue';
  if (['suspended', 'cancelled'].includes(r.access_status ?? '')) return 'Review instance access status';
  if (r.health_status === 'failing') return 'Run / fix health checks';
  if (r.open_tickets > 0) return 'Review open support ticket';
  if (['not_ready', 'needs_review'].includes(r.launch_readiness ?? '')) return 'Complete launch blockers';
  if (!['ready_for_client', 'sent', 'accepted', 'completed'].includes(r.handoff_status ?? '')) return 'Complete client handoff';
  if (!['deployed'].includes(r.provisioning_status ?? '')) return 'Finish provisioning';
  if (r.health_status === 'warning') return 'Review health warnings';
  return 'No immediate action';
}

function needsAttention(r: Omit<ClientRow, 'recommended_action' | 'needs_attention'>): boolean {
  return (
    r.urgent_tickets > 0 ||
    ['past_due', 'expired', 'cancelled'].includes(r.sub_status ?? '') ||
    ['suspended', 'cancelled'].includes(r.access_status ?? '') ||
    r.health_status === 'failing' ||
    r.open_tickets > 0
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const HEALTH_CFG: Record<string, { cls: string; icon: React.ReactNode }> = {
  unknown:  { cls: 'text-gray-400',  icon: <Minus className="w-3 h-3" /> },
  healthy:  { cls: 'text-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  warning:  { cls: 'text-yellow-600',icon: <AlertTriangle className="w-3 h-3" /> },
  failing:  { cls: 'text-red-600',   icon: <XCircle className="w-3 h-3" /> },
};

const ACCESS_CLS: Record<string, string> = {
  active: 'text-green-600', warning: 'text-yellow-600',
  restricted: 'text-orange-600', suspended: 'text-red-600', cancelled: 'text-gray-400',
};

const BILLING_CLS: Record<string, string> = {
  trial: 'bg-yellow-100 text-yellow-700', active: 'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700', suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500', expired: 'bg-red-100 text-red-700',
};

const READINESS_CLS: Record<string, string> = {
  not_ready: 'text-red-600', needs_review: 'text-yellow-600',
  ready_to_launch: 'text-green-600', launched: 'text-blue-600',
};

const ACTION_PRIORITY_CLS: Record<string, string> = {
  'No immediate action': 'text-gray-400',
};

function actionCls(action: string) {
  if (action.includes('urgent')) return 'text-red-600 font-semibold';
  if (action.includes('billing') || action.includes('access')) return 'text-orange-600 font-medium';
  if (action.includes('health') || action.includes('launch')) return 'text-yellow-600';
  if (action === 'No immediate action') return 'text-gray-400';
  return 'text-blue-600';
}

// ── Filter options ────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'urgent_support',  label: 'Urgent Support' },
  { value: 'billing_issue',   label: 'Billing Issue' },
  { value: 'health_failing',  label: 'Health Failing' },
  { value: 'not_launched',    label: 'Not Launched' },
  { value: 'launched',        label: 'Launched' },
  { value: 'active',          label: 'Active Clients' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function PlatformOperations() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);

    // Load all data sources in parallel
    const [clientsRes, instancesRes, subsRes, handoffsRes, ticketsRes, lcRes, alertsRes] = await Promise.all([
      supabase.from('platform_clients').select('id,business_name,owner_name,owner_email,status,plan_name'),
      supabase.from('platform_instances').select('id,client_id,instance_name,access_status,health_status,launch_readiness_status,provisioning_status,last_health_check_at,launched_at'),
      supabase.from('platform_client_subscriptions').select('client_id,status,plan_name,current_period_ends_at'),
      supabase.from('platform_client_handoffs').select('instance_id,status'),
      supabase.from('platform_support_tickets').select('client_id,status,priority,updated_at').not('status','in','(resolved,closed)'),
      supabase.from('platform_client_lifecycle').select('client_id,lifecycle_stage,lifecycle_status'),
      supabase.from('platform_alerts').select('client_id,severity').in('status',['unread','read']),
    ]);

    const clients = (clientsRes.data ?? []) as { id: string; business_name: string | null; owner_name: string; owner_email: string; status: string; plan_name: string | null }[];
    const instances = (instancesRes.data ?? []) as { id: string; client_id: string; instance_name: string; access_status: string; health_status: string; launch_readiness_status: string; provisioning_status: string; last_health_check_at: string | null; launched_at: string | null }[];
    const subs = (subsRes.data ?? []) as { client_id: string; status: string; plan_name: string | null; current_period_ends_at: string | null }[];
    const handoffs = (handoffsRes.data ?? []) as { instance_id: string; status: string }[];
    const tickets = (ticketsRes.data ?? []) as { client_id: string; status: string; priority: string; updated_at: string }[];
    const lifecycles = (lcRes.data ?? []) as { client_id: string; lifecycle_stage: string; lifecycle_status: string }[];

    // Index lookups
    const subByClient = Object.fromEntries(subs.map(s => [s.client_id, s]));
    const handoffByInstance = Object.fromEntries(handoffs.map(h => [h.instance_id, h]));
    const lcByClient = Object.fromEntries(lifecycles.map(l => [l.client_id, l]));
    const alertRows = (alertsRes.data ?? []) as { client_id: string | null; severity: string }[];
    const alertsByClient: Record<string, { critical: number; total: number }> = {};
    for (const a of alertRows) {
      if (!a.client_id) continue;
      if (!alertsByClient[a.client_id]) alertsByClient[a.client_id] = { critical: 0, total: 0 };
      alertsByClient[a.client_id].total++;
      if (a.severity === 'critical') alertsByClient[a.client_id].critical++;
    }

    const combined: ClientRow[] = clients.map(c => {
      const clientInstances = instances.filter(i => i.client_id === c.id);
      const sub = subByClient[c.id];
      const clientTickets = tickets.filter(t => t.client_id === c.id);

      // Pick "worst" instance: prefer failing > warning > unknown > healthy
      const healthOrder = ['failing','warning','unknown','healthy'];
      const primaryInst = clientInstances.sort((a, b) =>
        healthOrder.indexOf(a.health_status) - healthOrder.indexOf(b.health_status)
      )[0] ?? null;

      // Worst access status
      const accessOrder = ['cancelled','suspended','restricted','warning','active'];
      const worstAccess = clientInstances
        .sort((a, b) => accessOrder.indexOf(a.access_status) - accessOrder.indexOf(b.access_status))[0]?.access_status ?? null;

      // Handoff for primary instance
      const handoff = primaryInst ? handoffByInstance[primaryInst.id] : null;

      const open_tickets = clientTickets.length;
      const urgent_tickets = clientTickets.filter(t => t.priority === 'urgent').length;
      const latestTicket = clientTickets.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

      const base = {
        id: c.id,
        display_name: c.business_name || c.owner_name,
        owner_name: c.owner_name,
        owner_email: c.owner_email,
        status: c.status,
        plan_name: sub?.plan_name ?? c.plan_name ?? null,
        sub_status: sub?.status ?? null,
        sub_period_ends: sub?.current_period_ends_at ?? null,
        instance_id: primaryInst?.id ?? null,
        instance_name: primaryInst?.instance_name ?? null,
        access_status: worstAccess,
        health_status: primaryInst?.health_status ?? null,
        launch_readiness: primaryInst?.launch_readiness_status ?? null,
        provisioning_status: primaryInst?.provisioning_status ?? null,
        last_health_check: primaryInst?.last_health_check_at ?? null,
        launched_at: primaryInst?.launched_at ?? null,
        handoff_status: handoff?.status ?? null,
        open_tickets,
        urgent_tickets,
        latest_ticket_at: latestTicket?.updated_at ?? null,
      };

      return {
        ...base,
        recommended_action: recommendedAction(base),
        needs_attention: needsAttention(base),
        lifecycle_stage: lcByClient[c.id]?.lifecycle_stage ?? null,
        lifecycle_status: lcByClient[c.id]?.lifecycle_status ?? null,
        rec_lifecycle_stage: recommendLifecycle({
          clientStatus: c.status,
          subStatus: sub?.status ?? null,
          accessStatus: worstAccess,
          healthStatus: primaryInst?.health_status ?? null,
          launchReadiness: primaryInst?.launch_readiness_status ?? null,
          provisioningStatus: primaryInst?.provisioning_status ?? null,
          handoffStatus: handoff?.status ?? null,
          launchedAt: primaryInst?.launched_at ?? null,
          hasInstance: clientInstances.length > 0,
          urgentTickets: urgent_tickets,
        }).stage,
        rec_lifecycle_differs: false, // computed below
        critical_alerts: alertsByClient[c.id]?.critical ?? 0,
        total_alerts: alertsByClient[c.id]?.total ?? 0,
      };
    });

    // Post-process rec_lifecycle_differs
    for (const r of combined) {
      (r as ClientRow).rec_lifecycle_differs = r.rec_lifecycle_stage !== r.lifecycle_stage;
    }

    // Sort: needs attention first, then by company name
    combined.sort((a, b) => {
      if (a.needs_attention && !b.needs_attention) return -1;
      if (!a.needs_attention && b.needs_attention) return 1;
      if (a.urgent_tickets > 0 && b.urgent_tickets === 0) return -1;
      if (a.urgent_tickets === 0 && b.urgent_tickets > 0) return 1;
      return a.display_name.localeCompare(b.display_name);
    });

    setRows(combined);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const metrics = {
    total: rows.length,
    needsAttention: rows.filter(r => r.needs_attention).length,
    urgentSupport: rows.filter(r => r.urgent_tickets > 0).length,
    billingIssues: rows.filter(r => ['past_due','expired','cancelled'].includes(r.sub_status ?? '')).length,
    healthFailing: rows.filter(r => r.health_status === 'failing').length,
    readyToLaunch: rows.filter(r => r.launch_readiness === 'ready_to_launch').length,
    launched: rows.filter(r => r.launched_at).length,
  };

  // ── Filter logic ────────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    switch (filter) {
      case 'needs_attention': return r.needs_attention;
      case 'urgent_support':  return r.urgent_tickets > 0;
      case 'billing_issue':   return ['past_due','expired','cancelled'].includes(r.sub_status ?? '');
      case 'health_failing':  return r.health_status === 'failing';
      case 'not_launched':    return !r.launched_at;
      case 'launched':        return !!r.launched_at;
      case 'active':          return r.status === 'active';
      default: return true;
    }
  }).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.display_name.toLowerCase().includes(q) ||
           r.owner_email.toLowerCase().includes(q) ||
           (r.instance_name ?? '').toLowerCase().includes(q);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Client Operations</h1>
            <p className="text-sm text-gray-500">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total',           value: metrics.total,          cls: 'bg-gray-50',    onClick: () => setFilter('all') },
          { label: 'Attention',       value: metrics.needsAttention, cls: 'bg-red-50',     onClick: () => setFilter('needs_attention') },
          { label: 'Urgent Support',  value: metrics.urgentSupport,  cls: 'bg-red-50',     onClick: () => setFilter('urgent_support') },
          { label: 'Billing Issues',  value: metrics.billingIssues,  cls: 'bg-orange-50',  onClick: () => setFilter('billing_issue') },
          { label: 'Health Failing',  value: metrics.healthFailing,  cls: 'bg-yellow-50',  onClick: () => setFilter('health_failing') },
          { label: 'Ready to Launch', value: metrics.readyToLaunch,  cls: 'bg-green-50',   onClick: () => setFilter('not_launched') },
          { label: 'Launched',        value: metrics.launched,       cls: 'bg-blue-50',    onClick: () => setFilter('launched') },
        ].map(m => (
          <button key={m.label} onClick={m.onClick}
            className={`${m.cls} rounded-xl border border-gray-200 p-3 text-left hover:opacity-80 transition-opacity`}>
            <p className="text-xs text-gray-500 leading-tight">{m.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{m.value}</p>
          </button>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search client, email, instance…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 w-52" />
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

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No clients found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => <OperationsRow key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}

// ── Row card ──────────────────────────────────────────────────────────────────

function OperationsRow({ row: r }: { row: ClientRow }) {
  const hCfg = HEALTH_CFG[r.health_status ?? 'unknown'] ?? HEALTH_CFG.unknown;
  const accessCls = ACCESS_CLS[r.access_status ?? 'active'] ?? 'text-gray-400';
  const billCls = BILLING_CLS[r.sub_status ?? ''] ?? 'bg-gray-100 text-gray-400';
  const readCls = READINESS_CLS[r.launch_readiness ?? 'not_ready'] ?? 'text-gray-400';
  const aCls = actionCls(r.recommended_action);
  const isUrgent = r.urgent_tickets > 0;
  const hasOpenTickets = r.open_tickets > 0;

  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors ${
      isUrgent ? 'border-red-200 bg-red-50/20' :
      r.needs_attention ? 'border-orange-200' :
      'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-start gap-4 flex-wrap">
        {/* Client info */}
        <div className="flex-1 min-w-40">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/platform/clients/${r.id}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
              {r.display_name}
            </Link>
            {r.sub_status && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${billCls}`}>
                {r.sub_status}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{r.owner_email}</p>
          {r.plan_name && <p className="text-xs text-gray-400">{r.plan_name}</p>}
          {r.instance_name && <p className="text-xs text-gray-300 mt-0.5">{r.instance_name}</p>}
          {r.lifecycle_stage && (() => {
            const sc = STAGE_COLORS[r.lifecycle_stage];
            return (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc?.bg ?? 'bg-gray-100'} ${sc?.text ?? 'text-gray-500'}`}>
                  {STAGE_LABELS[r.lifecycle_stage] ?? r.lifecycle_stage}
                </span>
                {r.rec_lifecycle_differs && (
                  <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> →{STAGE_LABELS[r.rec_lifecycle_stage]}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Status grid */}
        <div className="flex items-center gap-5 flex-wrap text-xs">
          {/* Health */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-gray-400 text-xs">Health</span>
            <span className={`flex items-center gap-0.5 font-medium ${hCfg.cls}`}>
              {hCfg.icon} <span className="capitalize">{r.health_status ?? '—'}</span>
            </span>
          </div>

          {/* Access */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-gray-400 text-xs">Access</span>
            <span className={`font-medium capitalize ${accessCls}`}>{r.access_status ?? '—'}</span>
          </div>

          {/* Launch */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-gray-400 text-xs">Readiness</span>
            <span className={`font-medium capitalize ${readCls}`}>
              {r.launched_at ? (
                <span className="flex items-center gap-0.5 text-blue-600"><Rocket className="w-3 h-3" /> Launched</span>
              ) : (
                (r.launch_readiness ?? '—').replace(/_/g, ' ')
              )}
            </span>
          </div>

          {/* Support */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-gray-400 text-xs">Support</span>
            {hasOpenTickets ? (
              <span className={`flex items-center gap-0.5 font-medium ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                {isUrgent && <AlertTriangle className="w-3 h-3" />}
                <LifeBuoy className="w-3 h-3" />
                {r.open_tickets} open{r.urgent_tickets > 0 ? `, ${r.urgent_tickets} urgent` : ''}
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>

          {/* Alerts */}
          {r.total_alerts > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-gray-400 text-xs">Alerts</span>
              <span className={`flex items-center gap-0.5 font-medium ${r.critical_alerts > 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                <AlertTriangle className="w-3 h-3" />
                {r.total_alerts}{r.critical_alerts > 0 ? ` (${r.critical_alerts} crit)` : ''}
              </span>
            </div>
          )}

          {/* Billing period end */}
          {r.sub_period_ends && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-gray-400 text-xs">Next Invoice</span>
              <span className="text-gray-600">{fmtDateShort(r.sub_period_ends)}</span>
            </div>
          )}
        </div>

        {/* Recommended action */}
        <div className="flex flex-col min-w-48 max-w-60">
          <span className="text-xs text-gray-400 mb-0.5">Action</span>
          <span className={`text-xs leading-tight ${aCls}`}>{r.recommended_action}</span>
          {r.last_health_check && (
            <span className="text-xs text-gray-300 mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> {fmtDateShort(r.last_health_check)}
            </span>
          )}
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link to={`/platform/clients/${r.id}`} title="Client Detail"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {r.instance_id && (
            <>
              <Link to={`/platform/provisioning/${r.instance_id}/pack`} title="Deployment Pack"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                <Layers className="w-3.5 h-3.5" />
              </Link>
              <Link to={`/platform/instances/${r.instance_id}/launch-package`} title="Launch Package"
                className="p-1.5 rounded-lg border border-gray-200 text-purple-500 hover:text-purple-700 hover:bg-purple-50 transition-colors">
                <Rocket className="w-3.5 h-3.5" />
              </Link>
              <Link to={`/platform/health`} title="Health Overview"
                className="p-1.5 rounded-lg border border-gray-200 text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                <Activity className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
          <Link to={`/platform/support?client_id=${r.id}`} title="Support Tickets"
            className={`p-1.5 rounded-lg border transition-colors ${
              isUrgent ? 'border-red-300 text-red-500 hover:bg-red-50' : 'border-gray-200 text-orange-500 hover:text-orange-700 hover:bg-orange-50'
            }`}>
            <LifeBuoy className="w-3.5 h-3.5" />
          </Link>
          <Link to={`/platform/billing`} title="Billing"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
