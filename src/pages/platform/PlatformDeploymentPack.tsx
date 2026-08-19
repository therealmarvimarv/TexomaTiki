import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, Shield, Copy, Check,
  Globe, Database, Server, CheckCircle2, XCircle, Clock, Minus, Cpu, Play,
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
import { SupportTicketsCard } from './SupportTicketsCard';
import { DomainReadinessCard } from './DomainReadinessCard';

interface InstanceInfo {
  id: string;
  instance_name: string;
  property_name: string | null;
  frontend_url: string | null;
  admin_url: string | null;
  custom_domain: string | null;
  netlify_site_id: string | null;
  repo_url: string | null;
  instance_slug: string | null;
  last_deployed_at: string | null;
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  environment: string;
  provisioning_status: string;
  current_version: string | null;
  target_version: string | null;
  update_status: string;
  client_id: string;
  client_name: string;
}

interface BlueprintStep {
  id: string;
  step_key: string;
  step_label: string;
  step_group: string;
  instructions: string | null;
  sort_order: number;
}

interface EnvReq {
  id: string;
  env_key: string;
  label: string;
  provider: string;
  required: boolean;
  status: string;
  notes: string | null;
}

interface TemplateVersion {
  version: string;
  title: string;
  status: string;
}

interface ActiveJob {
  id: string;
  status: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  missing:    <XCircle className="w-4 h-4 text-red-400" />,
  added:      <Clock className="w-4 h-4 text-yellow-500" />,
  verified:   <CheckCircle2 className="w-4 h-4 text-green-500" />,
  not_needed: <Minus className="w-4 h-4 text-gray-300" />,
};

const STATUS_OPTIONS = ['missing', 'added', 'verified', 'not_needed'];

const PROVIDER_STYLES: Record<string, string> = {
  netlify:  'bg-teal-50 text-teal-700',
  supabase: 'bg-emerald-50 text-emerald-700',
  stripe:   'bg-purple-50 text-purple-700',
  resend:   'bg-blue-50 text-blue-700',
  twilio:   'bg-red-50 text-red-700',
  app:      'bg-gray-100 text-gray-600',
};

