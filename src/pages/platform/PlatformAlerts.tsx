import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Bell, Search, RefreshCw, Loader2, AlertTriangle, XCircle,
  CheckCircle2, Info, ExternalLink, MessageSquare, ChevronDown, Zap,
} from 'lucide-react';

export interface PlatformAlert {
  id: string;
  client_id: string | null;
  instance_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string | null;
  status: string;
  source_table: string | null;
  source_id: string | null;
  action_url: string | null;
  created_by: string | null;
  read_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  platform_clients: { business_name: string | null; owner_name: string } | null;
  platform_instances: { instance_name: string } | null;
}

interface AlertEvent {
  id: string;
  event_type: string;
  message: string | null;
  created_by: string | null;
  created_at: string;
}

const SEV_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  critical: { cls: 'bg-red-100 text-red-700 border-red-200',    icon: <XCircle className="w-3 h-3" />,      label: 'Critical' },
  warning:  { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <AlertTriangle className="w-3 h-3" />, label: 'Warning' },
  info:     { cls: 'bg-blue-100 text-blue-700 border-blue-200',  icon: <Info className="w-3 h-3" />,         label: 'Info' },
};

const STATUS_CLS: Record<string, string> = {
  unread:    'bg-gray-900 text-white',
  read:      'bg-gray-100 text-gray-600',
  resolved:  'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  urgent_support: 'Urgent Support', billing_past_due: 'Billing Past Due',
  billing_cancelled: 'Billing Cancelled', access_suspended: 'Access Suspended',
  health_failing: 'Health Failing', domain_failed: 'Domain Failed',
  ssl_pending: 'SSL Pending', webhook_failed: 'Webhook Failed',
  provisioning_failed: 'Provisioning Failed', launch_blocked: 'Launch Blocked',
  lifecycle_blocked: 'Lifecycle Blocked', manual_review: 'Manual Review',
  other: 'Other',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AlertRow({ alert, onAction }: { alert: PlatformAlert; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const sc = SEV_CFG[alert.severity] ?? SEV_CFG.info;

  const getActor = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? 'platform_admin';
  };

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('platform_alert_events')
      .select('*').eq('alert_id', alert.id).order('created_at', { ascending: false });
    setEvents((data ?? []) as AlertEvent[]);
  }, [alert.id]);

  useEffect(() => { if (expanded) loadEvents(); }, [expanded, loadEvents]);

  const doAction = async (
    status: string,
    eventType: string,
    extra?: Record<string, unknown>
  ) => {
    setActing(true);
    const actor = await getActor();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, ...extra };
    if (status === 'read' && !alert.read_at) patch.read_at = now;
    if (status === 'resolved') patch.resolved_at = now;
    if (status === 'dismissed') patch.dismissed_at = now;
    await supabase.from('platform_alerts').update(patch).eq('id', alert.id);
    await supabase.from('platform_alert_events').insert({ alert_id: alert.id, event_type: eventType, created_by: actor });
    setActing(false);
    onAction();
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setActing(true);
    const actor = await getActor();
    await supabase.from('platform_alert_events').insert({
      alert_id: alert.id, event_type: 'note_added', message: note.trim(), created_by: actor,
    });
    setNote('');
    setActing(false);
    loadEvents();
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${alert.status === 'dismissed' ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 p-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        {/* Severity badge */}
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 mt-0.5 ${sc.cls}`}>
          {sc.icon} {sc.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-xs font-bold ${alert.status === 'unread' ? 'text-gray-900' : 'text-gray-600'}`}>
              {alert.title}
            </p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[alert.status] ?? ''}`}>
              {alert.status}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {alert.platform_clients && (
              <p className="text-xs text-gray-500">{alert.platform_clients.business_name || alert.platform_clients.owner_name}</p>
            )}
            {alert.platform_instances?.instance_name && (
              <p className="text-xs text-gray-400">{alert.platform_instances.instance_name}</p>
            )}
            <p className="text-xs text-gray-300">{fmtDate(alert.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {alert.action_url && (
            <Link to={alert.action_url} onClick={e => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {alert.message && <p className="text-xs text-gray-600">{alert.message}</p>}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {alert.status === 'unread' && (
              <button onClick={() => doAction('read', 'read')} disabled={acting}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
                Mark Read
              </button>
            )}
            {['unread','read'].includes(alert.status) && (
              <button onClick={() => doAction('resolved', 'resolved')} disabled={acting}
                className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-3 h-3 inline mr-1" />Resolve
              </button>
            )}
            {['unread','read'].includes(alert.status) && (
              <button onClick={() => doAction('dismissed', 'dismissed')} disabled={acting}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
                Dismiss
              </button>
            )}
            {['resolved','dismissed'].includes(alert.status) && (
              <button onClick={() => doAction('unread', 'reopened')} disabled={acting}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
                Reopen
              </button>
            )}
            {alert.action_url && (
              <Link to={alert.action_url}
                className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                View →
              </Link>
            )}
          </div>

          {/* Note */}
          <div className="flex gap-2">
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add a note…"
              onKeyDown={e => e.key === 'Enter' && addNote()}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button onClick={addNote} disabled={!note.trim() || acting}
              className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
              <MessageSquare className="w-3 h-3" />
            </button>
          </div>

          {/* Events */}
          {events.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-100">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-300 flex-shrink-0">{fmtDate(ev.created_at)}</span>
                  <span className="text-gray-500 capitalize">{ev.event_type.replace(/_/g,' ')}</span>
                  {ev.message && <span className="text-gray-600 flex-1">— {ev.message}</span>}
                  {ev.created_by && <span className="text-gray-300 flex-shrink-0">{ev.created_by}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlatformAlerts() {
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('unread');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_alerts')
      .select('*,platform_clients(business_name,owner_name),platform_instances(instance_name)')
      .order('created_at', { ascending: false });
    setAlerts((data ?? []) as unknown as PlatformAlert[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateAlerts = async () => {
    setGenerating(true);
    setGenMsg(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-generate-alerts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setGenMsg(json.message ?? (res.ok ? 'Done' : (json.error ?? 'Failed')));
    setGenerating(false);
    await load();
  };

  const filtered = alerts.filter(a => {
    if (filter === 'critical' && a.severity !== 'critical') return false;
    if (filter === 'warning' && a.severity !== 'warning') return false;
    if (['unread','resolved','dismissed'].includes(filter) && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) &&
          !(a.message ?? '').toLowerCase().includes(q) &&
          !(a.platform_clients ? (a.platform_clients.business_name || a.platform_clients.owner_name) : '').toLowerCase().includes(q) &&
          !(a.platform_instances?.instance_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const critical  = alerts.filter(a => a.severity === 'critical' && a.status !== 'dismissed').length;
  const warnings  = alerts.filter(a => a.severity === 'warning'  && a.status !== 'dismissed').length;
  const unread    = alerts.filter(a => a.status === 'unread').length;
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const resolvedToday = alerts.filter(a => a.status === 'resolved' && a.resolved_at && new Date(a.resolved_at) >= todayStart).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
            <p className="text-sm text-gray-500">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={generateAlerts} disabled={generating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Generate Alerts
          </button>
        </div>
      </div>

      {genMsg && (
        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{genMsg}</p>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical', value: critical, cls: 'bg-red-50 border-red-200', vCls: 'text-red-700' },
          { label: 'Warnings', value: warnings, cls: 'bg-yellow-50 border-yellow-200', vCls: 'text-yellow-700' },
          { label: 'Unread',   value: unread,   cls: 'bg-gray-50', vCls: 'text-gray-900' },
          { label: 'Resolved Today', value: resolvedToday, cls: 'bg-green-50', vCls: 'text-green-700' },
        ].map(m => (
          <div key={m.label} className={`rounded-xl border p-3 ${m.cls}`}>
            <p className="text-xs text-gray-500">{m.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${m.vCls}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search alerts…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 w-48" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}{f.value === 'unread' && unread > 0 ? ` (${unread})` : ''}
              {f.value === 'critical' && critical > 0 ? ` (${critical})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'unread' ? 'No unread alerts — all clear' : 'No alerts found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => <AlertRow key={a.id} alert={a} onAction={load} />)}
        </div>
      )}
    </div>
  );
}

// Export hook for badge/count use
export async function fetchUnreadAlertCount(): Promise<{ unread: number; critical: number }> {
  const { data } = await supabase
    .from('platform_alerts')
    .select('severity, status')
    .in('status', ['unread', 'read']);
  const rows = (data ?? []) as { severity: string; status: string }[];
  return {
    unread:   rows.filter(r => r.status === 'unread').length,
    critical: rows.filter(r => r.severity === 'critical').length,
  };
}
