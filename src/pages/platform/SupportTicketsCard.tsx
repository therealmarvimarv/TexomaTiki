import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LifeBuoy, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal';
import { useNavigate } from 'react-router-dom';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  updated_at: string;
}

interface Props {
  clientId: string;
  instanceId?: string;
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-blue-500', in_progress: 'bg-yellow-500',
  waiting_on_client: 'bg-orange-500', waiting_on_me: 'bg-purple-500',
  resolved: 'bg-green-500', closed: 'bg-gray-300',
};

export function SupportTicketsCard({ clientId, instanceId }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const q = supabase.from('platform_support_tickets')
      .select('id,title,status,priority,updated_at')
      .eq('client_id', clientId)
      .not('status', 'in', '(resolved,closed)')
      .order('updated_at', { ascending: false })
      .limit(3);
    if (instanceId) q.eq('instance_id', instanceId);
    const { data } = await q;
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId, instanceId]);

  const openCount = tickets.filter(t => t.status === 'open').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-orange-500" />
          <p className="text-sm font-bold text-gray-900">Support</p>
          {urgentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" /> {urgentCount} urgent
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus className="w-3 h-3" /> New
          </button>
          <Link to={`/platform/support?client_id=${clientId}`}
            className="text-xs text-blue-600 hover:underline">All</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">No open tickets</p>
      ) : (
        <div className="space-y-1.5">
          {tickets.map(t => (
            <Link key={t.id} to={`/platform/support/${t.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-300'}`} />
              <span className="text-xs text-gray-700 flex-1 truncate group-hover:text-gray-900">{t.title}</span>
              {t.priority === 'urgent' && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
            </Link>
          ))}
        </div>
      )}

      {openCount > 0 && (
        <p className="text-xs text-gray-400 mt-2">{openCount} open ticket{openCount !== 1 ? 's' : ''}</p>
      )}

      {showCreate && (
        <CreateTicketModal
          prefillClientId={clientId}
          prefillInstanceId={instanceId}
          onClose={() => setShowCreate(false)}
          onCreated={(ticketId) => { setShowCreate(false); load(); navigate(`/platform/support/${ticketId}`); }}
        />
      )}
    </div>
  );
}
