import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Menu, X, Play } from 'lucide-react';
import platformDocumentationContent from '../../content/legal/platform-documentation.txt?raw';

interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

interface DocBlock {
  type: 'heading' | 'paragraph' | 'bullets' | 'numbers' | 'video';
  text?: string;
  items?: string[];
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseDocument(raw: string): DocSection[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const sections: DocSection[] = [];
  let current: DocSection | null = null;
  let listType: 'bullets' | 'numbers' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listType && listItems.length && current) {
      current.blocks.push({ type: listType, items: [...listItems] });
    }
    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      const title = trimmed.slice(2).trim();
      current = { id: slugify(title), title, blocks: [] };
      sections.push(current);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      if (current) {
        current.blocks.push({ type: 'heading', text: trimmed.slice(3).trim() });
      }
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'numbers') flushList();
      listType = 'numbers';
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (listType !== 'bullets') flushList();
      listType = 'bullets';
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (/^help\s+videos?\s+coming\s+soon$/i.test(trimmed)) {
      flushList();
      if (current) current.blocks.push({ type: 'video' });
      continue;
    }

    flushList();
    if (current) current.blocks.push({ type: 'paragraph', text: trimmed });
  }

  flushList();
  return sections;
}

export default function PlatformDocumentation() {
  const sections = useMemo(() => parseDocument(platformDocumentationContent), []);
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute('data-section-id');
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.1, 0.5, 1] }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
    setMobileNavOpen(false);
  };

  const renderBlock = (block: DocBlock, idx: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <h3 key={idx} className="text-lg font-semibold text-gray-900 mt-8 mb-3">
            {block.text}
          </h3>
        );
      case 'paragraph':
        return (
          <p key={idx} className="text-gray-700 leading-relaxed mb-4">
            {block.text}
          </p>
        );
      case 'bullets':
        return (
          <ul key={idx} className="space-y-2 mb-4">
            {block.items?.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-gray-700 leading-relaxed">
                <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      case 'numbers':
        return (
          <ol key={idx} className="space-y-2 mb-4">
            {block.items?.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-gray-700 leading-relaxed">
                <span className="text-gray-500 font-medium mt-0.5 flex-shrink-0 min-w-[1.25rem]">
                  {i + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        );
      case 'video':
        return (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 mb-4"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Play className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span className="text-sm text-gray-400 italic">Help videos coming soon</span>
          </div>
        );
      default:
        return null;
    }
  };

  const navItems = sections.map((s) => ({
    id: s.id,
    title: s.title,
  }));

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back link */}
        <Link
          to="/admin/account"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          <span>&larr;</span>
          Back to Account
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-gray-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Documentation
          </h1>
        </div>

        {/* Mobile nav toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Menu className="w-4 h-4 text-gray-500" />
            <span>Contents</span>
            {activeId && (
              <span className="text-gray-400 ml-auto truncate">
                {navItems.find((n) => n.id === activeId)?.title}
              </span>
            )}
            <ChevronRight
              className={`w-4 h-4 text-gray-400 transition-transform ${mobileNavOpen ? 'rotate-90' : ''}`}
            />
          </button>
          {mobileNavOpen && (
            <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left transition-colors border-b border-gray-50 last:border-0 ${
                    activeId === item.id
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop layout: sticky sidebar + content */}
        <div className="flex gap-8">
          {/* Left nav — sticky on desktop */}
          <nav className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
                Contents
              </p>
              <div className="space-y-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      activeId === item.id
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span
                      className={`w-1 h-4 rounded-full flex-shrink-0 transition-colors ${
                        activeId === item.id ? 'bg-white' : 'bg-transparent'
                      }`}
                    />
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-w-0 max-w-3xl"
          >
            {sections.map((section) => (
              <section
                key={section.id}
                data-section-id={section.id}
                ref={(el) => { sectionRefs.current[section.id] = el; }}
                className="mb-12 scroll-mt-8"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                  {section.title}
                </h2>
                <div>
                  {section.blocks.map((block, idx) => renderBlock(block, idx))}
                </div>
              </section>
            ))}

            {sections.length === 0 && (
              <p className="text-gray-400 text-sm">
                No documentation content found. Add content to the text file to see it here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
