import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StickyNav() {
  const [isSticky, setIsSticky] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 600);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isSticky) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 md:px-24">
        <nav className="flex items-center gap-8 h-20">
          <button
            onClick={() => navigate('/photos')}
            className="text-sm font-medium hover:text-gray-600 transition-colors"
          >
            Photos
          </button>
          <button
            onClick={() => scrollToSection('amenities')}
            className="text-sm font-medium hover:text-gray-600 transition-colors"
          >
            Amenities
          </button>
          <button
            onClick={() => scrollToSection('location')}
            className="text-sm font-medium hover:text-gray-600 transition-colors"
          >
            Location
          </button>
          <button
            onClick={() => scrollToSection('contact')}
            className="text-sm font-medium hover:text-gray-600 transition-colors"
          >
            Contact Us
          </button>
          <div className="flex-1" />
          <button
            onClick={() => scrollToSection('booking')}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all"
          >
            Reserve
          </button>
        </nav>
      </div>
    </div>
  );
}
