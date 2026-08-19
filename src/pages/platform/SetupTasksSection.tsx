import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, RefreshCw, Copy, Check, CheckCircle2, XCircle,
  SkipForward, ChevronDown, ChevronRight, Zap, AlertTriangle,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

export interface SetupTask {
  id: string;
  instance_id: string;
  job_id: string | null;
  task_group: string;
  task_key: string;
  task_label: string;
  provider: string;
  status: string;
  instructions: string;
  command_text: string | null;
  copy_payload: Record<string, string> | null;
  sort_order: number;
}

interface InstanceSnapshot {
  instance_name: string;
  property_name: string | null;
  frontend_url: string | null;
  admin_url: string | null;
  custom_domain: string | null;
  netlify_site_id: string | null;
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  environment: string;
  instance_slug: string | null;
}

const PROVIDER_BADGE: Record<string, string> = {
  github:              'bg-gray-900 text-white',
  supabase_management: 'bg-emerald-100 text-emerald-800',
  netlify:             'bg-teal-100 text-teal-800',
  domain_dns:          'bg-sky-100 text-sky-800',
  stripe:              'bg-violet-100 text-violet-800',
  resend:              'bg-blue-100 text-blue-800',
  smtp:                'bg-blue-100 text-blue-800',
  app:                 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  ready:     'bg-green-100 text-green-700',
  copied:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-800',
  skipped:   'bg-gray-100 text-gray-400',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  draft:     <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />,
  ready:     <Zap className="w-3.5 h-3.5 text-green-500" />,
  copied:    <Copy className="w-3.5 h-3.5 text-blue-500" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  skipped:   <SkipForward className="w-3.5 h-3.5 text-gray-400" />,
};

