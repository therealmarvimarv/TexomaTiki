import { useEffect, useState } from 'react';
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { supabase } from '../../lib/supabase';

import AdminOverview from './AdminOverview';
import AdminCalendar from './AdminCalendar';
import PropertyEditor from './PropertyEditor';
import BookingsManager from './BookingsManager';
import BookingDetail from './BookingDetail';
import CalendarSync from './CalendarSync';
import CleaningManager from './CleaningManager';
import MaintenanceManager from './MaintenanceManager';
import EmailSettings from './EmailSettings';
import PaymentsEditor from './PaymentsEditor';
import AccountPage from './AccountPage';
import PlatformPrivacyPolicy from './PlatformPrivacyPolicy';
import PlatformTermsConditions from './PlatformTermsConditions';
import PlatformDocumentation from './PlatformDocumentation';

import WhatsNewModal from '../../components/admin/WhatsNewModal';
import {
  CURRENT_ADMIN_UPDATE,
  getAdminUpdateStorageKey,
  getAdminUpdateLoginStorageKey,
} from '../../config/adminUpdates';

import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Home,
  Menu,
  X,
  Sparkles,
  Wrench,
  Mail,
  CreditCard,
  CircleUser as UserCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/admin',
    label: 'Overview',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: '/admin/calendar',
    label: 'Calendar',
    icon: CalendarDays,
  },
  {
    to: '/admin/bookings',
    label: 'Bookings',
    icon: BookOpen,
  },
  {
    to: '/admin/cleaning',
    label: 'Cleaning',
    icon: Sparkles,
  },
  {
    to: '/admin/maintenance',
    label: 'Maintenance',
    icon: Wrench,
  },
  {
    to: '/admin/property',
    label: 'Property',
    icon: Home,
  },
  {
    to: '/admin/email',
    label: 'Email',
    icon: Mail,
  },
  {
    to: '/admin/payments',
    label: 'Payments',
    icon: CreditCard,
  },
  {
    to: '/admin/account',
    label: 'Account',
    icon: UserCircle,
  },
];

