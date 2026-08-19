import { useEffect, useState } from 'react';
import {
  Cigarette, PartyPopper, Moon, PawPrint, Shield, Users, Clock, Sparkles,
  LogIn, LogOut, Car, Key, XCircle, AlertTriangle, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HouseRule {
  id: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
}

interface Policy {
  policy_type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface Props {
  propertyId: string;
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const RULE_ICONS: Record<string, React.ElementType> = {
  Cigarette, PartyPopper, Moon, PawPrint, Shield, Users, Clock, Sparkles,
  LogIn, LogOut, Car, Key, XCircle, AlertTriangle,
};

function RuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = RULE_ICONS[name] ?? Shield;
  return <Icon className={className} />;
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function HouseRulesCard({ rules }: { rules: HouseRule[] }) {
  if (rules.length === 0) return null;
  return (
    <div id="house-rules" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Shield className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">House rules</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {rules.map((rule) => (
          <div key={rule.id} className="px-6 py-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <RuleIcon name={rule.icon} className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{rule.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckInOutCard({ policy }: { policy: Policy | undefined }) {
  if (!policy) return null;
  const meta = policy.metadata as {
    check_in_time?: string;
    check_out_time?: string;
    early_checkin_note?: string;
    late_checkout_note?: string;
    access_note?: string;
    parking_note?: string;
  };

  return (
    <div id="check-in-out" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Key className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Check-in &amp; check-out</h3>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <LogIn className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500 mb-1">Check-in</p>
            <p className="text-base font-bold text-gray-900">{meta.check_in_time ?? '4:00 PM'}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <LogOut className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500 mb-1">Check-out</p>
            <p className="text-base font-bold text-gray-900">{meta.check_out_time ?? '11:00 AM'}</p>
          </div>
        </div>

        {meta.early_checkin_note && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>{meta.early_checkin_note}</p>
          </div>
        )}
        {meta.late_checkout_note && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>{meta.late_checkout_note}</p>
          </div>
        )}
        {meta.parking_note && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Car className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>{meta.parking_note}</p>
          </div>
        )}
        {meta.access_note && (
          <div className="flex items-start gap-2 text-sm text-gray-500 bg-blue-50 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">{meta.access_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CancellationCard({ policy }: { policy: Policy | undefined }) {
  if (!policy) return null;
  return (
    <div id="cancellation" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Cancellation policy</h3>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm text-gray-700 leading-relaxed">{policy.content}</p>
        {(policy.metadata as { contact_instruction?: string }).contact_instruction && (
          <p className="mt-3 text-xs text-gray-500 italic">
            {(policy.metadata as { contact_instruction?: string }).contact_instruction}
          </p>
        )}
      </div>
    </div>
  );
}

function PetPolicyCard({ policy }: { policy: Policy | undefined }) {
  if (!policy) return null;
  const meta = policy.metadata as {
    pets_allowed?: boolean;
    max_pets?: number;
    pet_fee_note?: string;
    leash_required?: boolean;
    furniture_note?: string;
  };

  return (
    <div id="pet-policy" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <PawPrint className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Pet policy</h3>
        {meta.pets_allowed ? (
          <span className="ml-auto text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            Pets allowed
          </span>
        ) : (
          <span className="ml-auto text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
            No pets
          </span>
        )}
      </div>
      <div className="px-6 py-5 space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">{policy.content}</p>
        <div className="grid grid-cols-2 gap-3">
          {meta.max_pets != null && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Max pets</p>
              <p className="text-sm font-semibold text-gray-900">{meta.max_pets}</p>
            </div>
          )}
          {meta.pet_fee_note && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Fee</p>
              <p className="text-sm font-semibold text-gray-900">{meta.pet_fee_note}</p>
            </div>
          )}
        </div>
        {meta.furniture_note && (
          <div className="flex items-start gap-2 text-sm text-gray-500 bg-amber-50 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p>{meta.furniture_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GenericPolicyCard({ policy }: { policy: Policy }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Info className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">{policy.title}</h3>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{policy.content}</p>
      </div>
    </div>
  );
}

function AccessibilityCard({ policy }: { policy: Policy | undefined }) {
  if (!policy) return null;
  const meta = policy.metadata as {
    single_story?: boolean;
    step_free_entry?: boolean;
    entry_steps?: number;
    bedroom_floor?: string;
    bathroom_accessible?: string;
    parking_distance?: string;
    certification_note?: string;
  };

  return (
    <div id="accessibility" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Info className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Accessibility notes</h3>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed">
          We want guests to have accurate expectations before booking. Please review these notes and
          contact the host with any specific questions.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{policy.content}</p>
        <div className="grid grid-cols-2 gap-3">
          {meta.single_story != null && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Property level</p>
              <p className="text-sm font-medium text-gray-900">{meta.single_story ? 'Single story' : 'Multi-story'}</p>
            </div>
          )}
          {meta.entry_steps != null && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Entry steps</p>
              <p className="text-sm font-medium text-gray-900">{meta.entry_steps === 0 ? 'Step-free' : `${meta.entry_steps} step${meta.entry_steps !== 1 ? 's' : ''}`}</p>
            </div>
          )}
          {meta.bedroom_floor && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Bedroom</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{meta.bedroom_floor} floor</p>
            </div>
          )}
          {meta.parking_distance && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Parking</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{meta.parking_distance}</p>
            </div>
          )}
        </div>
        {meta.certification_note && (
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
            <AlertTriangle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>{meta.certification_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuestInfoSection({ propertyId }: Props) {
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from('house_rules')
        .select('id,title,description,icon,sort_order')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('property_policies')
        .select('policy_type,title,content,metadata')
        .eq('property_id', propertyId)
        .eq('is_active', true),
    ]).then(([rulesRes, policiesRes]) => {
      setRules((rulesRes.data ?? []) as HouseRule[]);
      setPolicies((policiesRes.data ?? []) as Policy[]);
    }).finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div id="guest-info" className="py-10 border-b">
      <div className="h-7 w-48 bg-gray-100 rounded-lg animate-pulse mb-3" />
      <div className="h-4 w-80 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (rules.length === 0 && policies.length === 0) return null;

  const KNOWN_TYPES = new Set(['cancellation', 'check_in_out', 'pet', 'accessibility']);
  const getPolicy = (type: string) => policies.find((p) => p.policy_type === type);
  const customPolicies = policies.filter((p) => !KNOWN_TYPES.has(p.policy_type));

  return (
    <div id="guest-info" className="py-10 border-b">
      <h2 className="text-2xl font-semibold mb-2">Guest information</h2>
      <p className="text-gray-500 text-sm mb-6">Everything you need for a smooth, comfortable stay.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <HouseRulesCard rules={rules} />
          <CancellationCard policy={getPolicy('cancellation')} />
        </div>
        <div className="space-y-5">
          <CheckInOutCard policy={getPolicy('check_in_out')} />
          <PetPolicyCard policy={getPolicy('pet')} />
          {customPolicies.map((p) => (
            <GenericPolicyCard key={p.policy_type} policy={p} />
          ))}
          <AccessibilityCard policy={getPolicy('accessibility')} />
        </div>
      </div>
    </div>
  );
}
