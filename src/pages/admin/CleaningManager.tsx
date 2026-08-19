import { useEffect, useState } from 'react';
import { Plus, Save, X, Check, Trash2, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface CleaningTask {
  id: string;
  booking_id: string | null;
  task_date: string;
  checkout_date: string;
  assigned_to: string;
  status: 'needed' | 'scheduled' | 'in_progress' | 'completed' | 'skipped';
  notes: string;
  completed_at: string | null;
  created_at: string;
  guest_name?: string;
}

const STATUS_OPTIONS = ['needed', 'scheduled', 'in_progress', 'completed', 'skipped'] as const;

const STATUS_STYLES: Record<CleaningTask['status'], string> = {
  needed:      'bg-red-100 text-red-700',
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  skipped:     'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<CleaningTask['status'], string> = {
  needed:      'Needed',
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  skipped:     'Skipped',
};

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: CleaningTask['status'] }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function CleaningManager() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CleaningTask>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('cleaning_tasks')
      .select('*, bookings(guest_name)')
      .eq('property_id', PROPERTY_ID)
      .order('task_date', { ascending: true });

    setTasks(
      (data ?? []).map((t: any) => ({
        ...t,
        guest_name: t.bookings?.guest_name ?? null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.task_date || !draft.checkout_date) return;
    setSaving(true);
    if (editId === 'new') {
      const { data, error } = await supabase.from('cleaning_tasks').insert({
        property_id: PROPERTY_ID,
        booking_id: draft.booking_id ?? null,
        task_date: draft.task_date,
        checkout_date: draft.checkout_date,
        assigned_to: draft.assigned_to ?? '',
        status: draft.status ?? 'needed',
        notes: draft.notes ?? '',
      }).select('*, bookings(guest_name)').maybeSingle();
      if (!error && data) {
        setTasks(prev => [...prev, { ...data, guest_name: (data as any).bookings?.guest_name ?? null }]);
        flash('Saved!');
      }
    } else if (editId) {
      await supabase.from('cleaning_tasks').update({
        task_date: draft.task_date,
        checkout_date: draft.checkout_date,
        assigned_to: draft.assigned_to ?? '',
        status: draft.status,
        notes: draft.notes ?? '',
        updated_at: new Date().toISOString(),
      }).eq('id', editId);
      setTasks(prev => prev.map(t => t.id === editId ? { ...t, ...draft } as CleaningTask : t));
      flash('Saved!');
    }
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function markComplete(task: CleaningTask) {
    const now = new Date().toISOString();
    await supabase.from('cleaning_tasks').update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', completed_at: now } : t));
  }

  async function remove(id: string) {
    if (!confirm('Delete this cleaning task?')) return;
    await supabase.from('cleaning_tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  const visible = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Cleaning Schedule</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track turnovers and assign cleaners</p>
        </div>
        <button
          onClick={() => { setEditId('new'); setDraft({ status: 'needed', task_date: new Date().toISOString().split('T')[0], checkout_date: new Date().toISOString().split('T')[0] }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {(['all', ...STATUS_OPTIONS] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as CleaningTask['status']]}
          </button>
        ))}
        {msg && <span className="ml-auto text-sm font-medium text-green-600">{msg}</span>}
      </div>

      {/* New task form */}
      {editId === 'new' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3 mb-4">
          <p className="text-sm font-semibold text-gray-900">New cleaning task</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Task date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.task_date ?? ''} onChange={e => setDraft(d => ({ ...d, task_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Checkout date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.checkout_date ?? ''} onChange={e => setDraft(d => ({ ...d, checkout_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned to</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Cleaner name" value={draft.assigned_to ?? ''} onChange={e => setDraft(d => ({ ...d, assigned_to: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={draft.status ?? 'needed'} onChange={e => setDraft(d => ({ ...d, status: e.target.value as CleaningTask['status'] }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Optional notes…" value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save</button>
            <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {visible.map(task => (
          <div key={task.id} className="bg-white">
            {editId === task.id ? (
              <div className="p-5 bg-blue-50 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Edit task</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Task date</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.task_date ?? ''} onChange={e => setDraft(d => ({ ...d, task_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Checkout date</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.checkout_date ?? ''} onChange={e => setDraft(d => ({ ...d, checkout_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigned to</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.assigned_to ?? ''} onChange={e => setDraft(d => ({ ...d, assigned_to: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={draft.status ?? 'needed'} onChange={e => setDraft(d => ({ ...d, status: e.target.value as CleaningTask['status'] }))}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save</button>
                  <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{fmt(task.task_date)}</p>
                    <StatusBadge status={task.status} />
                    {task.guest_name && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{task.guest_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Checkout: {fmt(task.checkout_date)}</p>
                  {task.assigned_to && <p className="text-xs text-gray-600 mt-0.5">Assigned: <span className="font-medium">{task.assigned_to}</span></p>}
                  {task.notes && <p className="text-xs text-gray-500 mt-1 italic">{task.notes}</p>}
                  {task.completed_at && (
                    <p className="text-xs text-green-600 mt-0.5">Completed {new Date(task.completed_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.status !== 'completed' && (
                    <button onClick={() => markComplete(task)} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Done
                    </button>
                  )}
                  <button onClick={() => { setEditId(task.id); setDraft({ task_date: task.task_date, checkout_date: task.checkout_date, assigned_to: task.assigned_to, status: task.status, notes: task.notes }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                  <button onClick={() => remove(task.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            {filterStatus === 'all' ? 'No cleaning tasks yet.' : `No tasks with status "${STATUS_LABELS[filterStatus as CleaningTask['status']]}'.`}
          </div>
        )}
      </div>
    </div>
  );
}
