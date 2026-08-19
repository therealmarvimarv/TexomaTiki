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

function App() {
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
