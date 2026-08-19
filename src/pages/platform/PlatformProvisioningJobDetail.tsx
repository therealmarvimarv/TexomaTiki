import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
  XCircle, Clock, RefreshCw, Info, Zap, Ban,
} from 'lucide-react';
import { ProvisioningActions, ProviderStatus } from './ProvisioningActions';
import { SetupTasksSection } from './SetupTasksSection';
import { NetlifyActionCard } from './NetlifyActionCard';
import { SourceTemplateActionCard } from './SourceTemplateActionCard';
import { NetlifyDeployActionCard } from './NetlifyDeployActionCard';
import { NetlifyEnvVarsActionCard } from './NetlifyEnvVarsActionCard';
import { SupabaseSetupActionCard } from './SupabaseSetupActionCard';
import { DatabaseBootstrapActionCard } from './DatabaseBootstrapActionCard';
import { HandoffActionCard } from './HandoffActionCard';
import { InstanceAccessStatusCard } from './InstanceAccessStatusCard';
import { InstanceHealthChecksCard } from './InstanceHealthChecksCard';

interface ProvJob {
  id: string;
  instance_id: string;
  client_id: string;
  status: string;
  job_type: string;
  template_version: string | null;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
}

interface JobEvent {
  id: string;
  job_id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface InstanceInfo {
  id: string;
  instance_name: string;
  provisioning_status: string;
  current_version: string | null;
  netlify_site_id: string | null;
  frontend_url: string | null;
  repo_url: string | null;
  last_deployed_at: string | null;
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
}

const JOB_STYLES: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-600',
  running:   'bg-blue-100 text-blue-800',
  waiting:   'bg-yellow-100 text-yellow-800',
  succeeded: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-400',
};

const EVENT_ICON: Record<string, React.ReactNode> = {
  info:    <Info className="w-3.5 h-3.5 text-blue-500" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />,
  error:   <XCircle className="w-3.5 h-3.5 text-red-500" />,
  action:  <Zap className="w-3.5 h-3.5 text-purple-500" />,
};

