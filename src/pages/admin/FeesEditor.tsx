import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Brush, Dog, Users, Save } from 'lucide-react';

type FeeType = 'per_stay' | 'per_night' | 'per_guest_per_stay' | 'per_guest_per_night';

interface Fee {
  id: string;
  name: string;
  fee_type: FeeType;
  amount: string;
  applies_after_guests: number | null;
  is_standard: boolean;
  enabled: boolean;
  sort_order: number;
  apply_to_guest_quote: boolean;
}

const STANDARD_SLOTS = [
  {
    name: 'Cleaning',
    icon: Brush,
    description: null as string | null,
    feeTypes: ['per_stay', 'per_night'] as FeeType[],
  },
  {
    name: 'Pets',
    icon: Dog,
    description: null as string | null,
    feeTypes: ['per_stay', 'per_night'] as FeeType[],
  },
  {
    name: 'Additional guests',
    icon: Users,
    description: 'Hosting more guests? Use this fee to cover any extra costs.',
    feeTypes: ['per_guest_per_stay', 'per_guest_per_night'] as FeeType[],
  },
];

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  per_stay: 'Per stay',
  per_night: 'Per night',
  per_guest_per_stay: 'Per guest per stay',
  per_guest_per_night: 'Per guest per night',
};

function emptyStandardFee(name: string, sortOrder: number): Omit<Fee, 'id'> {
  const slot = STANDARD_SLOTS.find(s => s.name === name)!;
  return {
    name,
    fee_type: slot.feeTypes[0],
    amount: '',
    applies_after_guests: name === 'Additional guests' ? 3 : null,
    is_standard: true,
    enabled: true,
    sort_order: sortOrder,
    apply_to_guest_quote: true,
  };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-gray-900' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function FeesEditor({ propertyId }: { propertyId: string }) {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

  useEffect(() => { load(); }, [propertyId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('property_fees')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order');

    const rows: Fee[] = (data ?? []).map(r => ({
      id: r.id,
      name: r.name,
      fee_type: r.fee_type as FeeType,
      amount: String(r.amount === 0 ? '' : r.amount),
      applies_after_guests: r.applies_after_guests,
      is_standard: r.is_standard,
      enabled: r.enabled,
      sort_order: r.sort_order,
      apply_to_guest_quote: r.apply_to_guest_quote ?? true,
    }));

    const standardFees: Fee[] = STANDARD_SLOTS.map((slot, i) => {
      const existing = rows.find(r => r.is_standard && r.name === slot.name);
      if (existing) return existing;
      return { id: `__new__${slot.name}`, ...emptyStandardFee(slot.name, i + 1) };
    });

    const customFees = rows.filter(r => !r.is_standard);
    setFees([...standardFees, ...customFees]);
    setLoading(false);
  }

  function updateFee(id: string, patch: Partial<Fee>) {
    setFees(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  async function saveAll() {
    setSaving(true);
    for (const fee of fees) {
      const payload = {
        property_id: propertyId,
        name: fee.name,
        fee_type: fee.fee_type,
        amount: parseFloat(fee.amount) || 0,
        applies_after_guests: fee.applies_after_guests,
        is_standard: fee.is_standard,
        enabled: fee.enabled,
        sort_order: fee.sort_order,
        apply_to_guest_quote: fee.apply_to_guest_quote,
        updated_at: new Date().toISOString(),
      };

      if (fee.id.startsWith('__new__')) {
        if (!fee.is_standard && !fee.name.trim()) continue;
        const { data } = await supabase.from('property_fees').insert(payload).select().maybeSingle();
        if (data) {
          setFees(prev => prev.map(f => f.id === fee.id ? { ...f, id: data.id } : f));
        }
      } else {
        await supabase.from('property_fees').update(payload).eq('id', fee.id);
      }
    }
    setSaving(false);
    flash('Saved');
  }

  function addCustomFee() {
    const customFees = fees.filter(f => !f.is_standard);
    if (customFees.length >= 6) return;
    const maxOrder = fees.length > 0 ? Math.max(...fees.map(f => f.sort_order)) + 1 : 10;
    setFees(prev => [...prev, {
      id: `__new__custom__${Date.now()}`,
      name: '',
      fee_type: 'per_stay',
      amount: '',
      applies_after_guests: null,
      is_standard: false,
      enabled: true,
      sort_order: maxOrder,
      apply_to_guest_quote: true,
    }]);
  }

  async function deleteCustomFee(fee: Fee) {
    if (!fee.id.startsWith('__new__')) {
      await supabase.from('property_fees').delete().eq('id', fee.id);
    }
    setFees(prev => prev.filter(f => f.id !== fee.id));
  }

  const standardFees = fees.filter(f => f.is_standard);
  const customFees = fees.filter(f => !f.is_standard);

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading fees…</div>;

  return (
    <div className="space-y-10">
      {msg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {msg}
        </div>
      )}

      {/* Standard fees */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Standard fees</h3>
        <p className="text-sm text-gray-500 mb-6">
          You can add fees to help cover hosting costs. We recommend{' '}
          <strong className="font-semibold text-gray-700">keeping fees on the lower side</strong>
          {' '}— fees higher than <strong className="font-semibold text-gray-700">10%</strong> of a total booking may deter guests.
        </p>

        <div className="space-y-7">
          {standardFees.map(fee => {
            const slot = STANDARD_SLOTS.find(s => s.name === fee.name)!;
            const Icon = slot.icon;
            const isAdditionalGuests = fee.name === 'Additional guests';
            const isPets = fee.name === 'Pets';

            return (
              <div key={fee.id}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-gray-800" strokeWidth={1.75} />
                  <span className="font-semibold text-gray-900">{fee.name}</span>
                </div>
                {slot.description && (
                  <p className="text-sm text-gray-500 mb-3">{slot.description}</p>
                )}
                <div className="flex gap-3 flex-wrap mt-3">
                  {/* Amount */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Amount (USD) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fee.amount}
                      onChange={e => updateFee(fee.id, { amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                    />
                  </div>

                  {/* Fee type */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs text-gray-500 mb-1 block">Fee Type</label>
                    <div className="relative">
                      <select
                        value={fee.fee_type}
                        onChange={e => updateFee(fee.id, { fee_type: e.target.value as FeeType })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 bg-white appearance-none pr-8"
                      >
                        {slot.feeTypes.map(ft => (
                          <option key={ft} value={ft}>{FEE_TYPE_LABELS[ft]}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 8L1 3h10z" />
                      </svg>
                    </div>
                  </div>

                  {/* Guest threshold */}
                  {isAdditionalGuests && (
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-xs text-gray-500 mb-1 block">For each guest after</label>
                      <div className="relative">
                        <select
                          value={fee.applies_after_guests ?? 1}
                          onChange={e => updateFee(fee.id, { applies_after_guests: parseInt(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 bg-white appearance-none pr-8"
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M6 8L1 3h10z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apply to guest quote toggle */}
                <div className="flex items-center gap-2.5 mt-3">
                  <Toggle
                    checked={fee.apply_to_guest_quote}
                    onChange={v => updateFee(fee.id, { apply_to_guest_quote: v })}
                  />
                  <div>
                    <span className="text-xs font-medium text-gray-700">Apply to guest quote</span>
                    {isPets && (
                      <span className="text-xs text-gray-400 ml-1">— only charged when guest selects pets</span>
                    )}
                    {isAdditionalGuests && (
                      <span className="text-xs text-gray-400 ml-1">— only charged when guest count exceeds threshold</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Custom fees */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Custom fees</h3>
        <p className="text-sm text-gray-500 mb-6">
          Add up to six extra fees for things like water or heating.
        </p>

        <div className="space-y-4">
          {customFees.map(fee => (
            <div key={fee.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex gap-3 flex-wrap items-end">
                {/* Name */}
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-gray-500 mb-1 block">
                    Fee name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fee.name}
                    onChange={e => updateFee(fee.id, { name: e.target.value })}
                    placeholder="e.g. Water, Heating"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Amount */}
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-gray-500 mb-1 block">
                    Amount (USD) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fee.amount}
                    onChange={e => updateFee(fee.id, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Fee type */}
                <div className="flex-1 min-w-[155px]">
                  <label className="text-xs text-gray-500 mb-1 block">Fee Type</label>
                  <div className="relative">
                    <select
                      value={fee.fee_type}
                      onChange={e => updateFee(fee.id, { fee_type: e.target.value as FeeType })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 bg-white appearance-none pr-8"
                    >
                      {(Object.keys(FEE_TYPE_LABELS) as FeeType[]).map(ft => (
                        <option key={ft} value={ft}>{FEE_TYPE_LABELS[ft]}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 8L1 3h10z" />
                    </svg>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => deleteCustomFee(fee)}
                  className="p-2.5 text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors"
                  title="Remove fee"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Apply to guest quote toggle */}
              <div className="flex items-center gap-2.5">
                <Toggle
                  checked={fee.apply_to_guest_quote}
                  onChange={v => updateFee(fee.id, { apply_to_guest_quote: v })}
                />
                <span className="text-xs font-medium text-gray-700">Apply to guest quote</span>
              </div>
            </div>
          ))}
        </div>

        {customFees.length < 6 && (
          <button
            onClick={addCustomFee}
            className="mt-4 flex items-center gap-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add custom fee ({customFees.length}/6)
          </button>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={saveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save fees'}
        </button>
      </div>
    </div>
  );
}


export default FeesEditor
