import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SupportTicketsCard } from './SupportTicketsCard';
import { DomainReadinessCard } from './DomainReadinessCard';
import { ClientLifecycleCard } from './ClientLifecycleCard';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Minus,
  Copy, Check, RefreshCw, Rocket, Flag, ClipboardCheck, AlertCircle,
  ExternalLink, Activity,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Instance {
  id: string;
  client_id: string;
  instance_name: string;
  property_name: string | null;
  frontend_url: string | null;
  admin_url: string | null;
  supabase_project_url: string | null;
  supabase_project_ref: string | null;
  health_status: string;
  launch_readiness_status: string;
  last_health_check_at: string | null;
  access_status: string;
  last_billing_status: string | null;
  launched_at: string | null;
  launched_by: string | null;
}

interface Client {
  id: string;
  company_name: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
}

interface Subscription {
  status: string;
  plan_name: string | null;
}

interface Handoff {
  status: string;
  admin_invite_status: string;
  admin_invite_email: string | null;
  admin_temp_password: string | null;
  handoff_notes: string | null;
}

interface HealthCheck {
  check_key: string;
  check_label: string;
  check_group: string;
  status: string;
  severity: string;
  message: string | null;
}

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

interface LaunchPackage {
  id: string;
  checklist: ChecklistItem[];
  qa_notes: string | null;
  package_status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-100 text-gray-500';
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>{value.replace(/_/g, ' ')}</span>;
}

const HEALTH_CLS: Record<string, string> = {
  unknown: 'bg-gray-100 text-gray-500', healthy: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700', failing: 'bg-red-100 text-red-700',
};
const READINESS_CLS: Record<string, string> = {
  not_ready: 'bg-red-100 text-red-700', needs_review: 'bg-yellow-100 text-yellow-700',
  ready_to_launch: 'bg-green-100 text-green-700', launched: 'bg-blue-100 text-blue-700',
};
const ACCESS_CLS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', warning: 'bg-yellow-100 text-yellow-700',
  restricted: 'bg-orange-100 text-orange-700', suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const PKG_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', ready: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700', completed: 'bg-purple-100 text-purple-700',
};

