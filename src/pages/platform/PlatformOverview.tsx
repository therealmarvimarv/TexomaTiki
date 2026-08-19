import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Users, Server, CheckCircle2, AlertCircle, Clock, TrendingUp,
  Loader2, FileText, Activity, UserPlus, Bell,
} from 'lucide-react';

interface AlertStats {
  critical: number;
  warnings: number;
  unread: number;
  billingAlerts: number;
  healthAlerts: number;
  supportAlerts: number;
}

interface Stats {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  pastDueClients: number;
  suspendedClients: number;
  cancelledClients: number;
  deployedInstances: number;
  failedInstances: number;
  pendingInstances: number;
  mrrUSD: number;
  arrUSD: number;
  openTickets: number;
  urgentTickets: number;
  waitingOnClient: number;
  resolvedThisMonth: number;
}

interface RecentLog {
  id: string;
  accessed_by: string;
  access_type: string;
  reason: string | null;
  created_at: string;
  client_id: string | null;
  instance_id: string | null;
  client_name?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  loading?: boolean;
  to?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-2xl border p-5 flex items-start gap-4 transition-shadow ${to ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-gray-100'}`}>
        <Icon className="w-5 h-5 text-gray-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  viewed_dashboard: 'Viewed dashboard',
  opened_frontend: 'Opened frontend',
  opened_backend: 'Opened backend',
  support_note: 'Support note',
};

export default function PlatformOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [clientsRes, instancesRes, logsRes, subsRes, ticketsRes] = await Promise.all([
        supabase.from('platform_clients').select('status'),
        supabase.from('platform_instances').select('provisioning_status'),
        supabase
          .from('platform_support_access_logs')
          .select('id,accessed_by,access_type,reason,created_at,client_id,instance_id')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('platform_client_subscriptions').select('status,billing_cycle,price_amount,currency'),
        supabase.from('platform_support_tickets').select('status,priority,resolved_at'),
      ]);

      const clients = clientsRes.data ?? [];
      const instances = instancesRes.data ?? [];
      const subs = (subsRes.data ?? []) as { status: string; billing_cycle: string; price_amount: number | null; currency: string }[];
      const tickets = (ticketsRes.data ?? []) as { status: string; priority: string; resolved_at: string | null }[];

