import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { DeleteClientModal } from './DeleteClientModal';
import { BillingCard } from './BillingCard';
import { InstanceAccessStatusCard } from './InstanceAccessStatusCard';
import { InstanceHealthChecksCard } from './InstanceHealthChecksCard';
import { SupportTicketsCard } from './SupportTicketsCard';
import { DomainReadinessCard } from './DomainReadinessCard';
import { ClientLifecycleCard } from './ClientLifecycleCard';
import {
  ArrowLeft, ExternalLink, Globe, Shield, Database, Server,
  Pencil, Plus, Loader2, AlertCircle, X, Save, Activity,
  CheckCircle2, Clock, MessageSquare, Trash2, ClipboardList, Cpu, Rocket, CheckCircle,
} from 'lucide-react';
import type { PlatformClient } from './PlatformClients';

interface PlatformInstance {
  id: string;
  client_id: string;
  instance_name: string;
  property_name: string | null;
  frontend_url: string | null;
  admin_url: string | null;
  custom_domain: string | null;
  netlify_site_id: string | null;
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  environment: string;
  provisioning_status: string;
  current_version: string | null;
  last_deployed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AccessLog {
  id: string;
  accessed_by: string;
  access_type: string;
  reason: string | null;
  created_at: string;
}

const PROV_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  pending:     'bg-yellow-100 text-yellow-800',
  deployed:    'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  suspended:   'bg-orange-100 text-orange-800',
};

