import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  RefreshCw, Plus, Loader2, X, Save,
  ChevronDown, ChevronUp, Tag, AlertTriangle,
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

interface TemplateVersion {
  id: string;
  version: string;
  title: string;
  description: string | null;
  git_ref: string | null;
  status: string;
  release_notes: string | null;
  created_at: string;
}

interface PlatformInstance {
  id: string;
  instance_name: string;
  current_version: string | null;
  client_id: string;
  client_name?: string;
}

const JOB_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  running:   'bg-blue-100 text-blue-800',
  succeeded: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
};

const VERSION_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  draft:    'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-400',
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CreateVersionModal({ onClose, onSaved }: { onClose: () => void; onSaved: (v: TemplateVersion) => void }) {
  const [form, setForm] = useState({ version: '', title: '', description: '', git_ref: '', status: 'draft', release_notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.version.trim() || !form.title.trim()) { setError('Version and title are required.'); return; }
    setSaving(true);
    const { data, error: e } = await supabase.from('platform_template_versions').insert({
      version: form.version.trim(), title: form.title.trim(),
      description: form.description.trim() || null, git_ref: form.git_ref.trim() || null,
      status: form.status, release_notes: form.release_notes.trim() || null,
    }).select().maybeSingle();
    if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
    onSaved(data as TemplateVersion);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">New Template Version</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Version *</label><input value={form.version} onChange={e => set('version', e.target.value)} className={inputCls} placeholder="1.1.0" /></div>
            <div><label className={labelCls}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
            <div className="col-span-2"><label className={labelCls}>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="Master Template v1.1.0" /></div>
            <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} rows={2} /></div>
            <div className="col-span-2"><label className={labelCls}>Git Ref / Branch / Tag</label><input value={form.git_ref} onChange={e => set('git_ref', e.target.value)} className={inputCls} placeholder="v1.1.0 or main" /></div>
            <div className="col-span-2"><label className={labelCls}>Release Notes</label><textarea value={form.release_notes} onChange={e => set('release_notes', e.target.value)} className={inputCls} rows={3} placeholder="What changed in this version..." /></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Version
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateJobModal({ templateVersions, onClose, onSaved }: { templateVersions: TemplateVersion[]; onClose: () => void; onSaved: (j: UpdateJob) => void }) {
  const [form, setForm] = useState({
    target_version: templateVersions.find(v => v.status === 'active')?.version ?? '',
    scope: 'selected_instances' as 'all_instances' | 'selected_instances',
    notes: '',
  });
  const [instances, setInstances] = useState<PlatformInstance[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingInst, setLoadingInst] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('platform_instances').select('id,instance_name,current_version,client_id').order('instance_name')
      .then(async ({ data }) => {
        const insts = (data ?? []) as PlatformInstance[];
        const { data: clients } = await supabase.from('platform_clients').select('id,owner_name');
        const cm: Record<string, string> = {};
        for (const c of clients ?? []) cm[c.id] = c.owner_name;
        setInstances(insts.map(i => ({ ...i, client_name: cm[i.client_id] ?? '' })));
        setLoadingInst(false);
      });
  }, []);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    if (!form.target_version.trim()) { setError('Target version is required.'); return; }
    const targets = form.scope === 'all_instances' ? instances : instances.filter(i => selected.has(i.id));
    if (form.scope === 'selected_instances' && targets.length === 0) { setError('Select at least one instance.'); return; }
    setSaving(true); setError('');

    const { data: job, error: je } = await supabase.from('platform_update_jobs').insert({
      target_version: form.target_version.trim(), scope: form.scope,
      status: 'pending', notes: form.notes.trim() || null,
    }).select().maybeSingle();
    if (je || !job) { setError(je?.message ?? 'Failed to create job'); setSaving(false); return; }

    await supabase.from('platform_update_job_targets').insert(
      targets.map(inst => ({
        update_job_id: (job as UpdateJob).id, instance_id: inst.id,
        status: 'pending', from_version: inst.current_version ?? null,
        to_version: form.target_version.trim(),
      }))
    );

    for (const inst of targets) {
      await supabase.from('platform_instances').update({
        update_status: 'pending_update', target_version: form.target_version.trim(),
      }).eq('id', inst.id);
    }
    onSaved(job as UpdateJob);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Create Update Job</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">{error}</div>}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">This does not deploy code automatically. Use this to track manual update rollout.</p>
          </div>
          <div>
            <label className={labelCls}>Target Version *</label>
            <input value={form.target_version} onChange={e => setForm(f => ({ ...f, target_version: e.target.value }))} className={inputCls} placeholder="1.1.0" list="ver-list" />
            <datalist id="ver-list">{templateVersions.map(v => <option key={v.id} value={v.version} />)}</datalist>
          </div>
          <div>
            <label className={labelCls}>Scope</label>
            <div className="flex gap-4">
              {(['all_instances', 'selected_instances'] as const).map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" checked={form.scope === s} onChange={() => setForm(f => ({ ...f, scope: s }))} className="accent-gray-900" />
                  {s.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
          {form.scope === 'selected_instances' && (
            <div>
              <label className={labelCls}>Instances ({selected.size} selected)</label>
              {loadingInst ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
              ) : (
                <div className="border border-gray-200 rounded-xl divide-y max-h-48 overflow-y-auto">
                  {instances.map(inst => (
                    <label key={inst.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={selected.has(inst.id)} onChange={() => toggle(inst.id)} className="accent-gray-900 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{inst.instance_name}</p>
                        {inst.client_name && <p className="text-xs text-gray-400">{inst.client_name}</p>}
                      </div>
                      {inst.current_version && <span className="text-xs text-gray-400 font-mono flex-shrink-0">v{inst.current_version}</span>}
                    </label>
                  ))}
                  {instances.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No instances.</p>}
                </div>
              )}
            </div>
          )}
          {form.scope === 'all_instances' && !loadingInst && (
            <p className="text-xs text-gray-500">{instances.length} instance{instances.length !== 1 ? 's' : ''} will be targeted.</p>
          )}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} rows={3} placeholder="What's changing in this update..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Job
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformUpdates() {
  const [templateVersions, setTemplateVersions] = useState<TemplateVersion[]>([]);
  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionsOpen, setVersionsOpen] = useState(true);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('platform_template_versions').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_update_jobs').select('*').order('created_at', { ascending: false }),
    ]).then(([tvr, jr]) => {
      setTemplateVersions((tvr.data as TemplateVersion[]) ?? []);
      setJobs((jr.data as UpdateJob[]) ?? []);
      setLoading(false);
    });
  }, []);

  const activeVersion = templateVersions.find(v => v.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Updates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeVersion
              ? <>Active template: <strong>v{activeVersion.version}</strong> — {activeVersion.title}</>
              : 'No active template version.'}
          </p>
        </div>
        <button
          onClick={() => setShowJobModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Update Job
        </button>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          <strong>Manual tracking only.</strong> Update jobs track manual rollout progress. Automated deployment is not yet enabled.
        </p>
      </div>

      {/* Template Versions */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <button
          onClick={() => setVersionsOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900">Template Versions</span>
            <span className="text-xs text-gray-400">{templateVersions.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setShowVersionModal(true); }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            {versionsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>
        {versionsOpen && (
          loading ? (
            <div className="flex justify-center py-8 border-t"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : templateVersions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 border-t">No versions yet.</p>
          ) : (
            <div className="border-t divide-y">
              {templateVersions.map(tv => (
                <div key={tv.id} className={`px-5 py-4 flex items-start gap-4 ${tv.status === 'active' ? 'bg-green-50/40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{tv.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VERSION_STYLES[tv.status] ?? 'bg-gray-100 text-gray-500'}`}>{tv.status}</span>
                      <span className="text-xs text-gray-400 font-mono">v{tv.version}</span>
                    </div>
                    {tv.description && <p className="text-xs text-gray-500 mt-0.5">{tv.description}</p>}
                    {tv.git_ref && <p className="text-xs text-gray-400 font-mono mt-0.5">ref: {tv.git_ref}</p>}
                    {tv.release_notes && <p className="text-xs text-gray-500 mt-2 pt-2 border-t whitespace-pre-line">{tv.release_notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(tv.created_at)}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Jobs list */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Update Jobs</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center text-sm text-gray-400">No update jobs yet.</div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <Link
                key={job.id}
                to={`/platform/updates/${job.id}`}
                className="bg-white rounded-2xl border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">→ v{job.target_version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${JOB_STYLES[job.status] ?? 'bg-gray-100 text-gray-600'}`}>{job.status}</span>
                    <span className="text-xs text-gray-400">{job.scope.replace('_', ' ')}</span>
                  </div>
                  {job.notes && <p className="text-xs text-gray-500 mt-1 truncate">{job.notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Created {fmtDate(job.created_at)}{job.completed_at ? ` · Completed ${fmtDate(job.completed_at)}` : ''}
                  </p>
                </div>
                <RefreshCw className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {showVersionModal && (
        <CreateVersionModal
          onClose={() => setShowVersionModal(false)}
          onSaved={v => { setTemplateVersions(prev => [v, ...prev]); setShowVersionModal(false); }}
        />
      )}
      {showJobModal && (
        <CreateJobModal
          templateVersions={templateVersions}
          onClose={() => setShowJobModal(false)}
          onSaved={j => { setJobs(prev => [j, ...prev]); setShowJobModal(false); }}
        />
      )}
    </div>
  );
}
