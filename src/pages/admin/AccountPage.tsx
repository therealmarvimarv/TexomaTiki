import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, Building2, MapPin, Mail, Settings2, Activity, Shield, LogOut, Save, CheckCircle, AlertCircle, ChevronDown, Headphones as HeadphonesIcon } from 'lucide-react';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'SGD'];
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

const MANAGER_ROLES = ['Owner', 'Manager', 'Co-host', 'Property Manager', 'Support Contact', 'Other'];

interface AccountRow {
  id: string;
  property_id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  business_name: string | null;
  business_address: string | null;
  support_email: string | null;
  timezone: string;
  currency: string;
  date_format: string;
  account_status: string;
  created_at: string;
  // Listing Info
  listing_name: string | null;
  listing_address: string | null;
  listing_city: string | null;
  listing_state: string | null;
  listing_zip: string | null;
  listing_country: string | null;
  listing_manager_name: string | null;
  listing_manager_role: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  primary_guest_contact_name: string | null;
  primary_guest_contact_email: string | null;
  primary_guest_contact_phone: string | null;
  // Support
  support_phone: string | null;
  support_message: string | null;
  support_hours: string | null;
  support_enabled: boolean;
  // Email Template Settings
  property_address: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  suggested_door_code: string | null;
}

interface SystemStatus {
  paymentMode: string;
  emailProvider: string;
  calendarSources: number;
}

type Flash = { type: 'ok' | 'err'; text: string } | null;

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {helper && <p className="mt-1 text-xs text-gray-400">{helper}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', readOnly }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? e => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
        readOnly
          ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default'
          : 'bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'
      }`}
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent pr-8"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60"
    >
      <Save className="w-4 h-4" />
      {saving ? 'Saving…' : 'Save'}
    </button>
  );
}

function FlashBanner({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
      flash.type === 'ok'
        ? 'bg-green-50 text-green-800 border border-green-200'
        : 'bg-red-50 text-red-800 border border-red-200'
    }`}>
      {flash.type === 'ok'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {flash.text}
    </div>
  );
}

