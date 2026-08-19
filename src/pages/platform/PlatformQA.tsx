import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShieldCheck, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Circle, ChevronDown, Save, ClipboardList,
} from 'lucide-react';

interface QACheck {
  id: string;
  check_key: string;
  check_label: string;
  check_group: string;
  status: 'not_checked' | 'passing' | 'warning' | 'failing';
  message: string | null;
  last_checked_at: string | null;
  checked_by: string | null;
  updated_at: string;
}

const STATUS_CFG = {
  not_checked: { icon: <Circle className="w-3.5 h-3.5 text-gray-300" />,         cls: 'text-gray-400',   badge: 'bg-gray-100 text-gray-500',   label: 'Not Checked' },
  passing:     { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,  cls: 'text-green-700',  badge: 'bg-green-100 text-green-700', label: 'Passing' },
  warning:     { icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />,cls: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700',label: 'Warning' },
  failing:     { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,         cls: 'text-red-700',    badge: 'bg-red-100 text-red-700',     label: 'Failing' },
};

const GROUP_ORDER = ['Security', 'Provisioning', 'Deployment', 'Business', 'Launch'];

const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CheckRow({ check, onSaved }: { check: QACheck; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(check.status);
  const [message, setMessage] = useState(check.message ?? '');
  const [saving, setSaving] = useState(false);

  const cfg = STATUS_CFG[check.status];

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('platform_qa_checks').update({
      status,
      message: message.trim() || null,
      last_checked_at: new Date().toISOString(),
      checked_by: user?.email ?? 'platform_admin',
    }).eq('id', check.id);
    setSaving(false);
    setExpanded(false);
    onSaved();
  };

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-shrink-0">{cfg.icon}</div>
        <p className="flex-1 text-xs text-gray-700">{check.check_label}</p>
        {check.last_checked_at && (
          <span className="text-xs text-gray-300 hidden sm:block">{fmtDate(check.last_checked_at)}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2.5">
          {check.message && !message && (
            <p className="text-xs text-gray-500 italic">{check.message}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Status</p>
              <select value={status} onChange={e => setStatus(e.target.value as QACheck['status'])} className={inputCls}>
                <option value="not_checked">Not Checked</option>
                <option value="passing">Passing</option>
                <option value="warning">Warning</option>
                <option value="failing">Failing</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Note</p>
              <input type="text" value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Optional note…" className={inputCls} />
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </button>
        </div>
      )}
    </div>
  );
}

const LAUNCH_NOTES = [
  {
    heading: 'What is operational in Platform v1',
    items: [
      'Client onboarding and management',
      'Instance provisioning with auto-created steps, env requirements, handoff, launch package, health check, and lifecycle rows',
      'Deployment packs: source duplication, Netlify site, env vars, deploy, domain connection',
      'Billing and Stripe subscription sync (platform-sync-stripe-subscription)',
      'Stripe SaaS subscription webhook (platform-stripe-subscription-webhook)',
      'Instance access enforcement and event logging',
      'Instance health checks (platform-run-instance-health-checks)',
      'Launch packages with readiness checklist and mark-launched flow',
      'Client handoffs with confirmation and copy message',
      'Support tickets and ticket events',
      'Domain and DNS record tracking',
      'Client lifecycle tracking with recommended stages and event history',
      'Operations dashboard aggregating all client signals',
      'Platform alerts with generate, deduplication, and audit trail',
      'Platform QA checklist with production readiness tracking',
    ],
  },
  {
    heading: 'What remains manual (not automated)',
    items: [
      'Actual GitHub/GitLab repo forking — the source duplication step prepares the job but the real fork must be done manually or via a CI pipeline',
      'Supabase project creation — platform-setup-supabase-instance tracks the step but actual project creation is guided/manual unless a Supabase Management API token is configured',
      'DNS propagation — domain records are tracked but actual DNS entries must be added by the client or domain registrar',
      'SSL certificate issuance — tracked as ssl_pending; certificate issuance is handled by Netlify automatically after DNS points correctly',
      'Stripe product/price creation — must be done manually in Stripe dashboard before subscription sync works',
      'Sending external notification emails to clients — platform alert emails are not yet automated',
    ],
  },
  {
    heading: 'Required secrets to configure',
    items: [
      'STRIPE_PLATFORM_SECRET_KEY — Stripe secret key for the SaaS platform account',
      'STRIPE_PLATFORM_WEBHOOK_SECRET — Stripe webhook signing secret for the SaaS subscription webhook endpoint',
      'NETLIFY_ACCESS_TOKEN — Netlify personal access token with site creation permissions',
      'GITHUB_ACCESS_TOKEN (or GITLAB_TOKEN) — token for source template duplication',
      'SUPABASE_ACCESS_TOKEN + SUPABASE_ORGANIZATION_ID — only required if using automated Supabase project creation via the Management API (optional; manual setup works without these)',
      'All secrets must be added as Supabase Edge Function secrets — never hardcoded in frontend code',
    ],
  },
  {
    heading: 'Stripe webhook endpoint',
    items: [
      'Register the webhook endpoint in your Stripe dashboard under Developers > Webhooks',
      'Endpoint URL: https://<your-supabase-project>.supabase.co/functions/v1/platform-stripe-subscription-webhook',
      'Events to listen for: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed',
      'Copy the webhook signing secret and set it as STRIPE_PLATFORM_WEBHOOK_SECRET in Supabase Edge Function secrets',
    ],
  },
  {
    heading: 'Netlify provider reminder',
    items: [
      'Create a Netlify team/organization for client deployments',
      'Generate a personal access token with full site access',
      'Add the token as NETLIFY_ACCESS_TOKEN in Supabase Edge Function secrets',
      'Configure the Netlify integration in Platform > Integrations before running deployment actions',
    ],
  },
  {
    heading: 'Supabase bootstrap manual requirement',
    items: [
      'The platform-bootstrap-client-database edge function runs the schema SQL against a client Supabase instance',
      'The client Supabase URL and service role key must be configured in the instance env requirements before bootstrapping',
      'Bootstrap only runs the schema — it does not create the Supabase project itself',
      'After bootstrap, the client admin can log in using the Supabase-provided auth credentials',
    ],
  },
];

export default function PlatformQA() {
  const [checks, setChecks] = useState<QACheck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_qa_checks').select('*').order('check_group').order('check_label');
    setChecks((data ?? []) as QACheck[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = GROUP_ORDER.map(g => ({
    group: g,
    checks: checks.filter(c => c.check_group === g),
  })).filter(g => g.checks.length > 0);

  const total    = checks.length;
  const passing  = checks.filter(c => c.status === 'passing').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const failing  = checks.filter(c => c.status === 'failing').length;
  const checked  = checks.filter(c => c.status !== 'not_checked').length;
  const lastChecked = checks
    .filter(c => c.last_checked_at)
    .sort((a, b) => new Date(b.last_checked_at!).getTime() - new Date(a.last_checked_at!).getTime())[0]?.last_checked_at ?? null;

  const readiness = failing > 0 ? 'not_ready' : warnings > 0 ? 'needs_review' : passing === total && total > 0 ? 'ready' : 'in_progress';
  const readinessCfg = {
    not_ready:   { cls: 'bg-red-50 border-red-300',    text: 'text-red-700',    label: 'Not Ready for Production' },
    needs_review:{ cls: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', label: 'Needs Review' },
    ready:       { cls: 'bg-green-50 border-green-300', text: 'text-green-700',  label: 'Ready for Production' },
    in_progress: { cls: 'bg-gray-50',                  text: 'text-gray-600',   label: 'QA In Progress' },
  }[readiness];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Platform QA</h1>
            <p className="text-sm text-gray-500">Production readiness checklist</p>
          </div>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Readiness banner */}
      <div className={`rounded-xl border-2 p-4 ${readinessCfg.cls}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className={`text-lg font-bold ${readinessCfg.text}`}>{readinessCfg.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">Last checked: {fmtDate(lastChecked)}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-400">Total</p>
              <p className="font-bold text-gray-900">{total}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Checked</p>
              <p className="font-bold text-gray-700">{checked}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Passing</p>
              <p className="font-bold text-green-600">{passing}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Warnings</p>
              <p className="font-bold text-yellow-600">{warnings}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Failing</p>
              <p className="font-bold text-red-600">{failing}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ group, checks: groupChecks }) => {
            const gPass = groupChecks.filter(c => c.status === 'passing').length;
            const gFail = groupChecks.filter(c => c.status === 'failing').length;
            const gWarn = groupChecks.filter(c => c.status === 'warning').length;
            return (
              <div key={group}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{group}</h2>
                    <span className="text-xs text-gray-400">{groupChecks.length} checks</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {gFail > 0  && <span className="text-red-600 font-medium">{gFail} failing</span>}
                    {gWarn > 0  && <span className="text-yellow-600 font-medium">{gWarn} warnings</span>}
                    {gPass > 0  && <span className="text-green-600">{gPass} passing</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  {groupChecks.map(c => <CheckRow key={c.id} check={c} onSaved={load} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Launch notes */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900">Platform v1 Launch Notes</h2>
        </div>
        <div className="space-y-4">
          {LAUNCH_NOTES.map(section => (
            <div key={section.heading} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-800 mb-2">{section.heading}</p>
              <ul className="space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