const PROV_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  pending:     'bg-yellow-100 text-yellow-800',
  deployed:    'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  suspended:   'bg-orange-100 text-orange-800',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-300 italic">Not set</p>
    </div>
  );
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className="text-sm text-gray-900 font-mono break-all">{value}</p>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export default function PlatformDeploymentPack() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [blueprintSteps, setBlueprintSteps] = useState<BlueprintStep[]>([]);
  const [envReqs, setEnvReqs] = useState<EnvReq[]>([]);
  const [templateVersion, setTemplateVersion] = useState<TemplateVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEnv, setSavingEnv] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [startingJob, setStartingJob] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  // Tracks the live Netlify has_published_deploy value from the diagnostic card
  const [netlifyHasPublishedDeploy, setNetlifyHasPublishedDeploy] = useState<boolean | null>(null);

  useEffect(() => {
    if (!instanceId) return;
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    Promise.all([
      supabase.from('platform_instances')
        .select('id,instance_name,property_name,frontend_url,admin_url,custom_domain,netlify_site_id,repo_url,instance_slug,last_deployed_at,supabase_project_ref,supabase_project_url,environment,provisioning_status,current_version,target_version,update_status,client_id')
        .eq('id', instanceId).maybeSingle(),
      supabase.from('platform_instance_env_requirements')
        .select('*').eq('instance_id', instanceId).order('provider').order('env_key'),
      supabase.from('platform_template_versions')
        .select('version,title,status').eq('status', 'active').limit(1).maybeSingle(),
    ]).then(async ([ir, er, tv]) => {
      const inst = ir.data as InstanceInfo | null;
      if (inst) {
        const { data: client } = await supabase
          .from('platform_clients').select('owner_name,business_name')
          .eq('id', inst.client_id).maybeSingle();
        inst.client_name = client
          ? client.owner_name + (client.business_name ? ` — ${client.business_name}` : '')
          : 'Unknown';
      }
      setInstance(inst);
      setEnvReqs((er.data as EnvReq[]) ?? []);
      setTemplateVersion((tv.data as TemplateVersion) ?? null);

      const [bpResult, jobResult] = await Promise.all([
        supabase.from('platform_deployment_blueprints').select('id').eq('is_active', true).limit(1).maybeSingle(),
        supabase.from('platform_provisioning_jobs')
          .select('id,status')
          .eq('instance_id', instanceId)
          .not('status', 'in', '("succeeded","failed","cancelled")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (bpResult.data) {
        const { data: steps } = await supabase
          .from('platform_deployment_blueprint_steps').select('*')
          .eq('blueprint_id', bpResult.data.id).order('sort_order');
        setBlueprintSteps((steps as BlueprintStep[]) ?? []);
      }
      setActiveJob(jobResult.data as ActiveJob ?? null);

      // Fetch all provider statuses (for readiness summary + action gating)
      const { data: provRows } = await supabase
        .from('platform_provider_integrations')
        .select('provider,display_name,status');
      setProviderStatuses((provRows ?? []) as { provider: string; display_name: string; status: string }[]);

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

  const updateEnvStatus = async (id: string, status: string) => {
    setSavingEnv(id);
    const { data } = await supabase
      .from('platform_instance_env_requirements')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (data) setEnvReqs(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    setSavingEnv(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!instance) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Instance not found.</p>
        <Link to="/platform/provisioning" className="text-sm text-gray-500 hover:text-gray-900 underline mt-2 inline-block">Back to provisioning</Link>
      </div>
    );
  }

  const groups = Array.from(new Set(blueprintSteps.map(s => s.step_group)));
  const providers = Array.from(new Set(envReqs.map(e => e.provider)));
  const missing = envReqs.filter(e => e.status === 'missing' && e.required).length;
  const verified = envReqs.filter(e => e.status === 'verified').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/platform/provisioning/${instanceId}`} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{instance.instance_name} — Deployment Pack</h1>
          <p className="text-sm text-gray-500">{instance.client_name}</p>
        </div>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${PROV_STYLES[instance.provisioning_status] ?? 'bg-gray-100 text-gray-600'}`}>
          {instance.provisioning_status.replace('_', ' ')}
        </span>
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Security reminder:</strong> Do not paste secrets, API keys, service role keys, SMTP passwords, or webhook secrets here.
          Store actual secret values only in Supabase Vault, Netlify environment variables, or provider dashboards.
        </p>
      </div>

      {/* Database isolation warning */}
      {(() => {
        const MASTER_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const clientUrl = instance.supabase_project_url;
        const clientRef = instance.supabase_project_ref;
        const masterRef = MASTER_URL.replace('https://','').split('.')[0];
        const matchesMaster = (clientUrl && clientUrl === MASTER_URL) || (clientRef && clientRef === masterRef);
        const missing = !clientUrl && !clientRef;
        if (!missing && !matchesMaster) return null;
        return (
          <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
            <Database className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed space-y-1">
              <p className="font-bold">Database isolation required</p>
              {matchesMaster
                ? <p>This client is still connected to the master database. Changes made here will affect all sites on this platform. You must create and assign a dedicated Supabase project for this client before launch.</p>
                : <p>No client database is configured. This instance may be inheriting the master template database. Assign a dedicated Supabase project before launch.</p>}
              <p className="font-medium mt-1">Steps: Create a new Supabase project → apply all migrations from <code>supabase/migrations/</code> in order → seed starter property data only (no bookings/guests/payments) → set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Netlify env vars for this site only → clear-cache redeploy → save the project ref/URL on this instance record.</p>
            </div>
          </div>
        );
      })()}

      {/* Provisioning job status */}
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Provisioning Job</p>
          {activeJob ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Active job — status: <span className="font-medium text-gray-700">{activeJob.status}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No active provisioning job for this instance.</p>
          )}
        </div>
        {activeJob ? (
          <Link
            to={`/platform/provisioning/jobs/${activeJob.id}`}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5" /> View Job
          </Link>
        ) : (
          <button
            onClick={handleStartProvisioning}
            disabled={startingJob}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {startingJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start Provisioning
          </button>
        )}
      </div>

      {/* Provider readiness summary */}
      {providerStatuses.length > 0 && (
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Platform Provider Readiness</h2>
            <Link to="/platform/integrations" className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
              Manage Integrations
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {providerStatuses.map(p => (
              <div key={p.provider} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                {p.status === 'verified'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : p.status === 'failed'
                  ? <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  : <Minus className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                <span className="text-xs text-gray-700 truncate">{p.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instance summary */}
      <div className="bg-white rounded-2xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Instance Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Instance Name" value={instance.instance_name} />
          <InfoRow label="Property Name" value={instance.property_name} />
          <InfoRow label="Client" value={instance.client_name} />
          <InfoRow label="Template Version" value={templateVersion ? `v${templateVersion.version} — ${templateVersion.title}` : 'Unknown'} />
          <InfoRow label="Environment" value={instance.environment} />
          <InfoRow label="Current Version" value={instance.current_version} />
          {instance.target_version && <InfoRow label="Target Version (Pending)" value={instance.target_version} />}
          {instance.update_status && instance.update_status !== 'up_to_date' && (
            <div>
              <p className="text-xs text-gray-400 font-medium">Update Status</p>
              <p className="text-sm text-gray-900">{instance.update_status.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <InfoRow label="Frontend URL" value={instance.frontend_url} />
          <InfoRow label="Admin URL" value={instance.admin_url} />
          <InfoRow label="Custom Domain" value={instance.custom_domain} />
          <InfoRow label="Netlify Site ID" value={instance.netlify_site_id} />
          <InfoRow label="Supabase Project Ref" value={instance.supabase_project_ref} />
          <InfoRow label="Supabase Project URL" value={instance.supabase_project_url} />
        </div>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t flex-wrap">
          {instance.frontend_url && (
            <a href={instance.frontend_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              <Globe className="w-3 h-3" /> Open Frontend
            </a>
          )}
          {instance.admin_url && (
            <a href={instance.admin_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Server className="w-3 h-3" /> Open Admin
            </a>
          )}
          {instance.supabase_project_url && (
            <a href={instance.supabase_project_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              <Database className="w-3 h-3" /> Open Supabase
            </a>
          )}
        </div>
      </div>

      {/* Env var checklist */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Environment Variable Checklist</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {verified}/{envReqs.length} verified
              {missing > 0 && <span className="text-red-500 ml-2">· {missing} required missing</span>}
            </p>
          </div>
        </div>

        {envReqs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No env requirements found. This instance may predate Phase 3.</p>
        ) : (
          <div className="space-y-4">
            {providers.map(provider => {
              const provReqs = envReqs.filter(e => e.provider === provider);
              return (
                <div key={provider}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PROVIDER_STYLES[provider] ?? 'bg-gray-100 text-gray-600'}`}>
                      {provider}
                    </span>
                  </p>
                  <div className="border border-gray-200 rounded-xl divide-y overflow-hidden">
                    {provReqs.map(env => (
                      <div key={env.id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex-shrink-0">{STATUS_ICON[env.status] ?? STATUS_ICON.missing}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-900">{env.env_key}</span>
                            {env.required && (
                              <span className="text-xs text-red-400 font-medium">required</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{env.label}</p>
                        </div>
                        <select
                          value={env.status}
                          onChange={e => updateEnvStatus(env.id, e.target.value)}
                          disabled={savingEnv === env.id}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Automation */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Automation</h2>
        <div className="space-y-3">
        <SourceTemplateActionCard
          instanceId={instanceId!}
          repoUrl={instance.repo_url}
          providerStatuses={providerStatuses}
          jobId={activeJob?.id}
          onSuccess={result => {
            setInstance(prev => prev ? { ...prev, repo_url: result.repo_url } : prev);
          }}
        />
        <NetlifyActionCard
          instanceId={instanceId!}
          netlitySiteId={instance.netlify_site_id}
          frontendUrl={instance.frontend_url}
          providerStatuses={providerStatuses}
          jobId={activeJob?.id}
          onSuccess={result => {
            setInstance(prev => prev ? {
              ...prev,
              netlify_site_id: result.site_id || prev.netlify_site_id,
              frontend_url: result.site_url || prev.frontend_url,
              admin_url: result.site_url ? `${result.site_url}/admin` : prev.admin_url,
            } : prev);
          }}
          onDiagnosticResult={result => {
            setNetlifyHasPublishedDeploy(result.has_published_deploy);
          }}
        />
        <NetlifyDeployActionCard
          instanceId={instanceId!}
          netlitySiteId={instance.netlify_site_id}
          repoUrl={instance.repo_url}
          frontendUrl={instance.frontend_url}
          lastDeployedAt={instance.last_deployed_at}
          hasPublishedDeploy={netlifyHasPublishedDeploy}
          providerStatuses={providerStatuses}
          jobId={activeJob?.id}
          onSuccess={result => {
            setInstance(prev => prev ? {
              ...prev,
              last_deployed_at: new Date().toISOString(),
              frontend_url: result.deploy_url || prev.frontend_url,
            } : prev);
          }}
        />
        <NetlifyEnvVarsActionCard
          instanceId={instanceId!}
          netlitySiteId={instance.netlify_site_id}
          providerStatuses={providerStatuses}
          jobId={activeJob?.id}
        />
        <SupabaseSetupActionCard
          instanceId={instanceId!}
          supabaseProjectRef={instance.supabase_project_ref}
          supabaseProjectUrl={instance.supabase_project_url}
          providerStatuses={providerStatuses}
          jobId={activeJob?.id}
          onSuccess={result => {
            setInstance(prev => prev ? {
              ...prev,
              supabase_project_ref: result.project_ref,
              supabase_project_url: result.project_url,
            } : prev);
          }}
        />
        <DatabaseBootstrapActionCard
          instanceId={instanceId!}
          supabaseProjectRef={instance.supabase_project_ref}
          supabaseProjectUrl={instance.supabase_project_url}
          jobId={activeJob?.id}
        />
        <HandoffActionCard
          instanceId={instanceId!}
          jobId={activeJob?.id}
        />
        </div>
      </div>

      {/* Provisioning Actions */}
      {providerStatuses.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Provisioning Actions</h2>
          <ProvisioningActions
            statuses={providerStatuses}
            jobId={activeJob?.id}
          />
        </div>
      )}

      {/* Setup Tasks */}
      <SetupTasksSection
        instanceId={instanceId!}
        providerStatuses={providerStatuses}
        jobId={activeJob?.id}
      />

      {/* Deployment instructions */}
      {blueprintSteps.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Deployment Instructions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Generated from the active deployment blueprint. Use these steps to set up this instance.</p>
          </div>
          {groups.map(group => {
            const groupSteps = blueprintSteps.filter(s => s.step_group === group);
            return (
              <div key={group} className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
                  <span className="text-xs text-gray-400 ml-3">{groupSteps.length} steps</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {groupSteps.map((step, i) => (
                    <div key={step.id} className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{step.step_label}</p>
                          {step.instructions && (
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.instructions}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instance Access Status */}
      <InstanceAccessStatusCard instanceId={instanceId!} />

      {/* Health Checks */}
      <InstanceHealthChecksCard instanceId={instanceId!} />

      {/* Domain Readiness */}
      {instance && <DomainReadinessCard clientId={instance.client_id} instanceId={instance.id} netlifyDomain={instance.netlify_site_id} />}

      {/* Support Tickets */}
      {instance && <SupportTicketsCard clientId={instance.client_id} instanceId={instanceId} />}

      {/* Footer link back to checklist */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
        <Link
          to={`/platform/provisioning/${instanceId}`}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Provisioning Checklist
        </Link>
        <Link
          to={`/platform/instances/${instanceId}/launch-package`}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
        >
          Launch Package →
        </Link>
      </div>
    </div>
  );
}
