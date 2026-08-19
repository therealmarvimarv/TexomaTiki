import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteClientModal({ clientId, clientName, onClose, onDeleted }: Props) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirmed = confirmation === 'DELETE';

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError('');

    const { error: rpcError } = await supabase.rpc('platform_delete_client', {
      p_client_id: clientId,
    });

    if (rpcError) {
      setError(rpcError.message || 'Deletion failed. No records were changed.');
      setDeleting(false);
      return;
    }

    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="font-bold text-gray-900">Delete this client permanently?</h2>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1.5">
              <p className="font-semibold">This will remove the client and all related platform records from the Platform Dashboard.</p>
              <p>This does <strong>not</strong> delete the external Supabase project or Netlify site. You must delete those separately if needed.</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">Client to be deleted:</p>
            <p className="font-mono text-gray-600">{clientName}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-red-700">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono disabled:opacity-50"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete Client Permanently</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
