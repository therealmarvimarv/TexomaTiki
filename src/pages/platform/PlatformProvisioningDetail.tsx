import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, ExternalLink, CheckCircle2,
  XCircle, Save, ChevronDown, ChevronUp, AlertTriangle, Shield, Package, Cpu, Play,
} from 'lucide-react';

interface ProvStep {
  id: string;
  instance_id: string;
  step_key: string;
  step_label: string;
  step_group: string;
  status: string;
  instructions: string | null;
  external_url: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
}

interface InstanceInfo {
  id: string;
  instance_name: string;
  property_name: string | null;
  provisioning_status: string;
  client_id: string;
  client_name: string;
}

interface ActiveJob {
  id: string;
  status: string;
}

const STATUS_OPTIONS = ['not_started', 'in_progress', 'completed', 'failed', 'skipped'];

const STEP_STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  in_progress:  'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  failed:       'bg-red-100 text-red-700',
  skipped:      'bg-gray-100 text-gray-400',
};

const PROV_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  pending:     'bg-yellow-100 text-yellow-800',
  deployed:    'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  suspended:   'bg-orange-100 text-orange-800',
};

function fmtDateTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface StepRowProps {
  step: ProvStep;
  adminEmail: string;
  onUpdate: (updated: ProvStep) => void;
}

