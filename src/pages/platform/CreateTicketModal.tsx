import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  prefillClientId?: string;
  prefillInstanceId?: string;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}

interface ClientOption { id: string; company_name: string }
interface InstanceOption { id: string; instance_name: string }

const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200';
const labelCls = 'text-xs font-semibold text-gray-600 mb-1 block';

export function CreateTicketModal({ prefillClientId, prefillInstanceId, onClose, onCreated }: Props) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [clientId, setClientId] = useState(prefillClientId ?? '');
  const [instanceId, setInstanceId] = useState(prefillInstanceId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status] = useState('open');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('other');
  const [source, setSource] = useState('internal');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('platform_clients').select('id,company_name').order('company_name')
      .then(({ data }) => setClients((data ?? []) as ClientOption[]));
  }, []);

  useEffect(() => {
    if (!clientId) { setInstances([]); return; }
    supabase.from('platform_instances').select('id,instance_name').eq('client_id', clientId)
      .then(({ data }) => setInstances((data ?? []) as InstanceOption[]));
  }, [clientId]);

  const submit = async () => {
    if (!clientId || !title.trim()) { setError('Client and title are required.'); return; }
    setSaving(true);
    setError(null);
    const { data: user } = await supabase.auth.getUser();
    const actor = user.user?.email ?? 'platform_admin';
    const { data, error: insertErr } = await supabase.from('platform_support_tickets').insert({
      client_id: clientId,
      instance_id: instanceId || null,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      category,
      source,
      assigned_to: assignedTo.trim() || null,
      due_date: dueDate || null,
      created_by: actor,
    }).select('id').maybeSingle();
    if (insertErr || !data) { setError(insertErr?.message ?? 'Failed to create ticket'); setSaving(false); return; }
    await supabase.from('platform_support_ticket_events').insert({
      ticket_id: data.id,
      event_type: 'created',
      message: `Ticket created: ${title.trim()}`,
      new_value: status,
      created_by: actor,
    });
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-bold text-gray-900">New Support Ticket</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Security warning */}
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Do not paste passwords, API keys, tokens, or private keys into support notes.
          </div>

          <div>
            <label className={labelCls}>Client *</label>
            <select value={clientId} onChange={e => { setClientId(e.target.value); setInstanceId(''); }} className={inputCls}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>

          {instances.length > 0 && (
            <div>
              <label className={labelCls}>Instance (optional)</label>
              <select value={instanceId} onChange={e => setInstanceId(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {instances.map(i => <option key={i.id} value={i.id}>{i.instance_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the issue" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Details… (no passwords or secrets)" className={`${inputCls} resize-y`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                {['bug','feature_request','billing','onboarding','domain_dns','email','payments','calendar_sync','content_update','maintenance','other'].map(c =>
                  <option key={c} value={c}>{c.replace(/_/g,' ')}</option>
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select value={source} onChange={e => setSource(e.target.value)} className={inputCls}>
                {['internal','client_email','client_call','text_message','meeting','other'].map(s =>
                  <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Assigned To</label>
            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Email or name" className={inputCls} />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