function NavLink({
  item,
  collapsed = false,
  onClick,
}: {
  item: NavItem;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();

  const active = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
        collapsed
          ? 'justify-center w-10 h-10 mx-auto'
          : 'gap-3 px-3 py-2'
      } ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />

      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function AccountNavItem({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();

  const inAccountSection =
    location.pathname.startsWith('/admin/account');

  return (
    <div>
      <Link
        to="/admin/account"
        onClick={onNavigate}
        title={collapsed ? 'Account' : undefined}
        aria-label={collapsed ? 'Account' : undefined}
        className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
          collapsed
            ? 'justify-center w-10 h-10 mx-auto'
            : 'gap-3 px-3 py-2'
        } ${
          inAccountSection
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <UserCircle className="w-4 h-4 flex-shrink-0" />

        {!collapsed && <span>Account</span>}
      </Link>

      {!collapsed && inAccountSection && (
        <div className="ml-7 mt-1 space-y-1">
          <Link
            to="/admin/account/privacy"
            onClick={onNavigate}
            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
              location.pathname === '/admin/account/privacy'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Privacy Policy
          </Link>

          <Link
            to="/admin/account/terms"
            onClick={onNavigate}
            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
              location.pathname === '/admin/account/terms'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Terms &amp; Conditions
          </Link>

          <Link
            to="/admin/account/documentation"
            onClick={onNavigate}
            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
              location.pathname ===
              '/admin/account/documentation'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Documentation
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    return (
      localStorage.getItem('adminSidebarCollapsed') === 'true'
    );
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/admin/login');
        return;
      }

      const uid = data.session.user.id;

      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();

      if (!adminRow) {
        setDenied(true);
        setReady(true);
        return;
      }

      const appearanceStorageKey =
        getAdminUpdateStorageKey(
          uid,
          CURRENT_ADMIN_UPDATE.version
        );

      const loginStorageKey =
        getAdminUpdateLoginStorageKey(
          uid,
          CURRENT_ADMIN_UPDATE.version
        );

      const appearanceCount = Number(
        localStorage.getItem(appearanceStorageKey) || '0'
      );

      const currentLoginMarker =
        data.session.user.last_sign_in_at ?? '';

      const lastLoginShown =
        localStorage.getItem(loginStorageKey);

      const shouldShow =
        appearanceCount <
          CURRENT_ADMIN_UPDATE.maxAppearances &&
        currentLoginMarker !== '' &&
        lastLoginShown !== currentLoginMarker;

      if (shouldShow) {
        localStorage.setItem(
          appearanceStorageKey,
          String(appearanceCount + 1)
        );

        localStorage.setItem(
          loginStorageKey,
          currentLoginMarker
        );
      }

      setShowWhatsNew(shouldShow);
      setReady(true);
    });
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem(
      'adminSidebarCollapsed',
      sidebarCollapsed ? 'true' : 'false'
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileOpen]);

  const dismissWhatsNew = () => {
    setShowWhatsNew(false);
  };

  const goToPricing = () => {
    setShowWhatsNew(false);
    navigate('/admin/calendar?tab=pricing');
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            Access denied
          </p>

          <p className="text-sm text-gray-500 mb-6">
            Your account is not authorized to access this
            dashboard.
          </p>

          <button
            onClick={() => navigate('/admin/login')}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showWhatsNew && (
        <WhatsNewModal
          update={CURRENT_ADMIN_UPDATE}
          onDismiss={dismissWhatsNew}
          onGoToPricing={goToPricing}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex-col transition-all duration-200 ${
          sidebarCollapsed
            ? 'w-[72px]'
            : 'w-[220px]'
        }`}
      >
        {/* Texoma Tiki branding */}
        <div
          className={`h-20 flex items-center border-b border-gray-100 ${
            sidebarCollapsed
              ? 'justify-center px-2'
              : 'px-5'
          }`}
        >
          {sidebarCollapsed ? (
            <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
              TT
            </div>
          ) : (
            <div>
              <div className="text-lg font-bold text-gray-900 leading-tight">
                Texoma Tiki
              </div>

              <div className="mt-1 inline-flex text-[10px] uppercase tracking-wide font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Admin
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <div className="space-y-1">
            {NAV_ITEMS.slice(0, 5).map(item => (
              <NavLink
                key={item.to}
                item={item}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>

          <div className="border-t border-gray-200 my-5" />

          <div className="space-y-1">
            {NAV_ITEMS.slice(5, 8).map(item => (
              <NavLink
                key={item.to}
                item={item}
                collapsed={sidebarCollapsed}
              />
            ))}

            <AccountNavItem
              collapsed={sidebarCollapsed}
            />
          </div>
        </nav>

        {/* Collapse button */}
        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(value => !value)
            }
            aria-label={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            title={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            className={`flex items-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors ${
              sidebarCollapsed
                ? 'w-10 h-10 justify-center mx-auto'
                : 'w-full gap-3 px-3 py-2'
            }`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />

                <span className="text-sm font-medium">
                  Collapse
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="h-16 px-4 flex items-center justify-between">
          <button
            type="button"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">
              Texoma Tiki
            </span>

            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">
              Admin
            </span>
          </div>

          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <aside className="relative bg-white w-[280px] max-w-[85vw] h-full shadow-2xl flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">
                  Texoma Tiki
                </div>

                <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mt-0.5">
                  Admin
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {NAV_ITEMS.slice(0, 5).map(item => (
                  <NavLink
                    key={item.to}
                    item={item}
                    onClick={() =>
                      setMobileOpen(false)
                    }
                  />
                ))}
              </div>

              <div className="border-t border-gray-200 my-5" />

              <div className="space-y-1">
                {NAV_ITEMS.slice(5, 8).map(item => (
                  <NavLink
                    key={item.to}
                    item={item}
                    onClick={() =>
                      setMobileOpen(false)
                    }
                  />
                ))}

                <AccountNavItem
                  onNavigate={() =>
                    setMobileOpen(false)
                  }
                />
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Page content */}
      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          sidebarCollapsed
            ? 'lg:pl-[72px]'
            : 'lg:pl-[220px]'
        }`}
      >
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Routes>
            <Route
              path="/"
              element={<AdminOverview />}
            />

            <Route
              path="/calendar/*"
              element={<AdminCalendar />}
            />

            <Route
              path="/calendar-sync"
              element={<CalendarSync />}
            />

            <Route
              path="/bookings"
              element={<BookingsManager />}
            />

            <Route
              path="/bookings/:bookingId"
              element={<BookingDetail />}
            />

            <Route
              path="/cleaning"
              element={<CleaningManager />}
            />

            <Route
              path="/maintenance"
              element={<MaintenanceManager />}
            />

            <Route
              path="/property"
              element={<PropertyEditor />}
            />

            <Route
              path="/email"
              element={<EmailSettings />}
            />

            <Route
              path="/payments"
              element={<PaymentsEditor />}
            />

            <Route
              path="/account"
              element={<AccountPage />}
            />

            <Route
              path="/account/privacy"
              element={<PlatformPrivacyPolicy />}
            />

            <Route
              path="/account/terms"
              element={<PlatformTermsConditions />}
            />

            <Route
              path="/account/documentation"
              element={<PlatformDocumentation />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}