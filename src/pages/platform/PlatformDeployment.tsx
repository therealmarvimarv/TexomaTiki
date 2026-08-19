import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Loader2, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Shield, Plus, Tag,
} from 'lucide-react';

interface TemplateVersion {
  id: string;
  version: string;
  title: string;
  description: string | null;
  git_ref: string | null;
  netlify_site_id: string | null;
  supabase_migration_version: string | null;
  status: string;
  release_notes: string | null;
}

interface Blueprint {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  template_version_id: string | null;
}

interface BlueprintStep {
  id: string;
  step_key: string;
  step_label: string;
  step_group: string;
  instructions: string | null;
  sort_order: number;
}

function GroupSection({ group, steps }: { group: string; steps: BlueprintStep[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
          <span className="text-xs text-gray-400">{steps.length} steps</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {steps.map((step, i) => (
            <div key={step.id} className="px-5 py-3.5 bg-white">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{step.step_label}</p>
                  {step.instructions && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.instructions}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlatformDeployment() {
  const [templateVersion, setTemplateVersion] = useState<TemplateVersion | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [steps, setSteps] = useState<BlueprintStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: tv }, { data: bps }] = await Promise.all([
        supabase.from('platform_template_versions').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('platform_deployment_blueprints').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setTemplateVersion(tv as TemplateVersion ?? null);
      const bp = bps as Blueprint ?? null;
      setBlueprint(bp);
      if (bp) {
        const { data: bpSteps } = await supabase
          .from('platform_deployment_blueprint_steps')
          .select('*')
          .eq('blueprint_id', bp.id)
          .order('sort_order');
        setSteps((bpSteps as BlueprintStep[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const groups = Array.from(new Set(steps.map(s => s.step_group)));

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deployment Blueprint</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reference playbook for deploying a new isolated client instance.
          </p>
        </div>
        <Link
          to="/platform/clients"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Client
        </Link>
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Security reminder:</strong> Do not paste secrets, API keys, service role keys, or webhook secrets into platform notes.
          Store actual secret values only in Supabase Vault, Netlify environment variables, or your provider's secure dashboard.
        </p>
      </div>

      {/* Active template version */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Active Template Version</h2>
        </div>
        {templateVersion ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-lg font-bold text-gray-900">{templateVersion.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {templateVersion.status}
              </span>
              <span className="text-xs text-gray-400 font-mono">v{templateVersion.version}</span>
            </div>
            {templateVersion.description && (
              <p className="text-sm text-gray-500">{templateVersion.description}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
              {templateVersion.git_ref && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Git Ref</p>
                  <p className="text-xs text-gray-700 font-mono">{templateVersion.git_ref}</p>
                </div>
              )}
              {templateVersion.netlify_site_id && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Netlify Master Site</p>
                  <p className="text-xs text-gray-700 font-mono">{templateVersion.netlify_site_id}</p>
                </div>
              )}
              {templateVersion.supabase_migration_version && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Migration Version</p>
                  <p className="text-xs text-gray-700 font-mono">{templateVersion.supabase_migration_version}</p>
                </div>
              )}
            </div>
            {templateVersion.release_notes && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-gray-500 font-medium mb-1">Release Notes</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{templateVersion.release_notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No active template version found.</p>
        )}
      </div>

      {/* Blueprint */}
      {blueprint ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">{blueprint.title}</h2>
              {blueprint.description && <p className="text-sm text-gray-500 mt-0.5">{blueprint.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{steps.length} steps across {groups.length} phases</p>
            </div>
          </div>

          <div className="space-y-3">
            {groups.map(group => (
              <GroupSection
                key={group}
                group={group}
                steps={steps.filter(s => s.step_group === group)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No active deployment blueprint found.</p>
        </div>
      )}
    </div>
  );
}
