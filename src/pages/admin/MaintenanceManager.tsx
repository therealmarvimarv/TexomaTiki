import { useEffect, useState } from 'react';
import { Plus, Save, X, Check, Trash2, Filter, AlertTriangle, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface MaintenanceNote {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'archived';
  category: 'repair' | 'cleaning' | 'supplies' | 'inspection' | 'guest_reported' | 'general';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;
const STATUS_OPTIONS = ['open', 'in_progress', 'completed', 'archived'] as const;
const CATEGORY_OPTIONS = ['repair', 'cleaning', 'supplies', 'inspection', 'guest_reported', 'general'] as const;

const PRIORITY_STYLES: Record<MaintenanceNote['priority'], string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_STYLES: Record<MaintenanceNote['status'], string> = {
  open:        'bg-red-50 text-red-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed:   'bg-green-50 text-green-700',
  archived:    'bg-gray-100 text-gray-500',
};

const CATEGORY_LABELS: Record<MaintenanceNote['category'], string> = {
  repair:         'Repair',
  cleaning:       'Cleaning',
  supplies:       'Supplies',
  inspection:     'Inspection',
  guest_reported: 'Guest Reported',
  general:        'General',
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '); }

function PriorityBadge({ priority }: { priority: MaintenanceNote['priority'] }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${PRIORITY_STYLES[priority]}`}>
      {priority === 'urgent' && <AlertTriangle className="w-3 h-3" />}
      {cap(priority)}
    </span>
  );
}

function StatusBadge({ status }: { status: MaintenanceNote['status'] }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
      {cap(status)}
    </span>
  );
}

const BLANK: Partial<MaintenanceNote> = { priority: 'medium', status: 'open', category: 'general' };

export default function MaintenanceManager() {
  const [items, setItems] = useState<MaintenanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MaintenanceNote>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('maintenance_notes')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: false });
    setItems((data ?? []) as MaintenanceNote[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.title) return;
    setSaving(true);
    if (editId === 'new') {
      const { data, error } = await supabase.from('maintenance_notes').insert({
        property_id: PROPERTY_ID,
        title: draft.title,
        description: draft.description ?? '',
        priority: draft.priority ?? 'medium',
        status: draft.status ?? 'open',
        category: draft.category ?? 'general',
        due_date: draft.due_date ?? null,
      }).select().maybeSingle();
      if (!error && data) { setItems(prev => [data as MaintenanceNote, ...prev]); flash('Saved!'); }
    } else if (editId) {
      await supabase.from('maintenance_notes').update({
        title: draft.title,
        description: draft.description ?? '',
        priority: draft.priority,
        status: draft.status,
        category: draft.category,
        due_date: draft.due_date ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', editId);
      setItems(prev => prev.map(n => n.id === editId ? { ...n, ...draft } as MaintenanceNote : n));
      flash('Saved!');
    }
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function markComplete(item: MaintenanceNote) {
    const now = new Date().toISOString();
    await supabase.from('maintenance_notes').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', item.id);
    setItems(prev => prev.map(n => n.id === item.id ? { ...n, status: 'completed', completed_at: now } : n));
  }

  async function remove(id: string) {
    if (!confirm('Delete this maintenance task?')) return;
    await supabase.from('maintenance_notes').delete().eq('id', id);
    setItems(prev => prev.filter(n => n.id !== id));
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }

  const visible = (() => {
    if (filterStatus === 'active') return items.filter(n => n.status === 'open' || n.status === 'in_progress');
    if (filterStatus === 'all') return items;
    return items.filter(n => n.status === filterStatus);
  })();

  const openCount = items.filter(n => n.status === 'open').length;
  const urgentCount = items.filter(n => n.priority === 'urgent' && n.status !== 'completed' && n.status !== 'archived').length;

  function NoteForm() {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Fix leaky faucet in bathroom" value={draft.title ?? ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Details, location, what's needed…" value={draft.description ?? ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={draft.priority ?? 'medium'} onChange={e => setDraft(d => ({ ...d, priority: e.target.value as MaintenanceNote['priority'] }))}>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{cap(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={draft.status ?? 'open'} onChange={e => setDraft(d => ({ ...d, status: e.target.value as MaintenanceNote['status'] }))}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={draft.category ?? 'general'} onChange={e => setDraft(d => ({ ...d, category: e.target.value as MaintenanceNote['category'] }))}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due date (optional)</label>
          <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.due_date ?? ''} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value || null }))} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !draft.title} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Maintenance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track repairs, supplies, and property tasks</p>
        </div>
        <button
          onClick={() => { setEditId('new'); setDraft({ ...BLANK }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Open tasks</p>
          <p className="text-2xl font-bold text-gray-900">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Urgent</p>
          <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{urgentCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Total tasks</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {[
          { val: 'active', label: 'Active' },
          { val: 'all', label: 'All' },
          { val: 'open', label: 'Open' },
          { val: 'in_progress', label: 'In Progress' },
          { val: 'completed', label: 'Completed' },
          { val: 'archived', label: 'Archived' },
        ].map(f => (
          <button key={f.val} onClick={() => setFilterStatus(f.val)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === f.val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >{f.label}</button>
        ))}
        {msg && <span className="ml-auto text-sm font-medium text-green-600">{msg}</span>}
      </div>

      {/* New task form */}
      {editId === 'new' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">New task</p>
          <NoteForm />
        </div>
      )}

      {/* Task list */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {visible.map(item => (
          <div key={item.id} className="bg-white">
            {editId === item.id ? (
              <div className="p-5 bg-blue-50">
                <p className="text-sm font-semibold text-gray-900 mb-3">Edit task</p>
                <NoteForm />
              </div>
            ) : (
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Wrench className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[item.category]}</span>
                  </div>
                  {item.description && <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    {item.due_date && <span>Due: {new Date(item.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    {item.completed_at && <span className="text-green-600">Completed {new Date(item.completed_at).toLocaleDateString()}</span>}
                    <span>Created {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status !== 'completed' && item.status !== 'archived' && (
                    <button onClick={() => markComplete(item)} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Done
                    </button>
                  )}
                  <button onClick={() => { setEditId(item.id); setDraft({ title: item.title, description: item.description, priority: item.priority, status: item.status, category: item.category, due_date: item.due_date }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No tasks found.</div>
        )}
      </div>
    </div>
  );
}
