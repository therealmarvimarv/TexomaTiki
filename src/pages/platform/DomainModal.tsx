import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Loader2, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';

export interface Domain {
  id: string;
  client_id: string;
  instance_id: string;
  domain: string;
  domain_type: string;
  status: string;
  dns_provider: string | null;
  registrar: string | null;
  netlify_domain_id: string | null;
  ssl_status: string | null;
  is_primary: boolean;
  notes: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DnsRecord {
  id: string;
  domain_id: string;
  record_type: string;
  host: string;
  value: string;
  required_value: string | null;
  status: string;
  notes: string | null;
}

interface Props {
  clientId: string;
  instanceId: string;
  netliftySiteDomain?: string | null;
  domain?: Domain | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200';
const labelCls = 'text-xs font-semibold text-gray-600 mb-1 block';

const STATUS_OPTIONS = ['not_started','pending_dns','dns_configured','connected_to_netlify','ssl_pending','ssl_active','live','failed'];
const RECORD_TYPES = ['A','CNAME','TXT','MX','ALIAS','ANAME','other'];
const RECORD_STATUS_OPTIONS = ['needed','pending','verified','failed','skipped'];

function suggestRecords(domain: string, netliftySiteDomain: string | null): Omit<DnsRecord,'id'|'domain_id'>[] {
  const isApex = !domain.startsWith('www.');
  const recs: Omit<DnsRecord,'id'|'domain_id'>[] = [];
  if (isApex && netliftySiteDomain) {
    recs.push({ record_type: 'ALIAS', host: '@', value: netliftySiteDomain, required_value: netliftySiteDomain, status: 'needed', notes: 'Apex/root ALIAS record — use ANAME if registrar supports it' });
    recs.push({ record_type: 'CNAME', host: 'www', value: netliftySiteDomain, required_value: netliftySiteDomain, status: 'needed', notes: 'www subdomain CNAME to Netlify' });
  } else if (!isApex && netliftySiteDomain) {
    const sub = domain.split('.')[0];
    recs.push({ record_type: 'CNAME', host: sub, value: netliftySiteDomain, required_value: netliftySiteDomain, status: 'needed', notes: 'Subdomain CNAME to Netlify' });
  } else if (isApex) {
    recs.push({ record_type: 'A', host: '@', value: '75.2.60.5', required_value: '75.2.60.5', status: 'needed', notes: 'Netlify load balancer A record' });
    recs.push({ record_type: 'CNAME', host: 'www', value: domain, required_value: domain, status: 'needed', notes: 'www redirect to apex' });
  }
  return recs;
}

export function DomainModal({ clientId, instanceId, netliftySiteDomain, domain, onClose, onSaved }: Props) {
  const editing = !!domain;
  const [domainStr, setDomainStr] = useState(domain?.domain ?? '');
  const [domainType, setDomainType] = useState(domain?.domain_type ?? 'primary');
  const [status, setStatus] = useState(domain?.status ?? 'not_started');
  const [dnsProvider, setDnsProvider] = useState(domain?.dns_provider ?? '');
  const [registrar, setRegistrar] = useState(domain?.registrar ?? '');
  const [sslStatus, setSslStatus] = useState(domain?.ssl_status ?? '');
  const [isPrimary, setIsPrimary] = useState(domain?.is_primary ?? true);
  const [notes, setNotes] = useState(domain?.notes ?? '');
  const [dnsRecords, setDnsRecords] = useState<Omit<DnsRecord,'id'|'domain_id'>[]>([]);
  const [existingRecords, setExistingRecords] = useState<DnsRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (domain?.id) {
      supabase.from('platform_instance_dns_records').select('*').eq('domain_id', domain.id)
        .then(({ data }) => setExistingRecords((data ?? []) as DnsRecord[]));
    }
  }, [domain]);

  const addSuggestedRecords = () => {
    setDnsRecords(suggestRecords(domainStr, netliftySiteDomain ?? null));
  };

  const addRecord = () => {
    setDnsRecords(prev => [...prev, { record_type: 'CNAME', host: '', value: '', required_value: null, status: 'needed', notes: null }]);
  };

