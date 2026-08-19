import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  GitBranch, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Play,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

interface SourceTemplateActionCardProps {
  instanceId: string;
  repoUrl: string | null;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onSuccess?: (result: { repo_url: string; repo_name: string; source_template_ref: string }) => void;
  onEventLogged?: (msg: string) => void;
}

export function SourceTemplateActionCard({
  instanceId,
  repoUrl,
  providerStatuses,
  jobId,
  onSuccess,
  onEventLogged,
}: SourceTemplateActionCardProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ repo_url: string; repo_name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const githubProvider = providerStatuses.find(p => p.provider === 'github');
  const githubVerified = githubProvider?.status === 'verified';

  const existingUrl = result?.repo_url ?? repoUrl;
  const sourceCreated = !!existingUrl;

  const handleDuplicate = async () => {
    setRunning(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setRunning(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-duplicate-template-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instance_id: instanceId, job_id: jobId ?? undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ repo_url: json.repo_url, repo_name: json.repo_name });
        onSuccess?.(json);
        onEventLogged?.(`Source duplicated: ${json.repo_name}`);
      } else {
        setErrorMsg(json.error ?? 'Source duplication failed');
        onEventLogged?.(`Source duplication failed: ${json.error ?? 'unknown error'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setRunning(false);
  };

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${
      sourceCreated ? 'border-green-200 bg-green-50/20' : githubVerified ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        sourceCreated ? 'bg-green-100' : githubVerified ? 'bg-gray-100' : 'bg-gray-100'
      }`}>
        <GitBranch className={`w-4 h-4 ${sourceCreated ? 'text-green-700' : githubVerified ? 'text-gray-700' : 'text-gray-400'}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">Duplicate Master Source</p>
          {sourceCreated ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Created
            </span>
          ) : githubVerified ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Ready</span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Provider not verified
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Creates a private GitHub repository for this instance by generating from the master template repo.
          The new repo will be owned by your GitHub org.
        </p>

        {existingUrl && (
          <p className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded truncate">{existingUrl}</p>
        )}
        {result?.repo_name && (
          <p className="text-xs text-gray-400 font-mono">{result.repo_name}</p>
        )}

        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {sourceCreated ? (
            <a
              href={existingUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Repo
            </a>
          ) : githubVerified ? (
            <button
              onClick={handleDuplicate}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Duplicating…' : 'Duplicate Master Source'}
            </button>
          ) : (
            <Link
              to="/platform/integrations"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Verify GitHub in Integrations
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