const EVENT_BG: Record<string, string> = {
  info:    'border-blue-100 bg-blue-50/30',
  success: 'border-green-100 bg-green-50/30',
  warning: 'border-yellow-100 bg-yellow-50/30',
  error:   'border-red-100 bg-red-50/30',
  action:  'border-purple-100 bg-purple-50/30',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const TERMINAL = ['succeeded', 'failed', 'cancelled'];

export default function PlatformProvisioningJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ProvJob | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    if (!jobId) return;
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    Promise.all([
      supabase.from('platform_provisioning_jobs').select('*').eq('id', jobId).maybeSingle(),
      supabase.from('platform_provisioning_job_events').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('platform_provider_integrations').select('provider,display_name,status'),
    ]).then(async ([jr, er, pr]) => {
      const j = jr.data as ProvJob ?? null;
      setJob(j);
      setEvents((er.data as JobEvent[]) ?? []);
      setProviderStatuses((pr.data as ProviderStatus[]) ?? []);
      if (j) {
        const { data: inst } = await supabase
          .from('platform_instances')
          .select('id,instance_name,provisioning_status,current_version,netlify_site_id,frontend_url,repo_url,last_deployed_at,supabase_project_ref,supabase_project_url')
          .eq('id', j.instance_id)
          .maybeSingle();
        setInstance(inst as InstanceInfo ?? null);
      }
      setLoading(false);
    });
  }, [jobId]);

  const handleEventLogged = (msg: string) => {
    setEvents(prev => [...prev, {
      id: crypto.randomUUID(),
      job_id: jobId!,
      event_type: 'action',
      message: msg,
      metadata: null,
      created_at: new Date().toISOString(),
    }]);
  };

  const addEvent = async (type: string, message: string) => {
    const { data } = await supabase
      .from('platform_provisioning_job_events')
      .insert({ job_id: jobId!, event_type: type, message })
      .select()
      .maybeSingle();
    if (data) setEvents(prev => [...prev, data as JobEvent]);
  };

  const updateJobStatus = async (newStatus: string, extraPatch: Record<string, string | null> = {}) => {
    setSaving(true);
    const now = new Date().toISOString();
    const patch: Record<string, string | null> = { status: newStatus, ...extraPatch };
    if (newStatus === 'running' && !job?.started_at) patch.started_at = now;
    if (TERMINAL.includes(newStatus)) patch.completed_at = now;

    const { data: updatedJob } = await supabase
      .from('platform_provisioning_jobs')
      .update(patch)
      .eq('id', jobId!)
      .select()
      .maybeSingle();
    if (updatedJob) setJob(updatedJob as ProvJob);
    setSaving(false);
    return now;
  };

  const handleMarkRunning = async () => {
    await addEvent('action', `Job marked as running by ${adminEmail || 'admin'}`);
    await updateJobStatus('running');
    // update instance
    await supabase.from('platform_instances')
      .update({ provisioning_status: 'pending' })
      .eq('id', job!.instance_id);
    setInstance(prev => prev ? { ...prev, provisioning_status: 'pending' } : prev);
  };

  const handleMarkWaiting = async () => {
    await addEvent('warning', `Job paused — waiting for external dependency`);
    await updateJobStatus('waiting');
  };

  const handleMarkSucceeded = async () => {
    await addEvent('success', `Provisioning completed successfully by ${adminEmail || 'admin'}`);
    const now = new Date().toISOString();
    await updateJobStatus('succeeded');
    // update instance + provisioning_job_id
    await supabase.from('platform_instances').update({
      provisioning_status: 'deployed',
      current_version: job!.template_version ?? null,
      provisioning_job_id: jobId,
      last_deployed_at: now,
    }).eq('id', job!.instance_id);
    setInstance(prev => prev ? {
      ...prev,
      provisioning_status: 'deployed',
      current_version: job?.template_version ?? prev.current_version,
    } : prev);
  };

  const handleMarkFailed = async () => {
    await addEvent('error', `Provisioning failed — marked by ${adminEmail || 'admin'}`);
    await updateJobStatus('failed');
    await supabase.from('platform_instances')
      .update({ provisioning_status: 'failed' })
      .eq('id', job!.instance_id);
    setInstance(prev => prev ? { ...prev, provisioning_status: 'failed' } : prev);
  };

  const handleCancel = async () => {
    await addEvent('action', `Job cancelled by ${adminEmail || 'admin'}`);
    await updateJobStatus('cancelled');
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Provisioning job not found.</p>
        <Link to="/platform/provisioning/jobs" className="text-sm text-gray-500 hover:text-gray-900 underline mt-2 inline-block">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const isTerminal = TERMINAL.includes(job.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/platform/provisioning/jobs" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {instance?.instance_name ?? 'Provisioning Job'}
          </h1>
          <p className="text-sm text-gray-500">
            {job.job_type.replace('_', ' ')} · Created {fmtDate(job.created_at)}
            {job.requested_by ? ` · by ${job.requested_by}` : ''}
          </p>
        </div>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${JOB_STYLES[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {job.status}
        </span>
      </div>

      {/* Manual tracking notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Manual tracking only.</strong> This does not deploy code automatically. Use the actions below to track your manual provisioning progress.
        </p>
      </div>

      {/* Job summary card */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium">Instance</p>
            {instance ? (
              <Link to={`/platform/provisioning/${instance.id}`} className="text-gray-900 hover:text-blue-600 transition-colors font-medium">
                {instance.instance_name}
              </Link>
            ) : <p className="text-gray-500">—</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Template Version</p>
            <p className="text-gray-900">{job.template_version ? `v${job.template_version}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Current Instance Version</p>
            <p className="text-gray-900">{instance?.current_version ? `v${instance.current_version}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Started</p>
            <p className="text-gray-900">{job.started_at ? fmtDateTime(job.started_at) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Completed</p>
            <p className="text-gray-900">{job.completed_at ? fmtDateTime(job.completed_at) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Instance Status</p>
            <p className="text-gray-900">{instance?.provisioning_status?.replace('_', ' ') ?? '—'}</p>
          </div>
        </div>
        {job.error_message && (
          <div className="mt-2 pt-3 border-t">
            <p className="text-xs text-gray-500 font-medium mb-1">Error Message</p>
            <p className="text-xs text-red-600">{job.error_message}</p>
          </div>
        )}
        {job.notes && (
          <div className="mt-2 pt-3 border-t">
            <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
            <p className="text-xs text-gray-700">{job.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isTerminal && (
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {job.status === 'queued' && (
              <button
                onClick={handleMarkRunning}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Mark Running
              </button>
            )}
            {job.status === 'running' && (
              <button
                onClick={handleMarkWaiting}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-3 py-2 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                Mark Waiting
              </button>
            )}
            {job.status === 'waiting' && (
              <button
                onClick={handleMarkRunning}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Resume Running
              </button>
            )}
            <button
              onClick={handleMarkSucceeded}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Mark Succeeded
            </button>
            <button
              onClick={handleMarkFailed}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Mark Failed
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provisioning Actions */}
      {providerStatuses.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Provisioning Actions</h2>
          <ProvisioningActions
            statuses={providerStatuses}
            jobId={job?.id}
            onEventLogged={handleEventLogged}
          />
        </div>
      )}

      {/* Automation */}
      {instance && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Automation</h2>
          <div className="space-y-3">
          <SourceTemplateActionCard
            instanceId={instance.id}
            repoUrl={instance.repo_url}
            providerStatuses={providerStatuses}
            jobId={job.id}
            onSuccess={result => {
              setInstance(prev => prev ? { ...prev, repo_url: result.repo_url } : prev);
            }}
            onEventLogged={handleEventLogged}
          />
          <NetlifyActionCard
            instanceId={instance.id}
            netlitySiteId={instance.netlify_site_id}
            frontendUrl={instance.frontend_url}
            providerStatuses={providerStatuses}
            jobId={job.id}
            onSuccess={result => {
              setInstance(prev => prev ? {
                ...prev,
                netlify_site_id: result.site_id,
                frontend_url: result.site_url || prev.frontend_url,
              } : prev);
            }}
            onEventLogged={handleEventLogged}
          />
          <NetlifyDeployActionCard
            instanceId={instance.id}
            netlitySiteId={instance.netlify_site_id}
            repoUrl={instance.repo_url}
            frontendUrl={instance.frontend_url}
            lastDeployedAt={instance.last_deployed_at}
            providerStatuses={providerStatuses}
            jobId={job.id}
            onSuccess={result => {
              setInstance(prev => prev ? {
                ...prev,
                last_deployed_at: new Date().toISOString(),
                frontend_url: result.deploy_url || prev.frontend_url,
              } : prev);
            }}
            onEventLogged={handleEventLogged}
          />
          <NetlifyEnvVarsActionCard
            instanceId={instance.id}
            netlitySiteId={instance.netlify_site_id}
            providerStatuses={providerStatuses}
            jobId={job.id}
            onEventLogged={handleEventLogged}
          />
          <SupabaseSetupActionCard
            instanceId={instance.id}
            supabaseProjectRef={instance.supabase_project_ref}
            supabaseProjectUrl={instance.supabase_project_url}
            providerStatuses={providerStatuses}
            jobId={job.id}
            onSuccess={result => {
              setInstance(prev => prev ? {
                ...prev,
                supabase_project_ref: result.project_ref,
                supabase_project_url: result.project_url,
              } : prev);
            }}
            onEventLogged={handleEventLogged}
          />
          <DatabaseBootstrapActionCard
            instanceId={instance.id}
            supabaseProjectRef={instance.supabase_project_ref}
            supabaseProjectUrl={instance.supabase_project_url}
            jobId={job.id}
            onEventLogged={handleEventLogged}
          />
          <HandoffActionCard
            instanceId={instance.id}
            jobId={job.id}
            onEventLogged={handleEventLogged}
          />
          </div>
        </div>
      )}

      {/* Setup Tasks */}
      {instance && (
        <SetupTasksSection
          instanceId={instance.id}
          providerStatuses={providerStatuses}
          jobId={job.id}
          onEventLogged={handleEventLogged}
        />
      )}

      {/* Instance Access Status */}
      {instance && <InstanceAccessStatusCard instanceId={instance.id} />}

      {/* Health Checks */}
      {instance && <InstanceHealthChecksCard instanceId={instance.id} />}

      {/* Event timeline */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Event Timeline</h2>
        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">
            No events recorded yet.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-2">
              {events.map(event => (
                <div key={event.id} className={`relative ml-10 border rounded-xl px-4 py-3 ${EVENT_BG[event.event_type] ?? 'border-gray-100'}`}>
                  <div className="absolute -left-[1.85rem] top-3.5 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                    {EVENT_ICON[event.event_type] ?? EVENT_ICON.info}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-800">{event.message}</p>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{fmtDateTime(event.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex items-center gap-4 flex-wrap pt-2 border-t">
        {instance && (
          <Link
            to={`/platform/provisioning/${instance.id}`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Provisioning Checklist
          </Link>
        )}
        {instance && (
          <Link
            to={`/platform/provisioning/${instance.id}/pack`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Deployment Pack
          </Link>
        )}
        {instance && (
          <Link
            to={`/platform/instances/${instance.id}/launch-package`}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
          >
            Launch Package
          </Link>
        )}
        <Link
          to="/platform/provisioning/jobs"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors ml-auto"
        >
          All Jobs
        </Link>
      </div>
    </div>
  );
}
