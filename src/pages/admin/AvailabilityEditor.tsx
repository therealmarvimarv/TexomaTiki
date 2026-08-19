import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronRight, Moon, Clock, Calendar, AlertCircle, Save, Plus, Trash2, X, type LucideIcon } from 'lucide-react';

interface StayLimits {
  min_nights: number;
  max_nights: number;
  min_notice_days: number;
  max_advance_days: number;
}

type ExpandedRow = 'min_nights' | 'max_nights' | 'min_notice_days' | 'max_advance_days' | null;

function nightsLabel(n: number): string {
  if (n === 0) return 'No limit';
  return n === 1 ? '1 night' : `${n} nights`;
}

function noticeDaysLabel(n: number): string {
  if (n === 0) return 'Same day';
  if (n === 1) return '1 day';
  if (n < 7) return `${n} days`;
  if (n === 7) return '1 week';
  if (n === 14) return '2 weeks';
  if (n === 30) return '1 month';
  return `${n} days`;
}

function advanceDaysLabel(n: number): string {
  if (n === 0) return 'No limit';
  if (n < 30) return `${n} days`;
  if (n < 60) return '1 month';
  if (n < 90) return '2 months';
  if (n < 120) return '3 months';
  if (n < 180) return '4 months';
  if (n === 180) return '6 months';
  if (n <= 365) return '12 months';
  return `${n} days`;
}

interface RowConfig {
  key: keyof StayLimits;
  label: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  valueLabel: (n: number) => string;
  min: number;
  max: number;
  step: number;
  zeroLabel: string;
}

const ROWS: RowConfig[] = [
  {
    key: 'min_nights',
    label: 'Minimum nights',
    description: 'Set the shortest stay you allow. Guests must book at least this many nights.',
    hint: 'A higher minimum reduces turnover but may limit bookings.',
    icon: Moon,
    valueLabel: nightsLabel,
    min: 1,
    max: 365,
    step: 1,
    zeroLabel: '',
  },
  {
    key: 'max_nights',
    label: 'Maximum nights',
    description: 'Set the longest stay you allow. Guests can\'t book more than this.',
    hint: 'Set to 0 to allow stays of any length.',
    icon: Moon,
    valueLabel: nightsLabel,
    min: 0,
    max: 365,
    step: 1,
    zeroLabel: 'No limit',
  },
  {
    key: 'min_notice_days',
    label: 'Minimum notice',
    description: 'How many days in advance a guest must book before check-in.',
    hint: 'Use this to give yourself time to prepare.',
    icon: Clock,
    valueLabel: noticeDaysLabel,
    min: 0,
    max: 30,
    step: 1,
    zeroLabel: 'Same day',
  },
  {
    key: 'max_advance_days',
    label: 'Advance booking',
    description: 'How far into the future guests can book.',
    hint: 'Set to 0 to allow bookings at any time in the future.',
    icon: Calendar,
    valueLabel: advanceDaysLabel,
    min: 0,
    max: 365,
    step: 1,
    zeroLabel: 'No limit',
  },
];

const SECTION_HEADERS = [
  { label: 'Length of stay', keys: ['min_nights', 'max_nights'] as (keyof StayLimits)[] },
  { label: 'Booking limits', keys: ['min_notice_days', 'max_advance_days'] as (keyof StayLimits)[] },
];

interface OwnerBlock {
  id: string;
  start_date: string;
  end_date: string;
  block_type: string;
  reason: string;
  notes: string;
}

const BLOCK_TYPES = [
  { value: 'owner_stay',    label: 'Owner Stay' },
  { value: 'maintenance',   label: 'Maintenance' },
  { value: 'deep_cleaning', label: 'Deep Cleaning' },
  { value: 'private_hold',  label: 'Private Hold' },
  { value: 'unavailable',   label: 'Unavailable' },
  { value: 'other',         label: 'Other' },
] as const;

const BLOCK_TYPE_STYLES: Record<string, string> = {
  owner_stay:    'bg-blue-100 text-blue-700',
  maintenance:   'bg-amber-100 text-amber-700',
  deep_cleaning: 'bg-teal-100 text-teal-700',
  private_hold:  'bg-gray-100 text-gray-600',
  unavailable:   'bg-red-100 text-red-700',
  other:         'bg-gray-100 text-gray-500',
};

