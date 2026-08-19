import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Cpu, ChevronRight, AlertTriangle } from 'lucide-react';

interface JobRow {
  id: string;
  instance_id: string;
  client_id: string;
  status: string;
  job_type: string;
  template_version: string | null;
  requested_by: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  instance_name: string;
  client_name: string;
}

const STATUS_FILTERS = ['all', 'queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled'] as const;
type FilterVal = typeof STATUS_FILTERS[number];

const JOB_STYLES: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-600',
  running:   'bg-blue-100 text-blue-800',
  waiting:   'bg-yellow-100 text-yellow-800',
  succeeded: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-400',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlatformProvisioningJobs() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterVal>('all');

  useEffect(() => {
    async function load() {
      const { data: rawJobs } = await supabase
        .from('platform_provisioning_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!rawJobs || rawJobs.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const instanceIds = [...new Set(rawJobs.map(j => j.instance_id))];
      const clientIds = [...new Set(rawJobs.map(j => j.client_id))];

      const [{ data: instances }, { data: clients }] = await Promise.all([
        supabase.from('platform_instances').select('id,instance_name').in('id', instanceIds),
        supabase.from('platform_clients').select('id,owner_name,business_name').in('id', clientIds),
      ]);

      const iMap: Record<string, string> = {};
      for (const i of instances ?? []) iMap[i.id] = i.instance_name;

      const cMap: Record<string, string> = {};
      for (const c of clients ?? []) {
        cMap[c.id] = c.owner_name + (c.business_name ? ` — ${c.business_name}` : '');
      }

      setJobs(rawJobs.map(j => ({
        ...j,
        instance_name: iMap[j.instance_id] ?? 'Unknown',
        client_name: cMap[j.client_id] ?? 'Unknown',
      })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  const counts: Record<FilterVal, number> = {
    all: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => j.status === 'running').length,
    waiting: jobs.filter(j => j.status === 'waiting').length,
    succeeded: jobs.filter(j => j.status === 'succeeded').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Provisioning Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track all provisioning job runs across instances.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
              filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Cpu className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {filter === 'all'
              ? 'No provisioning jobs yet. Start one from an instance provisioning page.'
              : `No ${filter} jobs.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => (
            <Link
              key={job.id}
              to={`/platform/provisioning/jobs/${job.id}`}
              className="bg-white rounded-2xl border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 truncate">{job.instance_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${JOB_STYLES[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {job.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium whitespace-nowrap">
                    {job.job_type.replace('_', ' ')}
                  </span>
                  {job.status === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="w-3 h-3" /> failed
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{job.client_name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {job.template_version && <span>v{job.template_version}</span>}
                  <span>Started {fmtDate(job.created_at)}</span>
                  {job.completed_at && <span>· Done {fmtDate(job.completed_at)}</span>}
                  {job.requested_by && <span>· by {job.requested_by}</span>}
                </div>
                {job.error_message && (
                  <p className="text-xs text-red-500 mt-1 truncate">{job.error_message}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
