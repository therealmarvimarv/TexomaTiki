import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ServerCog, Loader2, CheckCircle2, AlertTriangle, Play,
  ChevronDown, ChevronUp, Terminal, ExternalLink,
} from 'lucide-react';

interface BootstrapInstruction {
  step: number;
  title: string;
  commands: string[];
  notes: string;
}

interface DatabaseBootstrapActionCardProps {
  instanceId: string;
  supabaseProjectRef: string | null;
  supabaseProjectUrl: string | null;
  jobId?: string | null;
  onEventLogged?: (msg: string) => void;
}

type ResultState = {
  status: 'manual_required';
  project_ref: string;
  project_url: string;
  instructions: BootstrapInstruction[];
};

export function DatabaseBootstrapActionCard({
  instanceId,
  supabaseProjectRef,
  supabaseProjectUrl,
  jobId,
  onEventLogged,
}: DatabaseBootstrapActionCardProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const blocked = !supabaseProjectRef;
  const manualRequired = result?.status === 'manual_required';

  const handleBootstrap = async () => {
    setRunning(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setRunning(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-bootstrap-client-database`, {
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
        setExpandedStep(1);
        onEventLogged?.('Manual database bootstrap instructions loaded');
      } else {
        setErrorMsg(json.error ?? 'Bootstrap request failed');
        onEventLogged?.(`Database bootstrap failed: ${json.error ?? 'unknown'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setRunning(false);
  };

  const borderCls = manualRequired
    ? 'border-amber-200 bg-amber-50/10'
    : blocked
    ? 'border-gray-100 bg-gray-50/50'
    : 'border-gray-200 bg-white';

  const iconCls = manualRequired ? 'bg-amber-100' : blocked ? 'bg-gray-100' : 'bg-gray-100';
  const iconColor = manualRequired ? 'text-amber-600' : blocked ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${borderCls}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        <ServerCog className={`w-4 h-4 ${iconColor}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">Bootstrap Client Database</p>
          {manualRequired && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Manual Required
            </span>
          )}
          {blocked && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">Blocked</span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Apply master migrations, configure Auth, create storage buckets, deploy Edge Functions, and verify the client database is production-ready.
        </p>

        {supabaseProjectRef && (
          <p className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
            ref: {supabaseProjectRef}
          </p>
        )}

        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {blocked ? (
            <span className="text-xs text-gray-400 italic">Set Up Isolated Database first</span>
          ) : !manualRequired ? (
            <button
              onClick={handleBootstrap}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Loading instructions…' : 'Bootstrap Client Database'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href={supabaseProjectUrl ?? 'https://supabase.com/dashboard'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open Database Dashboard
              </a>
            </div>
          )}
        </div>

        {/* Manual instructions */}
        {manualRequired && result?.instructions && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Setup Checklist — complete these steps in order:</p>
            {result.instructions.map(instruction => (
              <div
                key={instruction.step}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedStep(expandedStep === instruction.step ? null : instruction.step)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {instruction.step}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{instruction.title}</span>
                  </div>
                  {expandedStep === instruction.step
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                </button>

                {expandedStep === instruction.step && (
                  <div className="px-3 py-2.5 space-y-2 bg-white">
                    {instruction.commands.length > 0 && (
                      <div className="bg-gray-900 rounded-lg p-2.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Terminal className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400 font-mono">Terminal</span>
                        </div>
                        {instruction.commands.map((cmd, i) => (
                          <p key={i} className="text-xs font-mono text-green-300 leading-relaxed">{cmd}</p>
                        ))}
                      </div>
                    )}
                    {instruction.notes && (
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{instruction.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                After completing all steps, use the <strong>Netlify Env Vars</strong> card above to set <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>, then trigger a new deploy.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
