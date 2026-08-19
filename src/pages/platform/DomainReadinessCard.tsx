import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, Plus, CheckCircle2, XCircle, AlertTriangle, Minus, Copy, Check, Loader2, Pencil, Star, RefreshCw } from 'lucide-react';
import { DomainModal, Domain, DnsRecord } from './DomainModal';

interface Props {
  clientId: string;
  instanceId: string;
  netlifyDomain?: string | null;
}

const STATUS_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  not_started:          { cls: 'bg-gray-100 text-gray-500',    icon: <Minus className="w-3 h-3" />,         label: 'Not started' },
  pending_dns:          { cls: 'bg-yellow-100 text-yellow-700',icon: <AlertTriangle className="w-3 h-3" />, label: 'Pending DNS' },
  dns_configured:       { cls: 'bg-blue-100 text-blue-700',    icon: <CheckCircle2 className="w-3 h-3" />,  label: 'DNS configured' },
  connected_to_netlify: { cls: 'bg-blue-100 text-blue-700',    icon: <CheckCircle2 className="w-3 h-3" />,  label: 'Connected' },
  ssl_pending:          { cls: 'bg-yellow-100 text-yellow-700',icon: <AlertTriangle className="w-3 h-3" />, label: 'SSL pending' },
  ssl_active:           { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" />,  label: 'SSL active' },
  live:                 { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" />,  label: 'Live' },
  failed:               { cls: 'bg-red-100 text-red-700',      icon: <XCircle className="w-3 h-3" />,       label: 'Failed' },
};

const RECORD_STATUS_CLS: Record<string, string> = {
  needed:   'text-yellow-600', pending: 'text-blue-600',
  verified: 'text-green-600',  failed:  'text-red-600', skipped: 'text-gray-400',
};

function ConnectNetlifyButton({ domain, onDone }: { domain: Domain; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const connect = async () => {
    setLoading(true);
    setMsg(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-connect-netlify-domain`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ instance_id: domain.instance_id, domain_id: domain.id }),
    });
    const json = await res.json();
    setMsg(json.message ?? (res.ok ? 'Connected' : (json.error ?? 'Failed')));
    setLoading(false);
    if (res.ok) onDone();
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={connect} disabled={loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
        Connect to Netlify
      </button>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}

export function DomainReadinessCard({ clientId, instanceId, netlifyDomain }: Props) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [dnsMap, setDnsMap] = useState<Record<string, DnsRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedVal, setCopiedVal] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_instance_domains')
      .select('*').eq('instance_id', instanceId).order('is_primary', { ascending: false });
    const doms = (data ?? []) as Domain[];
    setDomains(doms);
    if (doms.length > 0) {
      const { data: recs } = await supabase.from('platform_instance_dns_records')
        .select('*').in('domain_id', doms.map(d => d.id));
      const map: Record<string, DnsRecord[]> = {};
      for (const r of (recs ?? []) as DnsRecord[]) {
        if (!map[r.domain_id]) map[r.domain_id] = [];
        map[r.domain_id].push(r);
      }
      setDnsMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [instanceId]);

  const copyVal = (val: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedVal(val);
    setTimeout(() => setCopiedVal(null), 2000);
  };

  const primaryDomain = domains.find(d => d.is_primary) ?? domains[0] ?? null;
  const hasIssues = domains.some(d => ['failed','pending_dns','ssl_pending'].includes(d.status));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className={`w-4 h-4 ${hasIssues ? 'text-yellow-500' : 'text-teal-600'}`} />
          <p className="text-sm font-bold text-gray-900">Domains</p>
          {domains.length > 0 && <span className="text-xs text-gray-400">{domains.length}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { load(); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditDomain(null); setShowModal(true); }}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
      ) : domains.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">No domains added yet</p>
      ) : (
        <div className="space-y-2">
          {domains.map(d => {
            const sc = STATUS_CFG[d.status] ?? STATUS_CFG.not_started;
            const recs = dnsMap[d.id] ?? [];
            const pendingRecs = recs.filter(r => r.status === 'needed' || r.status === 'pending').length;
            const isExpanded = expanded === d.id;
            return (
              <div key={d.id} className="border border-gray-100 rounded-lg overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : d.id)}>
                  {d.is_primary && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" title="Primary" />}
                  <span className="text-xs font-semibold text-gray-800 flex-1 truncate font-mono">{d.domain}</span>
                  <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${sc.cls}`}>
                    {sc.icon} {sc.label}
                  </span>
                  {d.ssl_status && (
                    <span className={`text-xs flex-shrink-0 ${d.ssl_status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                      SSL: {d.ssl_status}
                    </span>
                  )}
                  {pendingRecs > 0 && (
                    <span className="text-xs text-yellow-600 flex-shrink-0 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> {pendingRecs} DNS needed
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); setEditDomain(d); setShowModal(true); }}
                    className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 py-2 space-y-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {d.dns_provider && <span>DNS: {d.dns_provider}</span>}
                      {d.registrar && <span>Registrar: {d.registrar}</span>}
                      {d.domain_type !== 'primary' && <span className="capitalize">{d.domain_type}</span>}
                    </div>

                    {recs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-600">DNS Records</p>
                        {recs.map(r => (
                          <div key={r.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                            <span className="font-mono font-semibold text-gray-600 w-12 flex-shrink-0">{r.record_type}</span>
                            <span className="font-mono text-gray-500 w-10 flex-shrink-0 truncate">{r.host}</span>
                            <span className="font-mono text-gray-700 flex-1 truncate">{r.value}</span>
                            <span className={`flex-shrink-0 capitalize ${RECORD_STATUS_CLS[r.status] ?? ''}`}>{r.status}</span>
                            <button onClick={() => copyVal(r.value)} className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-700">
                              {copiedVal === r.value ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {d.notes && <p className="text-xs text-gray-400 italic">{d.notes}</p>}

                    {/* Netlify connect button if applicable */}
                    {d.status !== 'live' && d.status !== 'connected_to_netlify' && (
                      <ConnectNetlifyButton domain={d} onDone={load} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <DomainModal
          clientId={clientId}
          instanceId={instanceId}
          netliftySiteDomain={netlifyDomain}
          domain={editDomain}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// Lightweight export for launch package warnings
export function domainWarnings(domains: Domain[], dnsMap: Record<string, DnsRecord[]>): string[] {
  const warns: string[] = [];
  for (const d of domains) {
    if (d.is_primary && ['failed'].includes(d.status)) warns.push(`Primary domain ${d.domain} has failed status`);
    if (d.is_primary && ['pending_dns'].includes(d.status)) warns.push(`Primary domain ${d.domain} awaiting DNS configuration`);
    if (d.is_primary && d.ssl_status && d.ssl_status !== 'active') warns.push(`Primary domain ${d.domain} SSL not active: ${d.ssl_status}`);
    const pending = (dnsMap[d.id] ?? []).filter(r => r.status === 'needed').length;
    if (pending > 0) warns.push(`${d.domain}: ${pending} DNS record(s) still needed`);
  }
  return warns;
}
