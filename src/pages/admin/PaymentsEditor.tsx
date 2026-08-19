import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CreditCard, CheckCircle2, AlertCircle, AlertTriangle,
  Loader2, Copy, Check, Eye, EyeOff, RefreshCw, Trash2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentMode = 'test_manual' | 'test_stripe' | 'live_manual' | 'live_stripe';

interface PaymentStatus {
  payment_mode: PaymentMode;
  stripe_test_configured: boolean;
  webhook_secret_configured: boolean;
  stripe_live_configured: boolean;
  live_webhook_secret_configured: boolean;
  stripe_status: 'not_configured' | 'ready' | 'missing_webhook_secret' | 'partial';
  secret_key_preview: string | null;
  webhook_secret_preview: string | null;
  live_secret_key_preview: string | null;
  live_webhook_secret_preview: string | null;
  stripe_test_publishable_key: string;
  stripe_live_publishable_key: string;
  site_url: string;
  checkout_expires_minutes: number;
  webhook_endpoint_url: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchStatus(token: string): Promise<PaymentStatus | null> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-settings-status`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateSettings(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: PaymentStatus; error?: string }> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-settings-update`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Update failed' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

const MODE_LABELS: Record<PaymentMode, string> = {
  test_manual: 'Manual Test',
  test_stripe: 'Stripe Test',
  live_manual: 'Manual Live',
  live_stripe: 'Stripe Live',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const isManual = status.payment_mode === 'test_manual' || status.payment_mode === 'live_manual';

  if (isManual) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {MODE_LABELS[status.payment_mode]}
      </span>
    );
  }
  if (status.stripe_status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        {MODE_LABELS[status.payment_mode]} — ready
      </span>
    );
  }
  if (status.stripe_status === 'missing_webhook_secret') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Missing webhook secret
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Not configured
    </span>
  );
}

function SecretField({
  label, preview, placeholder, value, onChange, hint,
}: {
  label: string;
  preview: string | null;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const hasStored = preview !== null && preview !== '';

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {hasStored && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 border rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <code className="text-xs font-mono text-gray-700 flex-1">{preview}</code>
          <span className="text-xs text-gray-400">Saved</span>
        </div>
      )}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasStored ? 'Enter new value to replace…' : placeholder}
          className="w-full px-3 py-2 pr-10 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function PublishableKeyField({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoComplete="off"
        spellCheck={false}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Mode selector ─────────────────────────────────────────────────────────────