async function callHealthChecks(instanceId: string) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-run-instance-health-checks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instance_id: instanceId }),
  });
  if (!res.ok) {
    const j = await res.json();
    throw new Error(j.error ?? 'Health check failed');
  }
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlatformLaunchPackage() {
  const { instanceId } = useParams<{ instanceId: string }>();

  const [inst, setInst] = useState<Instance | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [pkg, setPkg] = useState<LaunchPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Support SQL fields
  const [supportEmail, setSupportEmailField] = useState('');
  const [supportPhone, setSupportPhoneField] = useState('');
  const [supportMessage, setSupportMessageField] = useState('Need help with your website or booking system? Contact support using the information below.');
  const [supportHours, setSupportHoursField] = useState('');
  const [supportEnabled, setSupportEnabledField] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qaNotesDebounce, setQaNotesDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    if (!instanceId) return;
    const [instRes, healthRes, pkgRes] = await Promise.all([
      supabase.from('platform_instances')
        .select('id,client_id,instance_name,property_name,frontend_url,admin_url,supabase_project_url,supabase_project_ref,health_status,launch_readiness_status,last_health_check_at,access_status,last_billing_status,launched_at,launched_by')
        .eq('id', instanceId).maybeSingle(),
      supabase.from('platform_instance_health_checks')
        .select('check_key,check_label,check_group,status,severity,message')
        .eq('instance_id', instanceId),
      supabase.from('platform_instance_launch_packages')
        .select('id,checklist,qa_notes,package_status')
        .eq('instance_id', instanceId).maybeSingle(),
    ]);

    const instData = instRes.data as Instance | null;
    setInst(instData);
    setHealthChecks((healthRes.data ?? []) as HealthCheck[]);

    let pkgData = pkgRes.data as LaunchPackage | null;
    if (!pkgData && instData) {
      // Auto-create if missing
      const { data: newPkg } = await supabase.from('platform_instance_launch_packages').insert({
        client_id: instData.client_id,
        instance_id: instanceId,
      }).select().maybeSingle();
      pkgData = newPkg as LaunchPackage | null;
    }
    setPkg(pkgData);

    if (instData) {
      const [clientRes, subRes, handoffRes] = await Promise.all([
        supabase.from('platform_clients').select('id,company_name,owner_name,owner_email,owner_phone').eq('id', instData.client_id).maybeSingle(),
        supabase.from('platform_client_subscriptions').select('status,plan_name').eq('client_id', instData.client_id).maybeSingle(),
        supabase.from('platform_client_handoffs').select('status,admin_invite_status,admin_invite_email,admin_temp_password,handoff_notes').eq('instance_id', instanceId).maybeSingle(),
      ]);
      setClient(clientRes.data as Client | null);
      setSub(subRes.data as Subscription | null);
      setHandoff(handoffRes.data as Handoff | null);
    }
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const criticalBlockers: string[] = [];
  const warnings: string[] = [];

  // Keys where passing one is sufficient (OR logic)
  const postCheckKey = 'create_booking_request_post_ok';
  const bookingFlowKey = 'client_booking_flow_verified';
  const postCheck = healthChecks.find(c => c.check_key === postCheckKey);
  const bookingFlow = healthChecks.find(c => c.check_key === bookingFlowKey);
  const postOrFlowPassing = postCheck?.status === 'passing' || bookingFlow?.status === 'passing';

  for (const c of healthChecks) {
    const isCriticalFail = c.status === 'failing' && c.severity === 'critical';
    const isWarnOrFail = c.status === 'failing' || c.status === 'warning';

    if (isCriticalFail) {
      // If this is the POST check but booking flow is passing, skip blocking
      if (c.check_key === postCheckKey && postOrFlowPassing) {
        warnings.push(`${c.check_label} — skipped (booking flow verified manually)`);
        continue;
      }
      criticalBlockers.push(`${c.check_label}${c.message ? `: ${c.message}` : ''}`);
    } else if (isWarnOrFail) {
      warnings.push(`${c.check_label}${c.message ? `: ${c.message}` : ''}`);
    }
  }
  if (!inst?.frontend_url) criticalBlockers.push('No frontend URL configured');
  if (!inst?.admin_url) criticalBlockers.push('No admin URL configured');
  if (['suspended', 'cancelled'].includes(inst?.access_status ?? '')) criticalBlockers.push(`Instance access is ${inst?.access_status}`);

  // Database isolation blockers (also enforced by health check, but show explicitly here)
  const MASTER_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const masterRef = MASTER_URL.replace('https://','').split('.')[0];
  const dbMatchesMaster =
    (inst?.supabase_project_url && inst.supabase_project_url === MASTER_URL) ||
    (inst?.supabase_project_ref && inst.supabase_project_ref === masterRef);
  const dbMissing = !inst?.supabase_project_url && !inst?.supabase_project_ref;
  // Only add direct blockers if not already captured by health check (avoid duplicate messages)
  const hasIsolationCheck = healthChecks.some(c => c.check_key === 'client_database_isolated');
  if (!hasIsolationCheck) {
    if (dbMissing) criticalBlockers.push('No client database configured — instance is sharing the master platform database');
    if (dbMatchesMaster) criticalBlockers.push('Client database matches master platform database — assign an isolated Supabase project before launch');
  }
  if (['past_due', 'cancelled', 'expired'].includes(inst?.last_billing_status ?? '')) warnings.push(`Billing status: ${inst?.last_billing_status}`);

  const handoffOk = ['ready_for_client', 'sent', 'accepted', 'completed'].includes(handoff?.status ?? '');
  if (!handoffOk) warnings.push(`Handoff status: ${handoff?.status ?? 'not started'}`);

  const checklist: ChecklistItem[] = Array.isArray(pkg?.checklist) ? pkg.checklist : [];
  const checklistDone = checklist.filter(i => i.done).length;

  const canMarkReady = criticalBlockers.length === 0 && pkg?.package_status === 'draft';
  const canMarkSent = pkg?.package_status === 'ready';
  const canMarkComplete = ['ready', 'sent'].includes(pkg?.package_status ?? '') &&
    ['ready_to_launch', 'launched'].includes(inst?.launch_readiness_status ?? '');

  // ── Actions ───────────────────────────────────────────────────────────────

  const runChecks = async () => {
    if (!instanceId) return;
    setRunningChecks(true);
    setCheckError(null);
    try {
      await callHealthChecks(instanceId);
      await reload();
    } catch (e) {
      setCheckError((e as Error).message);
    }
    setRunningChecks(false);
  };

  const toggleChecklistItem = async (key: string) => {
    if (!pkg) return;
    const updated = checklist.map(i => i.key === key ? { ...i, done: !i.done } : i);
    setPkg({ ...pkg, checklist: updated });
    await supabase.from('platform_instance_launch_packages').update({ checklist: updated }).eq('id', pkg.id);
  };

  const saveQaNotes = (notes: string) => {
    if (!pkg) return;
    setPkg({ ...pkg, qa_notes: notes });
    if (qaNotesDebounce) clearTimeout(qaNotesDebounce);
    const t = setTimeout(async () => {
      await supabase.from('platform_instance_launch_packages').update({ qa_notes: notes }).eq('id', pkg.id);
    }, 800);
    setQaNotesDebounce(t);
  };

  const setStatus = async (status: string) => {
    if (!pkg) return;
    setActionLoading(status);
    await supabase.from('platform_instance_launch_packages').update({ package_status: status }).eq('id', pkg.id);

    if (status === 'completed' && inst) {
      const { data: user } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      await supabase.from('platform_instances').update({
        launch_readiness_status: 'launched',
        launched_at: now,
        launched_by: user.user?.email ?? 'platform_admin',
      }).eq('id', inst.id);
    }

    await reload();
    setActionLoading(null);
  };

  const buildHandoffMessage = () => {
    const lines: string[] = [];
    lines.push(`Hi ${client?.owner_name ?? 'there'},`);
    lines.push('');
    lines.push(`Your ${inst?.property_name ?? inst?.instance_name ?? 'property'} site is ready!`);
    lines.push('');
    if (inst?.frontend_url) lines.push(`Guest site: ${inst.frontend_url}`);
    if (inst?.admin_url) lines.push(`Admin dashboard: ${inst.admin_url}`);
    if (handoff?.admin_invite_email) lines.push(`Admin login: ${handoff.admin_invite_email}`);
    lines.push('');
    lines.push('Next steps:');
    lines.push('1. Log in to your admin dashboard and review your property settings.');
    lines.push('2. Test a guest booking from your public site.');
    lines.push('3. Update your pricing and availability as needed.');
    if (handoff?.handoff_notes) {
      lines.push('');
      lines.push('Additional notes:');
      lines.push(handoff.handoff_notes);
    }
    lines.push('');
    lines.push('If you have any questions, reply to this message and we\'ll be happy to help.');
    return lines.join('\n');
  };

  const copyHandoffMessage = async () => {
    try {
      await navigator.clipboard.writeText(buildHandoffMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* noop */ }
  };

  const buildSupportSql = () => {
    const esc = (v: string) => v.replace(/'/g, "''");
    const emailVal = supportEmail.trim() ? `'${esc(supportEmail.trim())}'` : 'NULL';
    const phoneVal = supportPhone.trim() ? `'${esc(supportPhone.trim())}'` : 'NULL';
    const msgVal = supportMessage.trim() ? `'${esc(supportMessage.trim())}'` : 'NULL';
    const hoursVal = supportHours.trim() ? `'${esc(supportHours.trim())}'` : 'NULL';
    return [
      `-- Run this in the client Supabase SQL editor`,
      `UPDATE account_settings SET`,
      `  support_email   = ${emailVal},`,
      `  support_phone   = ${phoneVal},`,
      `  support_message = ${msgVal},`,
      `  support_hours   = ${hoursVal},`,
      `  support_enabled = ${supportEnabled}`,
      `WHERE property_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';`,
    ].join('\n');
  };

  const copySupportSql = async () => {
    try {
      await navigator.clipboard.writeText(buildSupportSql());
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch { /* noop */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!inst) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Instance not found.</p>
        <Link to="/platform/instances" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Back to Instances</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={`/platform/provisioning/${instanceId}/pack`} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Launch Package</h1>
          <p className="text-sm text-gray-500">{client?.company_name ?? '—'} · {inst.instance_name}</p>
        </div>
        <StatusBadge value={pkg?.package_status ?? 'draft'} map={PKG_CLS} />
      </div>

      {/* Action row */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={runChecks} disabled={runningChecks}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {runningChecks ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run Health Checks
        </button>
        <button onClick={copyHandoffMessage}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy Handoff Message'}
        </button>
        {canMarkReady && (
          <button onClick={() => setStatus('ready')} disabled={actionLoading === 'ready'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {actionLoading === 'ready' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
            Mark Package Ready
          </button>
        )}
        {canMarkSent && (
          <button onClick={() => setStatus('sent')} disabled={actionLoading === 'sent'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {actionLoading === 'sent' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
            Mark Package Sent
          </button>
        )}
        {canMarkComplete && (
          <button onClick={() => setStatus('completed')} disabled={actionLoading === 'completed'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {actionLoading === 'completed' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            Mark Final Launch Complete
          </button>
        )}
      </div>

      {checkError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{checkError}</p>}
      {criticalBlockers.length > 0 && !canMarkReady && pkg?.package_status === 'draft' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {criticalBlockers.length} critical blocker{criticalBlockers.length > 1 ? 's' : ''} must be resolved before marking package ready.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* A: Launch Summary */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" /> Launch Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
              <div><p className="text-gray-400 font-medium mb-0.5">Client</p><p className="text-gray-900">{client?.company_name ?? '—'}</p></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Instance</p><p className="text-gray-900">{inst.instance_name}</p></div>
              {inst.property_name && <div><p className="text-gray-400 font-medium mb-0.5">Property</p><p className="text-gray-900">{inst.property_name}</p></div>}
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Frontend URL</p>
                {inst.frontend_url
                  ? <a href={inst.frontend_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all">{inst.frontend_url}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a>
                  : <span className="text-red-500">Not set</span>}
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Admin URL</p>
                {inst.admin_url
                  ? <a href={inst.admin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all">{inst.admin_url}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a>
                  : <span className="text-red-500">Not set</span>}
              </div>
              <div><p className="text-gray-400 font-medium mb-0.5">Health</p><StatusBadge value={inst.health_status} map={HEALTH_CLS} /></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Readiness</p><StatusBadge value={inst.launch_readiness_status} map={READINESS_CLS} /></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Access</p><StatusBadge value={inst.access_status} map={ACCESS_CLS} /></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Billing</p><p className="text-gray-700 capitalize">{inst.last_billing_status?.replace('_', ' ') ?? '—'}</p></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Plan</p><p className="text-gray-700">{sub?.plan_name ?? '—'}</p></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Handoff</p><p className="text-gray-700 capitalize">{handoff?.status?.replace('_', ' ') ?? 'not started'}</p></div>
              <div><p className="text-gray-400 font-medium mb-0.5">Last Health Check</p><p className="text-gray-600">{fmtDate(inst.last_health_check_at)}</p></div>
              {inst.launched_at && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-gray-400 font-medium mb-0.5">Launched</p>
                  <p className="text-blue-700">{fmtDate(inst.launched_at)}{inst.launched_by ? ` by ${inst.launched_by}` : ''}</p>
                </div>
              )}
            </div>
          </section>

          {/* B: Critical Blockers */}
          <section className="bg-white rounded-xl border border-red-200 p-5">
            <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Critical Blockers ({criticalBlockers.length})
            </h2>
            {criticalBlockers.length === 0 ? (
              <p className="text-xs text-green-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> No critical blockers</p>
            ) : (
              <ul className="space-y-1.5">
                {criticalBlockers.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* C: Warnings */}
          <section className="bg-white rounded-xl border border-yellow-200 p-5">
            <h2 className="text-sm font-bold text-yellow-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Warnings ({warnings.length})
            </h2>
            {warnings.length === 0 ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5"><Minus className="w-3.5 h-3.5" /> No warnings</p>
            ) : (
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-yellow-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {w}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* D: Launch Checklist */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-600" /> Launch Checklist ({checklistDone}/{checklist.length})
            </h2>
            <div className="space-y-2">
              {checklist.map(item => {
                const isAdminItem = item.key.includes('admin') || item.label.toLowerCase().includes('admin login');
                return (
                  <label key={item.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.key)}
                      className="w-3.5 h-3.5 rounded text-blue-600 border-gray-300 focus:ring-blue-200" />
                    <span className={`text-xs flex-1 ${item.done ? 'line-through text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {item.label}
                    </span>
                    {isAdminItem && inst?.admin_url && (
                      <a href={inst.admin_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline flex-shrink-0 ml-2"
                        onClick={e => e.stopPropagation()}>
                        <ExternalLink className="w-3 h-3" /> Open Admin
                      </a>
                    )}
                  </label>
                );
              })}
            </div>
          </section>

          {/* E: Handoff Message */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Copy-ready Handoff Message</h2>
              <button onClick={copyHandoffMessage}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono border border-gray-100 max-h-64 overflow-y-auto leading-relaxed">
              {buildHandoffMessage()}
            </pre>
            <p className="text-xs text-gray-400 mt-2">No passwords or secrets are included in this message.</p>
          </section>

          {/* F: QA Notes */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Internal QA Notes</h2>
            <textarea
              value={pkg?.qa_notes ?? ''}
              onChange={e => saveQaNotes(e.target.value)}
              placeholder="Add internal QA notes, known issues, or launch observations…"
              rows={5}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-700 placeholder:text-gray-300"
            />
            <p className="text-xs text-gray-400 mt-1">Saves automatically.</p>
          </section>

          {/* G: Support Contact SQL */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Support Contact for Client</h2>
                <p className="text-xs text-gray-400 mt-0.5">Set the support info shown on the client admin Account page. Copy the SQL and run it in the client database.</p>
              </div>
              <button onClick={copySupportSql}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                {sqlCopied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                {sqlCopied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Support Email</label>
                <input type="email" value={supportEmail} onChange={e => setSupportEmailField(e.target.value)}
                  placeholder="support@yourdomain.com"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Support Phone (optional)</label>
                <input type="tel" value={supportPhone} onChange={e => setSupportPhoneField(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Support Message (optional)</label>
                <input type="text" value={supportMessage} onChange={e => setSupportMessageField(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Support Hours (optional)</label>
                <input type="text" value={supportHours} onChange={e => setSupportHoursField(e.target.value)}
                  placeholder="Mon–Fri, 9am–5pm CT"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="support-enabled" checked={supportEnabled} onChange={e => setSupportEnabledField(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 border-gray-300" />
                <label htmlFor="support-enabled" className="text-xs text-gray-700 cursor-pointer">Show Support section to client</label>
              </div>
            </div>
            <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono border border-gray-100 overflow-x-auto leading-relaxed">
              {buildSupportSql()}
            </pre>
          </section>
        </div>

        {/* Right column: Quick info */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-700 mb-2">Client</p>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-gray-400">Name: </span><span className="text-gray-800">{client?.owner_name ?? '—'}</span></div>
              <div><span className="text-gray-400">Email: </span><span className="text-gray-800">{client?.owner_email ?? '—'}</span></div>
              {client?.owner_phone && <div><span className="text-gray-400">Phone: </span><span className="text-gray-800">{client.owner_phone}</span></div>}
              {handoff?.admin_invite_email && <div><span className="text-gray-400">Admin login: </span><span className="text-gray-800">{handoff.admin_invite_email}</span></div>}
            </div>
          </div>

          {/* Health summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-700 mb-2">Health Summary</p>
            <div className="space-y-1.5 text-xs">
              {['Deployment','Database','App Setup','Business'].map(group => {
                const gc = healthChecks.filter(c => c.check_group === group);
                const gFail = gc.filter(c => c.status === 'failing').length;
                const gWarn = gc.filter(c => c.status === 'warning').length;
                const gPass = gc.filter(c => c.status === 'passing').length;
                return (
                  <div key={group} className="flex items-center justify-between">
                    <span className="text-gray-600">{group}</span>
                    <div className="flex items-center gap-2">
                      {gFail > 0 && <span className="text-red-600">{gFail}✗</span>}
                      {gWarn > 0 && <span className="text-yellow-600">{gWarn}△</span>}
                      <span className="text-green-600">{gPass}✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lifecycle */}
          {inst && <ClientLifecycleCard clientId={inst.client_id} />}

          {/* Domain */}
          {inst && <DomainReadinessCard clientId={inst.client_id} instanceId={inst.id} />}

          {/* Support */}
          {inst && <SupportTicketsCard clientId={inst.client_id} instanceId={instanceId} />}

          {/* Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1.5">
            <p className="text-xs font-bold text-gray-700 mb-2">Quick Links</p>
            <Link to={`/platform/clients/${inst.client_id}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> Client Detail
            </Link>
            <Link to={`/platform/provisioning/${instanceId}/pack`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> Deployment Pack
            </Link>
            <Link to="/platform/health" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <Activity className="w-3 h-3" /> Health Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
