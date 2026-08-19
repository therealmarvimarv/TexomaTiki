// Deterministic lifecycle recommendation based on observable instance/billing/support data.
// Never automatically applies changes — only suggests.

export const LIFECYCLE_STAGES = [
  'lead','signed','onboarding','provisioning','qa_review',
  'ready_to_launch','launched','active','past_due',
  'suspended','cancelled','archived',
] as const;

export type LifecycleStage = typeof LIFECYCLE_STAGES[number];
export type LifecycleStatus = 'on_track' | 'needs_attention' | 'blocked' | 'completed';

export const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', signed: 'Signed', onboarding: 'Onboarding',
  provisioning: 'Provisioning', qa_review: 'QA Review',
  ready_to_launch: 'Ready to Launch', launched: 'Launched',
  active: 'Active', past_due: 'Past Due',
  suspended: 'Suspended', cancelled: 'Cancelled', archived: 'Archived',
};

export const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  lead:             { bg: 'bg-gray-100',    text: 'text-gray-600' },
  signed:           { bg: 'bg-blue-100',    text: 'text-blue-700' },
  onboarding:       { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  provisioning:     { bg: 'bg-orange-100',  text: 'text-orange-700' },
  qa_review:        { bg: 'bg-purple-100',  text: 'text-purple-700' },
  ready_to_launch:  { bg: 'bg-teal-100',    text: 'text-teal-700' },
  launched:         { bg: 'bg-green-100',   text: 'text-green-700' },
  active:           { bg: 'bg-green-100',   text: 'text-green-700' },
  past_due:         { bg: 'bg-red-100',     text: 'text-red-700' },
  suspended:        { bg: 'bg-red-100',     text: 'text-red-700' },
  cancelled:        { bg: 'bg-gray-100',    text: 'text-gray-500' },
  archived:         { bg: 'bg-gray-100',    text: 'text-gray-400' },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  on_track:         { bg: 'bg-green-100',  text: 'text-green-700' },
  needs_attention:  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  blocked:          { bg: 'bg-red-100',    text: 'text-red-700' },
  completed:        { bg: 'bg-blue-100',   text: 'text-blue-700' },
};

export interface LifecycleInputs {
  clientStatus: string;
  subStatus: string | null;
  accessStatus: string | null;
  healthStatus: string | null;
  launchReadiness: string | null;
  provisioningStatus: string | null;
  handoffStatus: string | null;
  launchedAt: string | null;
  hasInstance: boolean;
  urgentTickets: number;
}

export interface LifecycleRecommendation {
  stage: LifecycleStage;
  status: LifecycleStatus;
  reason: string;
}

export function recommendLifecycle(inputs: LifecycleInputs): LifecycleRecommendation {
  const {
    clientStatus, subStatus, accessStatus, healthStatus,
    launchReadiness, provisioningStatus, handoffStatus,
    launchedAt, hasInstance, urgentTickets,
  } = inputs;

  if (['cancelled'].includes(clientStatus) || ['cancelled'].includes(subStatus ?? '') || accessStatus === 'cancelled') {
    return { stage: 'cancelled', status: 'blocked', reason: 'Client or subscription cancelled' };
  }
  if (clientStatus === 'suspended' || accessStatus === 'suspended') {
    return { stage: 'suspended', status: 'blocked', reason: 'Instance or client access suspended' };
  }
  if (['past_due', 'expired'].includes(subStatus ?? '')) {
    return { stage: 'past_due', status: 'needs_attention', reason: 'Subscription payment past due' };
  }
  if (urgentTickets > 0) {
    return { stage: 'active', status: 'needs_attention', reason: `${urgentTickets} urgent support ticket(s) open` };
  }
  if (healthStatus === 'failing') {
    return { stage: 'qa_review', status: 'blocked', reason: 'Health checks failing — review before launch' };
  }
  if (launchedAt && (subStatus === 'active' || subStatus === 'trial' || clientStatus === 'active')) {
    return { stage: 'active', status: 'on_track', reason: 'Instance launched and billing active' };
  }
  if (launchReadiness === 'ready_to_launch' || launchReadiness === 'launched') {
    return { stage: 'ready_to_launch', status: 'on_track', reason: 'Launch package ready to send / pending launch' };
  }
  if (healthStatus === 'warning') {
    return { stage: 'qa_review', status: 'needs_attention', reason: 'Health check warnings — review before launch' };
  }
  if (provisioningStatus === 'deployed') {
    if (handoffStatus && !['completed', 'accepted'].includes(handoffStatus)) {
      return { stage: 'onboarding', status: 'on_track', reason: 'Instance deployed, waiting on client handoff' };
    }
    return { stage: 'qa_review', status: 'on_track', reason: 'Instance deployed, ready for QA' };
  }
  if (provisioningStatus && ['pending', 'running', 'failed'].includes(provisioningStatus)) {
    return { stage: 'provisioning', status: provisioningStatus === 'failed' ? 'blocked' : 'on_track', reason: `Provisioning ${provisioningStatus}` };
  }
  if (hasInstance) {
    return { stage: 'provisioning', status: 'on_track', reason: 'Instance exists, provisioning in progress' };
  }
  if (clientStatus === 'trial' || clientStatus === 'active') {
    return { stage: 'onboarding', status: 'on_track', reason: 'Client signed, no instance yet' };
  }
  return { stage: 'onboarding', status: 'on_track', reason: 'No specific signals detected' };
}