function StepRow({ step, adminEmail, onUpdate }: StepRowProps) {
  const [status, setStatus] = useState(step.status);
  const [notes, setNotes] = useState(step.notes ?? '');
  const [externalUrl, setExternalUrl] = useState(step.external_url ?? '');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const doSave = async (overrideStatus?: string) => {
    setSaving(true);
    const finalStatus = overrideStatus ?? status;
    const payload = {
      status: finalStatus,
      notes: notes.trim() || null,
      external_url: externalUrl.trim() || null,
      completed_at: finalStatus === 'completed' ? new Date().toISOString() : (step.completed_at ?? null),
      completed_by: finalStatus === 'completed' ? adminEmail : (step.completed_by ?? null),
    };
    const { data, error } = await supabase
      .from('platform_provisioning_steps')
      .update(payload)
      .eq('id', step.id)
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) { console.error(error); return; }
    if (data) {
      setStatus(finalStatus);
      setDirty(false);
      onUpdate(data as ProvStep);
    }
  };

  const inputCls = 'w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';

  const rowBg = step.status === 'completed'
    ? 'bg-green-50/40'
    : step.status === 'failed'
    ? 'bg-red-50/40'
    : step.status === 'in_progress'
    ? 'bg-blue-50/30'
    : 'bg-white';

  const borderColor = step.status === 'failed'
    ? 'border-red-200'
    : step.status === 'completed'
    ? 'border-green-200'
    : 'border-gray-200';

  return (
    <div className={`border rounded-xl overflow-hidden ${borderColor}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.02] transition-colors ${rowBg}`}
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${STEP_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500'}`}>
          {status.replace('_', ' ')}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900">{step.step_label}</span>
        {step.completed_at && (
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">{fmtDateTime(step.completed_at)}</span>
        )}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-white">
          {step.instructions && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{step.instructions}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setDirty(true); }}
                className={inputCls}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">External URL</label>
              <input
                value={externalUrl}
                onChange={e => { setExternalUrl(e.target.value); setDirty(true); }}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setDirty(true); }}
              rows={2}
              className={inputCls}
              placeholder="Add notes — do not paste API keys or secrets here"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => doSave('completed')}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
              </button>
              <button
                onClick={() => doSave('failed')}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Mark Failed
              </button>
              {externalUrl.trim() && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              )}
            </div>
            {dirty && (
              <button
                onClick={() => doSave()}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            )}
          </div>
          {step.completed_by && (
            <p className="text-xs text-gray-400">Completed by {step.completed_by}{step.completed_at ? ` on ${fmtDateTime(step.completed_at)}` : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlatformProvisioningDetail() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [steps, setSteps] = useState<ProvStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [startingJob, setStartingJob] = useState(false);

  useEffect(() => {
    if (!instanceId) return;
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    Promise.all([
      supabase.from('platform_instances')
        .select('id, instance_name, property_name, provisioning_status, client_id')
        .eq('id', instanceId)
        .maybeSingle(),
      supabase.from('platform_provisioning_steps')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order'),
      supabase.from('platform_provisioning_jobs')
        .select('id,status')
        .eq('instance_id', instanceId)
        .not('status', 'in', '("succeeded","failed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(async ([ir, sr, jr]) => {
      const inst = ir.data as (InstanceInfo & { client_name: string }) | null;
      if (inst) {
        const { data: client } = await supabase
          .from('platform_clients')
          .select('owner_name, business_name')
          .eq('id', inst.client_id)
          .maybeSingle();
        inst.client_name = client
          ? client.owner_name + (client.business_name ? ` — ${client.business_name}` : '')
          : 'Unknown';
      }
      setInstance(inst);
      setSteps((sr.data as ProvStep[]) ?? []);
      setActiveJob(jr.data as ActiveJob ?? null);
      setLoading(false);
    });
  }, [instanceId]);

  const handleStartProvisioning = async () => {
    if (!instance || !instanceId) return;
    setStartingJob(true);
    const { data: tv } = await supabase
      .from('platform_template_versions')
      .select('version')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: job } = await supabase
      .from('platform_provisioning_jobs')
      .insert({
        instance_id: instanceId,
        client_id: instance.client_id,
        status: 'queued',
        job_type: 'new_instance',
        template_version: tv?.version ?? null,
        requested_by: adminEmail || null,
      })
      .select()
      .maybeSingle();

    if (job) {
      await supabase.from('platform_provisioning_job_events').insert({
        job_id: job.id,
        event_type: 'info',
        message: `Provisioning job created and queued by ${adminEmail || 'admin'}`,
      });
      await supabase.from('platform_instances')
        .update({ provisioning_status: 'pending' })
        .eq('id', instanceId);
      setActiveJob({ id: job.id, status: 'queued' });
      setInstance(prev => prev ? { ...prev, provisioning_status: 'pending' } : prev);
    }
    setStartingJob(false);
  };

  const handleStepUpdate = useCallback((updated: ProvStep) => {
    setSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
    supabase.from('platform_instances')
      .select('provisioning_status')
      .eq('id', instanceId!)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInstance(prev => prev ? { ...prev, provisioning_status: data.provisioning_status } : prev);
      });
  }, [instanceId]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!instance) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Instance not found.</p>
        <Link to="/platform/provisioning" className="text-sm text-gray-500 hover:text-gray-900 underline mt-2 inline-block">
          Back to provisioning
        </Link>
      </div>
    );
  }

  const totalCompleted = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const totalFailed = steps.filter(s => s.status === 'failed').length;
  const pct = steps.length > 0 ? Math.round((totalCompleted / steps.length) * 100) : 0;
  const groups = Array.from(new Set(steps.map(s => s.step_group)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/platform/provisioning" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{instance.instance_name}</h1>
          <p className="text-sm text-gray-500">{instance.client_name}</p>
        </div>
        <Link
          to={`/platform/provisioning/${instance.id}/pack`}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Package className="w-3.5 h-3.5" /> Deployment Pack
        </Link>
        {activeJob ? (
          <Link
            to={`/platform/provisioning/jobs/${activeJob.id}`}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" /> View Job ({activeJob.status})
          </Link>
        ) : (
          <button
            onClick={handleStartProvisioning}
            disabled={startingJob}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {startingJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start Provisioning
          </button>
        )}
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${PROV_STYLES[instance.provisioning_status] ?? 'bg-gray-100 text-gray-600'}`}>
          {instance.provisioning_status.replace('_', ' ')}
        </span>
      </div>

      {/* Progress summary */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">{totalCompleted} / {steps.length} steps complete</span>
          <span className="text-sm font-bold text-gray-900">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              totalFailed > 0 ? 'bg-red-400' : pct === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {totalFailed > 0 && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {totalFailed} step{totalFailed !== 1 ? 's' : ''} failed — review and resolve before launch.
          </p>
        )}
        {pct === 100 && totalFailed === 0 && (
          <p className="text-xs text-green-700 mt-2 font-medium">All steps complete — instance marked as deployed.</p>
        )}
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Security reminder:</strong> Do not paste secrets, API keys, or service role keys into step notes or URLs.
          Store secrets in Supabase Vault, Netlify environment variables, or your provider's secure dashboard.
        </p>
      </div>

      {/* Grouped checklist */}
      {groups.map(group => {
        const groupSteps = steps.filter(s => s.step_group === group);
        const groupCompleted = groupSteps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
        const groupFailed = groupSteps.filter(s => s.status === 'failed').length;
        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</h2>
              <div className="flex items-center gap-2">
                {groupFailed > 0 && (
                  <span className="text-xs text-red-500 font-medium">{groupFailed} failed</span>
                )}
                <span className="text-xs text-gray-400">{groupCompleted}/{groupSteps.length}</span>
              </div>
            </div>
            <div className="space-y-2">
              {groupSteps.map(step => (
                <StepRow key={step.id} step={step} adminEmail={adminEmail} onUpdate={handleStepUpdate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
