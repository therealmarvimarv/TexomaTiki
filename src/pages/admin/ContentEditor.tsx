import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface HouseRule {
  id: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface Policy {
  id: string;
  policy_type: string;
  title: string;
  content: string;
  is_active: boolean;
}

interface Recommendation {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  distance_label: string;
  website_url: string;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
}

type Tab = 'faqs' | 'rules' | 'policies' | 'recommendations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'faqs', label: 'FAQs' },
  { id: 'rules', label: 'House Rules' },
  { id: 'policies', label: 'Policies' },
  { id: 'recommendations', label: 'Local Recs' },
];

const FAQ_CATEGORIES = ['Booking', 'Payments', 'Check-in / Check-out', 'Pets', 'Cancellations', 'House Rules', 'Local Area', 'General'];
const REC_CATEGORIES = ['Beaches & Outdoors', 'Food & Drinks', 'Family Activities', 'Shopping', 'Essentials', 'General'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'Active' : 'Hidden'}
    </span>
  );
}

// ─── FAQ Tab ──────────────────────────────────────────────────────────────────

function FAQsTab() {
  const [items, setItems] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FAQ>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('faqs').select('*').eq('property_id', PROPERTY_ID).order('sort_order')
      .then(({ data }) => setItems((data ?? []) as FAQ[]))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!draft.question || !draft.answer) return;
    setSaving(true);
    if (editId === 'new') {
      const { data } = await supabase.from('faqs').insert({
        property_id: PROPERTY_ID,
        question: draft.question,
        answer: draft.answer,
        category: draft.category ?? 'General',
        sort_order: items.length * 10,
        is_active: true,
      }).select().maybeSingle();
      if (data) setItems((prev) => [...prev, data as FAQ]);
    } else if (editId) {
      await supabase.from('faqs').update({ question: draft.question, answer: draft.answer, category: draft.category }).eq('id', editId);
      setItems((prev) => prev.map((f) => f.id === editId ? { ...f, ...draft } as FAQ : f));
    }
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function toggleActive(item: FAQ) {
    await supabase.from('faqs').update({ is_active: !item.is_active }).eq('id', item.id);
    setItems((prev) => prev.map((f) => f.id === item.id ? { ...f, is_active: !f.is_active } : f));
  }

  async function remove(id: string) {
    if (!confirm('Delete this FAQ?')) return;
    await supabase.from('faqs').delete().eq('id', id);
    setItems((prev) => prev.filter((f) => f.id !== id));
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    const updates = next.map((f, i) => ({ id: f.id, sort_order: i * 10 }));
    setItems(next);
    await Promise.all(updates.map((u) => supabase.from('faqs').update({ sort_order: u.sort_order }).eq('id', u.id)));
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} FAQ item{items.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setEditId('new'); setDraft({ category: 'General' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add FAQ
        </button>
      </div>

      {editId === 'new' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">New FAQ</p>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Question" value={draft.question ?? ''} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
          <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Answer" value={draft.answer ?? ''} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.category ?? 'General'} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {FAQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {items.map((item, i) => (
          <div key={item.id} className="bg-white">
            {editId === item.id ? (
              <div className="p-4 space-y-3 bg-blue-50">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.question ?? ''} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
                <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" value={draft.answer ?? ''} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.category ?? item.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                  {FAQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1">{item.question}</p>
                    <StatusBadge active={item.is_active} />
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.answer}</p>
                  <span className="inline-block mt-1.5 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditId(item.id); setDraft({ question: item.question, answer: item.answer, category: item.category }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                  <button onClick={() => toggleActive(item)} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">{item.is_active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No FAQs yet. Add your first one above.</div>}
      </div>
    </div>
  );
}

// ─── House Rules Tab ──────────────────────────────────────────────────────────

function HouseRulesTab() {
  const [items, setItems] = useState<HouseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<HouseRule>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('house_rules').select('*').eq('property_id', PROPERTY_ID).order('sort_order')
      .then(({ data }) => setItems((data ?? []) as HouseRule[]))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!draft.title) return;
    setSaving(true);
    if (editId === 'new') {
      const { data } = await supabase.from('house_rules').insert({
        property_id: PROPERTY_ID,
        title: draft.title,
        description: draft.description ?? '',
        icon: draft.icon ?? 'Shield',
        sort_order: items.length * 10,
        is_active: true,
      }).select().maybeSingle();
      if (data) setItems((prev) => [...prev, data as HouseRule]);
    } else if (editId) {
      await supabase.from('house_rules').update({ title: draft.title, description: draft.description, icon: draft.icon }).eq('id', editId);
      setItems((prev) => prev.map((r) => r.id === editId ? { ...r, ...draft } as HouseRule : r));
    }
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function toggleActive(item: HouseRule) {
    await supabase.from('house_rules').update({ is_active: !item.is_active }).eq('id', item.id);
    setItems((prev) => prev.map((r) => r.id === item.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function remove(id: string) {
    if (!confirm('Delete this rule?')) return;
    await supabase.from('house_rules').delete().eq('id', id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setItems(next);
    await Promise.all(next.map((r, i) => supabase.from('house_rules').update({ sort_order: i * 10 }).eq('id', r.id)));
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  function RuleForm() {
    return (
      <div className="space-y-3">
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rule title" value={draft.title ?? ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Description (optional)" value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Icon name (e.g. Shield, PawPrint, Moon)" value={draft.icon ?? ''} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} rule{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditId('new'); setDraft({ icon: 'Shield' }); }} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add rule
        </button>
      </div>

      {editId === 'new' && <div className="bg-blue-50 border border-blue-100 rounded-xl p-5"><p className="text-sm font-semibold text-gray-900 mb-3">New rule</p><RuleForm /></div>}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {items.map((item, i) => (
          <div key={item.id} className="bg-white">
            {editId === item.id ? (
              <div className="p-4 bg-blue-50"><RuleForm /></div>
            ) : (
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <StatusBadge active={item.is_active} />
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.icon}</span>
                  </div>
                  {item.description && <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditId(item.id); setDraft({ title: item.title, description: item.description, icon: item.icon }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">Edit</button>
                  <button onClick={() => toggleActive(item)} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">{item.is_active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No house rules yet.</div>}
      </div>
    </div>
  );
}

// ─── Policies Tab ─────────────────────────────────────────────────────────────

function PoliciesTab() {
  const [items, setItems] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Policy>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('property_policies')
      .select('id,policy_type,title,content,is_active')
      .eq('property_id', PROPERTY_ID)
      .then(({ data, error }) => {
        if (error) console.error('PoliciesTab load error:', error);
        setItems((data ?? []) as Policy[]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    const policy_type = (draft.policy_type ?? '').trim();
    const title = (draft.title ?? '').trim();
    const content = draft.content ?? '';
    if (!policy_type || !title) { return; }
    setSaving(true);
    setMsg('');

    if (editId === 'new') {
      const { data, error } = await supabase
        .from('property_policies')
        .insert({ property_id: PROPERTY_ID, policy_type, title, content, metadata: {}, is_active: true })
        .select('id,policy_type,title,content,is_active')
        .maybeSingle();
      if (error) { setMsg('Error saving'); }
      else if (data) { setItems((prev) => [...prev, data as Policy]); setMsg('Saved!'); }
    } else if (editId) {
      const { error } = await supabase
        .from('property_policies')
        .update({ policy_type, title, content, updated_at: new Date().toISOString() })
        .eq('id', editId);
      if (error) { setMsg('Error saving'); }
      else {
        setItems((prev) => prev.map((p) => p.id === editId ? { ...p, policy_type, title, content } : p));
        setMsg('Saved!');
      }
    }

    setTimeout(() => setMsg(''), 2500);
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function toggleActive(item: Policy) {
    const next = !item.is_active;
    const { error } = await supabase
      .from('property_policies')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (!error) setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_active: next } : p));
  }

  async function remove(id: string) {
    if (!confirm('Delete this policy?')) return;
    const { error } = await supabase.from('property_policies').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  function PolicyForm() {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Policy type <span className="text-gray-400 font-normal">(internal identifier)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. cancellation, pet_policy, noise_rules"
            value={draft.policy_type ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, policy_type: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-gray-400 font-normal">(shown to guests)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Cancellation Policy, Pet Policy"
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
          <textarea
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Policy text shown to guests…"
            value={draft.content ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !(draft.policy_type ?? '').trim() || !(draft.title ?? '').trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={() => { setEditId(null); setDraft({}); }}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} polic{items.length !== 1 ? 'ies' : 'y'}</p>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm font-medium ${msg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
          <button
            onClick={() => { setEditId('new'); setDraft({ policy_type: '', title: '', content: '' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add policy
          </button>
        </div>
      </div>

      {editId === 'new' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">New policy</p>
          <PolicyForm />
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="bg-white">
            {editId === item.id ? (
              <div className="p-5 bg-blue-50">
                <p className="text-sm font-semibold text-gray-900 mb-3">Edit policy</p>
                <PolicyForm />
              </div>
            ) : (
              <div className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{item.policy_type}</span>
                    <StatusBadge active={item.is_active} />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.content}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => { setEditId(item.id); setDraft({ policy_type: item.policy_type, title: item.title, content: item.content }); }}
                    className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(item)}
                    className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {item.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && editId !== 'new' && (
          <div className="text-center py-10 text-gray-400 text-sm">No policies yet. Add your first one above.</div>
        )}
      </div>
    </div>
  );
}

// ─── Recommendations Tab ──────────────────────────────────────────────────────

function RecommendationsTab() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Recommendation>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('local_recommendations').select('*').eq('property_id', PROPERTY_ID).order('sort_order')
      .then(({ data }) => setItems((data ?? []) as Recommendation[]))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!draft.name) return;
    setSaving(true);
    const payload = {
      property_id: PROPERTY_ID,
      name: draft.name ?? '',
      category: draft.category ?? 'General',
      description: draft.description ?? '',
      address: draft.address ?? '',
      distance_label: draft.distance_label ?? '',
      website_url: draft.website_url ?? '',
      is_featured: draft.is_featured ?? false,
      sort_order: editId === 'new' ? items.length * 10 : undefined,
      is_active: true,
    };
    if (editId === 'new') {
      const { data } = await supabase.from('local_recommendations').insert(payload).select().maybeSingle();
      if (data) setItems((prev) => [...prev, data as Recommendation]);
    } else if (editId) {
      const { sort_order: _, property_id: __, is_active: ___, ...updatePayload } = payload;
      await supabase.from('local_recommendations').update(updatePayload).eq('id', editId);
      setItems((prev) => prev.map((r) => r.id === editId ? { ...r, ...draft } as Recommendation : r));
    }
    setEditId(null);
    setDraft({});
    setSaving(false);
  }

  async function toggleActive(item: Recommendation) {
    await supabase.from('local_recommendations').update({ is_active: !item.is_active }).eq('id', item.id);
    setItems((prev) => prev.map((r) => r.id === item.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function remove(id: string) {
    if (!confirm('Delete this recommendation?')) return;
    await supabase.from('local_recommendations').delete().eq('id', id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  function RecForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Name *" value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={draft.category ?? 'General'} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {REC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Short description" value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Address" value={draft.address ?? ''} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Distance (e.g. 5 min drive)" value={draft.distance_label ?? ''} onChange={(e) => setDraft((d) => ({ ...d, distance_label: e.target.value }))} />
        </div>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Website URL (optional)" value={draft.website_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, website_url: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={draft.is_featured ?? false} onChange={(e) => setDraft((d) => ({ ...d, is_featured: e.target.checked }))} className="rounded" />
          Feature this recommendation (shows star)
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={() => { setEditId(null); setDraft({}); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} recommendation{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditId('new'); setDraft({ category: 'General', is_featured: false }); }} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add place
        </button>
      </div>

      {editId === 'new' && <div className="bg-blue-50 border border-blue-100 rounded-xl p-5"><p className="text-sm font-semibold text-gray-900 mb-3">New recommendation</p><RecForm /></div>}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="bg-white">
            {editId === item.id ? (
              <div className="p-5 bg-blue-50"><RecForm /></div>
            ) : (
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
                    {item.is_featured && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Featured</span>}
                    <StatusBadge active={item.is_active} />
                  </div>
                  <p className="text-sm text-gray-500">{item.description}</p>
                  {(item.address || item.distance_label) && (
                    <p className="text-xs text-gray-400 mt-0.5">{[item.address, item.distance_label].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditId(item.id); setDraft({ name: item.name, category: item.category, description: item.description, address: item.address, distance_label: item.distance_label, website_url: item.website_url, is_featured: item.is_featured }); }} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">Edit</button>
                  <button onClick={() => toggleActive(item)} className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">{item.is_active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No recommendations yet.</div>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ContentEditor() {
  const [activeTab, setActiveTab] = useState<Tab>('faqs');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Content</h2>
        <p className="text-sm text-gray-500">Manage guest-facing content and policies</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'faqs' && <FAQsTab />}
      {activeTab === 'rules' && <HouseRulesTab />}
      {activeTab === 'policies' && <PoliciesTab />}
      {activeTab === 'recommendations' && <RecommendationsTab />}
    </div>
  );
}

export default ContentEditor