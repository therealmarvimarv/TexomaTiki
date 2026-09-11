import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

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
    setMenuOpen(false);
  };

  if (!isSticky) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 md:px-24">
        <nav className="relative flex items-center justify-center md:justify-start gap-8 h-16 md:h-20">
          <div className="hidden md:flex items-center gap-8">
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
          </div>
          <div className="hidden md:flex flex-1" />
          <button
            onClick={() => scrollToSection('booking')}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all"
          >
            Reserve
          </button>
          <button
            onClick={() => setMenuOpen(open => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            className="absolute right-0 md:hidden p-2 text-gray-900 hover:text-gray-600 transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-2">
            <button onClick={() => { navigate('/photos'); setMenuOpen(false); }} className="block w-full px-2 py-3 text-left text-sm font-medium hover:text-gray-600 transition-colors">
              Photos
            </button>
            <button onClick={() => scrollToSection('amenities')} className="block w-full px-2 py-3 text-left text-sm font-medium hover:text-gray-600 transition-colors">
              Amenities
            </button>
            <button onClick={() => scrollToSection('location')} className="block w-full px-2 py-3 text-left text-sm font-medium hover:text-gray-600 transition-colors">
              Location
            </button>
            <button onClick={() => scrollToSection('contact')} className="block w-full px-2 py-3 text-left text-sm font-medium hover:text-gray-600 transition-colors">
              Contact Us
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