export default function AccountPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Auth user
  const [loginEmail, setLoginEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  // Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFlash, setProfileFlash] = useState<Flash>(null);

  // Owner / Business
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [bizSaving, setBizSaving] = useState(false);
  const [bizFlash, setBizFlash] = useState<Flash>(null);

  // Support (read-only — developer-controlled)
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportHours, setSupportHours] = useState('');
  const [supportEnabled, setSupportEnabled] = useState(true);

  // Listing Info
  const [listingName, setListingName] = useState('');
  const [listingAddress, setListingAddress] = useState('');
  const [listingCity, setListingCity] = useState('');
  const [listingState, setListingState] = useState('');
  const [listingZip, setListingZip] = useState('');
  const [listingCountry, setListingCountry] = useState('');
  const [listingManagerName, setListingManagerName] = useState('');
  const [listingManagerRole, setListingManagerRole] = useState('Owner');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [primaryGuestContactName, setPrimaryGuestContactName] = useState('');
  const [primaryGuestContactEmail, setPrimaryGuestContactEmail] = useState('');
  const [primaryGuestContactPhone, setPrimaryGuestContactPhone] = useState('');
  const [listingSaving, setListingSaving] = useState(false);
  const [listingFlash, setListingFlash] = useState<Flash>(null);

  // Email Template Settings
  const [propertyAddress, setPropertyAddress] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [suggestedDoorCode, setSuggestedDoorCode] = useState('');
  const [emailTplSaving, setEmailTplSaving] = useState(false);
  const [emailTplFlash, setEmailTplFlash] = useState<Flash>(null);

  // Preferences
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [currency, setCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefFlash, setPrefFlash] = useState<Flash>(null);

  // System status
  const [status, setStatus] = useState<SystemStatus | null>(null);

  // Security
  const [resetSending, setResetSending] = useState(false);
  const [resetFlash, setResetFlash] = useState<Flash>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function flash(setter: (f: Flash) => void, key: string, f: Flash, ms = 4000) {
    setter(f);
    clearTimeout(flashTimers.current[key]);
    flashTimers.current[key] = setTimeout(() => setter(null), ms);
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/admin/login'); return; }

      const user = session.user;
      setLoginEmail(user.email ?? '');
      setCreatedAt(user.created_at ?? '');

      const [accountRes, paymentRes, emailRes, calRes] = await Promise.all([
        supabase.from('account_settings').select('*').eq('property_id', PROPERTY_ID).maybeSingle(),
        supabase.from('payment_settings').select('payment_mode').eq('property_id', PROPERTY_ID).maybeSingle(),
        supabase.from('email_settings').select('email_provider').eq('property_id', PROPERTY_ID).maybeSingle(),
        supabase.from('ical_sources').select('id', { count: 'exact', head: true }).eq('property_id', PROPERTY_ID).eq('enabled', true),
      ]);

      if (accountRes.data) {
        const a = accountRes.data as AccountRow;
        setAccountId(a.id);
        setFullName(a.full_name ?? '');
        setPhone(a.phone ?? '');
        setOwnerName(a.owner_name ?? '');
        setOwnerEmail(a.owner_email ?? '');
        setOwnerPhone(a.owner_phone ?? '');
        setBusinessName(a.business_name ?? '');
        setBusinessAddress(a.business_address ?? '');
        setSupportEmail(a.support_email ?? '');
        setListingName(a.listing_name ?? '');
        setListingAddress(a.listing_address ?? '');
        setListingCity(a.listing_city ?? '');
        setListingState(a.listing_state ?? '');
        setListingZip(a.listing_zip ?? '');
        setListingCountry(a.listing_country ?? '');
        setListingManagerName(a.listing_manager_name ?? '');
        setListingManagerRole(a.listing_manager_role ?? 'Owner');
        setManagerEmail(a.manager_email ?? '');
        setManagerPhone(a.manager_phone ?? '');
        setPrimaryGuestContactName(a.primary_guest_contact_name ?? '');
        setPrimaryGuestContactEmail(a.primary_guest_contact_email ?? '');
        setPrimaryGuestContactPhone(a.primary_guest_contact_phone ?? '');
        setSupportPhone(a.support_phone ?? '');
        setSupportMessage(a.support_message ?? '');
        setSupportHours(a.support_hours ?? '');
        setSupportEnabled(a.support_enabled ?? true);
        setPropertyAddress(a.property_address ?? '');
        setCheckInTime(a.check_in_time ?? '');
        setCheckOutTime(a.check_out_time ?? '');
        setSuggestedDoorCode(a.suggested_door_code ?? '');
        setTimezone(a.timezone);
        setCurrency(a.currency);
        setDateFormat(a.date_format);
      }

      setStatus({
        paymentMode: paymentRes.data?.payment_mode ?? 'test_manual',
        emailProvider: emailRes.data?.email_provider ?? 'disabled',
        calendarSources: calRes.count ?? 0,
      });

      setLoading(false);
    }
    load();
  }, [navigate]);

  async function upsert(patch: Record<string, unknown>) {
    if (accountId) {
      return supabase.from('account_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', accountId);
    }
    const { data, error } = await supabase.from('account_settings').insert({
      property_id: PROPERTY_ID,
      ...patch,
    }).select('id').single();
    if (!error && data) setAccountId(data.id);
    return { error };
  }

  async function saveProfile() {
    setProfileSaving(true);
    const { error } = await upsert({ full_name: fullName.trim(), phone: phone.trim() });
    flash(setProfileFlash, 'profile', error
      ? { type: 'err', text: 'Failed to save profile.' }
      : { type: 'ok', text: 'Profile saved.' });
    setProfileSaving(false);
  }

  function validateEmail(v: string) {
    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function saveBusiness() {
    if (!validateEmail(ownerEmail)) {
      flash(setBizFlash, 'biz', { type: 'err', text: 'Please enter a valid email address.' });
      return;
    }
    setBizSaving(true);
    const { error } = await upsert({
      owner_name: ownerName.trim(),
      owner_email: ownerEmail.trim(),
      owner_phone: ownerPhone.trim(),
      business_name: businessName.trim(),
      business_address: businessAddress.trim(),
    });
    flash(setBizFlash, 'biz', error
      ? { type: 'err', text: 'Failed to save business info.' }
      : { type: 'ok', text: 'Business info saved.' });
    setBizSaving(false);
  }

  async function saveListing() {
    if (!validateEmail(managerEmail) || !validateEmail(primaryGuestContactEmail)) {
      flash(setListingFlash, 'listing', { type: 'err', text: 'Please enter valid email addresses.' });
      return;
    }
    setListingSaving(true);
    const { error } = await upsert({
      listing_name: listingName.trim(),
      listing_address: listingAddress.trim(),
      listing_city: listingCity.trim(),
      listing_state: listingState.trim(),
      listing_zip: listingZip.trim(),
      listing_country: listingCountry.trim(),
      listing_manager_name: listingManagerName.trim(),
      listing_manager_role: listingManagerRole,
      manager_email: managerEmail.trim(),
      manager_phone: managerPhone.trim(),
      primary_guest_contact_name: primaryGuestContactName.trim(),
      primary_guest_contact_email: primaryGuestContactEmail.trim(),
      primary_guest_contact_phone: primaryGuestContactPhone.trim(),
    });
    flash(setListingFlash, 'listing', error
      ? { type: 'err', text: 'Failed to save listing info.' }
      : { type: 'ok', text: 'Listing info saved.' });
    setListingSaving(false);
  }

  async function saveEmailTemplateSettings() {
    setEmailTplSaving(true);
    const { error } = await upsert({
      property_address: propertyAddress.trim(),
      check_in_time: checkInTime.trim(),
      check_out_time: checkOutTime.trim(),
      suggested_door_code: suggestedDoorCode.trim(),
    });
    flash(setEmailTplFlash, 'emailtpl', error
      ? { type: 'err', text: 'Failed to save email template settings.' }
      : { type: 'ok', text: 'Email template settings saved.' });
    setEmailTplSaving(false);
  }

  async function savePreferences() {
    setPrefSaving(true);
    const { error } = await upsert({ timezone, currency, date_format: dateFormat });
    flash(setPrefFlash, 'pref', error
      ? { type: 'err', text: 'Failed to save preferences.' }
      : { type: 'ok', text: 'Preferences saved.' });
    setPrefSaving(false);
  }

  async function sendPasswordReset() {
    if (!loginEmail) return;
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/admin/account`,
    });
    flash(setResetFlash, 'reset', error
      ? { type: 'err', text: 'Could not send reset email. Check your auth configuration.' }
      : { type: 'ok', text: `Password reset email sent to ${loginEmail}.` }, 6000);
    setResetSending(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/admin/login');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-gray-900">Account</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, business info, and preferences.</p>
      </div>

      {/* Profile */}
      <SectionCard icon={User} title="Profile">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <TextInput value={fullName} onChange={setFullName} placeholder="Your name" />
            </Field>
            <Field label="Phone">
              <TextInput value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" type="tel" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Login Email" helper="Contact your auth provider to change your login email.">
              <TextInput value={loginEmail} readOnly />
            </Field>
            <Field label="Role">
              <TextInput value="Owner / Admin" readOnly />
            </Field>
          </div>
          {createdAt && (
            <p className="text-xs text-gray-400">
              Account created {new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <SaveButton onClick={saveProfile} saving={profileSaving} />
            {profileFlash && <FlashBanner flash={profileFlash} />}
          </div>
        </div>
      </SectionCard>

      {/* Owner / Business Info */}
      <SectionCard icon={Building2} title="Owner / Business Info">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Owner Name">
              <TextInput value={ownerName} onChange={setOwnerName} placeholder="Owner's full name" />
            </Field>
            <Field label="Owner Email">
              <TextInput value={ownerEmail} onChange={setOwnerEmail} placeholder="owner@example.com" type="email" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Owner Phone">
              <TextInput value={ownerPhone} onChange={setOwnerPhone} placeholder="+1 (555) 000-0000" type="tel" />
            </Field>
            <Field label="Business / Company Name" helper="Optional">
              <TextInput value={businessName} onChange={setBusinessName} placeholder="e.g. Sunshine Rentals LLC" />
            </Field>
          </div>
          <Field label="Business Address" helper="Optional">
            <TextInput value={businessAddress} onChange={setBusinessAddress} placeholder="123 Main St, City, State, ZIP" />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <SaveButton onClick={saveBusiness} saving={bizSaving} />
            {bizFlash && <FlashBanner flash={bizFlash} />}
          </div>
        </div>
      </SectionCard>

      {/* Listing Info */}
      <SectionCard icon={MapPin} title="Listing Info">
        <div className="space-y-4">
          <Field label="Listing Name">
            <TextInput value={listingName} onChange={setListingName} placeholder="e.g. Tiki Cottage" />
          </Field>
          <Field label="Listing Address">
            <TextInput value={listingAddress} onChange={setListingAddress} placeholder="123 Ocean Drive" />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Field label="City">
                <TextInput value={listingCity} onChange={setListingCity} placeholder="Miami" />
              </Field>
            </div>
            <Field label="State">
              <TextInput value={listingState} onChange={setListingState} placeholder="FL" />
            </Field>
            <Field label="ZIP">
              <TextInput value={listingZip} onChange={setListingZip} placeholder="33101" />
            </Field>
          </div>
          <Field label="Country">
            <TextInput value={listingCountry} onChange={setListingCountry} placeholder="US" />
          </Field>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Listing Manager</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Manager Name">
                <TextInput value={listingManagerName} onChange={setListingManagerName} placeholder="Full name" />
              </Field>
              <Field label="Manager Role">
                <div className="relative">
                  <select
                    value={listingManagerRole}
                    onChange={e => setListingManagerRole(e.target.value)}
                    className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent pr-8"
                  >
                    {MANAGER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="Manager Email">
                <TextInput value={managerEmail} onChange={setManagerEmail} placeholder="manager@example.com" type="email" />
              </Field>
              <Field label="Manager Phone">
                <TextInput value={managerPhone} onChange={setManagerPhone} placeholder="+1 (555) 000-0000" type="tel" />
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Guest Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Name">
                <TextInput value={primaryGuestContactName} onChange={setPrimaryGuestContactName} placeholder="Full name" />
              </Field>
              <Field label="Contact Email">
                <TextInput value={primaryGuestContactEmail} onChange={setPrimaryGuestContactEmail} placeholder="contact@example.com" type="email" />
              </Field>
              <Field label="Contact Phone">
                <TextInput value={primaryGuestContactPhone} onChange={setPrimaryGuestContactPhone} placeholder="+1 (555) 000-0000" type="tel" />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SaveButton onClick={saveListing} saving={listingSaving} />
            {listingFlash && <FlashBanner flash={listingFlash} />}
          </div>
        </div>
      </SectionCard>

      {/* Email Template Settings */}
      <SectionCard icon={Mail} title="Email Template Settings">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">These values are used as variables in guest email templates.</p>
          <Field label="Property Address" helper="Shown in guest emails, e.g. check-in instructions">
            <TextInput value={propertyAddress} onChange={setPropertyAddress} placeholder="123 Ocean Drive, Miami, FL 33101" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Check-in Time">
              <TextInput value={checkInTime} onChange={setCheckInTime} placeholder="e.g. 3:00 PM" />
            </Field>
            <Field label="Check-out Time">
              <TextInput value={checkOutTime} onChange={setCheckOutTime} placeholder="e.g. 11:00 AM" />
            </Field>
          </div>
          <Field label="Suggested Door Code" helper="Optional — used in email templates only, not enforced">
            <TextInput value={suggestedDoorCode} onChange={setSuggestedDoorCode} placeholder="e.g. 1234" />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <SaveButton onClick={saveEmailTemplateSettings} saving={emailTplSaving} />
            {emailTplFlash && <FlashBanner flash={emailTplFlash} />}
          </div>
        </div>
      </SectionCard>

      {/* Preferences */}
      <SectionCard icon={Settings2} title="Preferences">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Timezone">
              <SelectInput value={timezone} onChange={setTimezone} options={TIMEZONES} />
            </Field>
            <Field label="Currency">
              <SelectInput value={currency} onChange={setCurrency} options={CURRENCIES} />
            </Field>
            <Field label="Date Format">
              <SelectInput value={dateFormat} onChange={setDateFormat} options={DATE_FORMATS} />
            </Field>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <SaveButton onClick={savePreferences} saving={prefSaving} />
            {prefFlash && <FlashBanner flash={prefFlash} />}
          </div>
        </div>
      </SectionCard>

      {/* System Status */}
      {status && (
        <SectionCard icon={Activity} title="System Status">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatusCard label="Payment Mode" value={status.paymentMode === 'test_manual' ? 'Manual Test' : status.paymentMode === 'test_stripe' ? 'Stripe Test' : status.paymentMode === 'live_manual' ? 'Manual Live' : status.paymentMode === 'live_stripe' ? 'Stripe Live' : status.paymentMode.replace(/_/g, ' ')} />
            <StatusCard label="Email Provider" value={status.emailProvider} />
            <StatusCard
              label="Calendar Sync"
              value={status.calendarSources === 0 ? 'No sources' : `${status.calendarSources} source${status.calendarSources !== 1 ? 's' : ''} active`}
            />
            <StatusCard label="Account Status" value="Active" variant="green" />
            <div className="sm:col-span-2">
              <StatusCard
                label="Account ID"
                value={accountId ?? 'Not available'}
                mono
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Security / Logout */}
      <SectionCard icon={Shield} title="Security">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Login Email</p>
            <p className="text-sm text-gray-500">{loginEmail}</p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Password Reset</p>
            <p className="text-xs text-gray-400 mb-3">
              Sends a password reset link to your login email.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={sendPasswordReset}
                disabled={resetSending}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {resetSending ? 'Sending…' : 'Send Password Reset Email'}
              </button>
              {resetFlash && <FlashBanner flash={resetFlash} />}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Sign Out</p>
            {!logoutConfirm ? (
              <button
                onClick={() => setLogoutConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Sign out of the admin dashboard?</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Logout
                </button>
                <button
                  onClick={() => setLogoutConfirm(false)}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Support — read-only, developer-controlled */}
      {supportEnabled && (
        <SectionCard icon={HeadphonesIcon} title="Support">
          <div className="space-y-3">
            {supportMessage ? (
              <p className="text-sm text-gray-600">{supportMessage}</p>
            ) : (
              <p className="text-sm text-gray-600">Need help with your website or booking system? Contact support using the information below.</p>
            )}
            {supportEmail ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 flex-shrink-0">Email</span>
                  <a href={`mailto:${supportEmail}`} className="text-gray-900 hover:underline font-medium">{supportEmail}</a>
                </div>
                {supportPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-16 flex-shrink-0">Phone</span>
                    <a href={`tel:${supportPhone}`} className="text-gray-900 hover:underline font-medium">{supportPhone}</a>
                  </div>
                )}
                {supportHours && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-16 flex-shrink-0">Hours</span>
                    <span className="text-gray-700">{supportHours}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Support contact has not been configured yet.</p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StatusCard({ label, value, variant, mono }: {
  label: string;
  value: string;
  variant?: 'green';
  mono?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-medium capitalize ${
        variant === 'green' ? 'text-green-700' : 'text-gray-900'
      } ${mono ? 'font-mono text-xs tracking-tight truncate' : ''}`}>
        {value}
      </p>
    </div>
  );
}