const STATUS_STYLES: Record<string, string> = {
  lead:      'bg-gray-100 text-gray-700',
  trial:     'bg-yellow-100 text-yellow-800',
  active:    'bg-green-100 text-green-800',
  past_due:  'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  viewed_dashboard: 'Viewed dashboard',
  opened_frontend:  'Opened frontend',
  opened_backend:   'Opened backend',
  support_note:     'Support note',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const INSTANCE_EMPTY = {
  instance_name: '', property_name: '', frontend_url: '', admin_url: '',
  custom_domain: '', netlify_site_id: '', supabase_project_ref: '',
  supabase_project_url: '', environment: 'production',
  provisioning_status: 'not_started', current_version: '', notes: '',
};

type InstanceForm = typeof INSTANCE_EMPTY;

function InstanceModal({
  clientId,
  instance,
  onClose,
  onSaved,
}: {
  clientId: string;
  instance: PlatformInstance | null;
  onClose: () => void;
  onSaved: (i: PlatformInstance) => void;
}) {
  const [form, setForm] = useState<InstanceForm>(() => instance ? {
    instance_name: instance.instance_name,
    property_name: instance.property_name ?? '',
    frontend_url: instance.frontend_url ?? '',
    admin_url: instance.admin_url ?? '',
    custom_domain: instance.custom_domain ?? '',
    netlify_site_id: instance.netlify_site_id ?? '',
    supabase_project_ref: instance.supabase_project_ref ?? '',
    supabase_project_url: instance.supabase_project_url ?? '',
    environment: instance.environment,
    provisioning_status: instance.provisioning_status,
    current_version: instance.current_version ?? '',
    notes: instance.notes ?? '',
  } : { ...INSTANCE_EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof InstanceForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.instance_name.trim()) { setError('Instance name is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      client_id: clientId,
      instance_name: form.instance_name.trim(),
      property_name: form.property_name.trim() || null,
      frontend_url: form.frontend_url.trim() || null,
      admin_url: form.admin_url.trim() || null,
      custom_domain: form.custom_domain.trim() || null,
      netlify_site_id: form.netlify_site_id.trim() || null,
      supabase_project_ref: form.supabase_project_ref.trim() || null,
      supabase_project_url: form.supabase_project_url.trim() || null,
      environment: form.environment,
      provisioning_status: form.provisioning_status,
      current_version: form.current_version.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (instance) {
      const { data, error: e } = await supabase.from('platform_instances').update(payload).eq('id', instance.id).select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      onSaved(data as PlatformInstance);
    } else {
      const { data, error: e } = await supabase.from('platform_instances').insert(payload).select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      onSaved(data as PlatformInstance);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">{instance ? 'Edit Instance' : 'Add Instance'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Instance Name *</label>
              <input value={form.instance_name} onChange={e => set('instance_name', e.target.value)} className={inputCls} placeholder="Jane's Tiki Cottage" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Property Name</label>
              <input value={form.property_name} onChange={e => set('property_name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Frontend URL</label>
              <input value={form.frontend_url} onChange={e => set('frontend_url', e.target.value)} className={inputCls} placeholder="https://example.netlify.app" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Admin URL</label>
              <input value={form.admin_url} onChange={e => set('admin_url', e.target.value)} className={inputCls} placeholder="https://example.netlify.app/admin" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Custom Domain</label>
              <input value={form.custom_domain} onChange={e => set('custom_domain', e.target.value)} className={inputCls} placeholder="cabin.example.com" />
            </div>
            <div>
              <label className={labelCls}>Netlify Site ID</label>
              <input value={form.netlify_site_id} onChange={e => set('netlify_site_id', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Supabase Project Ref</label>
              <input value={form.supabase_project_ref} onChange={e => set('supabase_project_ref', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Supabase Project URL</label>
              <input value={form.supabase_project_url} onChange={e => set('supabase_project_url', e.target.value)} className={inputCls} placeholder="https://xxx.supabase.co" />
            </div>
            <div>
              <label className={labelCls}>Environment</label>
              <select value={form.environment} onChange={e => set('environment', e.target.value)} className={inputCls}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="template">Template</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Provisioning Status</label>
              <select value={form.provisioning_status} onChange={e => set('provisioning_status', e.target.value)} className={inputCls}>
                <option value="not_started">Not Started</option>
                <option value="pending">Pending</option>
                <option value="deployed">Deployed</option>
                <option value="failed">Failed</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Current Version</label>
              <input value={form.current_version} onChange={e => set('current_version', e.target.value)} className={inputCls} placeholder="1.0.0" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} rows={3} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {instance ? 'Save Changes' : 'Add Instance'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupportNoteModal({
  clientId,
  instanceId,
  accessedBy,
  onClose,
  onSaved,
}: {
  clientId: string;
  instanceId?: string | null;
  accessedBy: string;
  onClose: () => void;
  onSaved: (log: AccessLog) => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('platform_support_access_logs').insert({
      client_id: clientId,
      instance_id: instanceId ?? null,
      accessed_by: accessedBy,
      reason: note.trim(),
      access_type: 'support_note',
    }).select().maybeSingle();
    if (data) onSaved(data as AccessLog);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Add Support Note</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe the support action or note..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900"
            rows={4}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !note.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

async function logAccess(params: {
  clientId: string;
  instanceId?: string | null;
  accessedBy: string;
  accessType: string;
  reason?: string;
}) {
  await supabase.from('platform_support_access_logs').insert({
    client_id: params.clientId,
    instance_id: params.instanceId ?? null,
    accessed_by: params.accessedBy,
    access_type: params.accessType,
    reason: params.reason ?? null,
  });
}

export default function PlatformClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<PlatformClient | null>(null);
  const [instances, setInstances] = useState<PlatformInstance[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [editClient, setEditClient] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [instanceModal, setInstanceModal] = useState<{ open: boolean; instance: PlatformInstance | null }>({ open: false, instance: null });
  const [noteModal, setNoteModal] = useState(false);
  const [activeJobs, setActiveJobs] = useState<Record<string, { id: string; status: string }>>({});

  useEffect(() => {
    if (!clientId) return;
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    Promise.all([
      supabase.from('platform_clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('platform_instances').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('platform_support_access_logs').select('id,accessed_by,access_type,reason,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
    ]).then(async ([cr, ir, lr]) => {
      setClient(cr.data as PlatformClient ?? null);
      const insts = (ir.data as PlatformInstance[]) ?? [];
      setInstances(insts);
      setLogs((lr.data as AccessLog[]) ?? []);

      if (insts.length > 0) {
        const { data: jobs } = await supabase
          .from('platform_provisioning_jobs')
          .select('id,instance_id,status')
          .in('instance_id', insts.map(i => i.id))
          .not('status', 'in', '("succeeded","failed","cancelled")')
          .order('created_at', { ascending: false });
        const jobMap: Record<string, { id: string; status: string }> = {};
        for (const j of jobs ?? []) {
          if (!jobMap[j.instance_id]) jobMap[j.instance_id] = { id: j.id, status: j.status };
        }
        setActiveJobs(jobMap);
      }
      setLoading(false);
    });
  }, [clientId]);

  const handleOpenUrl = async (url: string, accessType: string, instanceId?: string | null) => {
    if (clientId) {
      await logAccess({ clientId, instanceId, accessedBy: adminEmail, accessType, reason: url });
      setLogs(prev => [{
        id: crypto.randomUUID(), accessed_by: adminEmail, access_type: accessType,
        reason: url, created_at: new Date().toISOString(),
      }, ...prev]);
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Client not found.</p>
        <Link to="/platform/clients" className="text-sm text-gray-500 hover:text-gray-900 underline mt-2 inline-block">Back to clients</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {deleteSuccess && (
        <div className="flex items-center gap-2.5 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          Client permanently deleted from Platform Dashboard.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link to="/platform/clients" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.owner_name}</h1>
          {client.business_name && <p className="text-sm text-gray-500">{client.business_name}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[client.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {client.status.replace('_', ' ')}
          </span>
          <button
            onClick={() => setDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            title="Delete this client permanently"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Client
          </button>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Client Info</h2>
          <button
            onClick={() => setEditClient(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div><p className="text-xs text-gray-500 font-medium">Email</p><p className="text-gray-900">{client.owner_email}</p></div>
          <div><p className="text-xs text-gray-500 font-medium">Phone</p><p className="text-gray-900">{client.owner_phone ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500 font-medium">Business</p><p className="text-gray-900">{client.business_name ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500 font-medium">Plan</p><p className="text-gray-900">{client.plan_name ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500 font-medium">Billing Status</p><p className="text-gray-900">{client.billing_status ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500 font-medium">Signup Date</p><p className="text-gray-900">{fmtDate(client.signup_date)}</p></div>
          {client.stripe_customer_id && (
            <div><p className="text-xs text-gray-500 font-medium">Stripe Customer</p><p className="text-gray-900 font-mono text-xs">{client.stripe_customer_id}</p></div>
          )}
          {client.stripe_subscription_id && (
            <div><p className="text-xs text-gray-500 font-medium">Stripe Subscription</p><p className="text-gray-900 font-mono text-xs">{client.stripe_subscription_id}</p></div>
          )}
        </div>
        {client.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Lifecycle */}
      <ClientLifecycleCard clientId={client.id} showHistory />

      {/* Support */}
      <SupportTicketsCard clientId={client.id} />

      {/* Billing */}
      <BillingCard clientId={client.id} />

      {/* Instances */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">App Instances ({instances.length})</h2>
          <button
            onClick={() => setInstanceModal({ open: true, instance: null })}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Instance
          </button>
        </div>
        {instances.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">
            No instances yet.
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map(inst => (
              <div key={inst.id} className="bg-white rounded-2xl border p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{inst.instance_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROV_STYLES[inst.provisioning_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inst.provisioning_status.replace('_', ' ')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {inst.environment}
                      </span>
                    </div>
                    {inst.property_name && <p className="text-xs text-gray-500 mt-0.5">{inst.property_name}</p>}
                    {inst.current_version && <p className="text-xs text-gray-400 mt-0.5">v{inst.current_version}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setInstanceModal({ open: true, instance: inst })}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Edit instance"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {inst.frontend_url && (
                    <button
                      onClick={() => handleOpenUrl(inst.frontend_url!, 'opened_frontend', inst.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Globe className="w-3 h-3" /> Open Frontend
                    </button>
                  )}
                  {inst.admin_url && (
                    <button
                      onClick={() => handleOpenUrl(inst.admin_url!, 'opened_backend', inst.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Shield className="w-3 h-3" /> Open Admin
                    </button>
                  )}
                  {inst.supabase_project_url && (
                    <button
                      onClick={() => handleOpenUrl(inst.supabase_project_url!, 'viewed_dashboard', inst.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Database className="w-3 h-3" /> Open Supabase
                    </button>
                  )}
                  {inst.netlify_site_id && (
                    <button
                      onClick={() => handleOpenUrl(`https://app.netlify.com/sites/${inst.netlify_site_id}`, 'viewed_dashboard', inst.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Netlify
                    </button>
                  )}
                  <Link
                    to={`/platform/provisioning/${inst.id}`}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ClipboardList className="w-3 h-3" /> Provisioning
                  </Link>
                  <Link
                    to={`/platform/instances/${inst.id}/launch-package`}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Rocket className="w-3 h-3" /> Launch Package
                  </Link>
                  {activeJobs[inst.id] && (
                    <Link
                      to={`/platform/provisioning/jobs/${activeJobs[inst.id].id}`}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Cpu className="w-3 h-3" /> Job ({activeJobs[inst.id].status})
                    </Link>
                  )}
                </div>
                {inst.notes && <p className="text-xs text-gray-500 mt-3 pt-3 border-t">{inst.notes}</p>}
                <div className="mt-4 pt-4 border-t space-y-4">
                  <InstanceAccessStatusCard instanceId={inst.id} />
                  <InstanceHealthChecksCard instanceId={inst.id} />
                  <DomainReadinessCard clientId={inst.client_id} instanceId={inst.id} netlifyDomain={inst.netlify_site_id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support Access Log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Support Log</h2>
          <button
            onClick={() => setNoteModal(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Add Note
          </button>
        </div>
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">No activity logged yet.</div>
        ) : (
          <div className="bg-white rounded-2xl border divide-y">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <Activity className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium">{ACCESS_TYPE_LABELS[log.access_type] ?? log.access_type}</p>
                  {log.reason && <p className="text-xs text-gray-500 mt-0.5 break-all">{log.reason}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">by {log.accessed_by}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {editClient && (
        <ClientEditModal
          client={client}
          onClose={() => setEditClient(false)}
          onSaved={c => { setClient(c); setEditClient(false); }}
        />
      )}

      {instanceModal.open && (
        <InstanceModal
          clientId={client.id}
          instance={instanceModal.instance}
          onClose={() => setInstanceModal({ open: false, instance: null })}
          onSaved={inst => {
            setInstances(prev => {
              const idx = prev.findIndex(i => i.id === inst.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = inst; return next; }
              return [inst, ...prev];
            });
            setInstanceModal({ open: false, instance: null });
          }}
        />
      )}

      {noteModal && (
        <SupportNoteModal
          clientId={client.id}
          accessedBy={adminEmail}
          onClose={() => setNoteModal(false)}
          onSaved={log => { setLogs(prev => [log, ...prev]); setNoteModal(false); }}
        />
      )}

      {deleteModal && (
        <DeleteClientModal
          clientId={client.id}
          clientName={client.owner_name}
          onClose={() => setDeleteModal(false)}
          onDeleted={() => {
            setDeleteModal(false);
            navigate('/platform/clients', { state: { deleted: true } });
          }}
        />
      )}
    </div>
  );
}

// Inline edit modal that reuses client form logic
function ClientEditModal({
  client,
  onClose,
  onSaved,
}: {
  client: PlatformClient;
  onClose: () => void;
  onSaved: (c: PlatformClient) => void;
}) {
  const STATUS_OPTIONS = ['lead', 'trial', 'active', 'past_due', 'suspended', 'cancelled'];
  const [form, setForm] = useState({
    owner_name: client.owner_name,
    owner_email: client.owner_email,
    owner_phone: client.owner_phone ?? '',
    business_name: client.business_name ?? '',
    status: client.status,
    plan_name: client.plan_name ?? '',
    billing_status: client.billing_status ?? '',
    notes: client.notes ?? '',
    signup_date: client.signup_date ?? '',
    stripe_customer_id: client.stripe_customer_id ?? '',
    stripe_subscription_id: client.stripe_subscription_id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.owner_name.trim() || !form.owner_email.trim()) { setError('Name and email required.'); return; }
    setSaving(true);
    const payload = {
      owner_name: form.owner_name.trim(), owner_email: form.owner_email.trim(),
      owner_phone: form.owner_phone.trim() || null, business_name: form.business_name.trim() || null,
      status: form.status, plan_name: form.plan_name.trim() || null,
      billing_status: form.billing_status.trim() || null, notes: form.notes.trim() || null,
      signup_date: form.signup_date || null,
      stripe_customer_id: form.stripe_customer_id.trim() || null,
      stripe_subscription_id: form.stripe_subscription_id.trim() || null,
    };
    const { data, error: e } = await supabase.from('platform_clients').update(payload).eq('id', client.id).select().maybeSingle();
    if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
    onSaved(data as PlatformClient);
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Edit Client</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={labelCls}>Owner Name *</label><input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>Owner Email *</label><input type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Phone</label><input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Business Name</label><input value={form.business_name} onChange={e => set('business_name', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
            <div><label className={labelCls}>Plan</label><input value={form.plan_name} onChange={e => set('plan_name', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Billing Status</label><input value={form.billing_status} onChange={e => set('billing_status', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Signup Date</label><input type="date" value={form.signup_date} onChange={e => set('signup_date', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Stripe Customer ID</label><input value={form.stripe_customer_id} onChange={e => set('stripe_customer_id', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Stripe Subscription ID</label><input value={form.stripe_subscription_id} onChange={e => set('stripe_subscription_id', e.target.value)} className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} rows={3} /></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
