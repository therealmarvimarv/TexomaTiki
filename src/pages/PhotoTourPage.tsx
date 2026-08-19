import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import PhotoTopBar from '../components/photos/PhotoTopBar';
import PhotoNavTabs from '../components/photos/PhotoNavTabs';
import PhotoSection from '../components/photos/PhotoSection';
import Lightbox from '../components/photos/Lightbox';
import Toast from '../components/photos/Toast';

const PROPERTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface Photo {
  src: string;
  alt: string;
  globalIndex?: number;
}

interface Section {
  id: string;
  title: string;
  thumb: string;
  features?: string[];
  photos: Photo[];
}

async function fetchSections(): Promise<Section[]> {
  const [secRes, featRes, imgRes] = await Promise.all([
    supabase
      .from('photo_sections')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .order('sort_order'),
    supabase
      .from('photo_section_features')
      .select('*')
      .order('sort_order'),
    supabase
      .from('property_images')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .not('section_id', 'is', null)
      .order('sort_order'),
  ]);

  const feats = featRes.data ?? [];
  const imgs = imgRes.data ?? [];

  return (secRes.data ?? []).map(sec => {
    const sectionPhotos = imgs
      .filter(i => i.section_id === sec.id)
      .map(i => ({ src: i.url, alt: sec.title }));
    const sectionFeats = feats
      .filter(f => f.section_id === sec.id)
      .map(f => f.feature as string);
    return {
      id: sec.slug,
      title: sec.title,
      thumb: sectionPhotos[0]?.src ?? '',
      features: sectionFeats.length > 0 ? sectionFeats : undefined,
      photos: sectionPhotos,
    };
  }).filter(s => s.photos.length > 0);
}

function buildSectionPhotos(sections: Section[]) {
  let offset = 0;
  return sections.map(section => {
    const photos = section.photos.map((p, i) => ({ ...p, globalIndex: offset + i }));
    offset += section.photos.length;
    return { ...section, photos };
  });
}

export default function PhotoTourPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrolledToHash = useRef(false);

  useEffect(() => {
    fetchSections().then(data => {
      setSections(data);
      if (data.length > 0) setActiveId(data[0].id);
      setLoading(false);
    });
  }, []);

  const sectionsWithIndex = buildSectionPhotos(sections);
  const allPhotos = sections.flatMap(s => s.photos);

  // Hash-based deep-link scroll on mount
  useEffect(() => {
    if (loading || scrolledToHash.current) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const t = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 172;
        window.scrollTo({ top: y, behavior: 'smooth' });
        scrolledToHash.current = true;
      }
    }, 150);
    return () => clearTimeout(t);
  }, [loading]);

  // IntersectionObserver to highlight active tab while scrolling
  useEffect(() => {
    if (loading) return;
    const observers: IntersectionObserver[] = [];
    sectionsWithIndex.forEach(section => {
      const el = document.getElementById(section.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(section.id); },
        { rootMargin: '-172px 0px -60% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [loading, sections]);

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(
    () => setLightboxIndex(i => (i !== null ? (i - 1 + allPhotos.length) % allPhotos.length : 0)),
    [allPhotos.length]
  );
  const nextPhoto = useCallback(
    () => setLightboxIndex(i => (i !== null ? (i + 1) % allPhotos.length : 0)),
    [allPhotos.length]
  );

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setToast(true);
  }

  const tabs = sections.map(s => ({ id: s.id, label: s.title, thumb: s.thumb }));

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading photos…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PhotoTopBar
        saved={saved}
        onToggleSave={() => setSaved(s => !s)}
        onShare={handleShare}
      />

      <PhotoNavTabs tabs={tabs} activeId={activeId} />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-16">
        {sectionsWithIndex.map((section, i) => (
          <PhotoSection
            key={section.id}
            id={section.id}
            title={section.title}
            features={section.features}
            photos={section.photos}
            featured={i === 0}
            onPhotoClick={openLightbox}
          />
        ))}
      </main>

      {lightboxIndex !== null && (
        <Lightbox
          photos={allPhotos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}

      {toast && (
        <Toast message="Photo tour link copied" onDismiss={() => setToast(false)} />
      )}
    </div>
  );
}
