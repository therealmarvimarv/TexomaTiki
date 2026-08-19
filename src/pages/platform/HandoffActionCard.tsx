import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Handshake, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Copy, Check, ExternalLink,
} from 'lucide-react';

interface Handoff {
  id: string;
  status: string;
  client_admin_name: string | null;
  client_admin_email: string | null;
  client_admin_phone: string | null;
  admin_invite_status: string;
  admin_url: string | null;
  frontend_url: string | null;
  handoff_notes: string | null;
  checklist: Record<string, boolean>;
  sent_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
}

interface HandoffActionCardProps {
  instanceId: string;
  jobId?: string | null;
  onEventLogged?: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'not_started',      label: 'Not Started' },
  { value: 'preparing',        label: 'Preparing' },
  { value: 'ready_for_client', label: 'Ready for Client' },
  { value: 'sent',             label: 'Sent' },
  { value: 'accepted',         label: 'Accepted' },
  { value: 'needs_support',    label: 'Needs Support' },
  { value: 'completed',        label: 'Completed' },
];

const INVITE_OPTIONS = [
  { value: 'not_sent', label: 'Not Sent' },
  { value: 'sent',     label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired',  label: 'Expired' },
  { value: 'failed',   label: 'Failed' },
];

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'email_confirmed',     label: 'Client admin email confirmed' },
  { key: 'admin_url_confirmed', label: 'Admin URL confirmed' },
  { key: 'site_url_confirmed',  label: 'Frontend URL confirmed' },
  { key: 'login_accessible',    label: 'Client can access login page' },
  { key: 'account_ready',       label: 'Account/Profile setup ready' },
  { key: 'property_ready',      label: 'Property setup ready' },
  { key: 'photos_pricing_ready',label: 'Photos & pricing setup ready' },
  { key: 'email_provider_ready',label: 'Email provider setup ready' },
  { key: 'stripe_ready',        label: 'Stripe/payment setup ready' },
  { key: 'ical_ready',          label: 'iCal/calendar setup ready' },
  { key: 'walkthrough_done',    label: 'Final walkthrough scheduled/completed' },
];

const STATUS_COLOR: Record<string, string> = {
  not_started:      'bg-gray-100 text-gray-600',
  preparing:        'bg-blue-100 text-blue-700',
  ready_for_client: 'bg-teal-100 text-teal-700',
  sent:             'bg-violet-100 text-violet-700',
  accepted:         'bg-green-100 text-green-700',
  needs_support:    'bg-amber-100 text-amber-700',
  completed:        'bg-green-200 text-green-800',
};