  const updateRecord = (i: number, field: string, val: string) => {
    setDnsRecords(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val || null } : r));
  };

  const removeRecord = (i: number) => setDnsRecords(prev => prev.filter((_, idx) => idx !== i));

  const updateExistingRecord = async (rec: DnsRecord, field: string, val: string) => {
    const updated = { ...rec, [field]: val };
    setExistingRecords(prev => prev.map(r => r.id === rec.id ? updated : r));
    await supabase.from('platform_instance_dns_records').update({ [field]: val }).eq('id', rec.id);
  };

  const deleteExistingRecord = async (id: string) => {
    setExistingRecords(prev => prev.filter(r => r.id !== id));
    await supabase.from('platform_instance_dns_records').delete().eq('id', id);
  };

  const copyValue = (val: string, idx: number) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const save = async () => {
    if (!domainStr.trim()) { setError('Domain is required'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      client_id: clientId,
      instance_id: instanceId,
      domain: domainStr.trim().toLowerCase(),
      domain_type: domainType,
      status,
      dns_provider: dnsProvider || null,
      registrar: registrar || null,
      ssl_status: sslStatus || null,
      is_primary: isPrimary,
      notes: notes || null,
    };

    let domainId = domain?.id;
    if (editing && domainId) {
      const { error: e } = await supabase.from('platform_instance_domains').update(payload).eq('id', domainId);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data, error: e } = await supabase.from('platform_instance_domains').insert(payload).select('id').maybeSingle();
      if (e || !data) { setError(e?.message ?? 'Insert failed'); setSaving(false); return; }
      domainId = data.id;
    }

    if (dnsRecords.length > 0 && domainId) {
      const recPayload = dnsRecords.filter(r => r.host && r.value).map(r => ({ ...r, domain_id: domainId }));
      if (recPayload.length > 0) {
        await supabase.from('platform_instance_dns_records').insert(recPayload);
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-sm font-bold text-gray-900">{editing ? 'Edit Domain' : 'Add Domain'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Domain + type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Domain *</label>
              <input type="text" value={domainStr} onChange={e => setDomainStr(e.target.value)}
                placeholder="example.com or www.example.com" className={inputCls} disabled={editing} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={domainType} onChange={e => setDomainType(e.target.value)} className={inputCls}>
                {['primary','redirect','temporary','staging'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>SSL Status</label>
              <input type="text" value={sslStatus} onChange={e => setSslStatus(e.target.value)}
                placeholder="e.g. active, pending, none" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DNS Provider</label>
              <input type="text" value={dnsProvider} onChange={e => setDnsProvider(e.target.value)}
                placeholder="Cloudflare, Route53, etc." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registrar</label>
              <input type="text" value={registrar} onChange={e => setRegistrar(e.target.value)}
                placeholder="GoDaddy, Namecheap, etc." className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-blue-600 border-gray-300 focus:ring-blue-200" />
            <span className="text-xs text-gray-700">Primary domain for this instance</span>
          </label>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes…" className={`${inputCls} resize-y`} />
          </div>

          {/* DNS Records */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">DNS Records</p>
              <div className="flex items-center gap-2">
                {!editing && domainStr && (
                  <button onClick={addSuggestedRecords} type="button"
                    className="text-xs text-blue-600 hover:underline">Suggest for Netlify</button>
                )}
                <button onClick={addRecord} type="button"
                  className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  <Plus className="w-3 h-3" /> Add Record
                </button>
              </div>
            </div>

            {netliftySiteDomain && (
              <p className="text-xs text-gray-400 mb-2">Netlify site: <span className="font-mono">{netliftySiteDomain}</span></p>
            )}

            {/* Existing records (edit mode) */}
            {existingRecords.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {existingRecords.map(rec => (
                  <div key={rec.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <select value={rec.record_type} onChange={e => updateExistingRecord(rec, 'record_type', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 w-20 bg-white">
                      {RECORD_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input value={rec.host} onChange={e => updateExistingRecord(rec, 'host', e.target.value)}
                      placeholder="Host" className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 min-w-0" />
                    <input value={rec.value} onChange={e => updateExistingRecord(rec, 'value', e.target.value)}
                      placeholder="Value" className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 min-w-0 font-mono" />
                    <select value={rec.status} onChange={e => updateExistingRecord(rec, 'status', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 w-20 bg-white">
                      {RECORD_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => copyValue(rec.value, -1)}
                      className="p-1 text-gray-400 hover:text-gray-600"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => deleteExistingRecord(rec.id)}
                      className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* New records */}
            {dnsRecords.length > 0 && (
              <div className="space-y-1.5">
                {dnsRecords.map((rec, i) => (
                  <div key={i} className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                    <select value={rec.record_type} onChange={e => updateRecord(i, 'record_type', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 w-20 bg-white">
                      {RECORD_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input value={rec.host} onChange={e => updateRecord(i, 'host', e.target.value)}
                      placeholder="Host" className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 min-w-0" />
                    <input value={rec.value} onChange={e => updateRecord(i, 'value', e.target.value)}
                      placeholder="Value" className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 min-w-0 font-mono" />
                    <select value={rec.status} onChange={e => updateRecord(i, 'status', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 w-20 bg-white">
                      {RECORD_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => copyValue(rec.value, i)}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button onClick={() => removeRecord(i)}
                      className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Records are suggested only — verify before marking as verified.
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} {editing ? 'Save Changes' : 'Add Domain'}
          </button>
        </div>
      </div>
    </div>
  );
}
