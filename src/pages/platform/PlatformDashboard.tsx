import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, Users, Server, RefreshCw, Settings, Menu, X, Shield, ClipboardList, BookOpen, Plug, Handshake, CreditCard, Activity, LifeBuoy, Layers, Globe, GitBranch, Bell, ShieldCheck,
} from 'lucide-react';
import PlatformOverview from './PlatformOverview';
import PlatformClients from './PlatformClients';
import PlatformClientDetail from './PlatformClientDetail';
import PlatformInstances from './PlatformInstances';
import PlatformUpdates from './PlatformUpdates';
import PlatformSettings from './PlatformSettings';
import PlatformProvisioning from './PlatformProvisioning';
import PlatformProvisioningDetail from './PlatformProvisioningDetail';
import PlatformDeployment from './PlatformDeployment';
import PlatformDeploymentPack from './PlatformDeploymentPack';
import PlatformUpdateJobDetail from './PlatformUpdateJobDetail';
import PlatformProvisioningJobs from './PlatformProvisioningJobs';
import PlatformProvisioningJobDetail from './PlatformProvisioningJobDetail';
import PlatformOnboarding from './PlatformOnboarding';
import PlatformIntegrations from './PlatformIntegrations';
import PlatformHandoffs from './PlatformHandoffs';
import PlatformBilling from './PlatformBilling';
import PlatformHealth from './PlatformHealth';
import PlatformLaunchPackage from './PlatformLaunchPackage';
import PlatformSupport from './PlatformSupport';
import PlatformOperations from './PlatformOperations';
import PlatformDomains from './PlatformDomains';
import PlatformLifecycle from './PlatformLifecycle';
import PlatformAlerts from './PlatformAlerts';
import PlatformQA from './PlatformQA';
import PlatformSupportTicket from './PlatformSupportTicket';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/platform', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/platform/operations', label: 'Operations', icon: Layers },
  { to: '/platform/lifecycle', label: 'Lifecycle', icon: GitBranch },
  { to: '/platform/clients', label: 'Clients', icon: Users },
  { to: '/platform/instances', label: 'Instances', icon: Server },
  { to: '/platform/provisioning', label: 'Provisioning', icon: ClipboardList },
  { to: '/platform/deployment', label: 'Deployment', icon: BookOpen },
  { to: '/platform/updates', label: 'Updates', icon: RefreshCw },
  { to: '/platform/integrations', label: 'Integrations', icon: Plug },
  { to: '/platform/billing', label: 'Billing', icon: CreditCard },
  { to: '/platform/domains', label: 'Domains', icon: Globe },
  { to: '/platform/health', label: 'Health', icon: Activity },
  { to: '/platform/alerts', label: 'Alerts', icon: Bell },
  { to: '/platform/support', label: 'Support', icon: LifeBuoy },
  { to: '/platform/handoffs', label: 'Handoffs', icon: Handshake },
  { to: '/platform/qa', label: 'QA', icon: ShieldCheck },
  { to: '/platform/settings', label: 'Settings', icon: Settings },
];

function NavLink({ item, badge, onClick }: { item: NavItem; badge?: number; onClick?: () => void }) {
  const location = useLocation();
  const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-white/15 text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <div className="relative">
        <Icon className="w-4 h-4 flex-shrink-0" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      {item.label}
    </Link>
  );
}

type AuthState = 'loading' | 'unauthorized' | 'denied' | 'ready';

export default function PlatformDashboard() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/admin/login');
        return;
      }
      setAdminEmail(sessionData.session.user.email ?? '');
      const { data: profile } = await supabase
        .from('platform_profiles')
        .select('platform_role')
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle();
      if (!profile || profile.platform_role !== 'super_admin') {
        setAuthState('denied');
        return;
      }
      setAuthState('ready');
      // Load alert badge count
      const { data: alertRows } = await supabase
        .from('platform_alerts')
        .select('id')
        .eq('status', 'unread');
      setUnreadAlerts((alertRows ?? []).length);
    })();
  }, [navigate]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-gray-400 text-sm">Your account does not have platform admin access.</p>
          <Link to="/admin" className="inline-block text-sm text-gray-400 hover:text-white underline">
            Return to Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white text-lg">Platform Admin</span>
            <span className="hidden sm:inline-block text-xs text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded-full font-medium">
              Super Admin
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} item={item} badge={item.to === '/platform/alerts' ? unreadAlerts : undefined} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[160px]">{adminEmail}</span>
            <Link
              to="/admin"
              className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Client Admin
            </Link>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 top-14">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-gray-900 w-64 h-full shadow-xl p-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} item={item} badge={item.to === '/platform/alerts' ? unreadAlerts : undefined} onClick={() => setMobileOpen(false)} />
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<PlatformOverview />} />
          <Route path="/clients" element={<PlatformClients />} />
          <Route path="/clients/:clientId" element={<PlatformClientDetail />} />
          <Route path="/instances" element={<PlatformInstances />} />
          <Route path="/provisioning" element={<PlatformProvisioning />} />
          <Route path="/provisioning/jobs" element={<PlatformProvisioningJobs />} />
          <Route path="/provisioning/jobs/:jobId" element={<PlatformProvisioningJobDetail />} />
          <Route path="/provisioning/:instanceId" element={<PlatformProvisioningDetail />} />
          <Route path="/provisioning/:instanceId/pack" element={<PlatformDeploymentPack />} />
          <Route path="/deployment" element={<PlatformDeployment />} />
          <Route path="/updates" element={<PlatformUpdates />} />
          <Route path="/updates/:jobId" element={<PlatformUpdateJobDetail />} />
          <Route path="/onboarding/new" element={<PlatformOnboarding />} />
          <Route path="/integrations" element={<PlatformIntegrations />} />
          <Route path="/billing" element={<PlatformBilling />} />
          <Route path="/health" element={<PlatformHealth />} />
          <Route path="/instances/:instanceId/launch-package" element={<PlatformLaunchPackage />} />
          <Route path="/operations" element={<PlatformOperations />} />
          <Route path="/lifecycle" element={<PlatformLifecycle />} />
          <Route path="/domains" element={<PlatformDomains />} />
          <Route path="/support" element={<PlatformSupport />} />
          <Route path="/support/:ticketId" element={<PlatformSupportTicket />} />
          <Route path="/alerts" element={<PlatformAlerts />} />
          <Route path="/qa" element={<PlatformQA />} />
          <Route path="/handoffs" element={<PlatformHandoffs />} />
          <Route path="/settings" element={<PlatformSettings />} />
        </Routes>
      </main>
    </div>
  );
}
