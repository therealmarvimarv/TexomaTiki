import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, Minus,
  Loader2, ChevronDown, ChevronUp, RefreshCw, Rocket, Flag,
  ExternalLink, Check, ShieldCheck,
} from 'lucide-react';

interface HealthCheck {
  id: string;
  check_key: string;
  check_label: string;
  check_group: string;
  status: string;
  severity: string;
  message: string | null;
  last_checked_at: string | null;
  checked_by: string | null;
  external_url: string | null;
}

interface InstanceInfo {
  id: string;
  health_status: string;
  launch_readiness_status: string;
  last_health_check_at: string | null;
  launched_at: string | null;
  launched_by: string | null;
}

interface InstanceHealthChecksCardProps {
  instanceId: string;
}

const STATUS_CFG: Record<string, { cls: string; icon: React.ReactNode }> = {
  passing:     { cls: 'text-green-600',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  warning:     { cls: 'text-yellow-600', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  failing:     { cls: 'text-red-600',    icon: <XCircle className="w-3.5 h-3.5" /> },
  not_checked: { cls: 'text-gray-400',   icon: <Minus className="w-3.5 h-3.5" /> },
  skipped:     { cls: 'text-gray-300',   icon: <Minus className="w-3.5 h-3.5" /> },
};

const SEVERITY_CFG: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-yellow-100 text-yellow-700',
  info:     'bg-gray-100 text-gray-500',
};

const HEALTH_CFG: Record<string, { cls: string; label: string }> = {
  unknown:  { cls: 'bg-gray-100 text-gray-500',   label: 'Unknown' },
  healthy:  { cls: 'bg-green-100 text-green-700',  label: 'Healthy' },
  warning:  { cls: 'bg-yellow-100 text-yellow-700',label: 'Warning' },
  failing:  { cls: 'bg-red-100 text-red-700',      label: 'Failing' },
};

const READINESS_CFG: Record<string, { cls: string; label: string }> = {
  not_ready:       { cls: 'bg-red-100 text-red-700',       label: 'Not Ready' },
  needs_review:    { cls: 'bg-yellow-100 text-yellow-700', label: 'Needs Review' },
  ready_to_launch: { cls: 'bg-green-100 text-green-700',   label: 'Ready to Launch' },
  launched:        { cls: 'bg-blue-100 text-blue-700',     label: 'Launched' },
};

const STATUS_OPTS = ['not_checked','passing','warning','failing','skipped'];
const GROUPS = ['Deployment','Database','App Setup','Business'];

// Provisioning checks that can be quick-confirmed via one-click button
const PROVISIONING_MANUAL_CHECKS: { key: string; label: string; description: string; severity: 'critical' | 'warning' }[] = [
  { key: 'client_database_bootstrapped',          label: 'Bootstrap SQL Applied',          description: 'client_database_bootstrap.sql was run in the client Supabase project with no errors', severity: 'critical' },
  { key: 'client_transaction_tables_empty',        label: 'Transaction Tables Empty',        description: 'bookings, inquiries, payment_events, notification_logs all empty at launch', severity: 'warning' },
  { key: 'client_auth_urls_configured',           label: 'Auth URLs Configured',            description: 'Supabase Auth Site URL and Redirect URLs set for the client project', severity: 'warning' },
  { key: 'client_admin_login_verified',           label: 'Client Admin Login Verified',     description: 'Client admin user created in Auth and /admin login confirmed on the deployed site', severity: 'critical' },
  { key: 'client_storage_ready',                  label: 'Storage Bucket Ready',            description: 'property-photos storage bucket exists in the client Supabase project', severity: 'warning' },
  { key: 'client_booking_flow_verified',          label: 'Live Booking Flow Verified',      description: 'End-to-end booking submission confirmed on the live client site', severity: 'critical' },
  { key: 'master_admin_unaffected_verified',      label: 'Master Admin Unaffected',         description: 'Test booking does NOT appear in the master platform admin — database isolation confirmed', severity: 'critical' },
  { key: 'provider_secrets_configured_if_enabled', label: 'Email/Stripe Secrets Configured', description: 'Client SMTP/Resend and Stripe secrets are configured if email/payments are enabled', severity: 'warning' },
];

async function callEdge(instanceId: string) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-run-instance-health-checks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instance_id: instanceId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Health check failed');
  return json;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function InstanceHealthChecksCard({ instanceId }: InstanceHealthChecksCardProps) {
  const [inst, setInst] = useState<InstanceInfo | null>(null);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMsg, setEditMsg] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingLaunched, setMarkingLaunched] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [instRes, checksRes] = await Promise.all([
      supabase.from('platform_instances')
        .select('id,health_status,launch_readiness_status,last_health_check_at,launched_at,launched_by')
        .eq('id', instanceId).maybeSingle(),
      supabase.from('platform_instance_health_checks')
        .select('*').eq('instance_id', instanceId).order('check_group').order('check_key'),
    ]);
    if (instRes.data) setInst(instRes.data as InstanceInfo);
    setChecks((checksRes.data ?? []) as HealthCheck[]);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { reload(); }, [reload]);

  const runChecks = async () => {
    setRunning(true);
    setRunError(null);
    try {
      await callEdge(instanceId);
      await reload();
    } catch (e) {
      setRunError((e as Error).message);
    }
    setRunning(false);
  };

  const startEdit = (c: HealthCheck) => {
    setEditingId(c.id);
    setEditStatus(c.status);
    setEditMsg(c.message ?? '');
    setEditUrl(c.external_url ?? '');
  };

  const saveEdit = async (check: HealthCheck) => {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('platform_instance_health_checks').update({
      status: editStatus,
      message: editMsg || null,
      external_url: editUrl || null,
      last_checked_at: new Date().toISOString(),
      checked_by: user.user?.email ?? 'platform_admin',
    }).eq('id', check.id);

    // Recalculate health_status on instance
    const { data: allChecks } = await supabase.from('platform_instance_health_checks')
      .select('status,severity').eq('instance_id', instanceId);
    const arr = (allChecks ?? []) as { status: string; severity: string }[];
    const hasCritFail = arr.some(c => c.severity === 'critical' && c.status === 'failing');
    const hasFail = arr.some(c => c.status === 'failing');
    const hasWarn = arr.some(c => c.status === 'warning');
    const healthStatus = hasCritFail || hasFail ? 'failing' : hasWarn ? 'warning' : 'healthy';
    const readiness = inst?.launch_readiness_status === 'launched' ? 'launched' :
      hasCritFail ? 'not_ready' : hasWarn ? 'needs_review' : 'ready_to_launch';
    await supabase.from('platform_instances').update({
      health_status: healthStatus,
      launch_readiness_status: readiness,
    }).eq('id', instanceId);

    setEditingId(null);
    setSaving(false);
    await reload();
  };

  const quickConfirm = async (key: string) => {
    setConfirmingKey(key);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('platform_instance_health_checks').update({
      status: 'passing',
      message: `Manually confirmed by ${user.user?.email ?? 'platform_admin'}`,
      last_checked_at: new Date().toISOString(),
      checked_by: user.user?.email ?? 'platform_admin',
    }).eq('instance_id', instanceId).eq('check_key', key);

    // Recalculate health status
    const { data: allChecks } = await supabase.from('platform_instance_health_checks')
      .select('status,severity').eq('instance_id', instanceId);
    const arr = (allChecks ?? []) as { status: string; severity: string }[];
    const hasCritFail = arr.some(c => c.severity === 'critical' && c.status === 'failing');
    const hasFail = arr.some(c => c.status === 'failing');
    const hasWarn = arr.some(c => c.status === 'warning');
    const healthStatus = hasCritFail || hasFail ? 'failing' : hasWarn ? 'warning' : 'healthy';
    const readiness = inst?.launch_readiness_status === 'launched' ? 'launched' :
      hasCritFail ? 'not_ready' : hasWarn ? 'needs_review' : 'ready_to_launch';
    await supabase.from('platform_instances').update({
      health_status: healthStatus,
      launch_readiness_status: readiness,
    }).eq('id', instanceId);

    setConfirmingKey(null);
    await reload();
  };

  const markReadyToLaunch = async () => {
    if (!inst) return;
    if (inst.launch_readiness_status === 'not_ready') return;
    setMarkingReady(true);
    await supabase.from('platform_instances').update({ launch_readiness_status: 'ready_to_launch' }).eq('id', instanceId);
    await reload();
    setMarkingReady(false);
  };

  const markLaunched = async () => {
    if (!inst || inst.launch_readiness_status !== 'ready_to_launch') return;
    setMarkingLaunched(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('platform_instances').update({
      launch_readiness_status: 'launched',
      launched_at: new Date().toISOString(),
      launched_by: user.user?.email ?? 'platform_admin',
    }).eq('id', instanceId);
    await reload();
    setMarkingLaunched(false);
  };

  const toggleGroup = (g: string) =>
    setCollapsedGroups(s => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      <span className="text-xs text-gray-400">Loading health checks…</span>
    </div>
  );

  const grouped = GROUPS.reduce<Record<string, HealthCheck[]>>((acc, g) => {
    acc[g] = checks.filter(c => c.check_group === g);
    return acc;
  }, {});
  const knownGroups = new Set(GROUPS);
  const extra = checks.filter(c => !knownGroups.has(c.check_group));
  if (extra.length) grouped['Other'] = extra;

  const criticalFailing = checks.filter(c => c.severity === 'critical' && c.status === 'failing').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const passing = checks.filter(c => c.status === 'passing').length;

  const hCfg = HEALTH_CFG[inst?.health_status ?? 'unknown'];
  const rCfg = READINESS_CFG[inst?.launch_readiness_status ?? 'not_ready'];
  const canMarkReady = inst && ['needs_review', 'ready_to_launch'].includes(inst.launch_readiness_status) && criticalFailing === 0;
  const canMarkLaunched = inst?.launch_readiness_status === 'ready_to_launch';

  // Build a map for provisioning checks so we can show current status
  const checkMap = new Map(checks.map(c => [c.check_key, c]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-sm font-bold text-gray-900">Health & Launch Readiness</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${hCfg.cls}`}>{hCfg.label}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${rCfg.cls}`}>{rCfg.label}</span>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />{passing} passing</span>
        <span className="flex items-center gap-1 text-yellow-600"><AlertTriangle className="w-3.5 h-3.5" />{warnings} warnings</span>
        <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3.5 h-3.5" />{criticalFailing} critical failures</span>
        {inst?.last_health_check_at && (
          <span className="ml-auto text-gray-400">Checked {fmtDate(inst.last_health_check_at)}</span>
        )}
      </div>

      {inst?.launched_at && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          <Rocket className="w-3.5 h-3.5" />
          <span>Launched {fmtDate(inst.launched_at)}{inst.launched_by ? ` by ${inst.launched_by}` : ''}</span>
        </div>
      )}

      {runError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{runError}</p>}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={runChecks} disabled={running}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run Automated Checks
        </button>
        {canMarkReady && inst?.launch_readiness_status !== 'launched' && (
          <button onClick={markReadyToLaunch} disabled={markingReady}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {markingReady ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
            Mark Ready to Launch
          </button>
        )}
        {canMarkLaunched && (
          <button onClick={markLaunched} disabled={markingLaunched}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {markingLaunched ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            Mark Launched
          </button>
        )}
        {criticalFailing > 0 && (
          <p className="text-xs text-red-600 self-center">{criticalFailing} critical failure{criticalFailing > 1 ? 's' : ''} — resolve before launch</p>
        )}
      </div>

      {/* ── Client Backend Provisioning section ───────────────────────────── */}
      <div className="border border-blue-100 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-800">Client Backend Provisioning</span>
          <span className="text-xs text-blue-500 ml-1">— manually confirm each step</span>
        </div>
        <div className="divide-y divide-blue-50">
          {PROVISIONING_MANUAL_CHECKS.map(({ key, label, description, severity }) => {
            const check = checkMap.get(key);
            const status = check?.status ?? 'not_checked';
            const isPassing = status === 'passing';
            const isFailing = status === 'failing';
            const isConfirming = confirmingKey === key;
            const sCfg = STATUS_CFG[status] ?? STATUS_CFG.not_checked;
            return (
              <div key={key} className="px-3 py-2.5 flex items-center gap-3">
                <span className={`flex-shrink-0 ${sCfg.cls}`}>{sCfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium ${isFailing ? 'text-red-700' : isPassing ? 'text-gray-800' : 'text-gray-700'}`}>
                      {label}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_CFG[severity]}`}>{severity}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
                  {check?.message && !check.message.startsWith('Manually confirm') && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{check.message}</p>
                  )}
                  {check?.last_checked_at && isPassing && (
                    <p className="text-xs text-gray-300 mt-0.5">{fmtDate(check.last_checked_at)}{check.checked_by ? ` · ${check.checked_by}` : ''}</p>
                  )}
                </div>
                {isPassing ? (
                  <span className="flex-shrink-0 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                ) : (
                  <button
                    onClick={() => quickConfirm(key)}
                    disabled={isConfirming}
                    className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-green-50 hover:border-green-300 hover:text-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isConfirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Confirm
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Standard grouped checks ────────────────────────────────────────── */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([group, groupChecks]) => {
          if (groupChecks.length === 0) return null;
          const collapsed = collapsedGroups.has(group);
          const groupFailing = groupChecks.filter(c => c.status === 'failing').length;
          const groupWarning = groupChecks.filter(c => c.status === 'warning').length;
          const groupPassing = groupChecks.filter(c => c.status === 'passing').length;
          return (
            <div key={group} className="border border-gray-100 rounded-lg overflow-hidden">
              <button onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">{group}</span>
                  <span className="text-xs text-gray-400">{groupPassing}/{groupChecks.length}</span>
                  {groupFailing > 0 && <span className="text-xs text-red-600">{groupFailing} fail</span>}
                  {groupWarning > 0 && <span className="text-xs text-yellow-600">{groupWarning} warn</span>}
                </div>
                {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {!collapsed && (
                <div className="divide-y divide-gray-50">
                  {groupChecks.map(c => {
                    const sCfg = STATUS_CFG[c.status] ?? STATUS_CFG.not_checked;
                    const sevCls = SEVERITY_CFG[c.severity] ?? SEVERITY_CFG.info;
                    const isEditing = editingId === c.id;
                    return (
                      <div key={c.id} className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 flex-shrink-0 ${sCfg.cls}`}>{sCfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-800">{c.check_label}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sevCls}`}>{c.severity}</span>
                              {c.external_url && (
                                <a href={c.external_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {c.message && <p className="text-xs text-gray-500 mt-0.5">{c.message}</p>}
                            {c.last_checked_at && (
                              <p className="text-xs text-gray-300 mt-0.5">{fmtDate(c.last_checked_at)}</p>
                            )}
                            {isEditing && (
                              <div className="mt-2 space-y-1.5">
                                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200">
                                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input type="text" value={editMsg} onChange={e => setEditMsg(e.target.value)}
                                  placeholder="Note / message"
                                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200" />
                                <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                                  placeholder="External URL (optional)"
                                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200" />
                                <div className="flex gap-1.5">
                                  <button onClick={() => saveEdit(c)} disabled={saving}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    Save
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {!isEditing && (
                            <button onClick={() => startEdit(c)}
                              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors">
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
