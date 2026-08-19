import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldX, Loader2,
  Check, AlertTriangle, Clock, RefreshCw, Ban,
} from 'lucide-react';

interface InstanceAccess {
  id: string;
  access_status: string;
  access_reason: string | null;
  access_updated_at: string | null;
  access_updated_by: string | null;
  billing_enforcement_mode: string;
  last_billing_status: string | null;
  billing_status_synced_at: string | null;
  client_id: string;
}

interface AccessEvent {
  id: string;
  event_type: string;
  previous_access_status: string | null;
  new_access_status: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

interface InstanceAccessStatusCardProps {
  instanceId: string;
  /** Optional: subscription_id used when logging events */
  subscriptionId?: string | null;
}

const ACCESS_CONFIG: Record<string, { label: string; cls: string; bg: string; icon: React.ReactNode }> = {
  active:     { label: 'Active',      cls: 'text-green-700',  bg: 'bg-green-100',  icon: <ShieldCheck className="w-4 h-4" /> },
  warning:    { label: 'Warning',     cls: 'text-yellow-700', bg: 'bg-yellow-100', icon: <ShieldAlert className="w-4 h-4" /> },
  restricted: { label: 'Restricted',  cls: 'text-orange-700', bg: 'bg-orange-100', icon: <ShieldOff className="w-4 h-4" /> },
  suspended:  { label: 'Suspended',   cls: 'text-red-700',    bg: 'bg-red-100',    icon: <Ban className="w-4 h-4" /> },
  cancelled:  { label: 'Cancelled',   cls: 'text-gray-500',   bg: 'bg-gray-100',   icon: <ShieldX className="w-4 h-4" /> },
};

const ENFORCEMENT_OPTIONS = [
  { value: 'manual',                 label: 'Manual only' },
  { value: 'automatic_warning_only', label: 'Auto warning' },
  { value: 'automatic_restrict',     label: 'Auto restrict on past_due' },
  { value: 'automatic_suspend',      label: 'Auto suspend on cancelled' },
];

const ACTION_BUTTONS: { action: string; status: string; label: string; cls: string; eventType: string }[] = [
  { action: 'restore',    status: 'active',     label: 'Mark Active',     cls: 'bg-green-600 hover:bg-green-700 text-white',   eventType: 'restored' },
  { action: 'warn',       status: 'warning',    label: 'Mark Warning',    cls: 'bg-yellow-500 hover:bg-yellow-600 text-white',  eventType: 'billing_warning' },
  { action: 'restrict',   status: 'restricted', label: 'Mark Restricted', cls: 'bg-orange-500 hover:bg-orange-600 text-white',  eventType: 'restricted' },
  { action: 'suspend',    status: 'suspended',  label: 'Mark Suspended',  cls: 'bg-red-600 hover:bg-red-700 text-white',        eventType: 'suspended' },
  { action: 'cancel',     status: 'cancelled',  label: 'Mark Cancelled',  cls: 'bg-gray-600 hover:bg-gray-700 text-white',      eventType: 'cancelled' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function InstanceAccessStatusCard({ instanceId, subscriptionId }: InstanceAccessStatusCardProps) {
  const [inst, setInst] = useState<InstanceAccess | null>(null);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [enforceMode, setEnforceMode] = useState('manual');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [instRes, evRes] = await Promise.all([
      supabase.from('platform_instances').select(
        'id,access_status,access_reason,access_updated_at,access_updated_by,billing_enforcement_mode,last_billing_status,billing_status_synced_at,client_id'
      ).eq('id', instanceId).maybeSingle(),
      supabase.from('platform_instance_access_events')
        .select('id,event_type,previous_access_status,new_access_status,reason,created_by,created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (instRes.data) {
      setInst(instRes.data as InstanceAccess);
      setEnforceMode((instRes.data as InstanceAccess).billing_enforcement_mode ?? 'manual');
    }
    setEvents((evRes.data ?? []) as AccessEvent[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [instanceId]);

  const applyAction = async (btn: typeof ACTION_BUTTONS[0]) => {
    if (!inst) return;
    if (btn.status === inst.access_status) return;
    setActioning(btn.action);
    setError(null);

    const { data: user } = await supabase.auth.getUser();
    const actorEmail = user.user?.email ?? 'platform_admin';
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase.from('platform_instances').update({
      access_status: btn.status,
      access_reason: reason || null,
      access_updated_at: now,
      access_updated_by: actorEmail,
    }).eq('id', instanceId);

    if (updateErr) { setError(updateErr.message); setActioning(null); return; }

    await supabase.from('platform_instance_access_events').insert({
      client_id: inst.client_id,
      instance_id: instanceId,
      subscription_id: subscriptionId ?? null,
      event_type: btn.eventType,
      previous_access_status: inst.access_status,
      new_access_status: btn.status,
      reason: reason || null,
      created_by: actorEmail,
    });

    await reload();
    setReason('');
    setActioning(null);
  };

  const saveMode = async () => {
    if (!inst) return;
    setSaving(true);
    await supabase.from('platform_instances').update({ billing_enforcement_mode: enforceMode }).eq('id', instanceId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    await reload();
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      <span className="text-xs text-gray-400">Loading access status…</span>
    </div>
  );

  if (!inst) return null;

  const cfg = ACCESS_CONFIG[inst.access_status] ?? ACCESS_CONFIG.active;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
            <span className={cfg.cls}>{cfg.icon}</span>
          </div>
          <p className="text-sm font-bold text-gray-900">Instance Access</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.cls}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Last Billing Status</p>
          <p className="text-gray-800 capitalize">{inst.last_billing_status?.replace('_', ' ') ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Billing Synced</p>
          <p className="text-gray-600">{fmtDate(inst.billing_status_synced_at)}</p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Access Updated</p>
          <p className="text-gray-600">{fmtDate(inst.access_updated_at)}</p>
        </div>
        {inst.access_reason && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-gray-400 font-medium mb-0.5">Reason</p>
            <p className="text-gray-700">{inst.access_reason}</p>
          </div>
        )}
        {inst.access_updated_by && (
          <div>
            <p className="text-gray-400 font-medium mb-0.5">Updated By</p>
            <p className="text-gray-600">{inst.access_updated_by}</p>
          </div>
        )}
      </div>

      {/* Enforcement mode */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-semibold text-gray-500 flex-shrink-0">Enforcement Mode</label>
        <select value={enforceMode} onChange={e => setEnforceMode(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 flex-1 max-w-xs">
          {ENFORCEMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={saveMode} disabled={saving}
          className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3 text-green-600" /> : <RefreshCw className="w-3 h-3" />}
          {saved ? 'Saved' : 'Save Mode'}
        </button>
      </div>

      {/* Reason input */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Note / Reason (optional)</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Contacted client about payment"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {ACTION_BUTTONS.filter(b => b.status !== inst.access_status).map(btn => (
          <button key={btn.action} onClick={() => applyAction(btn)} disabled={!!actioning}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors ${btn.cls}`}>
            {actioning === btn.action ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {btn.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}

      {/* Event history */}
      {events.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500">Access Event History</p>
          <div className="space-y-1">
            {events.map(ev => {
              const evCfg = ACCESS_CONFIG[ev.new_access_status] ?? ACCESS_CONFIG.active;
              return (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${evCfg.bg.replace('bg-', 'bg-')}`}
                    style={{ background: ev.new_access_status === 'active' ? '#16a34a' : ev.new_access_status === 'warning' ? '#ca8a04' : ev.new_access_status === 'suspended' ? '#dc2626' : '#9ca3af' }} />
                  <span className="text-gray-500 flex-shrink-0 w-24">{ev.event_type.replace('_', ' ')}</span>
                  {ev.previous_access_status && (
                    <span className="text-gray-400">{ev.previous_access_status} → {ev.new_access_status}</span>
                  )}
                  {ev.reason && <span className="text-gray-500 flex-1 truncate">{ev.reason}</span>}
                  <span className="text-gray-300 flex-shrink-0 ml-auto">
                    {new Date(ev.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