const BLANK_BLOCK = { block_type: 'unavailable', reason: '', notes: '', start_date: '', end_date: '' };

export default function AvailabilityEditor({ propertyId, section }: { propertyId: string; section?: string }) {
  const [limits, setLimits] = useState<StayLimits>({
    min_nights: 1,
    max_nights: 0,
    min_notice_days: 1,
    max_advance_days: 180,
  });
  const [expanded, setExpanded] = useState<ExpandedRow>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Owner blocks state
  const [blocks, setBlocks] = useState<OwnerBlock[]>([]);
  const [blockEditId, setBlockEditId] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<Partial<OwnerBlock>>({});
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState('');

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

  useEffect(() => {
    if (section === 'owner-blocks') {
      setTimeout(() => {
        document.getElementById('owner-blocks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [section]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('properties').select('min_nights, max_nights, min_notice_days, max_advance_days').eq('id', propertyId).maybeSingle(),
      supabase.from('owner_blocks').select('*').eq('property_id', propertyId).order('start_date'),
    ]).then(([propRes, blocksRes]) => {
      if (propRes.data) {
        setLimits({
          min_nights: propRes.data.min_nights ?? 1,
          max_nights: propRes.data.max_nights ?? 0,
          min_notice_days: propRes.data.min_notice_days ?? 1,
          max_advance_days: propRes.data.max_advance_days ?? 180,
        });
      }
      setBlocks((blocksRes.data ?? []) as OwnerBlock[]);
      setLoading(false);
    });
  }, [propertyId]);

  async function saveBlock() {
    const { start_date, end_date, block_type, reason, notes } = blockDraft;
    setBlockError('');
    if (!start_date || !end_date) {
      setBlockError('Start date and end date are required.');
      return;
    }
    if (end_date <= start_date) {
      setBlockError('End date must be after start date.');
      return;
    }
    setBlockSaving(true);
    if (blockEditId === 'new') {
      const { data, error } = await supabase.from('owner_blocks').insert({
        property_id: propertyId,
        start_date,
        end_date,
        block_type: block_type ?? 'unavailable',
        reason: reason ?? '',
        notes: notes ?? '',
      }).select().maybeSingle();
      if (error) {
        console.error('[AvailabilityEditor] insert error:', error.message, { property_id: propertyId, start_date, end_date });
        setBlockError(error.message || 'Failed to save block. Please try again.');
        setBlockSaving(false);
        return;
      }
      if (data) {
        setBlocks(prev => [...prev, data as OwnerBlock].sort((a, b) => a.start_date.localeCompare(b.start_date)));
        flash('Block added');
      }
    } else if (blockEditId) {
      const { error } = await supabase.from('owner_blocks')
        .update({ start_date, end_date, block_type, reason, notes, updated_at: new Date().toISOString() })
        .eq('id', blockEditId);
      if (error) {
        console.error('[AvailabilityEditor] update error:', error.message, { id: blockEditId });
        setBlockError(error.message || 'Failed to update block.');
        setBlockSaving(false);
        return;
      }
      setBlocks(prev => prev.map(b => b.id === blockEditId ? { ...b, ...blockDraft } as OwnerBlock : b));
      flash('Block saved');
    }
    setBlockEditId(null);
    setBlockDraft({});
    setBlockError('');
    setBlockSaving(false);
  }

  async function deleteBlock(id: string) {
    if (!confirm('Delete this owner block?')) return;
    await supabase.from('owner_blocks').delete().eq('id', id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  async function save() {
    setSaving(true);
    await supabase
      .from('properties')
      .update({
        min_nights: limits.min_nights,
        max_nights: limits.max_nights,
        min_notice_days: limits.min_notice_days,
        max_advance_days: limits.max_advance_days,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId);
    setSaving(false);
    setExpanded(null);
    flash('Saved');
  }

  function toggleRow(key: keyof StayLimits) {
    setExpanded(prev => prev === key ? null : key);
  }

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="max-w-xl space-y-8">
      {msg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {msg}
        </div>
      )}

      {SECTION_HEADERS.map(section => (
        <div key={section.label}>
          <h3 className="text-base font-semibold text-gray-900 mb-3">{section.label}</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
            {ROWS.filter(r => section.keys.includes(r.key)).map(row => {
              const isOpen = expanded === row.key;
              const Icon = row.icon;
              const currentVal = limits[row.key];
              const sublabel = row.valueLabel(currentVal);

              return (
                <div key={row.key}>
                  {/* Row header — always visible */}
                  <button
                    onClick={() => toggleRow(row.key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{row.label}</div>
                        {sublabel && (
                          <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* Expanded input area */}
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 bg-gray-50 border-t border-gray-100 space-y-4">
                      <p className="text-sm text-gray-600">{row.description}</p>

                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Nights</label>
                        <input
                          type="number"
                          min={row.min}
                          max={row.max}
                          step={row.step}
                          value={currentVal}
                          onChange={e => setLimits(prev => ({ ...prev, [row.key]: parseInt(e.target.value) || 0 }))}
                          className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 bg-white"
                          autoFocus
                        />
                        {row.zeroLabel && (
                          <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Enter 0 for "{row.zeroLabel}"
                          </p>
                        )}
                        {row.hint && (
                          <p className="text-xs text-gray-400 mt-1">{row.hint}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save availability'}
        </button>
      </div>

      {/* Owner Blocks */}
      <div id="owner-blocks">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Owner Blocks</h3>
            <p className="text-xs text-gray-500 mt-0.5">Block dates for personal use, maintenance, or private holds</p>
          </div>
          <button
            onClick={() => { setBlockEditId('new'); setBlockDraft({ ...BLANK_BLOCK }); setBlockError(''); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add block
          </button>
        </div>

        {blockEditId === 'new' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3 mb-3">
            <p className="text-sm font-semibold text-gray-900">New owner block</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={blockDraft.start_date ?? ''} onChange={e => setBlockDraft(d => ({ ...d, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date <span className="font-normal text-gray-400">(exclusive)</span></label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={blockDraft.end_date ?? ''} onChange={e => setBlockDraft(d => ({ ...d, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block type</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={blockDraft.block_type ?? 'unavailable'} onChange={e => setBlockDraft(d => ({ ...d, block_type: e.target.value }))}>
                {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason <span className="font-normal text-gray-400">(optional)</span></label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Family trip" value={blockDraft.reason ?? ''} onChange={e => setBlockDraft(d => ({ ...d, reason: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Internal notes…" value={blockDraft.notes ?? ''} onChange={e => setBlockDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
            {blockError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {blockError}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={saveBlock} disabled={blockSaving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> {blockSaving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setBlockEditId(null); setBlockDraft({}); setBlockError(''); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {blocks.map(block => (
            <div key={block.id} className="bg-white">
              {blockEditId === block.id ? (
                <div className="p-4 bg-blue-50 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Edit block</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                      <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={blockDraft.start_date ?? ''} onChange={e => setBlockDraft(d => ({ ...d, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                      <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={blockDraft.end_date ?? ''} onChange={e => setBlockDraft(d => ({ ...d, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={blockDraft.block_type ?? 'unavailable'} onChange={e => setBlockDraft(d => ({ ...d, block_type: e.target.value }))}>
                    {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Reason (optional)" value={blockDraft.reason ?? ''} onChange={e => setBlockDraft(d => ({ ...d, reason: e.target.value }))} />
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Notes (optional)" value={blockDraft.notes ?? ''} onChange={e => setBlockDraft(d => ({ ...d, notes: e.target.value }))} />
                  {blockError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {blockError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveBlock} disabled={blockSaving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> {blockSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => { setBlockEditId(null); setBlockDraft({}); setBlockError(''); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(block.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(block.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BLOCK_TYPE_STYLES[block.block_type] ?? 'bg-gray-100 text-gray-500'}`}>
                        {BLOCK_TYPES.find(t => t.value === block.block_type)?.label ?? block.block_type}
                      </span>
                    </div>
                    {block.reason && <p className="text-xs text-gray-500">{block.reason}</p>}
                    {block.notes && <p className="text-xs text-gray-400 italic">{block.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setBlockEditId(block.id); setBlockDraft({ start_date: block.start_date, end_date: block.end_date, block_type: block.block_type, reason: block.reason, notes: block.notes }); setBlockError(''); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                    <button onClick={() => deleteBlock(block.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {blocks.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No owner blocks. Add one to prevent guest bookings on specific dates.</div>
          )}
        </div>
      </div>
    </div>
  );
}
