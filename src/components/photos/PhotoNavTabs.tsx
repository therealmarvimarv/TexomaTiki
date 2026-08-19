import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  thumb: string;
}

interface Props {
  tabs: Tab[];
  activeId: string | null;
}

export default function PhotoNavTabs({ tabs, activeId }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = listRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, []);

  function scroll(dir: 'left' | 'right') {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 172;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  return (
    <div className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-r from-white via-white to-transparent pr-4"
            aria-label="Scroll left"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </span>
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-l from-white via-white to-transparent pl-4"
            aria-label="Scroll right"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </span>
          </button>
        )}

        <div
          ref={listRef}
          className="flex gap-4 overflow-x-auto py-3 px-4 sm:px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div
                  className={`w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isActive
                      ? 'border-gray-900 shadow-md'
                      : 'border-transparent group-hover:border-gray-300'
                  }`}
                >
                  <img
                    src={tab.thumb}
                    alt={tab.label}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