      const activeSubs = subs.filter(s => s.status === 'active' && s.price_amount && s.currency === 'USD');
      const mrrUSD = activeSubs
        .filter(s => s.billing_cycle === 'monthly')
        .reduce((acc, s) => acc + (s.price_amount ?? 0), 0)
        + activeSubs
          .filter(s => s.billing_cycle === 'yearly')
          .reduce((acc, s) => acc + (s.price_amount ?? 0) / 12, 0);

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'active').length,
        trialClients: clients.filter(c => c.status === 'trial').length,
        pastDueClients: subs.filter(s => s.status === 'past_due').length,
        suspendedClients: clients.filter(c => c.status === 'suspended').length,
        cancelledClients: clients.filter(c => c.status === 'cancelled').length,
        deployedInstances: instances.filter(i => i.provisioning_status === 'deployed').length,
        failedInstances: instances.filter(i => i.provisioning_status === 'failed').length,
        pendingInstances: instances.filter(i => i.provisioning_status === 'pending').length,
        mrrUSD,
        arrUSD: mrrUSD * 12,
        openTickets: tickets.filter(t => t.status === 'open').length,
        urgentTickets: tickets.filter(t => t.priority === 'urgent' && !['resolved','closed'].includes(t.status)).length,
        waitingOnClient: tickets.filter(t => t.status === 'waiting_on_client').length,
        resolvedThisMonth: tickets.filter(t => t.status === 'resolved' && t.resolved_at && t.resolved_at >= monthStart).length,
      });

      setLogs((logsRes.data ?? []) as RecentLog[]);

      // Alert stats
      const { data: alertRows } = await supabase
        .from('platform_alerts')
        .select('severity,status,alert_type')
        .not('status', 'in', '("dismissed")');
      const ar = (alertRows ?? []) as { severity: string; status: string; alert_type: string }[];
      setAlertStats({
        critical:      ar.filter(a => a.severity === 'critical').length,
        warnings:      ar.filter(a => a.severity === 'warning').length,
        unread:        ar.filter(a => a.status === 'unread').length,
        billingAlerts: ar.filter(a => ['billing_past_due','billing_cancelled','webhook_failed'].includes(a.alert_type)).length,
        healthAlerts:  ar.filter(a => ['health_failing','domain_failed','ssl_pending'].includes(a.alert_type)).length,
        supportAlerts: ar.filter(a => a.alert_type === 'urgent_support').length,
      });

      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Master control center for all client accounts and instances.</p>
        </div>
        <Link
          to="/platform/onboarding/new"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> New Client Onboarding
        </Link>
      </div>

      {/* Billing / revenue */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label="Active Subs" value={stats?.activeClients ?? 0} loading={loading} accent="bg-green-50" to="/platform/billing" />
          <StatCard icon={Clock} label="Trial" value={stats?.trialClients ?? 0} loading={loading} accent="bg-yellow-50" to="/platform/billing" />
          <StatCard icon={AlertCircle} label="Past Due" value={stats?.pastDueClients ?? 0} loading={loading} accent="bg-red-50" to="/platform/billing" />
          <StatCard
            icon={TrendingUp}
            label="Est. MRR"
            value={stats?.mrrUSD ? `$${Math.round(stats.mrrUSD).toLocaleString()}` : '—'}
            sub={stats?.arrUSD ? `ARR ~$${Math.round(stats.arrUSD).toLocaleString()}` : undefined}
            loading={loading}
            accent="bg-blue-50"
            to="/platform/billing"
          />
        </div>
      </div>

      {/* Client stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Clients</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Total" value={stats?.totalClients ?? 0} loading={loading} accent="bg-gray-100" to="/platform/clients" />
          <StatCard icon={CheckCircle2} label="Active" value={stats?.activeClients ?? 0} loading={loading} accent="bg-green-50" to="/platform/clients" />
          <StatCard icon={Clock} label="Trial" value={stats?.trialClients ?? 0} loading={loading} accent="bg-yellow-50" to="/platform/clients" />
          <StatCard icon={AlertCircle} label="Suspended" value={stats?.suspendedClients ?? 0} loading={loading} accent="bg-red-50" to="/platform/clients" />
          <StatCard icon={TrendingUp} label="Cancelled" value={stats?.cancelledClients ?? 0} loading={loading} accent="bg-gray-100" to="/platform/clients" />
        </div>
      </div>

      {/* Instance stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Instances</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard icon={Server} label="Deployed" value={stats?.deployedInstances ?? 0} loading={loading} accent="bg-blue-50" to="/platform/instances" />
          <StatCard icon={Clock} label="Pending" value={stats?.pendingInstances ?? 0} loading={loading} accent="bg-yellow-50" to="/platform/instances" />
          <StatCard icon={AlertCircle} label="Failed" value={stats?.failedInstances ?? 0} loading={loading} accent="bg-red-50" to="/platform/instances" />
        </div>
      </div>

      {/* Support */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Support</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={AlertCircle} label="Open Tickets"      value={stats?.openTickets ?? 0}        loading={loading} accent="bg-blue-50"   to="/platform/support" />
          <StatCard icon={AlertCircle} label="Urgent"            value={stats?.urgentTickets ?? 0}       loading={loading} accent="bg-red-50"    to="/platform/support" />
          <StatCard icon={Clock}       label="Waiting on Client" value={stats?.waitingOnClient ?? 0}    loading={loading} accent="bg-orange-50" to="/platform/support" />
          <StatCard icon={CheckCircle2} label="Resolved (month)" value={stats?.resolvedThisMonth ?? 0} loading={loading} accent="bg-green-50"  to="/platform/support" />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alerts</h2>
          <Link to="/platform/alerts" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Critical',  value: alertStats?.critical ?? 0,      accent: 'bg-red-50',    icon: Bell },
            { label: 'Warnings',  value: alertStats?.warnings ?? 0,      accent: 'bg-yellow-50', icon: AlertCircle },
            { label: 'Unread',    value: alertStats?.unread ?? 0,        accent: 'bg-gray-50',   icon: Bell },
            { label: 'Billing',   value: alertStats?.billingAlerts ?? 0, accent: 'bg-orange-50', icon: AlertCircle },
            { label: 'Health',    value: alertStats?.healthAlerts ?? 0,  accent: 'bg-blue-50',   icon: Activity },
            { label: 'Support',   value: alertStats?.supportAlerts ?? 0, accent: 'bg-purple-50', icon: AlertCircle },
          ].map(m => (
            <Link key={m.label} to="/platform/alerts"
              className={`${m.accent} rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow`}>
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${m.value > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{loading ? '—' : m.value}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Support Activity</h2>
          <Activity className="w-4 h-4 text-gray-400" />
        </div>
        {loading ? (
          <div className="bg-white rounded-2xl border p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No activity logged yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border divide-y">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <Activity className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium">
                    {ACCESS_TYPE_LABELS[log.access_type] ?? log.access_type}
                  </p>
                  {log.reason && <p className="text-xs text-gray-500 mt-0.5">{log.reason}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">by {log.accessed_by}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
