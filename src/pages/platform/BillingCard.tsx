import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CreditCard, Loader2, Check, AlertTriangle, RefreshCw,
  UserPlus, ExternalLink, Copy, Zap, Wifi, WifiOff, Webhook,
} from 'lucide-react';

interface Subscription {
  id: string;
  client_id: string;
  status: string;
  plan_name: string | null;
  billing_cycle: string;
  price_amount: number | null;
  currency: string;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  next_invoice_date: string | null;
  payment_method: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_latest_invoice_id: string | null;
  stripe_subscription_status: string | null;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
  notes: string | null;
}

interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_status: string;
  error_message: string | null;
  received_at: string;
}

interface BillingCardProps {
  clientId: string;
}

const STATUS_OPTIONS = ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'];

const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'manual', label: 'Manual' },
];

const METHOD_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'manual_invoice', label: 'Manual Invoice' },
  { value: 'cash', label: 'Cash' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLOR: Record<string, string> = {
  trial:     'bg-yellow-100 text-yellow-700',
  active:    'bg-green-100 text-green-700',
  past_due:  'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired:   'bg-gray-100 text-gray-500',
};

const SYNC_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  not_connected: { label: 'Not Connected', cls: 'text-gray-400', icon: <WifiOff className="w-3 h-3" /> },
  connected:     { label: 'Connected',     cls: 'text-green-600', icon: <Wifi className="w-3 h-3" /> },
  sync_failed:   { label: 'Sync Failed',   cls: 'text-red-600',   icon: <AlertTriangle className="w-3 h-3" /> },
};

function DateInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <input type="date" value={value ? value.slice(0, 10) : ''}
        onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
      />
    </div>
  );
}

