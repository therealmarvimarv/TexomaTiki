import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Shield, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, Save, Minus,
} from 'lucide-react';

interface ProviderIntegration {
  id: string;
  provider: string;
  display_name: string;
  status: string;
  required_env_keys: string[];
  last_checked_at: string | null;
  last_check_status: string | null;
  last_check_message: string | null;
  notes: string | null;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  not_configured: 'bg-gray-100 text-gray-600',
  configured:     'bg-yellow-100 text-yellow-800',
  verified:       'bg-green-100 text-green-800',
  failed:         'bg-red-100 text-red-800',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  not_configured: <Minus className="w-4 h-4 text-gray-400" />,
  configured:     <Clock className="w-4 h-4 text-yellow-500" />,
  verified:       <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed:         <XCircle className="w-4 h-4 text-red-500" />,
};

const STATUS_OPTIONS = ['not_configured', 'configured', 'verified', 'failed'];

function fmtDateTime(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function ProviderCard({
  integration,
  onUpdated,
  onTest,
  testing,
}: {
  integration: ProviderIntegration;
  onUpdated: (updated: ProviderIntegration) => void;
  onTest: (provider: string) => void;
  testing: boolean;
}) {
  const [notes, setNotes] = useState(integration.notes ?? '');
  const [status, setStatus] = useState(integration.status);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase
      .from('platform_provider_integrations')
      .update({ notes: notes.trim() || null, status })
      .eq('id', integration.id)
      .select()
      .maybeSingle();
    if (data) { onUpdated(data as ProviderIntegration); setDirty(false); }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';

  return (
    <div className={`bg-white rounded-2xl border p-5 space-y-4 ${status === 'failed' ? 'border-red-200' : status === 'verified' ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {STATUS_ICON[status] ?? STATUS_ICON.not_configured}
          <div>
            <p className="font-semibold text-gray-900">{integration.display_name}</p>
            <p className="text-xs text-gray-400 font-mono">{integration.provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setDirty(true); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Required env keys — names only */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Required Environment Variables</p>
        <div className="flex flex-wrap gap-1.5">
          {integration.required_env_keys.map(key => (
            <span key={key} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-mono">
              {key}
            </span>
          ))}
        </div>
      </div>

      {/* Last check */}
      <div className="flex items-start gap-4 text-xs text-gray-500 flex-wrap">
        <div>
          <span className="font-medium">Last checked:</span>{' '}
          {fmtDateTime(integration.last_checked_at)}
        </div>
        {integration.last_check_message && (
          <div className="flex-1 min-w-0">
            <span className="font-medium">Result:</span>{' '}
            <span className={integration.last_check_status === 'verified' ? 'text-green-700' : integration.last_check_status === 'failed' ? 'text-red-600' : 'text-gray-600'}>
              {integration.last_check_message}
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notes</label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setDirty(true); }}
          rows={2}
          placeholder="Configuration notes — do not paste API keys or secrets here"
          className={inputCls}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <button
          onClick={() => onTest(integration.provider)}
          disabled={testing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Test Connection
        </button>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlatformIntegrations() {
  const [integrations, setIntegrations] = useState<ProviderIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; message: string; ok: boolean } | null>(null);

  useEffect(() => {
    supabase
      .from('platform_provider_integrations')
      .select('*')
      .order('display_name')
      .then(({ data }) => {
        setIntegrations((data as ProviderIntegration[]) ?? []);
        setLoading(false);
      });
  }, []);

  const handleUpdated = (updated: ProviderIntegration) => {
    setIntegrations(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const handleTest = async (provider: string) => {
    setTesting(provider);
    setTestResult(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setTesting(null); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/platform-test-provider-integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (res.ok) {
        setTestResult({ provider, message: json.message, ok: json.status === 'verified' });
        // Refresh this integration row from DB
        const { data: refreshed } = await supabase
          .from('platform_provider_integrations')
          .select('*')
          .eq('provider', provider)
          .maybeSingle();
        if (refreshed) handleUpdated(refreshed as ProviderIntegration);
      } else {
        setTestResult({ provider, message: json.error ?? 'Test failed', ok: false });
      }
    } catch (e) {
      setTestResult({ provider, message: 'Network error — could not reach edge function', ok: false });
    }
    setTesting(null);
  };

  const verified = integrations.filter(i => i.status === 'verified').length;
  const total = integrations.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track readiness for external API providers before enabling provisioning automation.
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-gray-900">{verified}/{total} verified</span>
          </div>
        )}
      </div>

      {/* Security banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Security reminder:</strong> This page tracks environment variable names and connection status only.
          Do not paste API keys, tokens, or secrets into notes fields.
          Actual credentials must be stored in Supabase Edge Function secrets or your provider's secure dashboard.
        </p>
      </div>

      {/* How Test Connection works */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Test Connection</strong> calls a secure edge function that checks whether required environment variables are present in the
          Supabase Edge Function runtime. No values are returned or logged — only presence is checked.
          Set secrets via the Supabase dashboard under Edge Function Secrets.
        </p>
      </div>

      {/* Inline test result */}
      {testResult && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${testResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {testResult.ok
            ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
          <p className={`text-xs ${testResult.ok ? 'text-green-800' : 'text-red-700'}`}>
            <strong>{testResult.provider}:</strong> {testResult.message}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map(integration => (
            <ProviderCard
              key={integration.id}
              integration={integration}
              onUpdated={handleUpdated}
              onTest={handleTest}
              testing={testing === integration.provider}
            />
          ))}
        </div>
      )}

      <div className="pt-2 border-t">
        <Link to="/platform/deployment" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          View Deployment Blueprint
        </Link>
      </div>
    </div>
  );
}
