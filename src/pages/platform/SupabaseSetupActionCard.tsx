import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Database, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Play, Info, XCircle,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

interface SupabaseSetupActionCardProps {
  instanceId: string;
  supabaseProjectRef: string | null;
  supabaseProjectUrl: string | null;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onSuccess?: (result: { project_ref: string; project_url: string }) => void;
  onEventLogged?: (msg: string) => void;
}

type ResultState = {
  status: 'created' | 'manual_required';
  project_ref?: string;
  project_url?: string;
  reason?: string;
  instructions?: string[];
};

const ISOLATION_KEY = 'db_isolated_confirmed';

export function SupabaseSetupActionCard({
  instanceId,
  supabaseProjectRef,
  supabaseProjectUrl,
  providerStatuses,
  jobId,
  onSuccess,
  onEventLogged,
}: SupabaseSetupActionCardProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isolationConfirmed, setIsolationConfirmed] = useState(false);
  const [savingConfirmation, setSavingConfirmation] = useState(false);

  const MASTER_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const masterRef = MASTER_URL.replace('https://','').split('.')[0];
  const liveRefCheck = result?.project_ref ?? supabaseProjectRef;
  const liveUrlCheck = result?.project_url ?? supabaseProjectUrl;
  const matchesMaster =
    (liveUrlCheck && liveUrlCheck === MASTER_URL) ||
    (liveRefCheck && liveRefCheck === masterRef);

  const providerVerified =
    providerStatuses.find(p => p.provider === 'supabase_management')?.status === 'verified';

  const configured =
    !!supabaseProjectRef ||
    !!supabaseProjectUrl ||
    result?.status === 'created';

  const manualRequired = result?.status === 'manual_required';
  const liveRef = result?.project_ref ?? supabaseProjectRef;
  const liveUrl = result?.project_url ?? supabaseProjectUrl;

  const handleSetup = async () => {
    setRunning(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setRunning(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-setup-supabase-instance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instance_id: instanceId, job_id: jobId ?? undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(json);
        if (json.status === 'created') {
          onSuccess?.({ project_ref: json.project_ref, project_url: json.project_url });
          onEventLogged?.(`Supabase project created: ${json.project_ref}`);
        } else {
          setShowInstructions(true);
          onEventLogged?.(`Manual Supabase setup required: ${json.reason ?? ''}`);
        }
      } else {
        setErrorMsg(json.error ?? 'Setup failed');
        onEventLogged?.(`Supabase setup failed: ${json.error ?? 'unknown error'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setRunning(false);
  };

  const borderCls = configured
    ? 'border-green-200 bg-green-50/20'
    : manualRequired
    ? 'border-amber-200 bg-amber-50/10'
    : 'border-gray-200 bg-white';

  const iconCls = configured
    ? 'bg-green-100'
    : manualRequired
    ? 'bg-amber-100'
    : 'bg-gray-100';

  const iconColor = configured
    ? 'text-green-700'
    : manualRequired
    ? 'text-amber-600'
    : 'text-gray-600';

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${borderCls}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        <Database className={`w-4 h-4 ${iconColor}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">Set Up Isolated Database</p>
          {configured ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Configured
            </span>
          ) : manualRequired ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Manual Required
            </span>
          ) : providerVerified ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Ready</span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Provider not verified
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Creates an isolated Supabase project for this client instance. If automated creation via the
          Supabase Management API is not configured, guided manual setup instructions are provided.
        </p>

        {/* Master database warning */}
        {matchesMaster && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
            <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 font-medium">
              This client is still connected to the master database. Changes here affect all platform sites.
              Create a dedicated Supabase project and update this record before launch.
            </p>
          </div>
        )}

        {liveRef && (
          <p className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
            ref: {liveRef}
          </p>
        )}
        {liveUrl && (
          <p className="text-xs font-mono text-gray-400 truncate">{liveUrl}</p>
        )}

        {manualRequired && result?.reason && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{result.reason}</p>
          </div>
        )}

        {manualRequired && result?.instructions && (
          <div>
            <button
              onClick={() => setShowInstructions(s => !s)}
              className="text-xs text-amber-700 hover:underline"
            >
              {showInstructions ? 'Hide' : 'Show'} manual setup instructions
            </button>
            {showInstructions && (
              <ol className="mt-2 space-y-1.5 list-none">
                {result.instructions.map((step, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
        )}

        {/* Isolation confirmation — shown when configured and not matching master */}
        {configured && !matchesMaster && (
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              id={`${instanceId}-isolation-confirm`}
              checked={isolationConfirmed}
              onChange={async (e) => {
                const checked = e.target.checked;
                setIsolationConfirmed(checked);
                if (checked) {
                  setSavingConfirmation(true);
                  await supabase.from('platform_instance_health_checks').upsert({
                    instance_id: instanceId,
                    check_key: ISOLATION_KEY,
                    check_label: 'Database isolated confirmed',
                    check_group: 'Database',
                    status: 'passing',
                    message: 'Operator confirmed this client has its own isolated database',
                    last_checked_at: new Date().toISOString(),
                  }, { onConflict: 'instance_id,check_key', ignoreDuplicates: false });
                  setSavingConfirmation(false);
                }
              }}
              className="w-3.5 h-3.5 rounded text-green-600 border-gray-300 focus:ring-green-200"
            />
            <label htmlFor={`${instanceId}-isolation-confirm`} className="text-xs text-green-800 cursor-pointer">
              {savingConfirmation ? 'Saving…' : 'I confirmed this client has its own isolated database'}
            </label>
            {isolationConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {configured && liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Database
            </a>
          ) : !providerVerified ? (
            <Link
              to="/platform/integrations"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Set Up Supabase in Integrations
            </Link>
          ) : !configured ? (
            <button
              onClick={handleSetup}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Setting up…' : 'Set Up Isolated Database'}
            </button>
          ) : null}

          {manualRequired && (
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Supabase Dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