async function callEdge(action: string, payload: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-sync-stripe-subscription`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

export function BillingCard({ clientId }: BillingCardProps) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<Subscription>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  const reload = () =>
    Promise.all([
      supabase.from('platform_client_subscriptions').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('platform_stripe_webhook_events')
        .select('id,stripe_event_id,event_type,processed_status,error_message,received_at')
        .eq('related_client_id', clientId)
        .order('received_at', { ascending: false })
        .limit(5),
    ]).then(([subRes, evRes]) => {
      if (subRes.data) { setSub(subRes.data as Subscription); setForm(subRes.data as Subscription); }
      setWebhookEvents((evRes.data ?? []) as WebhookEvent[]);
      setLoading(false);
    });

  useEffect(() => { reload(); }, [clientId]);

  const set = (field: keyof Subscription, value: unknown) =>
    setForm(p => ({ ...p, [field]: value }));

  const save = async () => {
    if (!sub) return;
    setSaving(true);
    const { data } = await supabase
      .from('platform_client_subscriptions')
      .update({
        status: form.status,
        plan_name: form.plan_name || null,
        billing_cycle: form.billing_cycle,
        price_amount: form.price_amount ?? null,
        currency: form.currency || 'USD',
        trial_starts_at: form.trial_starts_at,
        trial_ends_at: form.trial_ends_at,
        current_period_starts_at: form.current_period_starts_at,
        current_period_ends_at: form.current_period_ends_at,
        next_invoice_date: form.next_invoice_date,
        payment_method: form.payment_method,
        stripe_customer_id: form.stripe_customer_id || null,
        stripe_subscription_id: form.stripe_subscription_id || null,
        stripe_price_id: form.stripe_price_id || null,
        notes: form.notes || null,
      })
      .eq('id', sub.id)
      .select('*')
      .maybeSingle();
    if (data) { setSub(data as Subscription); setForm(data as Subscription); }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setActionLoading(action);
    setActionError(null);
    try {
      await callEdge(action, { client_id: clientId, ...extra });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
      // mark sync_failed locally if it was a sync action
      if (action === 'sync') {
        await supabase.from('platform_client_subscriptions')
          .update({ sync_status: 'sync_failed', sync_error: (e as Error).message })
          .eq('client_id', clientId);
        await reload();
      }
    }
    setActionLoading(null);
  };

  const createCheckout = async () => {
    setActionLoading('create_checkout');
    setActionError(null);
    setCheckoutUrl(null);
    try {
      const res = await callEdge('create_checkout', {
        client_id: clientId,
        price_id: form.stripe_price_id || undefined,
      });
      setCheckoutUrl(res.checkout_url);
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
    setActionLoading(null);
  };

  const copyUrl = async () => {
    if (!checkoutUrl) return;
    await navigator.clipboard.writeText(checkoutUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      <span className="text-xs text-gray-400">Loading billing…</span>
    </div>
  );

  if (!sub) return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-500" />
      <span className="text-xs text-amber-700">No subscription record found for this client.</span>
    </div>
  );

  const statusCls = STATUS_COLOR[form.status ?? 'trial'] ?? STATUS_COLOR.trial;
  const syncCfg = SYNC_CONFIG[sub.sync_status ?? 'not_connected'] ?? SYNC_CONFIG.not_connected;
  const hasCustomer = !!(sub.stripe_customer_id);
  const hasPriceId = !!(form.stripe_price_id || sub.stripe_price_id);
  const canCreateCheckout = hasCustomer && hasPriceId;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-green-700" />
          </div>
          <p className="text-sm font-bold text-gray-900">Billing & Subscription</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-medium ${syncCfg.cls}`}>
            {syncCfg.icon} {syncCfg.label}
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${statusCls}`}>
            {form.status ?? 'trial'}
          </span>
        </div>
      </div>

      {/* Stripe status panel */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">Stripe Connection</p>
          {sub.last_synced_at && (
            <p className="text-xs text-gray-400">
              Synced {new Date(sub.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
          {sub.stripe_customer_id
            ? <span className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded">{sub.stripe_customer_id}</span>
            : <span className="text-gray-400 italic">No customer ID</span>}
          {sub.stripe_subscription_id && (
            <span className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded">{sub.stripe_subscription_id}</span>
          )}
          {sub.stripe_subscription_status && (
            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded capitalize">{sub.stripe_subscription_status}</span>
          )}
        </div>

        {sub.sync_error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{sub.sync_error}</p>
        )}

        {actionError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{actionError}</p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Sync */}
          <button onClick={() => runAction('sync')} disabled={!!actionLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
            {actionLoading === 'sync' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync from Stripe
          </button>

          {/* Create customer */}
          {!hasCustomer && (
            <button onClick={() => runAction('create_customer')} disabled={!!actionLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {actionLoading === 'create_customer' ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              Create Stripe Customer
            </button>
          )}

          {/* Create checkout */}
          <button onClick={createCheckout} disabled={!canCreateCheckout || !!actionLoading}
            title={!canCreateCheckout ? 'Requires Stripe customer ID and price ID' : ''}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {actionLoading === 'create_checkout' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Create Subscription Link
          </button>
        </div>

        {/* Checkout URL */}
        {checkoutUrl && (
          <div className="mt-2 flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-violet-700 flex-1 truncate">{checkoutUrl}</p>
            <button onClick={copyUrl} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 flex-shrink-0">
              {urlCopied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              {urlCopied ? 'Copied' : 'Copy'}
            </button>
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <ExternalLink className="w-3 h-3 text-violet-500" />
            </a>
          </div>
        )}

        {/* Webhook status */}
        <div className="border-t border-gray-100 pt-2 mt-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Webhook className="w-3 h-3" />
            <span>Webhook Events</span>
            <span className="ml-auto text-gray-300 font-normal">active when STRIPE_PLATFORM_WEBHOOK_SECRET is set</span>
          </div>
          {webhookEvents.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No webhook events received yet.</p>
          ) : (
            <div className="space-y-1">
              {webhookEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    ev.processed_status === 'processed' ? 'bg-green-400' :
                    ev.processed_status === 'failed' ? 'bg-red-400' : 'bg-gray-300'
                  }`} />
                  <span className="text-gray-600 font-mono flex-1">{ev.event_type}</span>
                  <span className={`capitalize flex-shrink-0 ${
                    ev.processed_status === 'processed' ? 'text-green-600' :
                    ev.processed_status === 'failed' ? 'text-red-600' : 'text-gray-400'
                  }`}>{ev.processed_status}</span>
                  <span className="text-gray-400 flex-shrink-0">
                    {new Date(ev.received_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual billing fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Status</label>
          <select value={form.status ?? 'trial'} onChange={e => set('status', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Plan Name</label>
          <input type="text" value={form.plan_name ?? ''} onChange={e => set('plan_name', e.target.value || null)}
            placeholder="e.g. Starter, Pro"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Billing Cycle</label>
          <select value={form.billing_cycle ?? 'monthly'} onChange={e => set('billing_cycle', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200">
            {CYCLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Price Amount</label>
          <div className="flex gap-1">
            <input type="number" min="0" step="0.01" value={form.price_amount ?? ''}
              onChange={e => set('price_amount', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0.00"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200" />
            <input type="text" value={form.currency ?? 'USD'} onChange={e => set('currency', e.target.value.toUpperCase())}
              maxLength={3} placeholder="USD"
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200 text-center" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Payment Method</label>
          <select value={form.payment_method ?? 'manual_invoice'} onChange={e => set('payment_method', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200">
            {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <DateInput label="Next Invoice Date" value={form.next_invoice_date ?? null} onChange={v => set('next_invoice_date', v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DateInput label="Trial Starts" value={form.trial_starts_at ?? null} onChange={v => set('trial_starts_at', v)} />
        <DateInput label="Trial Ends" value={form.trial_ends_at ?? null} onChange={v => set('trial_ends_at', v)} />
        <DateInput label="Period Start" value={form.current_period_starts_at ?? null} onChange={v => set('current_period_starts_at', v)} />
        <DateInput label="Period End" value={form.current_period_ends_at ?? null} onChange={v => set('current_period_ends_at', v)} />
      </div>

      {/* Stripe IDs (editable for manual entry) */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Stripe Customer ID</label>
          <input type="text" value={form.stripe_customer_id ?? ''} onChange={e => set('stripe_customer_id', e.target.value || null)}
            placeholder="cus_..."
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200 font-mono" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Stripe Subscription ID</label>
          <input type="text" value={form.stripe_subscription_id ?? ''} onChange={e => set('stripe_subscription_id', e.target.value || null)}
            placeholder="sub_..."
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200 font-mono" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Stripe Price ID</label>
          <input type="text" value={form.stripe_price_id ?? ''} onChange={e => set('stripe_price_id', e.target.value || null)}
            placeholder="price_..."
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200 font-mono" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Notes</label>
        <textarea rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)}
          placeholder="Internal billing notes…"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-200 resize-none" />
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-1.5 text-xs px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Billing'}
      </button>
    </div>
  );
}
