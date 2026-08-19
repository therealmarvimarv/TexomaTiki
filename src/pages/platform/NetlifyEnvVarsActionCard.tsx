import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  KeyRound, Loader2, CheckCircle2, AlertTriangle, ExternalLink,
  Send, Globe, Eye, EyeOff, Plus, Trash2,
} from 'lucide-react';
import { ProviderStatus } from './ProvisioningActions';

interface EnvRequirement {
  id: string;
  env_key: string;
  label: string;
  provider: string;
  required: boolean;
  status: string;
}

interface NetlifyEnvVarsActionCardProps {
  instanceId: string;
  netlitySiteId: string | null;
  providerStatuses: ProviderStatus[];
  jobId?: string | null;
  onSuccess?: (keysSet: string[]) => void;
  onEventLogged?: (msg: string) => void;
}

const NETLIFY_PROVIDERS = new Set(['netlify', 'app']);

export function NetlifyEnvVarsActionCard({
  instanceId,
  netlitySiteId,
  providerStatuses,
  jobId,
  onSuccess,
  onEventLogged,
}: NetlifyEnvVarsActionCardProps) {
  const [requirements, setRequirements] = useState<EnvRequirement[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extraKeys, setExtraKeys] = useState<{ key: string; value: string }[]>([]);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successKeys, setSuccessKeys] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const netlifyVerified = providerStatuses.find(p => p.provider === 'netlify')?.status === 'verified';

  useEffect(() => {
    if (!instanceId || !netlitySiteId) return;
    supabase
      .from('platform_instance_env_requirements')
      .select('id,env_key,label,provider,required,status')
      .eq('instance_id', instanceId)
      .then(({ data }) => {
        if (data) setRequirements(data.filter(r => NETLIFY_PROVIDERS.has(r.provider)));
      });
  }, [instanceId, netlitySiteId]);

  const netlifyReqs = requirements.filter(r => r.provider === 'netlify');
  const appReqs = requirements.filter(r => r.provider === 'app');
  const allConfigured = requirements.length > 0 && requirements.every(r => r.status !== 'missing');
  const anyAdded = successKeys.length > 0 || requirements.some(r => r.status !== 'missing');

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    const envVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) envVars[k] = v.trim();
    }
    for (const { key, value } of extraKeys) {
      if (key.trim() && value.trim()) envVars[key.trim()] = value.trim();
    }
    if (Object.keys(envVars).length === 0) {
      setErrorMsg('Enter at least one env var value before submitting.');
      setSubmitting(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setSubmitting(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-set-netlify-env-vars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instance_id: instanceId, job_id: jobId ?? undefined, env_vars: envVars }),
      });
      const json = await res.json();
      if (res.ok) {
        const keys: string[] = json.keys_set ?? [];
        setSuccessKeys(keys);
        // Update local requirement statuses
        setRequirements(prev => prev.map(r => keys.includes(r.env_key) ? { ...r, status: 'added' } : r));
        // Clear submitted values (do not persist them)
        setValues({});
        setExtraKeys([]);
        onSuccess?.(keys);
        onEventLogged?.(`Netlify env vars set: ${keys.join(', ')}`);
      } else {
        setErrorMsg(json.error ?? 'Failed to set env vars');
        onEventLogged?.(`Netlify env vars failed: ${json.error ?? 'unknown error'}`);
      }
    } catch {
      setErrorMsg('Network error — could not reach edge function');
    }
    setSubmitting(false);
  };

  const toggleShow = (key: string) =>
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));

  const statusBadge = (status: string) => {
    if (status === 'added' || status === 'verified')
      return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Added</span>;
    if (status === 'not_needed')
      return <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Not needed</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Missing</span>;
  };

  const renderReqRow = (req: EnvRequirement) => (
    <div key={req.id} className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-mono font-semibold text-gray-700">{req.env_key}</label>
          {req.required && <span className="text-red-400 text-xs">*</span>}
          {statusBadge(req.status)}
        </div>
        <button
          type="button"
          onClick={() => toggleShow(req.env_key)}
          className="text-gray-400 hover:text-gray-600"
        >
          {showValues[req.env_key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-gray-400">{req.label}</p>
      <input
        type={showValues[req.env_key] ? 'text' : 'password'}
        placeholder={req.status !== 'missing' ? '(already added — enter to overwrite)' : 'Enter value…'}
        value={values[req.env_key] ?? ''}
        onChange={e => setValues(prev => ({ ...prev, [req.env_key]: e.target.value }))}
        className="w-full text-xs font-mono border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-gray-300"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );

  const blocked = !netlitySiteId;

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${
      allConfigured ? 'border-green-200 bg-green-50/20' : 'border-gray-200 bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        allConfigured ? 'bg-green-100' : 'bg-blue-50'
      }`}>
        <KeyRound className={`w-4 h-4 ${allConfigured ? 'text-green-700' : 'text-blue-600'}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">Netlify Environment Variables</p>
            {allConfigured ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            ) : anyAdded ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                <AlertTriangle className="w-3 h-3" /> Partial
              </span>
            ) : null}
          </div>
          {!blocked && netlifyVerified && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-blue-600 hover:underline"
            >
              {expanded ? 'Collapse' : 'Set Vars'}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Configure environment variables directly on the Netlify site. Values are sent securely and never stored in this platform.
        </p>

        {/* Blocked / not verified states */}
        {blocked ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            Create Netlify Site first before setting environment variables.
          </p>
        ) : !netlifyVerified ? (
          <Link
            to="/platform/integrations"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors w-fit"
          >
            <ExternalLink className="w-3 h-3" /> Verify Netlify in Integrations
          </Link>
        ) : null}

        {/* Status summary (collapsed) */}
        {!blocked && netlifyVerified && !expanded && requirements.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {requirements.map(r => (
              <span key={r.id} className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                r.status !== 'missing' ? 'border-green-200 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500 bg-gray-50'
              }`}>
                {r.env_key}
              </span>
            ))}
          </div>
        )}

        {/* Expanded form */}
        {!blocked && netlifyVerified && expanded && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Values entered here are sent directly to Netlify and are <strong>not stored</strong> in this platform.
              </p>
            </div>

            {netlifyReqs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Netlify (Frontend)
                </p>
                {netlifyReqs.map(renderReqRow)}
              </div>
            )}

            {appReqs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">App / Other</p>
                {appReqs.map(renderReqRow)}
              </div>
            )}

            {/* Extra / custom keys */}
            {extraKeys.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom</p>
                {extraKeys.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="VAR_NAME"
                      value={entry.key}
                      onChange={e => setExtraKeys(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                      className="w-36 text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <input
                      type="password"
                      placeholder="value"
                      value={entry.value}
                      onChange={e => setExtraKeys(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      className="flex-1 text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => setExtraKeys(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setExtraKeys(prev => [...prev, { key: '', value: '' }])}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <Plus className="w-3 h-3" /> Add custom env var
            </button>

            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{errorMsg}</p>
            )}

            {successKeys.length > 0 && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                Set: {successKeys.join(', ')}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {submitting ? 'Sending…' : 'Send to Netlify'}
              </button>
              <button
                onClick={() => { setExpanded(false); setErrorMsg(null); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
