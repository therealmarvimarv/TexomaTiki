import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle, Save,
  CheckCircle2, XCircle, MessageSquare,
} from 'lucide-react';

interface Ticket {
  id: string;
  client_id: string;
  instance_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  source: string;
  assigned_to: string | null;
  due_date: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  platform_clients: { company_name: string; owner_email: string } | null;
  platform_instances: { instance_name: string } | null;
}

interface TicketEvent {
  id: string;
  event_type: string;
  message: string | null;
  previous_value: string | null;
  new_value: string | null;
  created_by: string | null;
  created_at: string;
}

const STATUS_CFG: Record<string, string> = {
  open:               'bg-blue-100 text-blue-700',
  in_progress:        'bg-yellow-100 text-yellow-700',
  waiting_on_client:  'bg-orange-100 text-orange-700',
  waiting_on_me:      'bg-purple-100 text-purple-700',
  resolved:           'bg-green-100 text-green-700',
  closed:             'bg-gray-100 text-gray-500',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  created:          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  status_changed:   <AlertCircle className="w-3.5 h-3.5 text-blue-500" />,
  priority_changed: <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />,
  resolved:         <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  closed:           <XCircle className="w-3.5 h-3.5 text-gray-400" />,
  reopened:         <AlertCircle className="w-3.5 h-3.5 text-blue-500" />,
  note_added:       <MessageSquare className="w-3.5 h-3.5 text-gray-500" />,
  assigned:         <AlertCircle className="w-3.5 h-3.5 text-purple-500" />,
};

