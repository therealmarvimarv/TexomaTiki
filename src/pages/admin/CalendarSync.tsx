import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  RefreshCw, Plus, Trash2, Copy, Check, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Shield, AlertTriangle,
  RotateCcw, Loader2,
} from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const PLATFORM_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  vrbo: 'VRBO',
  booking_com: 'Booking.com',
  other: 'Other',
};

const PLATFORM_OPTIONS = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'other', label: 'Other' },
];

interface IcalSource {
  id: string;
  name: string;
  platform: string;
  url: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string | null;
}

// Mask most of a feed URL — show protocol + host only, hide path/query params
// which often contain auth tokens from external platforms.
function maskFeedUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}/…`;
  } catch {
    return raw.length > 40 ? raw.slice(0, 40) + '…' : raw;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ── Export feed section ───────────────────────────────────────────────────────

function ExportFeedSection() {
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const exportUrl = exportToken
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-export?property_id=${PROPERTY_ID}&token=${exportToken}`
    : null;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('properties')
      .select('calendar_export_token, calendar_export_token_created_at')
      .eq('id', PROPERTY_ID)
      .maybeSingle();
    setExportToken(data?.calendar_export_token ?? null);
    setTokenCreatedAt(data?.calendar_export_token_created_at ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generateToken() {
    setRegenerating(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const authToken = session.session?.access_token;
      // Generate token via edge function so it happens server-side
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-export-token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ property_id: PROPERTY_ID }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setExportToken(data.token);
      setTokenCreatedAt(data.created_at);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate token');
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    if (!exportUrl) return;
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">iCal Export Feed</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Share this URL with Airbnb, VRBO, or Booking.com so they can import
          your confirmed bookings and block those dates automatically.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium">Share only with trusted calendar platforms</p>
          <p className="text-amber-800">
            This feed is protected by a secret token. Anyone with this URL can see your
            blocked date ranges. Guest names, emails, payment data, and booking details
            are never included — only generic "Reserved" event titles.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : exportToken ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono truncate">
              {exportUrl}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={exportUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              Preview
            </a>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            {tokenCreatedAt && (
              <p className="text-xs text-gray-400">Token generated {formatDate(tokenCreatedAt)}</p>
            )}
            <button
              onClick={generateToken}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating…' : 'Regenerate token'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Regenerating the token invalidates the old URL. Update it on all
            platforms that use this feed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            No export token yet. Generate one to create a secure feed URL.
          </p>
          <button
            onClick={generateToken}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {regenerating ? 'Generating…' : 'Generate secure export URL'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ── Import sources section ────────────────────────────────────────────────────

export default function CalendarSync() {
  const [sources, setSources] = useState<IcalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newPlatform, setNewPlatform] = useState('other');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchSources = useCallback(async () => {
    const { data } = await supabase
      .from('ical_sources')
      .select('id, name, platform, url, enabled, last_sync_at, last_error, created_at')
      .eq('property_id', PROPERTY_ID)
      .order('created_at', { ascending: true });
    setSources((data ?? []) as IcalSource[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  async function callImport(body: Record<string, unknown>) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Sync failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  async function handleSyncAll() {
    setSyncing(true);
    setError('');
    try {
      await callImport({});
      await fetchSources();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncOne(sourceId: string) {
    setSyncingId(sourceId);
    setError('');
    try {
      await callImport({ source_id: sourceId });
      await fetchSources();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggle(source: IcalSource) {
    await supabase.from('ical_sources').update({ enabled: !source.enabled, updated_at: new Date().toISOString() }).eq('id', source.id);
    await fetchSources();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this calendar source? Imported blocks from this source will be cleaned up on the next sync or can be left in place.')) return;
    await supabase.from('ical_sources').delete().eq('id', id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return;
    const url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Feed URL must start with http:// or https://');
      return;
    }
    setAdding(true);
    setError('');
    try {
      const { error: err } = await supabase.from('ical_sources').insert({
        property_id: PROPERTY_ID,
        name: newName.trim(),
        platform: newPlatform,
        url,
        enabled: true,
      });
      if (err) throw err;
      setNewName('');
      setNewUrl('');
      setNewPlatform('other');
      setShowAdd(false);
      await fetchSources();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add source');
    } finally {
      setAdding(false);
    }
  }

  function sourceStatus(source: IcalSource): { label: string; style: string; icon: React.ElementType } {
    if (!source.enabled) return { label: 'Disabled', style: 'bg-gray-100 text-gray-400', icon: Clock };
    if (source.last_error) return { label: 'Error', style: 'bg-red-50 text-red-600', icon: AlertCircle };
    if (source.last_sync_at) return { label: 'Synced', style: 'bg-green-50 text-green-700', icon: CheckCircle2 };
    return { label: 'Not synced', style: 'bg-gray-100 text-gray-500', icon: Clock };
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendar Sync</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Sync availability with external booking platforms to prevent double-bookings.
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing || sources.filter(s => s.enabled).length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync All'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Export feed */}
      <ExportFeedSection />

      {/* Import sources */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900">Import Calendars</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Add iCal feed URLs from external platforms to block those dates here.
              Feed URLs are masked for security.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>

        {showAdd && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                >
                  {PLATFORM_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display name</label>
                <input
                  type="text"
                  placeholder="e.g. My VRBO listing"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">iCal URL</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Only http:// and https:// URLs are accepted. The full URL is stored
              securely and never shown in full after saving.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAdd(false); setNewName(''); setNewUrl(''); setNewPlatform('other'); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newUrl.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding…' : 'Add source'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm space-y-1">
            <p>No import sources yet.</p>
            <p className="text-xs">Add an Airbnb, VRBO, or Booking.com iCal URL to block those dates here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sources.map((source) => {
              const status = sourceStatus(source);
              const StatusIcon = status.icon;
              const platformLabel = PLATFORM_LABELS[source.platform] ?? source.platform;
              return (
                <div key={source.id} className="py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-900 text-sm">{source.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformLabel}</span>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${status.style}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    {/* Masked URL — path/query hidden to protect embedded tokens */}
                    <p className="text-xs text-gray-400 font-mono mb-1" title="URL masked for security">
                      {maskFeedUrl(source.url)}
                    </p>
                    {source.last_error && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-500 break-words">{source.last_error}</p>
                      </div>
                    )}
                    {!source.last_error && source.last_sync_at && (
                      <p className="text-xs text-gray-400">
                        Last synced: {formatDate(source.last_sync_at)}
                      </p>
                    )}
                    {!source.last_error && !source.last_sync_at && source.enabled && (
                      <p className="text-xs text-gray-400">Never synced — click sync to import dates.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(source)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${source.enabled ? 'bg-gray-900' : 'bg-gray-300'}`}
                      title={source.enabled ? 'Disable' : 'Enable'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${source.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <button
                      onClick={() => handleSyncOne(source.id)}
                      disabled={syncingId === source.id || !source.enabled}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                      title="Sync now"
                    >
                      <RefreshCw className={`w-4 h-4 text-gray-600 ${syncingId === source.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove source"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-sm text-blue-900 space-y-3">
        <p className="font-semibold">How to connect external platforms</p>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>
            <strong>Export (push your dates out):</strong> Copy the secure export URL above and
            paste it into your Airbnb, VRBO, or Booking.com listing as an "import calendar" link.
            Those platforms will periodically fetch the feed and block confirmed dates.
          </li>
          <li>
            <strong>Import (pull external dates in):</strong> In each platform, find their
            "export calendar" or "iCal URL" option. Copy that URL and add it as a source
            above. Click Sync to pull in their blocked dates.
          </li>
          <li>
            <strong>Sync schedule:</strong> Click "Sync All" any time to refresh all import
            sources. Blocked dates from imports appear immediately in the booking calendar.
          </li>
        </ol>
        <p className="text-xs text-blue-700 pt-1 border-t border-blue-200">
          Imported blocks only show as "unavailable" — no guest details are shared between platforms.
        </p>
      </div>
    </div>
  );
}
