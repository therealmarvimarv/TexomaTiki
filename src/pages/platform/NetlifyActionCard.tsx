import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Globe, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Play, RefreshCw, Search,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

interface NetlifyActionCardProps {
  instanceId: string;
  netlitySiteId: string | null;
  frontendUrl: string | null;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onSuccess?: (result: { site_id: string; site_name: string; site_url: string; netlify_admin_url: string }) => void;
  onEventLogged?: (msg: string) => void;
  onDiagnosticResult?: (result: { has_published_deploy: boolean; site_exists: boolean }) => void;
}

export function NetlifyActionCard({
  instanceId,
  netlitySiteId,
  frontendUrl,
  providerStatuses,
  jobId,
  onSuccess,
  onEventLogged,
  onDiagnosticResult,
}: NetlifyActionCardProps) {
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<{ site_url: string; site_name: string } | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ actual_site_name: string; frontend_url_saved: string } | null>(null);
  const [siteNotFound, setSiteNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const netlifyProvider = providerStatuses.find(p => p.provider === 'netlify');
  const netlifyVerified = netlifyProvider?.status === 'verified';

  const existingSiteId = netlitySiteId;
  const existingUrl = result?.site_url ?? frontendUrl;

  const handleRefresh = async () => {
    setRefreshing(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setRefreshing(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-refresh-netlify-site-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.site_exists === false) {
          setSiteNotFound(true);
          onEventLogged?.(`Netlify site ID ${existingSiteId} not found — site may have been deleted`);
        } else {
          setSiteNotFound(false);
          setRefreshResult({
            actual_site_name: json.actual_site_name,
            frontend_url_saved: json.frontend_url_saved,
          });
          if (json.frontend_url_saved) {
            onSuccess?.({ site_id: existingSiteId ?? '', site_name: json.actual_site_name, site_url: json.frontend_url_saved, netlify_admin_url: '' });
          }
          onEventLogged?.(`Netlify site info refreshed: ${json.actual_site_name} → ${json.frontend_url_saved ?? 'no URL yet'}`);
        }
      } else if (res.status === 404) {
        setSiteNotFound(true);
        onEventLogged?.(`Netlify site ID ${existingSiteId} not found — site may have been deleted`);
      } else {
        setErrorMsg(json.error ?? 'Refresh failed');
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setRefreshing(false);
  };

  const handleDiagnose = async () => {
    setDiagnosing(true);
    setErrorMsg(null);
    setDiagResult(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setDiagnosing(false); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-netlify-diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      const json = await res.json();
      setDiagResult(json);
      if (json.stale_netlify_site_id) {
        setSiteNotFound(true);
        onEventLogged?.('Netlify diagnostic: saved site ID is stale — fields cleared');
        onDiagnosticResult?.({ has_published_deploy: false, site_exists: false });
      } else if (json.site_exists_in_netlify) {
        setSiteNotFound(false);
        onEventLogged?.(`Netlify diagnostic: site confirmed — ${json.actual_url ?? ''}`);
        onDiagnosticResult?.({
          has_published_deploy: !!json.has_published_deploy || !!(json.site_by_id as Record<string,unknown> | null)?.published_deploy,
          site_exists: true,
        });
      }
    } catch {
      setErrorMsg('Network error running diagnostic');
    }
    setDiagnosing(false);
  };

  const handleClearStale = async () => {
    setClearing(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setClearing(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-refresh-netlify-site-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instance_id: instanceId, clear_stale: true }),
      });
      const json = await res.json();
      if (res.ok && json.stale_cleared) {
        onEventLogged?.('Stale Netlify site info cleared — ready to create a new site');
        // Reload to pick up cleared DB state
        window.location.reload();
      } else {
        setErrorMsg(json.error ?? 'Clear failed');
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setClearing(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    setErrorMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setCreating(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-create-netlify-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instance_id: instanceId, job_id: jobId ?? undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ site_url: json.site_url, site_name: json.site_name });
        onSuccess?.(json);
        onEventLogged?.(`Netlify site created: ${json.site_name}`);
      } else {
        setErrorMsg(json.error ?? 'Netlify site creation failed');
        onEventLogged?.(`Netlify site creation failed: ${json.error ?? 'unknown error'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setCreating(false);
  };

  const siteCreated = !!existingSiteId || !!result;

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${
      siteCreated ? 'border-green-200 bg-green-50/20' : netlifyVerified ? 'border-teal-200 bg-teal-50/10' : 'border-gray-200 bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        siteCreated ? 'bg-green-100' : netlifyVerified ? 'bg-teal-100' : 'bg-gray-100'
      }`}>
        <Globe className={`w-4 h-4 ${siteCreated ? 'text-green-700' : netlifyVerified ? 'text-teal-700' : 'text-gray-400'}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">Create Netlify Site</p>
          {siteCreated ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Created
            </span>
          ) : netlifyVerified ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> Provider not verified
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Creates a blank Netlify site linked to this instance. You can connect a repository and configure environment variables afterwards.
        </p>

        {siteCreated && (refreshResult?.frontend_url_saved ?? existingUrl) && (
          <p className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded truncate">
            {refreshResult?.frontend_url_saved ?? existingUrl}
          </p>
        )}
        {refreshResult && (
          <p className="text-xs text-gray-500">
            Actual Netlify name: <span className="font-mono">{refreshResult.actual_site_name}</span>
          </p>
        )}
        {siteCreated && existingSiteId && (
          <p className="text-xs text-gray-400 font-mono">ID: {existingSiteId}</p>
        )}

        {siteNotFound && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
            <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Netlify site not found</p>
            <p>Site ID <span className="font-mono">{existingSiteId}</span> does not exist in Netlify. It may have been deleted. Clear the stale info to create a new site.</p>
          </div>
        )}
        {diagResult && (
          <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1 font-mono">
            <p className="font-semibold text-gray-700 font-sans">Netlify Diagnostic Result</p>
            <p>Site exists in Netlify: <span className={diagResult.site_exists_in_netlify ? 'text-green-700' : 'text-red-600'}>{String(diagResult.site_exists_in_netlify)}</span></p>
            {diagResult.site_exists_in_netlify && <>
              <p>GET by ID status: {String(diagResult.get_site_by_id_status)}</p>
              {diagResult.site_by_id && <>
                <p>ID: {String((diagResult.site_by_id as Record<string,unknown>).id)}</p>
                <p>Name: {String((diagResult.site_by_id as Record<string,unknown>).name)}</p>
                <p>URL: {String((diagResult.site_by_id as Record<string,unknown>).ssl_url ?? (diagResult.site_by_id as Record<string,unknown>).url)}</p>
                <p>Admin: {String((diagResult.site_by_id as Record<string,unknown>).admin_url)}</p>
                <p>Account: {String((diagResult.site_by_id as Record<string,unknown>).account_slug ?? (diagResult.site_by_id as Record<string,unknown>).account_id)}</p>
                <p>Has published deploy: <span className={(diagResult.site_by_id as Record<string,unknown>).published_deploy ? 'text-green-700' : 'text-amber-600'}>{String(!!(diagResult.site_by_id as Record<string,unknown>).published_deploy)}</span></p>
              </>}
            </>}
            {diagResult.stale_netlify_site_id && <p className="text-red-600 font-sans">Stale site ID — fields cleared. Reload to create a new site.</p>}
            <p>DB update: {String(diagResult.db_update ?? 'none')}</p>
          </div>
        )}
        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {siteCreated ? (
            <>
              {(refreshResult?.frontend_url_saved ?? existingUrl) && (
                <a
                  href={refreshResult?.frontend_url_saved ?? existingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open Site
                </a>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing || clearing || diagnosing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {refreshing ? 'Refreshing…' : 'Refresh Site Info'}
              </button>
              <button
                onClick={handleDiagnose}
                disabled={diagnosing || refreshing || clearing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {diagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {diagnosing ? 'Diagnosing…' : 'Run Netlify Diagnostic'}
              </button>
              {siteNotFound && (
                <button
                  onClick={handleClearStale}
                  disabled={clearing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {clearing ? 'Clearing…' : 'Clear Stale Site Info'}
                </button>
              )}
            </>
          ) : netlifyVerified ? (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {creating ? 'Creating…' : 'Create Netlify Site'}
            </button>
          ) : (
            <Link
              to="/platform/integrations"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Verify Netlify in Integrations
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
