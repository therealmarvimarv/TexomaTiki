import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PropertyPage from './pages/PropertyPage';
import BookingSuccess from './pages/BookingSuccess';
import BookingCancelled from './pages/BookingCancelled';
import InquirySuccess from './pages/InquirySuccess';
import BookingRequestSuccess from './pages/BookingRequestSuccess';
import PhotoTourPage from './pages/PhotoTourPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import { supabase } from './lib/supabase';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function useWebsiteSettings() {
  useEffect(() => {
    async function applyWebsiteSettings() {
      const { data } = await supabase
        .from('account_settings')
        .select('favicon_url, seo_title, seo_meta_description')
        .eq('property_id', PROPERTY_ID)
        .maybeSingle();

      if (!data) return;

      document.querySelectorAll('link[rel="icon"]').forEach(el => el.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = data.favicon_url || '/vite.svg';
      document.head.appendChild(link);

      if (data.seo_title) {
        document.title = data.seo_title;
      }

      if (data.seo_meta_description) {
        let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'description';
          document.head.appendChild(meta);
        }
        meta.content = data.seo_meta_description;
      }
    }
    applyWebsiteSettings();
  }, []);
}

function App() {
  useWebsiteSettings();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PropertyPage />} />
        <Route path="/property/:id" element={<PropertyPage />} />
        <Route path="/photos" element={<PhotoTourPage />} />
        <Route path="/booking/success" element={<BookingSuccess />} />
        <Route path="/booking-success" element={<BookingSuccess />} />
        <Route path="/booking/cancelled" element={<BookingCancelled />} />
        <Route path="/inquiry/success" element={<InquirySuccess />} />
        <Route path="/booking/request-success" element={<BookingRequestSuccess />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/platform/*" element={<PlatformDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