const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200';
const labelCls = 'text-xs font-semibold text-gray-600 mb-1 block';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PlatformSupportTicket() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    if (!ticketId) return;
    const [tRes, eRes] = await Promise.all([
      supabase.from('platform_support_tickets')
        .select('*,platform_clients(company_name,owner_email),platform_instances(instance_name)')
        .eq('id', ticketId).maybeSingle(),
      supabase.from('platform_support_ticket_events')
        .select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    ]);
    const t = tRes.data as Ticket | null;
    setTicket(t);
    setEvents((eRes.data ?? []) as TicketEvent[]);
    if (t) {
      setStatus(t.status);
      setPriority(t.priority);
      setAssignedTo(t.assigned_to ?? '');
      setDueDate(t.due_date ?? '');
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { reload(); }, [reload]);

  const getActor = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? 'platform_admin';
  };

  const logEvent = async (type: string, msg: string | null, prev: string | null, next: string | null) => {
    const actor = await getActor();
    await supabase.from('platform_support_ticket_events').insert({
      ticket_id: ticketId,
      event_type: type,
      message: msg,
      previous_value: prev,
      new_value: next,
      created_by: actor,
    });
  };

  const saveChanges = async () => {
    if (!ticket) return;
    setSaving(true);
    const actor = await getActor();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
    };
    if (status !== ticket.status) {
      if (status === 'resolved') updates.resolved_at = now;
      if (status === 'closed') updates.closed_at = now;
      await logEvent('status_changed', null, ticket.status, status);
    }
    if (priority !== ticket.priority) await logEvent('priority_changed', null, ticket.priority, priority);
    if (assignedTo !== (ticket.assigned_to ?? '')) await logEvent('assigned', `Assigned to ${assignedTo || 'unassigned'}`, ticket.assigned_to, assignedTo || null);

    await supabase.from('platform_support_tickets').update(updates).eq('id', ticket.id);
    if (note.trim()) {
      await supabase.from('platform_support_ticket_events').insert({
        ticket_id: ticketId,
        event_type: 'note_added',
        message: note.trim(),
        created_by: actor,
      });
      setNote('');
    }
    setSaving(false);
    await reload();
  };

  const quickAction = async (action: 'resolve' | 'close' | 'reopen') => {
    setSaving(true);
    const now = new Date().toISOString();
    const newStatus = action === 'reopen' ? 'open' : action === 'resolve' ? 'resolved' : 'closed';
    const updates: Record<string, unknown> = { status: newStatus };
    if (action === 'resolve') updates.resolved_at = now;
    if (action === 'close') updates.closed_at = now;
    await supabase.from('platform_support_tickets').update(updates).eq('id', ticketId);
    await logEvent(action === 'reopen' ? 'reopened' : action, null, ticket?.status ?? null, newStatus);
    setSaving(false);
    await reload();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (!ticket) return (
    <div className="text-center py-16">
      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">Ticket not found.</p>
      <Link to="/platform/support" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Back to Support</Link>
    </div>
  );

  const sc = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/platform/support" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{ticket.title}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc}`}>{ticket.status.replace(/_/g,' ')}</span>
            <span className="text-xs text-gray-400">{ticket.platform_clients?.company_name ?? '—'}</span>
            {ticket.platform_instances && <span className="text-xs text-gray-300">· {ticket.platform_instances.instance_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!['resolved','closed'].includes(ticket.status) && (
            <button onClick={() => quickAction('resolve')} disabled={saving}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              <CheckCircle2 className="w-3 h-3" /> Resolve
            </button>
          )}
          {ticket.status !== 'closed' && (
            <button onClick={() => quickAction('close')} disabled={saving}
              className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <XCircle className="w-3 h-3" /> Close
            </button>
          )}
          {['resolved','closed'].includes(ticket.status) && (
            <button onClick={() => quickAction('reopen')} disabled={saving}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: detail + note */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {ticket.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* Edit fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Update Ticket</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                  {['open','in_progress','waiting_on_client','waiting_on_me','resolved','closed'].map(s =>
                    <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                  )}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                  {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Assigned To</label>
                <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inputCls} placeholder="Email or name" />
              </div>
              <div>
                <label className={labelCls}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Add Internal Note</label>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Do not paste passwords, API keys, tokens, or private keys.</p>
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Internal note…" className={`${inputCls} resize-y`} />
            </div>
            <div className="flex justify-end">
              <button onClick={saveChanges} disabled={saving}
                className="flex items-center gap-1.5 text-xs px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Changes
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">Activity</p>
            {events.length === 0 ? (
              <p className="text-xs text-gray-400">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-0.5">{EVENT_ICONS[ev.event_type] ?? EVENT_ICONS.note_added}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 capitalize">{ev.event_type.replace(/_/g,' ')}</p>
                      {ev.previous_value && ev.new_value && (
                        <p className="text-xs text-gray-500">{ev.previous_value} → {ev.new_value}</p>
                      )}
                      {ev.message && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{ev.message}</p>}
                      <p className="text-xs text-gray-300 mt-0.5">{fmtDate(ev.created_at)}{ev.created_by ? ` · ${ev.created_by}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: metadata */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5 text-xs">
            <p className="font-semibold text-gray-700 mb-2">Details</p>
            <div><span className="text-gray-400">Category: </span><span className="text-gray-800 capitalize">{ticket.category.replace(/_/g,' ')}</span></div>
            <div><span className="text-gray-400">Source: </span><span className="text-gray-800 capitalize">{ticket.source.replace(/_/g,' ')}</span></div>
            <div><span className="text-gray-400">Created by: </span><span className="text-gray-800">{ticket.created_by ?? '—'}</span></div>
            <div><span className="text-gray-400">Created: </span><span className="text-gray-800">{fmtDate(ticket.created_at)}</span></div>
            <div><span className="text-gray-400">Updated: </span><span className="text-gray-800">{fmtDate(ticket.updated_at)}</span></div>
            {ticket.resolved_at && <div><span className="text-gray-400">Resolved: </span><span className="text-gray-800">{fmtDate(ticket.resolved_at)}</span></div>}
            {ticket.closed_at && <div><span className="text-gray-400">Closed: </span><span className="text-gray-800">{fmtDate(ticket.closed_at)}</span></div>}
            {ticket.due_date && <div><span className="text-gray-400">Due: </span><span className="text-gray-800">{new Date(ticket.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 text-xs">
            <p className="font-semibold text-gray-700 mb-2">Links</p>
            <Link to={`/platform/clients/${ticket.client_id}`} className="text-blue-600 hover:underline block">Client Detail</Link>
            {ticket.instance_id && (
              <>
                <Link to={`/platform/provisioning/${ticket.instance_id}/pack`} className="text-blue-600 hover:underline block">Deployment Pack</Link>
                <Link to={`/platform/instances/${ticket.instance_id}/launch-package`} className="text-blue-600 hover:underline block">Launch Package</Link>
              </>
            )}
            <Link to={`/platform/support?client_id=${ticket.client_id}`} className="text-blue-600 hover:underline block">All client tickets</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