function buildTaskList(
  instance: InstanceSnapshot,
  providerStatuses: ProviderStatus[],
  instanceId: string,
  jobId?: string | null,
): Omit<SetupTask, 'id'>[] {
  const isReady = (provider: string) =>
    providerStatuses.find(p => p.provider === provider)?.status === 'verified';

  const domain = instance.custom_domain ?? '[CLIENT_DOMAIN]';
  const slug = instance.instance_slug ?? '[INSTANCE_SLUG]';
  const frontendUrl = instance.frontend_url ?? `https://${domain}`;
  const supaRef = instance.supabase_project_ref ?? '[SUPABASE_PROJECT_REF]';

  const task = (
    task_group: string,
    task_key: string,
    task_label: string,
    provider: string,
    sort_order: number,
    instructions: string,
    command_text?: string,
    copy_payload?: Record<string, string>,
  ): Omit<SetupTask, 'id'> => ({
    instance_id: instanceId,
    job_id: jobId ?? null,
    task_group,
    task_key,
    task_label,
    provider,
    status: isReady(provider) || provider === 'app' ? 'ready' : 'draft',
    instructions,
    command_text: command_text ?? null,
    copy_payload: copy_payload ?? null,
    sort_order,
  });

  return [
    // ── Source / Template ──────────────────────────────────────────────────
    task(
      'Source / Template',
      'github_clone_template',
      'Clone template repository',
      'github',
      10,
      `Go to the GitHub template org and create a new repository from the template. Name it: ${slug}`,
      `gh repo create [ORG]/${slug} --template [ORG]/[TEMPLATE_REPO] --private`,
      { repo_name: slug },
    ),
    task(
      'Source / Template',
      'github_set_branch_protection',
      'Set branch protection rules',
      'github',
      20,
      'In the new repo settings, protect the main branch: require PR reviews, no force-push.',
      undefined,
    ),

    // ── Supabase ───────────────────────────────────────────────────────────
    task(
      'Supabase Setup',
      'supabase_create_project',
      'Set up Supabase project',
      'supabase_management',
      30,
      `Create a new Supabase project for this instance. Suggested name: ${instance.instance_name}. Note the project ref and URL.`,
      undefined,
      {
        project_name: instance.instance_name,
        region: '[SELECT_REGION]',
      },
    ),
    task(
      'Supabase Setup',
      'supabase_run_migrations',
      'Run schema migrations',
      'supabase_management',
      40,
      `Connect to the new Supabase project and run the full template migration. Use the project ref: ${supaRef}`,
      `supabase db push --project-ref ${supaRef}`,
    ),
    task(
      'Supabase Setup',
      'supabase_set_auth_config',
      'Configure Auth settings',
      'supabase_management',
      50,
      `In Supabase Auth settings: set Site URL to ${frontendUrl}. Add ${frontendUrl}/** as a Redirect URL. Disable email confirmation if needed.`,
      undefined,
      { site_url: frontendUrl },
    ),
    task(
      'Supabase Setup',
      'supabase_set_edge_secrets',
      'Add Edge Function secrets',
      'supabase_management',
      60,
      'In Supabase → Edge Functions → Secrets, add all required secrets. Use key names only — paste values from your password manager.',
      `# Add via CLI (values must be set manually):
supabase secrets set STRIPE_SECRET_KEY=[PASTE_VALUE_IN_SUPABASE] \\
  RESEND_API_KEY=[PASTE_VALUE_IN_SUPABASE] \\
  --project-ref ${supaRef}`,
    ),

    // ── Netlify ────────────────────────────────────────────────────────────
    task(
      'Netlify Setup',
      'netlify_create_site',
      'Create Netlify site',
      'netlify',
      70,
      `Create a new Netlify site connected to the GitHub repo ${slug}. Set auto-deploy from the main branch.`,
      `netlify sites:create --name ${slug}`,
      { site_name: slug },
    ),
    task(
      'Netlify Setup',
      'netlify_set_env_vars',
      'Set Netlify environment variables',
      'netlify',
      80,
      `In Netlify → Site → Environment Variables, set all required vars for this instance. Use key names only.`,
      `# Required variable names (set values in Netlify dashboard):
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STRIPE_PUBLIC_KEY`,
    ),
    task(
      'Netlify Setup',
      'netlify_trigger_deploy',
      'Trigger initial deploy',
      'netlify',
      90,
      'Trigger a deploy from the Netlify dashboard to confirm build succeeds with the new environment variables.',
      `netlify deploy --prod --dir=dist`,
    ),

    // ── Domain / DNS ───────────────────────────────────────────────────────
    task(
      'Domain / DNS',
      'dns_add_cname',
      'Add CNAME / A record',
      'domain_dns',
      100,
      `In your DNS provider, point ${domain} to the Netlify site. For a subdomain use CNAME; for an apex domain use A record with Netlify's load balancer IP.`,
      undefined,
      { domain, target: '[NETLIFY_SITE_ID].netlify.app' },
    ),
    task(
      'Domain / DNS',
      'netlify_custom_domain',
      'Add custom domain in Netlify',
      'netlify',
      110,
      `In Netlify → Site → Domain Management, add ${domain} as a custom domain. Enable HTTPS / Let's Encrypt.`,
      undefined,
      { domain },
    ),

    // ── App Initial Setup ──────────────────────────────────────────────────
    task(
      'App Initial Setup',
      'app_create_admin_user',
      'Create admin user account',
      'app',
      120,
      `Log in to the new instance at ${frontendUrl}/admin. Use the Supabase dashboard to create the first admin user manually, or use the onboarding flow if available.`,
      undefined,
      { admin_url: instance.admin_url ?? frontendUrl + '/admin' },
    ),
    task(
      'App Initial Setup',
      'app_configure_property',
      'Configure property details',
      'app',
      130,
      `Log into the admin at ${instance.admin_url ?? frontendUrl + '/admin'} and complete property setup: name, address, photos, pricing, availability.`,
      undefined,
    ),
    task(
      'App Initial Setup',
      'app_stripe_webhook',
      'Register Stripe webhook endpoint',
      'stripe',
      140,
      `In the Stripe dashboard, add a webhook endpoint pointing to: ${frontendUrl}/api/stripe/webhook. Subscribe to: checkout.session.completed, payment_intent.payment_failed.`,
      undefined,
      { webhook_url: `${frontendUrl}/api/stripe/webhook` },
    ),
    task(
      'App Initial Setup',
      'app_test_booking_flow',
      'Test end-to-end booking flow',
      'app',
      150,
      `Using Stripe test mode, complete a test booking on ${frontendUrl}. Verify confirmation email is sent, booking appears in admin, and Stripe webhook fires correctly.`,
      undefined,
    ),

    // ── Launch QA ──────────────────────────────────────────────────────────
    task(
      'Launch QA',
      'qa_checklist_review',
      'Complete pre-launch QA checklist',
      'app',
      160,
      'Review all pages on mobile and desktop. Check: booking flow, confirmation emails, admin dashboard, Stripe payments, DNS/SSL.',
      undefined,
    ),
    task(
      'Launch QA',
      'qa_switch_stripe_live',
      'Switch Stripe to live mode',
      'stripe',
      170,
      'Replace Stripe test keys with live keys in Netlify env vars and Supabase secrets. Update webhook endpoint to live mode.',
      undefined,
    ),
    task(
      'Launch QA',
      'qa_mark_launched',
      'Mark instance as launched',
      'app',
      180,
      `Update the instance status in the platform to "deployed". Notify the client at ${instance.property_name ?? instance.instance_name} that their site is live.`,
      undefined,
    ),
  ];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onCopied,
}: {
  task: SetupTask;
  onStatusChange: (id: string, status: string) => void;
  onCopied?: (task: SetupTask) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = task.status === 'completed' || task.status === 'skipped';

  const copyText = task.command_text ??
    (task.copy_payload ? Object.entries(task.copy_payload).map(([k, v]) => `${k}=${v}`).join('\n') : null);

  const handleCopy = () => {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(() => {
      onStatusChange(task.id, 'copied');
      onCopied?.(task);
    });
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      done ? 'border-gray-200 bg-gray-50/50 opacity-70' : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex-shrink-0">{STATUS_ICON[task.status] ?? STATUS_ICON.draft}</span>
        <span className={`flex-1 text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.task_label}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PROVIDER_BADGE[task.provider] ?? PROVIDER_BADGE.app}`}>
          {task.provider.replace('_management', '').replace('_', ' ')}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[task.status] ?? STATUS_BADGE.draft}`}>
          {task.status}
        </span>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          <p className="text-xs text-gray-600 leading-relaxed pt-3">{task.instructions}</p>

          {copyText && (
            <div className="bg-gray-900 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <pre className="flex-1 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {copyText}
              </pre>
              <CopyBtn text={copyText} />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {copyText && task.status !== 'copied' && task.status !== 'completed' && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            )}
            {task.status !== 'completed' && (
              <button
                onClick={() => onStatusChange(task.id, 'completed')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Mark Complete
              </button>
            )}
            {task.status === 'completed' && (
              <button
                onClick={() => onStatusChange(task.id, 'ready')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <XCircle className="w-3 h-3" /> Undo
              </button>
            )}
            {task.status !== 'skipped' && task.status !== 'completed' && (
              <button
                onClick={() => onStatusChange(task.id, 'skipped')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SkipForward className="w-3 h-3" /> Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SetupTasksSectionProps {
  instanceId: string;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onEventLogged?: (msg: string) => void;
}

export function SetupTasksSection({
  instanceId,
  providerStatuses,
  jobId,
  onEventLogged,
}: SetupTasksSectionProps) {
  const [tasks, setTasks] = useState<SetupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('platform_generated_setup_tasks')
      .select('*')
      .eq('instance_id', instanceId)
      .order('sort_order');
    setTasks((data as SetupTask[]) ?? []);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleGenerate = async () => {
    setGenerating(true);

    // Fetch instance snapshot
    const { data: inst } = await supabase
      .from('platform_instances')
      .select('instance_name,property_name,frontend_url,admin_url,custom_domain,netlify_site_id,supabase_project_ref,supabase_project_url,environment,instance_slug')
      .eq('id', instanceId)
      .maybeSingle();

    if (!inst) { setGenerating(false); return; }

    // Delete existing draft/ready tasks for this instance
    await supabase
      .from('platform_generated_setup_tasks')
      .delete()
      .eq('instance_id', instanceId)
      .in('status', ['draft', 'ready']);

    const newTasks = buildTaskList(inst as InstanceSnapshot, providerStatuses, instanceId, jobId);

    const { data: inserted } = await supabase
      .from('platform_generated_setup_tasks')
      .insert(newTasks)
      .select();

    setTasks((inserted as SetupTask[]) ?? []);

    if (jobId) {
      await supabase.from('platform_provisioning_job_events').insert({
        job_id: jobId,
        event_type: 'action',
        message: `Setup tasks generated — ${newTasks.length} tasks across ${new Set(newTasks.map(t => t.task_group)).size} groups`,
      });
      onEventLogged?.(`Setup tasks generated — ${newTasks.length} tasks created`);
    }

    setGenerating(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { data } = await supabase
      .from('platform_generated_setup_tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (data) setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleTaskCopied = async (task: SetupTask) => {
    if (!jobId) return;
    await supabase.from('platform_provisioning_job_events').insert({
      job_id: jobId,
      event_type: 'action',
      message: `Setup task copied: ${task.task_label}`,
    });
    onEventLogged?.(`Setup task copied: ${task.task_label}`);
  };

  const handleTaskCompleted = async (task: SetupTask) => {
    if (!jobId) return;
    await supabase.from('platform_provisioning_job_events').insert({
      job_id: jobId,
      event_type: 'success',
      message: `Setup task completed: ${task.task_label}`,
    });
    onEventLogged?.(`Setup task completed: ${task.task_label}`);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const groups = Array.from(new Set(tasks.map(t => t.task_group)));
  const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
  const readyCount = tasks.filter(t => t.status === 'ready').length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">Setup Tasks</h2>
          {tasks.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {completedCount}/{tasks.length} done
              {readyCount > 0 && <span className="text-green-600 ml-2">· {readyCount} ready</span>}
              {tasks.length - completedCount - readyCount > 0 && (
                <span className="text-amber-600 ml-2">
                  · {tasks.length - completedCount - readyCount} need provider config
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {tasks.length === 0 ? 'Generate Setup Tasks' : 'Regenerate Tasks'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No tasks generated yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Generate Setup Tasks" to create a copy-ready checklist for this instance.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const groupTasks = tasks.filter(t => t.task_group === group);
            const groupDone = groupTasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
            const collapsed = collapsedGroups.has(group);

            return (
              <div key={group} className="bg-white rounded-2xl border overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-3 px-5 py-3 bg-gray-50 border-b hover:bg-gray-100 transition-colors text-left"
                >
                  {collapsed
                    ? <ChevronRight className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  <span className="font-semibold text-xs uppercase tracking-wider text-gray-600 flex-1">{group}</span>
                  <span className="text-xs text-gray-400">{groupDone}/{groupTasks.length}</span>
                  {groupDone === groupTasks.length && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </button>
                {!collapsed && (
                  <div className="p-3 space-y-2">
                    {groupTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={(id, status) => {
                          handleStatusChange(id, status);
                          if (status === 'completed') handleTaskCompleted(task);
                        }}
                        onCopied={handleTaskCopied}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
