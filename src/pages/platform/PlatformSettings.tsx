import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Loader2, CheckCircle, AlertCircle, Shield, Info } from 'lucide-react';

interface PlatformSettings {
  id: string;
  master_version: string;
  notes: string | null;
  updated_at: string;
}

interface PlatformProfile {
  id: string;
  user_id: string;
  platform_role: string;
  created_at: string;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [profiles, setProfiles] = useState<PlatformProfile[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [form, setForm] = useState({ master_version: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAdminEmail(data.session?.user.email ?? ''));
    Promise.all([
      supabase.from('platform_settings').select('*').limit(1).maybeSingle(),
      supabase.from('platform_profiles').select('*').order('created_at'),
    ]).then(([sr, pr]) => {
      if (sr.data) {
        setSettings(sr.data as PlatformSettings);
        setForm({ master_version: sr.data.master_version, notes: sr.data.notes ?? '' });
      }
      setProfiles((pr.data as PlatformProfile[]) ?? []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!form.master_version.trim()) { setError('Version is required.'); return; }
    setSaving(true); setError('');
    if (settings) {
      const { data, error: e } = await supabase
        .from('platform_settings')
        .update({ master_version: form.master_version.trim(), notes: form.notes.trim() || null })
        .eq('id', settings.id)
        .select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      setSettings(data as PlatformSettings);
    } else {
      const { data, error: e } = await supabase
        .from('platform_settings')
        .insert({ master_version: form.master_version.trim(), notes: form.notes.trim() || null })
        .select().maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Save failed'); setSaving(false); return; }
      setSettings(data as PlatformSettings);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-900 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Master template configuration and platform owner settings.</p>
      </div>

      {/* Template version */}
      <div className="bg-white rounded-2xl border p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Master Template</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                <CheckCircle className="w-4 h-4" /> Settings saved.
              </div>
            )}
            <div>
              <label className={labelCls}>Master Template Version</label>
              <input
                value={form.master_version}
                onChange={e => setForm(f => ({ ...f, master_version: e.target.value }))}
                className={inputCls}
                placeholder="1.0.0"
              />
              <p className="text-xs text-gray-400 mt-1.5">This is the canonical version of the base template. Increment when you ship platform-level changes.</p>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls}
                rows={4}
                placeholder="Release notes, known issues, pending migration steps..."
              />
            </div>
            {settings?.updated_at && (
              <p className="text-xs text-gray-400">Last updated: {fmtDateTime(settings.updated_at)}</p>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </>
        )}
      </div>

      {/* Platform admin accounts */}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Platform Admin Accounts</h2>
        </div>
        <p className="text-xs text-gray-500">
          These Supabase Auth users have <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">platform_role = super_admin</code> and can access this area.
          To grant access, insert a row into <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">platform_profiles</code> with the user's UUID.
        </p>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No platform admin profiles found.</p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-900 font-mono">{p.user_id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Added {fmtDateTime(p.created_at)}</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{p.platform_role}</span>
              </div>
            ))}
          </div>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            To add a new platform admin, run:<br />
            <code className="block mt-1 bg-amber-100 px-2 py-1 rounded font-mono text-xs break-all">
              INSERT INTO platform_profiles (user_id, platform_role) VALUES ('&lt;uuid&gt;', 'super_admin');
            </code>
          </p>
        </div>
      </div>

      {/* Provisioning notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Provisioning</h2>
        <p className="text-sm text-gray-600">
          Auto-provisioning of new client instances (Supabase project creation, Netlify deployments, DNS configuration) is <strong>not yet automated</strong>.
        </p>
        <ul className="text-sm text-gray-500 space-y-1.5 list-disc list-inside">
          <li>Client instances are tracked manually in the Instances table</li>
          <li>URLs, Supabase refs, and Netlify IDs are entered by hand</li>
          <li>Phase 2 will add one-click deployment pipelines</li>
        </ul>
      </div>
    </div>
  );
}
