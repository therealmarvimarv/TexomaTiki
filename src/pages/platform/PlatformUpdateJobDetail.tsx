import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
  XCircle, Clock, SkipForward, RefreshCw,
} from 'lucide-react';

interface UpdateJob {
  id: string;
  target_version: string;
  status: string;
  scope: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

interface TargetRow {
  id: string;
  update_job_id: string;
  instance_id: string;
  status: string;
  from_version: string | null;
  to_version: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  // from instance
  instance_name: string;
  current_version: string | null;
  update_status: string;
}

const JOB_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  running:   'bg-blue-100 text-blue-800',
  succeeded: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
};

const TARGET_STYLES: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  succeeded:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  skipped:     'bg-gray-100 text-gray-400',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlatformUpdateJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<UpdateJob | null>(null);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    Promise.all([
      supabase.from('platform_update_jobs').select('*').eq('id', jobId).maybeSingle(),
      supabase.from('platform_update_job_targets').select('*').eq('update_job_id', jobId).order('created_at'),
    ]).then(async ([jr, tr]) => {
      setJob(jr.data as UpdateJob ?? null);
      const rawTargets = (tr.data ?? []) as Omit<TargetRow, 'instance_name' | 'current_version' | 'update_status'>[];
      if (rawTargets.length > 0) {
        const instanceIds = rawTargets.map(t => t.instance_id);
        const { data: instances } = await supabase
          .from('platform_instances')
          .select('id,instance_name,current_version,update_status')
          .in('id', instanceIds);
        const iMap: Record<string, { instance_name: string; current_version: string | null; update_status: string }> = {};
        for (const inst of instances ?? []) iMap[inst.id] = inst;
        setTargets(rawTargets.map(t => ({
          ...t,
          instance_name: iMap[t.instance_id]?.instance_name ?? 'Unknown',
          current_version: iMap[t.instance_id]?.current_version ?? null,
          update_status: iMap[t.instance_id]?.update_status ?? 'up_to_date',
        })));
      }
      setLoading(false);
    });
  }, [jobId]);

  const updateTarget = async (target: TargetRow, newStatus: string) => {
    setSaving(target.id);
    const now = new Date().toISOString();

    const targetPatch: Record<string, string | null> = { status: newStatus };
    if (newStatus === 'in_progress') targetPatch.started_at = now;
    if (['succeeded', 'failed', 'skipped'].includes(newStatus)) targetPatch.completed_at = now;

    await supabase.from('platform_update_job_targets').update(targetPatch).eq('id', target.id);

    // Update instance fields
    if (newStatus === 'succeeded') {
      await supabase.from('platform_instances').update({
        current_version: target.to_version,
        update_status: 'up_to_date',
        target_version: null,
        last_updated_at: now,
      }).eq('id', target.instance_id);
    } else if (newStatus === 'failed') {
      await supabase.from('platform_instances').update({ update_status: 'failed' }).eq('id', target.instance_id);
    } else if (newStatus === 'in_progress') {
      await supabase.from('platform_instances').update({ update_status: 'updating' }).eq('id', target.instance_id);
    }

    // Refresh targets
    const { data: allTargets } = await supabase
      .from('platform_update_job_targets').select('status').eq('update_job_id', jobId!);
    const updatedTargets = allTargets ?? [];
    const terminal = ['succeeded', 'skipped', 'failed'];
    const allDone = updatedTargets.every(t => terminal.includes(t.status));
    const allOk = updatedTargets.every(t => ['succeeded', 'skipped'].includes(t.status));

    if (allDone) {
      const finalStatus = allOk ? 'succeeded' : 'failed';
      const { data: updatedJob } = await supabase
        .from('platform_update_jobs')
        .update({ status: finalStatus, completed_at: now })
        .eq('id', jobId!)
        .select().maybeSingle();
      if (updatedJob) setJob(updatedJob as UpdateJob);
    }

    // Update local state
    setTargets(prev => prev.map(t => t.id === target.id ? {
      ...t,
      status: newStatus,
      started_at: newStatus === 'in_progress' ? now : t.started_at,
      completed_at: ['succeeded', 'failed', 'skipped'].includes(newStatus) ? now : t.completed_at,
      current_version: newStatus === 'succeeded' ? target.to_version : t.current_version,
      update_status: newStatus === 'succeeded' ? 'up_to_date' : newStatus === 'failed' ? 'failed' : newStatus === 'in_progress' ? 'updating' : t.update_status,
    } : t));
    setSaving(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Update job not found.</p>
        <Link to="/platform/updates" className="text-sm text-gray-500 hover:text-gray-900 underline mt-2 inline-block">Back to Updates</Link>
      </div>
    );
  }

  const done = targets.filter(t => ['succeeded', 'skipped', 'failed'].includes(t.status)).length;
  const succeeded = targets.filter(t => t.status === 'succeeded').length;
  const failed = targets.filter(t => t.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/platform/updates" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Update → v{job.target_version}</h1>
          <p className="text-sm text-gray-500">{job.scope.replace('_', ' ')} · Created {fmtDate(job.created_at)}</p>
        </div>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${JOB_STYLES[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {job.status}
        </span>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Manual tracking only.</strong> This does not deploy code automatically yet. Mark targets as you complete each instance manually.
        </p>
      </div>

      {/* Job summary */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-gray-900">{targets.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-700">{succeeded}</p>
            <p className="text-xs text-gray-500 mt-0.5">Succeeded</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-xs text-gray-500 mt-0.5">Failed</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-gray-700">{targets.length - done}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </div>
        </div>
        {targets.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{done} / {targets.length} complete</span>
              <span className="text-xs font-semibold text-gray-700">{Math.round((done / targets.length) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${failed > 0 ? 'bg-red-400' : done === targets.length ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.round((done / targets.length) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {job.notes && <p className="text-sm text-gray-600 pt-2 border-t">{job.notes}</p>}
        {job.completed_at && <p className="text-xs text-gray-400">Completed {fmtDate(job.completed_at)}</p>}
      </div>

      {/* Target instances */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Target Instances</h2>
        {targets.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">No targets found for this job.</div>
        ) : (
          <div className="space-y-2">
            {targets.map(target => (
              <div
                key={target.id}
                className={`bg-white rounded-2xl border p-4 ${target.status === 'failed' ? 'border-red-200' : target.status === 'succeeded' ? 'border-green-200' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/platform/provisioning/${target.instance_id}`} className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {target.instance_name}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TARGET_STYLES[target.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {target.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>
                        {target.from_version ? `v${target.from_version}` : 'unknown'}
                        {' → '}
                        <strong className="text-gray-700">v{target.to_version}</strong>
                      </span>
                      {target.current_version && target.status === 'succeeded' && (
                        <span className="text-green-600">Now at v{target.current_version}</span>
                      )}
                    </div>
                    {target.started_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Started {fmtDate(target.started_at)}
                        {target.completed_at ? ` · Done ${fmtDate(target.completed_at)}` : ''}
                      </p>
                    )}
                  </div>

                  {!['succeeded', 'skipped'].includes(target.status) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      {target.status === 'pending' && (
                        <button
                          onClick={() => updateTarget(target, 'in_progress')}
                          disabled={saving === target.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                        >
                          {saving === target.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} In Progress
                        </button>
                      )}
                      <button
                        onClick={() => updateTarget(target, 'succeeded')}
                        disabled={saving === target.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === target.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Succeeded
                      </button>
                      <button
                        onClick={() => updateTarget(target, 'failed')}
                        disabled={saving === target.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === target.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Failed
                      </button>
                      <button
                        onClick={() => updateTarget(target, 'skipped')}
                        disabled={saving === target.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {saving === target.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />} Skip
                      </button>
                    </div>
                  )}

                  {target.status === 'succeeded' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  {target.status === 'skipped' && (
                    <Clock className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
