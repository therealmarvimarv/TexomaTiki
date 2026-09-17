import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-24 py-6">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-gray-900 transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </footer>
  );
}
