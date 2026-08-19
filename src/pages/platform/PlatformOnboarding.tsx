import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, Shield, Loader2,
  User, Server, Cpu, Eye, Sparkles,
} from 'lucide-react';
import { ProviderReadinessSummary, ProviderStatus } from './ProvisioningActions';

// ── Slug generation ──────────────────────────────────────────────────────────
function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  const slug = toSlug(base);
  if (!slug) return '';
  const { data } = await supabase
    .from('platform_instances')
    .select('instance_slug')
    .like('instance_slug', `${slug}%`);
  const existing = new Set((data ?? []).map((r: { instance_slug: string | null }) => r.instance_slug));
  if (!existing.has(slug)) return slug;
  for (let i = 2; i < 100; i++) {
    const candidate = `${slug}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

// ── Step types ───────────────────────────────────────────────────────────────
interface ClientForm {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  business_name: string;
  status: string;
  plan_name: string;
  billing_status: string;
  notes: string;
}

interface InstanceForm {
  instance_name: string;
  property_name: string;
  custom_domain: string;
  environment: string;
  deployment_strategy: string;
  template_version: string;
}

interface GeneratedData {
  instance_slug: string;
  frontend_url: string;
  admin_url: string;
  source_template_ref: string;
}

const STEP_LABELS = ['Client Info', 'Instance Info', 'Generated Setup', 'Review & Create'];

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < current ? 'bg-gray-900 text-white' : i === current ? 'bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-2' : 'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 sm:w-12 transition-colors ${i < current ? 'bg-gray-900' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-gray-500 font-medium w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-900 font-mono break-all">{value || <em className="text-gray-300 font-sans">—</em>}</span>
    </div>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────────────
export default function PlatformOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1
  const [client, setClient] = useState<ClientForm>({
    owner_name: '', owner_email: '', owner_phone: '', business_name: '',
    status: 'trial', plan_name: '', billing_status: 'pending', notes: '',
  });

  // Step 2
  const [instance, setInstance] = useState<InstanceForm>({
    instance_name: '', property_name: '', custom_domain: '',
    environment: 'production', deployment_strategy: 'manual', template_version: '',
  });

  // Step 3 (generated)
  const [generated, setGenerated] = useState<GeneratedData>({
    instance_slug: '', frontend_url: '', admin_url: '', source_template_ref: '',
  });
  const [generatingSlug, setGeneratingSlug] = useState(false);

  // Step 4
  const [startJob, setStartJob] = useState(true);

  // Meta
  const [activeTemplateVersion, setActiveTemplateVersion] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    supabase
      .from('platform_provider_integrations')
      .select('provider,display_name,status')
      .then(({ data }) => setProviderStatuses((data ?? []) as ProviderStatus[]));
    supabase
      .from('platform_template_versions')
      .select('version')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.version) {
          setActiveTemplateVersion(data.version);
          setInstance(prev => prev.template_version ? prev : { ...prev, template_version: data.version });
        }
      });
  }, []);

  const setClientField = (k: keyof ClientForm, v: string) =>
    setClient(f => ({ ...f, [k]: v }));
  const setInstanceField = (k: keyof InstanceForm, v: string) =>
    setInstance(f => ({ ...f, [k]: v }));

  // ── Validation per step ──────────────────────────────────────────────────
  const validateStep = async (s: number): Promise<string[]> => {
    const errs: string[] = [];
    if (s === 0) {
      if (!client.owner_name.trim()) errs.push('Owner name is required.');
      if (!client.owner_email.trim()) errs.push('Owner email is required.');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.owner_email)) errs.push('Invalid email format.');
      if (!client.business_name.trim()) errs.push('Business name is required.');
      if (errs.length === 0 && client.owner_email.trim()) {
        const { data } = await supabase
          .from('platform_clients')
          .select('id')
          .eq('owner_email', client.owner_email.trim())
          .maybeSingle();
        if (data) setEmailWarning('A client with this email already exists. You may proceed if intentional.');
        else setEmailWarning('');
      }
    }
    if (s === 1) {
      if (!instance.instance_name.trim()) errs.push('Instance name is required.');
      if (!instance.property_name.trim()) errs.push('Property name is required.');
      if (!instance.template_version.trim()) errs.push('Template version is required.');
    }
    return errs;
  };

  // ── Step 2→3: Generate derived fields ───────────────────────────────────
  const buildGenerated = async () => {
    setGeneratingSlug(true);
    const base = client.business_name.trim() || instance.instance_name.trim();
    const slug = await uniqueSlug(base);
    const domain = instance.custom_domain.trim();
    const frontend_url = domain ? `https://${domain}` : '';
    const admin_url = domain ? `https://${domain}/admin` : '';
    setGenerated({
      instance_slug: slug,
      frontend_url,
      admin_url,
      source_template_ref: instance.template_version.trim(),
    });
    setGeneratingSlug(false);
  };

  const next = async () => {
    const errs = await validateStep(step);
    setErrors(errs);
    if (errs.length) return;
    if (step === 1) await buildGenerated();
    setStep(s => s + 1);
  };

  const back = () => { setErrors([]); setStep(s => s - 1); };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setErrors([]);

    // 1. Create client
    const { data: newClient, error: clientErr } = await supabase
      .from('platform_clients')
      .insert({
        owner_name: client.owner_name.trim(),
        owner_email: client.owner_email.trim(),
        owner_phone: client.owner_phone.trim() || null,
        business_name: client.business_name.trim() || null,
        status: client.status,
        plan_name: client.plan_name.trim() || null,
        billing_status: client.billing_status.trim() || null,
        notes: client.notes.trim() || null,
        signup_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .maybeSingle();

    if (clientErr || !newClient) {
      setErrors([clientErr?.message ?? 'Failed to create client.']);
      setSubmitting(false);
      return;
    }

    // 2. Create instance (triggers auto-create provisioning_steps + env_requirements)
    const { data: newInst, error: instErr } = await supabase
      .from('platform_instances')
      .insert({
        client_id: newClient.id,
        instance_name: instance.instance_name.trim(),
        property_name: instance.property_name.trim() || null,
        custom_domain: instance.custom_domain.trim() || null,
        environment: instance.environment,
        deployment_strategy: instance.deployment_strategy,
        instance_slug: generated.instance_slug || null,
        frontend_url: generated.frontend_url || null,
        admin_url: generated.admin_url || null,
        source_template_ref: generated.source_template_ref || null,
        current_version: instance.template_version.trim() || null,
        update_status: 'up_to_date',
        provisioning_status: 'not_started',
      })
      .select()
      .maybeSingle();

    if (instErr || !newInst) {
      setErrors([instErr?.message ?? 'Failed to create instance.']);
      setSubmitting(false);
      return;
    }

    // 3. Optionally create provisioning job
    if (startJob) {
      const { data: job } = await supabase
        .from('platform_provisioning_jobs')
        .insert({
          instance_id: newInst.id,
          client_id: newClient.id,
          status: 'queued',
          job_type: 'new_instance',
          template_version: instance.template_version.trim() || null,
          requested_by: adminEmail || null,
        })
        .select()
        .maybeSingle();

      if (job) {
        await supabase.from('platform_provisioning_job_events').insert({
          job_id: job.id,
          event_type: 'info',
          message: `Provisioning job created via onboarding wizard by ${adminEmail || 'admin'}`,
        });
        await supabase
          .from('platform_instances')
          .update({ provisioning_status: 'pending' })
          .eq('id', newInst.id);
        navigate(`/platform/provisioning/jobs/${job.id}`);
        return;
      }
    }

    navigate(`/platform/provisioning/${newInst.id}/pack`);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/platform" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">New Client Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set up a new client and their first app instance.</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Platform tracking only.</strong> This wizard creates tracking records in the platform admin.
          External Supabase/Netlify project creation is still manual until API automation is connected.
        </p>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-2xl border px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <StepIndicator current={step} total={STEP_LABELS.length} />
          <p className="text-sm font-semibold text-gray-700">{STEP_LABELS[step]}</p>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{e}
            </p>
          ))}
        </div>
      )}

      {/* Email warning (non-blocking) */}
      {emailWarning && step === 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-800">{emailWarning}</p>
        </div>
      )}

      {/* ── Step 0: Client Info ── */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Client Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Owner Name *</label>
              <input value={client.owner_name} onChange={e => setClientField('owner_name', e.target.value)} className={inputCls} placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Owner Email *</label>
              <input type="email" value={client.owner_email} onChange={e => setClientField('owner_email', e.target.value)} className={inputCls} placeholder="jane@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={client.owner_phone} onChange={e => setClientField('owner_phone', e.target.value)} className={inputCls} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={labelCls}>Business Name *</label>
              <input value={client.business_name} onChange={e => setClientField('business_name', e.target.value)} className={inputCls} placeholder="Beachside Cottages LLC" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={client.status} onChange={e => setClientField('status', e.target.value)} className={inputCls}>
                {['lead', 'trial', 'active', 'past_due', 'suspended', 'cancelled'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              <input value={client.plan_name} onChange={e => setClientField('plan_name', e.target.value)} className={inputCls} placeholder="Starter" />
            </div>
            <div>
              <label className={labelCls}>Billing Status</label>
              <input value={client.billing_status} onChange={e => setClientField('billing_status', e.target.value)} className={inputCls} placeholder="pending" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={client.notes} onChange={e => setClientField('notes', e.target.value)} rows={2} className={inputCls} placeholder="Referred by..." />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Instance Info ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Instance Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Instance Name *</label>
              <input value={instance.instance_name} onChange={e => setInstanceField('instance_name', e.target.value)} className={inputCls} placeholder="Jane's Beach Cottage" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Property Name *</label>
              <input value={instance.property_name} onChange={e => setInstanceField('property_name', e.target.value)} className={inputCls} placeholder="The Beachside Bungalow" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Custom Domain (optional)</label>
              <input value={instance.custom_domain} onChange={e => setInstanceField('custom_domain', e.target.value)} className={inputCls} placeholder="cabin.example.com" />
              <p className="text-xs text-gray-400 mt-1">If set, URL placeholders will be generated using this domain.</p>
            </div>
            <div>
              <label className={labelCls}>Environment</label>
              <select value={instance.environment} onChange={e => setInstanceField('environment', e.target.value)} className={inputCls}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="template">Template</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Deployment Strategy</label>
              <select value={instance.deployment_strategy} onChange={e => setInstanceField('deployment_strategy', e.target.value)} className={inputCls}>
                <option value="manual">Manual</option>
                <option value="semi_automated">Semi Automated</option>
                <option value="automated">Automated</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Target Template Version *</label>
              <input
                value={instance.template_version}
                onChange={e => setInstanceField('template_version', e.target.value)}
                className={inputCls}
                placeholder={activeTemplateVersion || '1.0.0'}
                list="tv-suggestions"
              />
              {activeTemplateVersion && (
                <datalist id="tv-suggestions">
                  <option value={activeTemplateVersion} />
                </datalist>
              )}
              {activeTemplateVersion && (
                <p className="text-xs text-gray-400 mt-1">Active version: v{activeTemplateVersion}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Generated Setup ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Generated Setup</h2>
          </div>
          {generatingSlug ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Instance Slug</label>
                <input
                  value={generated.instance_slug}
                  onChange={e => setGenerated(g => ({ ...g, instance_slug: toSlug(e.target.value) }))}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Auto-generated from business name. Edit if needed.</p>
              </div>
              <div>
                <label className={labelCls}>Frontend URL Placeholder</label>
                <input
                  value={generated.frontend_url}
                  onChange={e => setGenerated(g => ({ ...g, frontend_url: e.target.value }))}
                  className={inputCls}
                  placeholder="Will be set after Netlify deploy"
                />
                {!instance.custom_domain.trim() && (
                  <p className="text-xs text-gray-400 mt-1">No custom domain set — leave blank or fill after deploy.</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Admin URL Placeholder</label>
                <input
                  value={generated.admin_url}
                  onChange={e => setGenerated(g => ({ ...g, admin_url: e.target.value }))}
                  className={inputCls}
                  placeholder="Will be set after Netlify deploy"
                />
              </div>
              <div>
                <label className={labelCls}>Source Template Ref</label>
                <input
                  value={generated.source_template_ref}
                  onChange={e => setGenerated(g => ({ ...g, source_template_ref: e.target.value }))}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">The template version this instance is built from.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Review & Create ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Security reminder */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Security reminder:</strong> Do not store API keys, Supabase service role keys, or secrets here.
            </p>
          </div>

          {/* Client summary */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Client</h3>
            <div className="divide-y divide-gray-100">
              <ReviewRow label="Owner Name" value={client.owner_name} />
              <ReviewRow label="Email" value={client.owner_email} />
              <ReviewRow label="Phone" value={client.owner_phone} />
              <ReviewRow label="Business Name" value={client.business_name} />
              <ReviewRow label="Status" value={client.status} />
              <ReviewRow label="Plan" value={client.plan_name} />
              <ReviewRow label="Billing Status" value={client.billing_status} />
            </div>
          </div>

          {/* Instance summary */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Instance</h3>
            <div className="divide-y divide-gray-100">
              <ReviewRow label="Instance Name" value={instance.instance_name} />
              <ReviewRow label="Property Name" value={instance.property_name} />
              <ReviewRow label="Environment" value={instance.environment} />
              <ReviewRow label="Template Version" value={instance.template_version} />
              <ReviewRow label="Instance Slug" value={generated.instance_slug} />
              <ReviewRow label="Frontend URL" value={generated.frontend_url || '(none — set after deploy)'} />
              <ReviewRow label="Admin URL" value={generated.admin_url || '(none — set after deploy)'} />
              <ReviewRow label="Source Template Ref" value={generated.source_template_ref} />
              <ReviewRow label="Deployment Strategy" value={instance.deployment_strategy} />
            </div>
          </div>

          {/* What will be created */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">What Will Be Created</h3>
            <ul className="space-y-1.5">
              {[
                'platform_clients row',
                'platform_instances row linked to client',
                'Provisioning checklist steps (auto-created by trigger)',
                'Environment variable requirements (auto-created by trigger)',
                'Deployment pack (available immediately)',
                startJob ? 'Provisioning job (queued)' : null,
              ].filter(Boolean).map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Provider readiness */}
          <ProviderReadinessSummary statuses={providerStatuses} />

          {/* Start job checkbox */}
          <div className="bg-white rounded-2xl border p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={startJob}
                onChange={e => setStartJob(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Start provisioning job immediately</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates a queued provisioning job for this instance. You can track its progress in the Provisioning Jobs page.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button
            onClick={back}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <Link
            to="/platform"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Link>
        )}

        {step < STEP_LABELS.length - 1 ? (
          <button
            onClick={next}
            className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Cpu className="w-4 h-4" /> Create Client & Instance</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
