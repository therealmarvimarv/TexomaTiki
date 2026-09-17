import { Link } from 'react-router-dom';

interface LegalPageLayoutProps {
  title: string;
  content: string;
  backLink?: { to: string; label: string };
}

export default function LegalPageLayout({ title, content, backLink }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12 sm:py-16">
        {backLink && (
          <Link
            to={backLink.to}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
          >
            <span>&larr;</span>
            {backLink.label}
          </Link>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-8">
          {title}
        </h1>
        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-[15px] sm:text-base">
          {content}
        </div>
      </div>
    </div>
  );
}
