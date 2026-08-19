import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
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
import { LayoutDashboard, CalendarDays, BookOpen, Home, Menu, X, Sparkles, Wrench, Mail, CreditCard, CircleUser as UserCircle } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { to: '/admin/cleaning', label: 'Cleaning', icon: Sparkles },
  { to: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/admin/property', label: 'Property', icon: Home },
  { to: '/admin/email', label: 'Email', icon: Mail },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/account', label: 'Account', icon: UserCircle },
];

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </Link>
  );
}

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/admin/login');
      } else {
        setReady(true);
      }
    });
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-bold text-gray-900 text-lg">Tiki Cottage</span>
            <span className="hidden sm:inline-block text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">Admin</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} item={item} />
            ))}
          </nav>

          {/* Spacer to balance the layout */}
          <div className="w-20" />
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 top-14">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-white w-64 h-full shadow-xl p-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
            ))}
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/calendar/*" element={<AdminCalendar />} />
          <Route path="/calendar-sync" element={<CalendarSync />} />
          <Route path="/bookings" element={<BookingsManager />} />
          <Route path="/bookings/:bookingId" element={<BookingDetail />} />
          <Route path="/cleaning" element={<CleaningManager />} />
          <Route path="/maintenance" element={<MaintenanceManager />} />
          <Route path="/property" element={<PropertyEditor />} />
          <Route path="/email" element={<EmailSettings />} />
          <Route path="/payments" element={<PaymentsEditor />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </main>
    </div>
  );
}
