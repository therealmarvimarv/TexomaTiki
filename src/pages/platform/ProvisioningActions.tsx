import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  CheckCircle2, AlertTriangle, Minus, ExternalLink, GitBranch,
  Database, Globe, Settings, Link as LinkIcon, CreditCard, Mail,
} from 'lucide-react';

export interface ProviderStatus {
  provider: string;
  display_name: string;
  status: string;
}

function isReady(provider: string, statuses: ProviderStatus[]): boolean {
  const p = statuses.find(s => s.provider === provider);
  return p?.status === 'verified';
}

function isEmailReady(statuses: ProviderStatus[]): boolean {
  return isReady('resend', statuses) || isReady('smtp', statuses);
}

interface ActionCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  providers: string[];
  providerLabels: string[];
  ready: boolean;
  jobId?: string;
  onEventLogged?: (msg: string) => void;
}

function ActionCard({
  icon: Icon,
  title,
  description,
  providers,
  providerLabels,
  ready,
  jobId,
  onEventLogged,
}: ActionCardProps) {
  const handleAction = async () => {
    if (!jobId) return;
    const msg = ready
      ? `${title} — action reviewed (automation ready)`
      : `${title} — manual steps required (provider not verified)`;
    await supabase.from('platform_provisioning_job_events').insert({
      job_id: jobId,
      event_type: ready ? 'action' : 'warning',
      message: msg,
    });
    onEventLogged?.(msg);
  };

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${
      ready ? 'border-green-200 bg-green-50/20' : 'border-gray-200 bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        ready ? 'bg-green-100' : 'bg-gray-100'
      }`}>
        <Icon className={`w-4 h-4 ${ready ? 'text-green-700' : 'text-gray-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {ready ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Manual Required
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-2">{description}</p>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-gray-400">Requires:</span>
          {providerLabels.map(label => (
            <span key={label} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">{label}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ready ? (
            <button
              onClick={handleAction}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Automation
            </button>
          ) : (
            <>
              <button
                onClick={handleAction}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> View Manual Steps
              </button>
              <Link
                to="/platform/integrations"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Configure Provider
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProvisioningActionsProps {
  statuses: ProviderStatus[];
  jobId?: string;
  onEventLogged?: (msg: string) => void;
}

export function ProvisioningActions({ statuses, jobId, onEventLogged }: ProvisioningActionsProps) {
  const netlifyReady    = isReady('netlify', statuses);
  const supabaseReady   = isReady('supabase_management', statuses);
  const githubReady     = isReady('github', statuses);
  const stripeReady     = isReady('stripe', statuses);
  const emailReady      = isEmailReady(statuses);
  const domainReady     = isReady('domain_dns', statuses);

  const actions: ActionCardProps[] = [
    {
      icon: GitBranch,
      title: 'Duplicate Source Template',
      description: 'Clone the master template repository to create an isolated codebase for this client instance.',
      providers: ['github'],
      providerLabels: ['GitHub / Source Control'],
      ready: githubReady,
    },
    {
      icon: Database,
      title: 'Set Up Supabase Project',
      description: 'Provision an isolated Supabase database project and run the full schema migration.',
      providers: ['supabase_management'],
      providerLabels: ['Supabase Setup'],
      ready: supabaseReady,
    },
    {
      icon: Globe,
      title: 'Create Netlify Site',
      description: 'Deploy the cloned template to a new Netlify site, linked to the instance repository.',
      providers: ['netlify'],
      providerLabels: ['Netlify'],
      ready: netlifyReady,
    },
    {
      icon: Settings,
      title: 'Configure Environment Variables',
      description: 'Set all required environment variables in the Netlify site and Supabase project.',
      providers: ['netlify', 'supabase_management'],
      providerLabels: ['Netlify', 'Supabase Setup'],
      ready: netlifyReady && supabaseReady,
    },
    {
      icon: LinkIcon,
      title: 'Configure Custom Domain / DNS',
      description: 'Point the client custom domain to the Netlify site and configure DNS records.',
      providers: ['domain_dns'],
      providerLabels: ['Domain / DNS'],
      ready: domainReady,
    },
    {
      icon: CreditCard,
      title: 'Configure Stripe Payments',
      description: 'Set up Stripe webhook endpoint, configure restricted API key, and test checkout flow.',
      providers: ['stripe'],
      providerLabels: ['Stripe'],
      ready: stripeReady,
    },
    {
      icon: Mail,
      title: 'Configure Email Provider',
      description: 'Connect Resend or SMTP for transactional email — booking confirmations, notifications.',
      providers: ['resend', 'smtp'],
      providerLabels: ['Resend or SMTP'],
      ready: emailReady,
    },
  ];

  const readyCount = actions.filter(a => a.ready).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">{readyCount}/{actions.length} actions automation-ready</p>
        <Link to="/platform/integrations" className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
          Manage Providers
        </Link>
      </div>
      {actions.map(action => (
        <ActionCard
          key={action.title}
          {...action}
          jobId={jobId}
          onEventLogged={onEventLogged}
        />
      ))}
    </div>
  );
}

// ── Small readiness summary for list pages / wizard ─────────────────────────

interface ReadinessSummaryProps {
  statuses: ProviderStatus[];
}

const SUMMARY_PROVIDERS = [
  { provider: 'github',              label: 'GitHub' },
  { provider: 'supabase_management', label: 'Supabase Setup' },
  { provider: 'netlify',             label: 'Netlify' },
  { provider: 'stripe',              label: 'Stripe' },
  { provider: 'resend',              label: 'Resend' },
  { provider: 'smtp',                label: 'SMTP' },
  { provider: 'domain_dns',          label: 'Domain/DNS' },
];

export function ProviderReadinessSummary({ statuses }: ReadinessSummaryProps) {
  if (statuses.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Provider Readiness</p>
        <Link to="/platform/integrations" className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Manage
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUMMARY_PROVIDERS.map(({ provider, label }) => {
          const p = statuses.find(s => s.provider === provider);
          const verified = p?.status === 'verified';
          const known = !!p;
          return (
            <div
              key={provider}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                verified ? 'bg-green-50 text-green-700' : known ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-400'
              }`}
            >
              {verified
                ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                : <Minus className="w-3 h-3 flex-shrink-0" />}
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