export function HandoffActionCard({ instanceId, jobId, onEventLogged }: HandoffActionCardProps) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<Partial<Handoff>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase
      .from('platform_client_handoffs')
      .select('*')
      .eq('instance_id', instanceId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHandoff(data as Handoff);
          setForm({
            status: data.status,
            client_admin_name: data.client_admin_name,
            client_admin_email: data.client_admin_email,
            client_admin_phone: data.client_admin_phone,
            admin_invite_status: data.admin_invite_status,
            admin_url: data.admin_url,
            frontend_url: data.frontend_url,
            handoff_notes: data.handoff_notes,
          });
          setChecklist(data.checklist ?? {});
        }
        setLoading(false);
      });
  }, [instanceId]);

  const save = async () => {
    if (!handoff) return;
    setSaving(true);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      ...form,
      checklist,
    };
    if (form.status === 'sent' && !handoff.sent_at) updates.sent_at = now;
    if (form.status === 'accepted' && !handoff.accepted_at) updates.accepted_at = now;
    if (form.status === 'completed' && !handoff.completed_at) {
      updates.completed_at = now;
      if (jobId) {
        await supabase.from('platform_provisioning_job_events').insert({
          job_id: jobId, event_type: 'success',
          message: `Client handoff completed for ${form.client_admin_email ?? 'client'}`,
        });
        onEventLogged?.('Client handoff marked completed');
      }
      // Mark create_admin_user provisioning step completed if exists
      await supabase
        .from('platform_provisioning_steps')
        .update({ status: 'completed', completed_at: now })
        .eq('instance_id', instanceId)
        .eq('step_key', 'create_admin_user')
        .in('status', ['not_started', 'in_progress']);
    }
    const { data } = await supabase
      .from('platform_client_handoffs')
      .update(updates)
      .eq('id', handoff.id)
      .select('*')
      .maybeSingle();
    if (data) {
      setHandoff(data as Handoff);
      setForm({
        status: data.status,
        client_admin_name: data.client_admin_name,
        client_admin_email: data.client_admin_email,
        client_admin_phone: data.client_admin_phone,
        admin_invite_status: data.admin_invite_status,
        admin_url: data.admin_url,
        frontend_url: data.frontend_url,
        handoff_notes: data.handoff_notes,
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const toggleCheck = (key: string) =>
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));

  const checkCount = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length;

  const handoffMessage = () => {
    const name = form.client_admin_name ? `, ${form.client_admin_name}` : '';
    const site = form.frontend_url ?? '[SITE URL]';
    const admin = form.admin_url ?? '[ADMIN URL]';
    const email = form.client_admin_email ?? '[YOUR EMAIL]';
    return `Hi${name},

Your property website is ready! Here are your access details:

Website: ${site}
Admin Dashboard: ${admin}
Login Email: ${email}

To get started:
1. Log in to your admin dashboard at the link above
2. Complete your property information and description
3. Upload your property photos
4. Set your pricing and availability
5. Connect your email provider (for guest notifications)
6. Connect Stripe to accept payments
7. Set up your iCal/calendar sync if needed

If you have any questions during setup, please reach out.

Welcome aboard!`;
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(handoffMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = STATUS_COLOR[form.status ?? 'not_started'] ?? STATUS_COLOR.not_started;
  const isComplete = handoff?.status === 'completed';

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-400">Loading handoff…</span>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-4 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-xs text-amber-700">No handoff record found for this instance.</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${isComplete ? 'border-green-200 bg-green-50/20' : 'border-gray-200 bg-white'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isComplete ? 'bg-green-100' : 'bg-teal-50'}`}>
        <Handshake className={`w-4 h-4 ${isComplete ? 'text-green-700' : 'text-teal-600'}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">Client Handoff</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {STATUS_OPTIONS.find(o => o.value === (form.status ?? 'not_started'))?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{checkCount}/{CHECKLIST_ITEMS.length} ready</span>
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-blue-600 hover:underline">
              {expanded ? 'Collapse' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Summary (collapsed) */}
        {!expanded && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {form.client_admin_email && (
              <p className="text-xs text-gray-600 col-span-2">{form.client_admin_name ? `${form.client_admin_name} — ` : ''}{form.client_admin_email}</p>
            )}
            {form.frontend_url && (
              <a href={form.frontend_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                Site <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {form.admin_url && (
              <a href={form.admin_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-600 hover:underline flex items-center gap-0.5">
                Admin <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}

        {/* Expanded form */}
        {expanded && (
          <div className="space-y-4">
            {/* Status + invite */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Handoff Status</label>
                <select
                  value={form.status ?? 'not_started'}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Invite Status</label>
                <select
                  value={form.admin_invite_status ?? 'not_sent'}
                  onChange={e => setForm(p => ({ ...p, admin_invite_status: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  {INVITE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Client Admin Name</label>
                <input
                  type="text"
                  value={form.client_admin_name ?? ''}
                  onChange={e => setForm(p => ({ ...p, client_admin_name: e.target.value || null }))}
                  placeholder="Full name"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Admin Email</label>
                <input
                  type="email"
                  value={form.client_admin_email ?? ''}
                  onChange={e => setForm(p => ({ ...p, client_admin_email: e.target.value || null }))}
                  placeholder="owner@example.com"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone (optional)</label>
                <input
                  type="tel"
                  value={form.client_admin_phone ?? ''}
                  onChange={e => setForm(p => ({ ...p, client_admin_phone: e.target.value || null }))}
                  placeholder="+1 555 000 0000"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            {/* URLs */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Frontend URL</label>
                <input
                  type="url"
                  value={form.frontend_url ?? ''}
                  onChange={e => setForm(p => ({ ...p, frontend_url: e.target.value || null }))}
                  placeholder="https://..."
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Admin URL</label>
                <input
                  type="url"
                  value={form.admin_url ?? ''}
                  onChange={e => setForm(p => ({ ...p, admin_url: e.target.value || null }))}
                  placeholder="https://.../admin"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Notes</label>
              <textarea
                rows={2}
                value={form.handoff_notes ?? ''}
                onChange={e => setForm(p => ({ ...p, handoff_notes: e.target.value || null }))}
                placeholder="Internal notes about this handoff…"
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none"
              />
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">Handoff Checklist</p>
                <span className="text-xs text-gray-400">{checkCount}/{CHECKLIST_ITEMS.length}</span>
              </div>
              <div className="space-y-1">
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => toggleCheck(item.key)}
                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                        checklist[item.key] ? 'bg-teal-600' : 'border border-gray-300 bg-white group-hover:border-teal-400'
                      }`}
                    >
                      {checklist[item.key] && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className={`text-xs ${checklist[item.key] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Handoff'}
              </button>
              <button onClick={() => setExpanded(false)} className="text-xs text-gray-500 hover:text-gray-700">
                Collapse
              </button>
            </div>
          </div>
        )}

        {/* Handoff message */}
        <div>
          <button
            onClick={() => setShowMessage(m => !m)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            {showMessage ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Copy-ready handoff message
          </button>
          {showMessage && (
            <div className="mt-2 relative">
              <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                {handoffMessage()}
              </pre>
              <button
                onClick={copyMessage}
                className="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-500" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        {isComplete && (
          <p className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Handoff completed{handoff.completed_at ? ` on ${new Date(handoff.completed_at).toLocaleDateString()}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
