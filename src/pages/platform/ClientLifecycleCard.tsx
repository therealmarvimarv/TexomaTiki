import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  GitBranch, Loader2, ChevronDown, Check, AlertTriangle, RefreshCw,
} from 'lucide-react';
import {
  LIFECYCLE_STAGES, STAGE_LABELS, STAGE_COLORS, STATUS_COLORS,
  LifecycleStage, LifecycleStatus, LifecycleRecommendation,
} from './lifecycleLogic';

interface LifecycleRow {
  id: string;
  lifecycle_stage: string;
  lifecycle_status: string;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface LifecycleEvent {
  id: string;
  previous_stage: string | null;
  new_stage: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  clientId: string;
  recommendation?: LifecycleRecommendation | null;
  showHistory?: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200';

export function ClientLifecycleCard({ clientId, recommendation, showHistory = false }: Props) {
  const [row, setRow] = useState<LifecycleRow | null>(null);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const load = useCallback(async () => {
    const [rowRes, evRes] = await Promise.all([
      supabase.from('platform_client_lifecycle').select('*').eq('client_id', clientId).maybeSingle(),
      showHistory
        ? supabase.from('platform_client_lifecycle_events').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
    ]);
    const r = rowRes.data as LifecycleRow | null;
    setRow(r);
    setStage(r?.lifecycle_stage ?? 'onboarding');
    setStatus(r?.lifecycle_status ?? 'on_track');
    setReason(r?.reason ?? '');
    setEvents((evRes.data ?? []) as LifecycleEvent[]);
    setLoading(false);
  }, [clientId, showHistory]);

  useEffect(() => { load(); }, [load]);

  const getActor = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? 'platform_admin';
  };

  const save = async (overrideStage?: string, overrideStatus?: string, overrideReason?: string) => {
    setSaving(true);
    const actor = await getActor();
    const newStage = overrideStage ?? stage;
    const newStatus = overrideStatus ?? status;
    const newReason = overrideReason ?? reason;

    if (row) {
      await supabase.from('platform_client_lifecycle').update({
        lifecycle_stage: newStage,
        lifecycle_status: newStatus,
        reason: newReason || null,
        updated_by: actor,
      }).eq('client_id', clientId);
    } else {
      await supabase.from('platform_client_lifecycle').insert({
        client_id: clientId,
        lifecycle_stage: newStage,
        lifecycle_status: newStatus,
        reason: newReason || null,
        updated_by: actor,
      });
    }

    if (newStage !== row?.lifecycle_stage || newStatus !== row?.lifecycle_status) {
      await supabase.from('platform_client_lifecycle_events').insert({
        client_id: clientId,
        previous_stage: row?.lifecycle_stage ?? null,
        new_stage: newStage,
        previous_status: row?.lifecycle_status ?? null,
        new_status: newStatus,
        reason: newReason || null,
        created_by: actor,
      });
    }

    setSaving(false);
    setShowEdit(false);
    await load();
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    save(recommendation.stage, recommendation.status, recommendation.reason);
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex justify-center py-6">
      <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
    </div>
  );

  const stageCfg = STAGE_COLORS[row?.lifecycle_stage ?? 'onboarding'] ?? STAGE_COLORS.onboarding;
  const statusCfg = STATUS_COLORS[row?.lifecycle_status ?? 'on_track'] ?? STATUS_COLORS.on_track;
  const recDiffers = recommendation && (recommendation.stage !== row?.lifecycle_stage || recommendation.status !== row?.lifecycle_status);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-bold text-gray-900">Lifecycle</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => load()} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowEdit(e => !e)}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <ChevronDown className={`w-3 h-3 transition-transform ${showEdit ? 'rotate-180' : ''}`} /> Edit
          </button>
        </div>
      </div>

      {/* Current state */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${stageCfg.bg} ${stageCfg.text}`}>
          {STAGE_LABELS[row?.lifecycle_stage ?? 'onboarding'] ?? row?.lifecycle_stage}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.text}`}>
          {(row?.lifecycle_status ?? 'on_track').replace(/_/g, ' ')}
        </span>
      </div>

      {row?.reason && <p className="text-xs text-gray-500 mb-1 italic">{row.reason}</p>}
      {row?.updated_at && (
        <p className="text-xs text-gray-300 mb-2">Updated {fmtDate(row.updated_at)}{row.updated_by ? ` by ${row.updated_by}` : ''}</p>
      )}

      {/* Recommendation banner */}
      {recDiffers && recommendation && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-800 font-medium">
              Recommended: <span className="font-semibold">{STAGE_LABELS[recommendation.stage]}</span> / {recommendation.status.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">{recommendation.reason}</p>
          </div>
          <button onClick={applyRecommendation} disabled={saving}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Apply
          </button>
        </div>
      )}

      {/* Edit panel */}
      {showEdit && (
        <div className="space-y-2.5 border-t border-gray-100 pt-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Stage</p>
              <select value={stage} onChange={e => setStage(e.target.value)} className={inputCls}>
                {LIFECYCLE_STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Status</p>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                {(['on_track','needs_attention','blocked','completed'] as LifecycleStatus[]).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Reason / Note</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Optional reason for this stage…"
              className={`${inputCls} resize-y`} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => save()} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button onClick={() => save('active', 'on_track', 'Marked active')} disabled={saving}
              className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              Mark Active
            </button>
            <button onClick={() => save('cancelled', 'blocked', 'Marked cancelled')} disabled={saving}
              className="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => save('archived', 'completed', 'Archived')} disabled={saving}
              className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Archive
            </button>
          </div>
        </div>
      )}

      {/* History toggle */}
      {showHistory && events.length > 0 && (
        <div className="border-t border-gray-100 mt-3 pt-2">
          <button onClick={() => setShowEvents(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {showEvents ? 'Hide' : 'Show'} history ({events.length})
          </button>
          {showEvents && (
            <div className="mt-2 space-y-1.5">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-300 flex-shrink-0 mt-0.5">{fmtDate(ev.created_at)}</span>
                  <span className="text-gray-700 flex-1">
                    {ev.previous_stage ? `${STAGE_LABELS[ev.previous_stage] ?? ev.previous_stage} → ` : ''}{STAGE_LABELS[ev.new_stage] ?? ev.new_stage}
                    {ev.reason ? <span className="text-gray-400"> — {ev.reason}</span> : null}
                  </span>
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