function ModeSelector({
  value, onChange, disabled,
}: {
  value: PaymentMode;
  onChange: (v: PaymentMode) => void;
  disabled: boolean;
}) {
  const groups: { title: string; modes: PaymentMode[]; descriptions: Record<PaymentMode, string> }[] = [
    {
      title: 'Test Mode',
      modes: ['test_manual', 'test_stripe'],
      descriptions: {
        test_manual: 'Guests submit booking requests. No online payment collected.',
        test_stripe: 'Guests pay via Stripe Checkout using test credentials only.',
        live_manual: '',
        live_stripe: '',
      },
    },
    {
      title: 'Live Mode',
      modes: ['live_manual', 'live_stripe'],
      descriptions: {
        test_manual: '',
        test_stripe: '',
        live_manual: 'Guests submit booking requests. Live keys may be stored but are not used.',
        live_stripe: 'Guests pay via Stripe Checkout with real charges using live credentials.',
      },
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.title}</p>
          <div className="grid grid-cols-2 gap-3">
            {group.modes.map((mode) => {
              const active = value === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(mode)}
                  className={`relative flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {active && (
                    <span className="absolute top-3 right-3">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${active ? 'text-blue-900' : 'text-gray-800'}`}>
                    {MODE_LABELS[mode]}
                  </span>
                  <span className={`text-xs leading-relaxed ${active ? 'text-blue-700' : 'text-gray-500'}`}>
                    {group.descriptions[mode]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentsEditor() {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  // Form state
  const [mode, setMode] = useState<PaymentMode>('test_manual');
  const [siteUrl, setSiteUrl] = useState('');
  const [expiresMinutes, setExpiresMinutes] = useState(30);
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [liveWebhookSecret, setLiveWebhookSecret] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const load = useCallback(async (t: string) => {
    setLoading(true);
    const s = await fetchStatus(t);
    if (s) {
      setStatus(s);
      setMode(s.payment_mode);
      setSiteUrl(s.site_url ?? '');
      setExpiresMinutes(s.checkout_expires_minutes ?? 30);
      setTestPublishableKey(s.stripe_test_publishable_key ?? '');
      setLivePublishableKey(s.stripe_live_publishable_key ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? '';
      setToken(t);
      if (t) load(t);
      else setLoading(false);
    });
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    // Client-side validation: test key must start with sk_test_
    if (secretKey && !secretKey.startsWith('sk_test_')) {
      setSaveError('Test secret key must start with sk_test_');
      setSaving(false);
      return;
    }
    // Live key must start with sk_live_
    if (liveSecretKey && !liveSecretKey.startsWith('sk_live_')) {
      setSaveError('Live secret key must start with sk_live_');
      setSaving(false);
      return;
    }
    // Webhook secrets must start with whsec_
    if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
      setSaveError('Webhook secret must start with whsec_');
      setSaving(false);
      return;
    }
    if (liveWebhookSecret && !liveWebhookSecret.startsWith('whsec_')) {
      setSaveError('Live webhook secret must start with whsec_');
      setSaving(false);
      return;
    }
    // Publishable keys
    if (testPublishableKey && !testPublishableKey.startsWith('pk_test_')) {
      setSaveError('Test publishable key must start with pk_test_');
      setSaving(false);
      return;
    }
    if (livePublishableKey && !livePublishableKey.startsWith('pk_live_')) {
      setSaveError('Live publishable key must start with pk_live_');
      setSaving(false);
      return;
    }

    // Warn if saving test_stripe mode without any test keys configured or being saved now
    if (mode === 'test_stripe' && !secretKey && !status?.stripe_test_configured) {
      setSaveError(
        'Stripe test mode is selected, but test keys are not configured. ' +
        'Guests will see online payment unavailable until keys are added.',
      );
      setSaving(false);
      return;
    }

    // Warn if saving live_stripe mode without live keys configured or being saved now
    if (mode === 'live_stripe' && !liveSecretKey && !status?.stripe_live_configured) {
      setSaveError(
        'Stripe live mode is selected, but live keys are not configured. ' +
        'Guests will see online payment unavailable until live keys are added.',
      );
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      payment_mode: mode,
      site_url: siteUrl.trim().replace(/\/+$/, ""),
      checkout_expires_minutes: expiresMinutes,
    };
    if (secretKey) payload.stripe_test_secret_key = secretKey;
    if (webhookSecret) payload.stripe_webhook_secret = webhookSecret;
    if (liveSecretKey) payload.stripe_live_secret_key = liveSecretKey;
    if (liveWebhookSecret) payload.stripe_live_webhook_secret = liveWebhookSecret;
    if (testPublishableKey !== (status?.stripe_test_publishable_key ?? '')) {
      payload.stripe_test_publishable_key = testPublishableKey;
    }
    if (livePublishableKey !== (status?.stripe_live_publishable_key ?? '')) {
      payload.stripe_live_publishable_key = livePublishableKey;
    }

    const result = await updateSettings(token, payload);
    if (result.ok && result.data) {
      setStatus(result.data);
      setMode(result.data.payment_mode);
      setSiteUrl(result.data.site_url ?? '');
      setExpiresMinutes(result.data.checkout_expires_minutes ?? 30);
      setTestPublishableKey(result.data.stripe_test_publishable_key ?? '');
      setLivePublishableKey(result.data.stripe_live_publishable_key ?? '');
      setSecretKey('');
      setWebhookSecret('');
      setLiveSecretKey('');
      setLiveWebhookSecret('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.error ?? 'Save failed');
    }
    setSaving(false);
  };

  const handleClearTest = async () => {
    if (!confirm('Remove stored Stripe TEST credentials? This will disable test_stripe mode until new keys are saved.')) return;
    setClearing(true);
    setClearError('');
    const result = await updateSettings(token, { clear_stripe_test_keys: true, payment_mode: 'test_manual' });
    if (result.ok && result.data) {
      setStatus(result.data);
      setMode('test_manual');
      setSecretKey('');
      setWebhookSecret('');
    } else {
      setClearError(result.error ?? 'Failed to clear test credentials');
    }
    setClearing(false);
  };

  const handleClearLive = async () => {
    if (!confirm('Remove stored Stripe LIVE credentials? This will disable live_stripe mode until new keys are saved.')) return;
    setClearing(true);
    setClearError('');
    const result = await updateSettings(token, { clear_stripe_live_keys: true, payment_mode: 'test_manual' });
    if (result.ok && result.data) {
      setStatus(result.data);
      setMode('test_manual');
      setLiveSecretKey('');
      setLiveWebhookSecret('');
    } else {
      setClearError(result.error ?? 'Failed to clear live credentials');
    }
    setClearing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const webhookUrl = status?.webhook_endpoint_url ?? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;
  const hasTestKeys = status?.stripe_test_configured || status?.webhook_secret_configured;
  const hasLiveKeys = status?.stripe_live_configured || status?.live_webhook_secret_configured;
  const isStripeMode = mode === 'test_stripe' || mode === 'live_stripe';
  const isLiveMode = mode === 'live_manual' || mode === 'live_stripe';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure how guests pay for bookings. Secrets are stored in Secured Vault — never in the database or browser.
          </p>
        </div>
        <button
          onClick={() => load(token)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-5 ${
        status?.stripe_status === 'ready' && isStripeMode
          ? 'border-green-200 bg-green-50/30'
          : isStripeMode && status?.stripe_status !== 'ready'
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <CreditCard className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">Current Status</span>
          {status && <StatusBadge status={status} />}
        </div>

        {status && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              {status.stripe_test_configured
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={status.stripe_test_configured ? 'text-gray-700' : 'text-gray-400'}>
                Test secret key
                {status.secret_key_preview && (
                  <code className="ml-2 text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {status.secret_key_preview}
                  </code>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {status.webhook_secret_configured
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={status.webhook_secret_configured ? 'text-gray-700' : 'text-gray-400'}>
                Test webhook secret
                {status.webhook_secret_preview && (
                  <code className="ml-2 text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {status.webhook_secret_preview}
                  </code>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {status.stripe_live_configured
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={status.stripe_live_configured ? 'text-gray-700' : 'text-gray-400'}>
                Live secret key
                {status.live_secret_key_preview && (
                  <code className="ml-2 text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {status.live_secret_key_preview}
                  </code>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {status.live_webhook_secret_configured
                ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={status.live_webhook_secret_configured ? 'text-gray-700' : 'text-gray-400'}>
                Live webhook secret
                {status.live_webhook_secret_preview && (
                  <code className="ml-2 text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {status.live_webhook_secret_preview}
                  </code>
                )}
              </span>
            </div>
          </div>
        )}

        {isStripeMode && status?.stripe_status === 'missing_webhook_secret' && (
          <div className="mt-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Stripe key is set but the webhook secret is missing. Payments will not be confirmed automatically until the webhook secret is added.</span>
          </div>
        )}

        {isStripeMode && status?.stripe_status === 'not_configured' && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Stripe mode is selected but no credentials are configured. Guests will see an error at checkout.</span>
          </div>
        )}
      </div>

      {/* Payment mode */}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Payment Mode</h3>
        <ModeSelector value={mode} onChange={setMode} disabled={saving} />
      </div>

      {/* Stripe test credentials */}
      <div className="bg-white rounded-2xl border p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Stripe Test Credentials</h3>
          <p className="text-xs text-gray-500 mt-1">
            Only <code className="bg-gray-100 px-1 rounded font-mono">sk_test_</code> keys are accepted.
            Secrets are encrypted in Secured Vault.
          </p>
        </div>

        <SecretField
          label="Stripe Test Secret Key"
          preview={status?.secret_key_preview ?? null}
          placeholder="sk_test_••••••••••••••••••••••••"
          value={secretKey}
          onChange={setSecretKey}
          hint="From Stripe Dashboard → Developers → API keys → Secret key (test mode)"
        />

        <SecretField
          label="Test Webhook Signing Secret"
          preview={status?.webhook_secret_preview ?? null}
          placeholder="whsec_••••••••••••••••••••••••"
          value={webhookSecret}
          onChange={setWebhookSecret}
          hint="From Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret"
        />

        <PublishableKeyField
          label="Test Publishable Key"
          value={testPublishableKey}
          onChange={setTestPublishableKey}
          placeholder="pk_test_••••••••••••••••••••••••"
          hint="From Stripe Dashboard → Developers → API keys → Publishable key (test mode). Safe to store — not secret."
        />
      </div>

      {/* Stripe live credentials */}
      <div className="bg-white rounded-2xl border p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Stripe Live Credentials</h3>
          <p className="text-xs text-gray-500 mt-1">
            <code className="bg-gray-100 px-1 rounded font-mono">sk_live_</code> keys process real charges.
            Secrets are encrypted in Secured Vault. Live keys may be saved in any mode but are only used when
            payment mode is <strong>Stripe Live</strong>.
          </p>
        </div>

        {isLiveMode && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Live mode processes real payments. Ensure you have tested thoroughly in test mode first.
          </div>
        )}

        <SecretField
          label="Stripe Live Secret Key"
          preview={status?.live_secret_key_preview ?? null}
          placeholder="sk_live_••••••••••••••••••••••••"
          value={liveSecretKey}
          onChange={setLiveSecretKey}
          hint="From Stripe Dashboard → Developers → API keys → Secret key (live mode)"
        />

        <SecretField
          label="Live Webhook Signing Secret"
          preview={status?.live_webhook_secret_preview ?? null}
          placeholder="whsec_••••••••••••••••••••••••"
          value={liveWebhookSecret}
          onChange={setLiveWebhookSecret}
          hint="From Stripe Dashboard → Developers → Webhooks → your live endpoint → Signing secret"
        />

        <PublishableKeyField
          label="Live Publishable Key"
          value={livePublishableKey}
          onChange={setLivePublishableKey}
          placeholder="pk_live_••••••••••••••••••••••••"
          hint="From Stripe Dashboard → Developers → API keys → Publishable key (live mode). Safe to store — not secret."
        />
      </div>

      {/* Webhook endpoint */}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Webhook Endpoint</h3>
        <p className="text-xs text-gray-500">
          Add this URL in the Stripe Dashboard under <strong>Developers → Webhooks → Add endpoint</strong>.
          Enable these events: <code className="bg-gray-100 px-1 rounded font-mono text-xs">checkout.session.completed</code>,{' '}
          <code className="bg-gray-100 px-1 rounded font-mono text-xs">checkout.session.expired</code>,{' '}
          <code className="bg-gray-100 px-1 rounded font-mono text-xs">payment_intent.payment_failed</code>.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-4 py-3">
          <code className="text-xs font-mono text-gray-700 flex-1 break-all">{webhookUrl}</code>
          <CopyButton value={webhookUrl} />
        </div>
      </div>

      {/* Non-secret settings */}
      <div className="bg-white rounded-2xl border p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">Checkout Settings</h3>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Site URL</label>
          <input
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://yourdomain.com"
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Used as base for Stripe success and cancel URLs.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Checkout Expiration (minutes)
          </label>
          <input
            type="number"
            value={expiresMinutes}
            onChange={(e) => setExpiresMinutes(Number(e.target.value))}
            min={30}
            max={1440}
            step={5}
            className="w-32 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            How long a Stripe Checkout session stays open (30–1440 min). Default: 30.
          </p>
        </div>

        <p className="text-xs text-gray-400 pt-1 border-t">
          Expired pending payment holds are cleaned up automatically every 5 minutes.
        </p>
      </div>

      {/* Save / clear actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving || clearing}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>

        {hasTestKeys && (
          <button
            onClick={handleClearTest}
            disabled={saving || clearing}
            className="flex items-center gap-2 px-4 py-2.5 border border-amber-200 text-amber-700 text-sm font-medium rounded-xl hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {clearing ? 'Clearing…' : 'Remove Test Keys'}
          </button>
        )}

        {hasLiveKeys && (
          <button
            onClick={handleClearLive}
            disabled={saving || clearing}
            className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {clearing ? 'Clearing…' : 'Remove Live Keys'}
          </button>
        )}

        {saveSuccess && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {saveError}
          </span>
        )}
        {clearError && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {clearError}
          </span>
        )}
      </div>

      {/* Security notice */}
      <div className="bg-gray-50 border rounded-2xl p-5 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">Security</p>
        <p>Stripe secret keys and webhook secrets are encrypted in Secured Vault and never stored in plain text.</p>
        <p>Secret keys are never returned in API responses. Only masked previews (last 4 chars) are shown.</p>
        <p>Publishable keys (pk_test_, pk_live_) are safe to store in the database — they are not secret.</p>
        <p>This page is admin-only. Guests cannot access payment settings.</p>
      </div>
    </div>
  );
}
