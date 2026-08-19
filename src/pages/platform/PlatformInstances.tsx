import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Globe, Shield, Database, ExternalLink, Loader2, Search,
  Pencil, Plus, X, Save, AlertCircle, ClipboardList, UserPlus, Rocket,
} from 'lucide-react';

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
  target_version: string | null;
  update_status: string;
  last_deployed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
}

const PROV_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  pending:     'bg-yellow-100 text-yellow-800',
  deployed:    'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  suspended:   'bg-orange-100 text-orange-800',
};

const ENV_STYLES: Record<string, string> = {
  production: 'bg-blue-50 text-blue-700',
  staging:    'bg-purple-50 text-purple-700',
  template:   'bg-gray-100 text-gray-600',
};

const UPDATE_STATUS_STYLES: Record<string, string> = {
  update_available: 'bg-blue-50 text-blue-700',
  pending_update:   'bg-yellow-100 text-yellow-800',
  updating:         'bg-blue-100 text-blue-800',
  updated:          'bg-green-100 text-green-800',
  failed:           'bg-red-100 text-red-700',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const INSTANCE_EMPTY = {
  client_id: '', instance_name: '', property_name: '', frontend_url: '',
  admin_url: '', custom_domain: '', netlify_site_id: '', supabase_project_ref: '',
  supabase_project_url: '', environment: 'production',
  provisioning_status: 'not_started', current_version: '', notes: '',
};

type InstanceForm = typeof INSTANCE_EMPTY;

interface Client { id: string; owner_name: string; business_name: string | null; }

function InstanceModal({
  instance,
  clients,
  onClose,
  onSaved,
}: {
  instance: PlatformInstance | null;
  clients: Client[];
  onClose: () => void;
  onSaved: (i: PlatformInstance) => void;
}) {
  const [form, setForm] = useState<InstanceForm>(() => instance ? {
    client_id: instance.client_id,
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
  } : { ...INSTANCE_EMPTY, client_id: clients[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof InstanceForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.instance_name.trim()) { setError('Instance name is required.'); return; }
    if (!form.client_id) { setError('Select a client.'); return; }
    setSaving(true); setError('');
    const payload = {
      client_id: form.client_id,
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
              <label className={labelCls}>Client *</label>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls} disabled={!!instance}>
                {!form.client_id && <option value="">Select a client...</option>}
                {clients.map(c => <option key={c.id} value={c.id}>{c.owner_name}{c.business_name ? ` — ${c.business_name}` : ''}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Instance Name *</label>
              <input value={form.instance_name} onChange={e => set('instance_name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Property Name</label>
              <input value={form.property_name} onChange={e => set('property_name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Frontend URL</label>
              <input value={form.frontend_url} onChange={e => set('frontend_url', e.target.value)} className={inputCls} placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Admin URL</label>
              <input value={form.admin_url} onChange={e => set('admin_url', e.target.value)} className={inputCls} placeholder="https://.../admin" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Custom Domain</label>
              <input value={form.custom_domain} onChange={e => set('custom_domain', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Netlify Site ID</label>
              <input value={form.netlify_site_id} onChange={e => set('netlify_site_id', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Supabase Ref</label>
              <input value={form.supabase_project_ref} onChange={e => set('supabase_project_ref', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Supabase URL</label>
              <input value={form.supabase_project_url} onChange={e => set('supabase_project_url', e.target.value)} className={inputCls} />
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
              <label className={labelCls}>Version</label>
              <input value={form.current_version} onChange={e => set('current_version', e.target.value)} className={inputCls} placeholder="1.0.0" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} rows={3} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {instance ? 'Save Changes' : 'Add Instance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformInstances() {
  const [instances, setInstances] = useState<PlatformInstance[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; instance: PlatformInstance | null }>({ open: false, instance: null });

  useEffect(() => {
    Promise.all([
      supabase.from('platform_instances').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_clients').select('id,owner_name,business_name').order('owner_name'),
    ]).then(([ir, cr]) => {
      const cls = (cr.data as Client[]) ?? [];
      const clientMap = Object.fromEntries(cls.map(c => [c.id, c.owner_name + (c.business_name ? ` — ${c.business_name}` : '')]));
      const insts = ((ir.data as PlatformInstance[]) ?? []).map(i => ({ ...i, client_name: clientMap[i.client_id] ?? 'Unknown' }));
      setInstances(insts);
      setClients(cls);
      setLoading(false);
    });
  }, []);

  const filtered = instances.filter(i =>
    !search ||
    i.instance_name.toLowerCase().includes(search.toLowerCase()) ||
    (i.property_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = (saved: PlatformInstance) => {
    const clientName = clients.find(c => c.id === saved.client_id)?.owner_name ?? 'Unknown';
    const withName = { ...saved, client_name: clientName };
    setInstances(prev => {
      const idx = prev.findIndex(i => i.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = withName; return next; }
      return [withName, ...prev];
    });
    setModal({ open: false, instance: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instances</h1>
          <p className="text-sm text-gray-500 mt-0.5">{instances.length} total instance{instances.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/platform/onboarding/new"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> New Client Onboarding
          </Link>
          <button
            onClick={() => setModal({ open: true, instance: null })}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Quick Add
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search instances..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-sm text-gray-400">
          {search ? 'No instances match your search.' : 'No instances yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inst => (
            <div key={inst.id} className="bg-white rounded-2xl border p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{inst.instance_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROV_STYLES[inst.provisioning_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inst.provisioning_status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENV_STYLES[inst.environment] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inst.environment}
                    </span>
                  </div>
                  {inst.client_name && (
                    <Link to={`/platform/clients/${inst.client_id}`} className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
                      {inst.client_name}
                    </Link>
                  )}
                  {inst.property_name && <p className="text-xs text-gray-500 mt-0.5">{inst.property_name}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {inst.current_version && <span className="text-xs text-gray-400">v{inst.current_version}</span>}
                    {inst.target_version && <span className="text-xs text-gray-400">→ v{inst.target_version}</span>}
                    {inst.update_status && inst.update_status !== 'up_to_date' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UPDATE_STATUS_STYLES[inst.update_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inst.update_status.replace(/_/g, ' ')}
                      </span>
                    )}
                    {inst.last_deployed_at && <span className="text-xs text-gray-400">Deployed {fmtDate(inst.last_deployed_at)}</span>}
                    {inst.custom_domain && <span className="text-xs text-gray-400">{inst.custom_domain}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inst.frontend_url && (
                    <a href={inst.frontend_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Open Frontend">
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {inst.admin_url && (
                    <a href={inst.admin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Open Admin">
                      <Shield className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {inst.supabase_project_url && (
                    <a href={inst.supabase_project_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Open Supabase">
                      <Database className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <Link
                    to={`/platform/provisioning/${inst.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    title="Manage Provisioning"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to={`/platform/instances/${inst.id}/launch-package`}
                    className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-400 hover:text-purple-700"
                    title="Launch Package"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => setModal({ open: true, instance: inst })}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {inst.notes && <p className="text-xs text-gray-500 mt-3 pt-3 border-t">{inst.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <InstanceModal
          instance={modal.instance}
          clients={clients}
          onClose={() => setModal({ open: false, instance: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
