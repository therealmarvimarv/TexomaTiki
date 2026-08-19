import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Rocket, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Play,
  GitBranch, Globe, Info, RefreshCw,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

interface NetlifyDeployActionCardProps {
  instanceId: string;
  netlitySiteId: string | null;
  repoUrl: string | null;
  frontendUrl: string | null;
  lastDeployedAt: string | null;
  /** Pass the live has_published_deploy value from the Netlify diagnostic if available */
  hasPublishedDeploy?: boolean | null;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onSuccess?: (result: { deploy_url: string; deploy_id: string | null; status: string }) => void;
  onEventLogged?: (msg: string) => void;
}

type ResultState = {
  status: string;
  deploy_url?: string;
  deploy_id?: string | null;
  deploy_state?: string | null;
  deploy_error_message?: string | null;
  has_published_deploy?: boolean;
  deploy_trigger_http_status?: number;
  message?: string;
  netlify_dashboard_url?: string;
};

export function NetlifyDeployActionCard({
  instanceId,
  netlitySiteId,
  repoUrl,
  frontendUrl,
  lastDeployedAt,
  hasPublishedDeploy,
  providerStatuses,
  jobId,
  onSuccess,
  onEventLogged,
}: NetlifyDeployActionCardProps) {
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [deployStatus, setDeployStatus] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const netlifyVerified = providerStatuses.find(p => p.provider === 'netlify')?.status === 'verified';
  const githubVerified = providerStatuses.find(p => p.provider === 'github')?.status === 'verified';
  const providersReady = netlifyVerified && githubVerified;

  // A deploy is only confirmed if Netlify says so — lastDeployedAt is informational only.
  // If hasPublishedDeploy is explicitly false, override any stale lastDeployedAt.
  const confirmedByNetlify = result?.has_published_deploy === true || result?.status === 'deploy_triggered' && !!result.deploy_id;
  const noPublishedDeploy = hasPublishedDeploy === false && !confirmedByNetlify;
  const deployed = confirmedByNetlify || (!!lastDeployedAt && hasPublishedDeploy !== false);
  const manualRequired = result?.status === 'manual_required';
  const liveUrl = result?.deploy_url ?? frontendUrl;

  const handleCheckStatus = async () => {
    setChecking(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setChecking(false); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-netlify-diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instance_id: instanceId, deploy_id: result?.deploy_id ?? undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        const latest = Array.isArray(json.latest_deploys) ? json.latest_deploys[0] : null;
        const byId = json.deploy_by_id ?? null;
        setDeployStatus(byId ?? latest ?? null);
      }
    } catch { /* ignore */ }
    setChecking(false);
  };

  const blocker = !netlitySiteId
    ? 'Create Netlify Site first'
    : !repoUrl
    ? 'Duplicate Master Source first'
    : null;

  const handleConnect = async () => {
    setRunning(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setRunning(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-connect-netlify-source`, {
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
        if (json.status === 'deploy_triggered') {
          onSuccess?.({ deploy_url: json.deploy_url, deploy_id: json.deploy_id, status: json.status });
          onEventLogged?.(`Netlify deploy triggered — ${json.deploy_url ?? ''}`);
        } else if (json.status === 'manual_required') {
          onEventLogged?.('Manual Netlify repo connection required');
        } else {
          onEventLogged?.(`Netlify linked but deploy trigger failed — check Netlify dashboard`);
        }
      } else {
        setErrorMsg(json.error ?? 'Connect & Deploy failed');
        onEventLogged?.(`Netlify connect failed: ${json.error ?? 'unknown error'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setRunning(false);
  };

  const borderCls = deployed
    ? 'border-green-200 bg-green-50/20'
    : noPublishedDeploy
    ? 'border-amber-200 bg-amber-50/10'
    : manualRequired
    ? 'border-amber-200 bg-amber-50/10'
    : blocker
    ? 'border-gray-100 bg-gray-50/50'
    : 'border-gray-200 bg-white';

  const iconCls = deployed
    ? 'bg-green-100'
    : noPublishedDeploy || manualRequired
    ? 'bg-amber-100'
    : blocker
    ? 'bg-gray-100'
    : 'bg-blue-50';

  const iconColor = deployed
    ? 'text-green-700'
    : noPublishedDeploy || manualRequired
    ? 'text-amber-600'
    : blocker
    ? 'text-gray-300'
    : 'text-blue-600';

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${borderCls}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        <Rocket className={`w-4 h-4 ${iconColor}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">Connect &amp; Deploy Netlify Site</p>
          {deployed && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Deployed
            </span>
          )}
          {noPublishedDeploy && !deployed && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> No Published Deploy
            </span>
          )}
          {manualRequired && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Manual Required
            </span>
          )}
          {blocker && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              Blocked
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Links the Netlify site to the duplicated GitHub repo, configures build settings, and triggers the first deploy.
        </p>

        {/* Prereq status */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`flex items-center gap-1 text-xs font-medium ${netlitySiteId ? 'text-green-600' : 'text-gray-400'}`}>
            <Globe className="w-3 h-3" />
            {netlitySiteId ? 'Netlify site ready' : 'Netlify site missing'}
          </span>
          <span className={`flex items-center gap-1 text-xs font-medium ${repoUrl ? 'text-green-600' : 'text-gray-400'}`}>
            <GitBranch className="w-3 h-3" />
            {repoUrl ? 'Source repo ready' : 'Source repo missing'}
          </span>
        </div>

        {liveUrl && deployed && (
          <p className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded truncate">{liveUrl}</p>
        )}

        {manualRequired && result?.message && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{result.message}</p>
          </div>
        )}

        {noPublishedDeploy && !result && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            Netlify confirmed no published deploy exists for this site. Click Retry Connect &amp; Deploy to re-link the repo and trigger a build.
          </p>
        )}

        {result && result.status !== 'manual_required' && (
          <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-0.5 font-mono">
            <p className="font-semibold text-gray-700 font-sans mb-1">Deploy Triggered</p>
            <p>status: <span className={result.status === 'deploy_triggered' ? 'text-green-700' : 'text-amber-600'}>{result.status}</span></p>
            {result.deploy_id && <p>deploy_id: {result.deploy_id}</p>}
            {result.deploy_state && <p>deploy_state: {result.deploy_state}</p>}
            {result.deploy_trigger_http_status != null && <p>trigger_http: {result.deploy_trigger_http_status}</p>}
            <p>has_published_deploy: <span className={result.has_published_deploy ? 'text-green-700' : 'text-amber-600'}>{String(!!result.has_published_deploy)}</span></p>
            {result.deploy_error_message && (
              <p className="text-red-600 break-all font-sans">error: {result.deploy_error_message}</p>
            )}
          </div>
        )}

        {deployStatus && (
          <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-0.5 font-mono">
            <p className="font-semibold text-gray-700 font-sans mb-1">Latest Deploy State</p>
            <p>deploy_id: {String(deployStatus.deploy_id ?? '—')}</p>
            <p>
              deploy_state:{' '}
              <span className={
                deployStatus.deploy_state === 'ready' ? 'text-green-700'
                : deployStatus.deploy_state === 'error' ? 'text-red-600'
                : 'text-amber-600'
              }>
                {String(deployStatus.deploy_state ?? '—')}
              </span>
            </p>
            {deployStatus.deploy_created_at && <p>created: {String(deployStatus.deploy_created_at)}</p>}
            {deployStatus.deploy_updated_at && <p>updated: {String(deployStatus.deploy_updated_at)}</p>}
            {deployStatus.deploy_published_at && <p>published: {String(deployStatus.deploy_published_at)}</p>}
            {deployStatus.deploy_ssl_url && (
              <p>url: <a href={String(deployStatus.deploy_ssl_url)} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{String(deployStatus.deploy_ssl_url)}</a></p>
            )}
            {deployStatus.error_message && (
              <p className="text-red-600 break-all font-sans">error: {String(deployStatus.error_message)}</p>
            )}
            {!deployStatus.error_message && deployStatus.deploy_state !== 'ready' && (
              <p className="text-amber-700 font-sans">Build still in progress — check again in a moment.</p>
            )}
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {deployed && liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Site
            </a>
          )}
          {deployed && liveUrl && (
            <a
              href={`${liveUrl}/admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Admin
            </a>
          )}
          {netlitySiteId && (
            <a
              href={`https://app.netlify.com/sites/${netlitySiteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Netlify Dashboard
            </a>
          )}
          {manualRequired && result?.netlify_dashboard_url ? (
            <a
              href={result.netlify_dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Netlify Dashboard
            </a>
          ) : blocker ? (
            <span className="text-xs text-gray-400 italic">{blocker}</span>
          ) : !providersReady ? (
            <Link
              to="/platform/integrations"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Verify Providers in Integrations
            </Link>
          ) : (
            <button
              onClick={handleConnect}
              disabled={running || checking}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Connecting…' : noPublishedDeploy || deployed ? 'Retry Connect & Deploy' : 'Connect & Deploy'}
            </button>
          )}
          {(result?.deploy_id || netlitySiteId) && !blocker && (
            <button
              onClick={handleCheckStatus}
              disabled={checking || running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {checking ? 'Checking…' : 'Check Build Status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
