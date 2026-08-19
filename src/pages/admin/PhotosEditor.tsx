import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, X, Image as ImageIcon, Check, Upload, Loader2 } from 'lucide-react';

const STORAGE_BUCKET = 'property-photos';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface Photo {
  id: string;
  url: string;
  sort_order: number;
  section_id: string | null;
  storage_path: string | null;
}

interface Feature {
  id: string;
  feature: string;
  sort_order: number;
}

interface Section {
  id: string;
  title: string;
  slug: string;
  sort_order: number;
  photos: Photo[];
  features: Feature[];
  collapsed: boolean;
}

function slugify(title: string) {
  return 'section-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Shared photo grid ─────────────────────────────────────────────────────────

interface PhotoGridProps {
  photos: Photo[];
  sectionId: string | null;
  onAdd: () => void;
  onDelete: (photoId: string) => void;
  onDragStart: (photoIdx: number) => void;
  onDragOver: (e: React.DragEvent, photoIdx: number) => void;
  onDrop: () => void;
}

function PhotoGrid({ photos, onAdd, onDelete, onDragStart, onDragOver, onDrop }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
        onClick={onAdd}
      >
        No photos yet — click to add
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo, pIdx) => (
        <div
          key={photo.id}
          draggable
          onDragStart={e => { e.stopPropagation(); onDragStart(pIdx); }}
          onDragOver={e => { e.stopPropagation(); onDragOver(e, pIdx); }}
          onDrop={e => { e.stopPropagation(); onDrop(); }}
          className="relative group rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border border-gray-100"
        >
          <img src={photo.url} alt="" className="w-full h-28 object-cover" draggable={false} />
          <div className="absolute top-1 left-1 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical className="w-3.5 h-3.5 text-white" />
          </div>
          <button
            onClick={() => onDelete(photo.id)}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
          {pIdx === 0 && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded font-medium pointer-events-none">
              Cover
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Photo action buttons ──────────────────────────────────────────────────────

function PhotoActions({
  onUpload,
  onAddUrl,
  uploading,
}: {
  onUpload: () => void;
  onAddUrl: () => void;
  uploading: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onUpload}
        disabled={uploading}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40"
      >
        {uploading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Upload className="w-3.5 h-3.5" />}
        Upload
      </button>
      <span className="text-gray-300 select-none">|</span>
      <button
        onClick={onAddUrl}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add URL
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotosEditor({ propertyId }: { propertyId: string }) {
  const [mainPhotos, setMainPhotos] = useState<Photo[]>([]);
  const [mainCollapsed, setMainCollapsed] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [showNewAreaInput, setShowNewAreaInput] = useState(false);
  const newAreaInputRef = useRef<HTMLInputElement>(null);

  // ── Photo add inline state ─────────────────────────────────────────────────
  const [addPhotoSectionId, setAddPhotoSectionId] = useState<string | null>(null);
  const [addPhotoUrl, setAddPhotoUrl] = useState('');
  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  const [addMainPhotoVisible, setAddMainPhotoVisible] = useState(false);
  const [addMainPhotoUrl, setAddMainPhotoUrl] = useState('');

  // drag state
  const dragSectionIdx = useRef<number | null>(null);
  const dragOverSectionIdx = useRef<number | null>(null);
  const dragMainPhotoIdx = useRef<number | null>(null);
  const dragOverMainPhotoIdx = useRef<number | null>(null);
  const dragPhotoRef = useRef<{ sectionId: string; photoIdx: number } | null>(null);
  const dragOverPhotoRef = useRef<{ sectionId: string; photoIdx: number } | null>(null);

  // ── Upload state ───────────────────────────────────────────────────────────
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  // null = main, string = section id
  const uploadTargetRef = useRef<string | null>(null);
  // undefined = idle, null = main uploading, string = section id uploading
  const [uploadingSection, setUploadingSection] = useState<string | null | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    const [secRes, featRes, imgRes, mainImgRes] = await Promise.all([
      supabase.from('photo_sections').select('*').eq('property_id', propertyId).order('sort_order'),
      supabase.from('photo_section_features').select('*').order('sort_order'),
      supabase.from('property_images').select('id,url,sort_order,section_id,storage_path').eq('property_id', propertyId).not('section_id', 'is', null).order('sort_order'),
      supabase.from('property_images').select('id,url,sort_order,section_id,storage_path').eq('property_id', propertyId).is('section_id', null).order('sort_order'),
    ]);

    const feats = featRes.data ?? [];
    const imgs = imgRes.data ?? [];

    setMainPhotos((mainImgRes.data ?? []).map(i => ({
      id: i.id,
      url: i.url,
      sort_order: i.sort_order,
      section_id: null,
      storage_path: i.storage_path ?? null,
    })));

    const built: Section[] = (secRes.data ?? []).map(s => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      sort_order: s.sort_order,
      photos: imgs.filter(i => i.section_id === s.id).map(i => ({
        id: i.id,
        url: i.url,
        sort_order: i.sort_order,
        section_id: i.section_id,
        storage_path: i.storage_path ?? null,
      })),
      features: feats.filter(f => f.section_id === s.id).map(f => ({
        id: f.id,
        feature: f.feature,
        sort_order: f.sort_order,
      })),
      collapsed: false,
    }));

    setSections(built);
    setLoading(false);
  };

  useEffect(() => { load(); }, [propertyId]);

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };
  const flashErr = (text: string) => { setErrMsg(text); setTimeout(() => setErrMsg(''), 5000); };

  // ── Upload ─────────────────────────────────────────────────────────────────

  function triggerUpload(sectionId: string | null) {
    uploadTargetRef.current = sectionId;
    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.value = '';
      hiddenFileInputRef.current.click();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const target = uploadTargetRef.current;
    setUploadingSection(target);

    // Pre-calculate starting sort orders
    let mainNextOrder = mainPhotos.length > 0
      ? Math.max(...mainPhotos.map(p => p.sort_order))
      : 0;
    const sectionOrderMap: Record<string, number> = {};

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.has(file.type)) {
        flashErr(`"${file.name}": only JPG, PNG, or WebP images are supported.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        flashErr(`"${file.name}": file must be under 10MB.`);
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${propertyId}/${target ?? 'main'}/${Date.now()}-${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageErr) {
        flashErr(`Upload failed: ${storageErr.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const url = urlData.publicUrl;

      if (target === null) {
        mainNextOrder += 1;
        const { data, error } = await supabase
          .from('property_images')
          .insert({ property_id: propertyId, section_id: null, url, storage_path: path, source: 'upload', sort_order: mainNextOrder })
          .select('id,url,sort_order,section_id,storage_path').maybeSingle();
        if (!error && data) {
          setMainPhotos(prev => [...prev, {
            id: data.id, url: data.url, sort_order: data.sort_order,
            section_id: null, storage_path: path,
          }]);
          flash('Photo uploaded');
        }
      } else {
        if (!(target in sectionOrderMap)) {
          const sec = sections.find(s => s.id === target);
          sectionOrderMap[target] = sec && sec.photos.length > 0
            ? Math.max(...sec.photos.map(p => p.sort_order))
            : 0;
        }
        sectionOrderMap[target] += 1;
        const { data, error } = await supabase
          .from('property_images')
          .insert({ property_id: propertyId, section_id: target, url, storage_path: path, source: 'upload', sort_order: sectionOrderMap[target] })
          .select('id,url,sort_order,section_id,storage_path').maybeSingle();
        if (!error && data) {
          setSections(prev => prev.map(s =>
            s.id === target
              ? { ...s, photos: [...s.photos, { id: data.id, url: data.url, sort_order: data.sort_order, section_id: target, storage_path: path }] }
              : s
          ));
          flash('Photo uploaded');
        }
      }
    }

    setUploadingSection(undefined);
    if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = '';
  }

  // ── Main page photos ───────────────────────────────────────────────────────

  const addMainPhoto = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const maxOrder = mainPhotos.length > 0 ? Math.max(...mainPhotos.map(p => p.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('property_images')
      .insert({ property_id: propertyId, section_id: null, url: trimmed, storage_path: null, source: 'url', sort_order: maxOrder })
      .select('id,url,sort_order,section_id,storage_path')
      .maybeSingle();
    if (!error && data) {
      setMainPhotos(prev => [...prev, { id: data.id, url: data.url, sort_order: data.sort_order, section_id: null, storage_path: null }]);
      flash('Photo added');
    }
    setAddMainPhotoUrl('');
    setAddMainPhotoVisible(false);
  };

  const deleteMainPhoto = async (photoId: string) => {
    const photo = mainPhotos.find(p => p.id === photoId);
    if (photo?.storage_path) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
      if (error) flashErr('Storage file could not be removed — record deleted anyway.');
    }
    await supabase.from('property_images').delete().eq('id', photoId);
    setMainPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const onMainPhotoDragStart = (photoIdx: number) => { dragMainPhotoIdx.current = photoIdx; };
  const onMainPhotoDragOver = (e: React.DragEvent, photoIdx: number) => {
    e.preventDefault();
    dragOverMainPhotoIdx.current = photoIdx;
  };
  const onMainPhotoDrop = async () => {
    const from = dragMainPhotoIdx.current;
    const to = dragOverMainPhotoIdx.current;
    if (from === null || to === null || from === to) return;

    const reordered = [...mainPhotos];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
    setMainPhotos(updated);

    await Promise.all(updated.map(p =>
      supabase.from('property_images').update({ sort_order: p.sort_order }).eq('id', p.id)
    ));

    dragMainPhotoIdx.current = null;
    dragOverMainPhotoIdx.current = null;
  };

  // ── Section: add ──────────────────────────────────────────────────────────
  const commitAddSection = async () => {
    const title = newAreaTitle.trim();
    if (!title) return;
    const slug = slugify(title);
    const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('photo_sections')
      .insert({ property_id: propertyId, title, slug, sort_order: maxOrder })
      .select()
      .maybeSingle();
    if (!error && data) {
      setSections(prev => [...prev, { id: data.id, title: data.title, slug: data.slug, sort_order: data.sort_order, photos: [], features: [], collapsed: false }]);
      flash('Area added');
    }
    setNewAreaTitle('');
    setShowNewAreaInput(false);
  };

  // ── Section: rename ───────────────────────────────────────────────────────
  const renameSection = (sectionId: string, newTitle: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title: newTitle } : s));
  };

  const saveTitle = async (section: Section) => {
    await supabase.from('photo_sections').update({ title: section.title }).eq('id', section.id);
  };

  // ── Section: delete ───────────────────────────────────────────────────────
  const deleteSection = async (sectionId: string) => {
    if (!confirm('Delete this area and all its photos? This cannot be undone.')) return;
    await supabase.from('photo_sections').delete().eq('id', sectionId);
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  // ── Section: drag-reorder ─────────────────────────────────────────────────
  const onSectionDragStart = (idx: number) => { dragSectionIdx.current = idx; };
  const onSectionDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverSectionIdx.current = idx;
  };
  const onSectionDrop = async () => {
    const from = dragSectionIdx.current;
    const to = dragOverSectionIdx.current;
    if (from === null || to === null || from === to) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, sort_order: i + 1 }));
    setSections(updated);

    await Promise.all(updated.map(s =>
      supabase.from('photo_sections').update({ sort_order: s.sort_order }).eq('id', s.id)
    ));

    dragSectionIdx.current = null;
    dragOverSectionIdx.current = null;
  };

  // ── Photos: add ───────────────────────────────────────────────────────────
  const commitAddPhoto = async (sectionId: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const sec = sections.find(s => s.id === sectionId)!;
    const maxOrder = sec.photos.length > 0 ? Math.max(...sec.photos.map(p => p.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('property_images')
      .insert({ property_id: propertyId, section_id: sectionId, url: trimmed, storage_path: null, source: 'url', sort_order: maxOrder })
      .select('id,url,sort_order,section_id,storage_path')
      .maybeSingle();
    if (!error && data) {
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, photos: [...s.photos, { id: data.id, url: data.url, sort_order: data.sort_order, section_id: sectionId, storage_path: null }] }
          : s
      ));
      flash('Photo added');
    }
    setAddPhotoUrl('');
    setAddPhotoSectionId(null);
  };

  // ── Photos: delete ────────────────────────────────────────────────────────
  const deletePhoto = async (sectionId: string, photoId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    const photo = sec?.photos.find(p => p.id === photoId);
    if (photo?.storage_path) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
      if (error) flashErr('Storage file could not be removed — record deleted anyway.');
    }
    await supabase.from('property_images').delete().eq('id', photoId);
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, photos: s.photos.filter(p => p.id !== photoId) } : s
    ));
  };

  // ── Photos: drag-reorder ──────────────────────────────────────────────────
  const onPhotoDragStart = (sectionId: string, photoIdx: number) => {
    dragPhotoRef.current = { sectionId, photoIdx };
  };
  const onPhotoDragOver = (e: React.DragEvent, sectionId: string, photoIdx: number) => {
    e.preventDefault();
    dragOverPhotoRef.current = { sectionId, photoIdx };
  };
  const onPhotoDrop = async (targetSectionId: string) => {
    const from = dragPhotoRef.current;
    const to = dragOverPhotoRef.current;
    if (!from || !to) return;
    if (from.sectionId !== targetSectionId || to.sectionId !== targetSectionId) return;
    if (from.photoIdx === to.photoIdx) return;

    setSections(prev => prev.map(s => {
      if (s.id !== targetSectionId) return s;
      const photos = [...s.photos];
      const [moved] = photos.splice(from.photoIdx, 1);
      photos.splice(to.photoIdx, 0, moved);
      return { ...s, photos: photos.map((p, i) => ({ ...p, sort_order: i + 1 })) };
    }));

    const sec = sections.find(s => s.id === targetSectionId);
    if (sec) {
      const photos = [...sec.photos];
      const [moved] = photos.splice(from.photoIdx, 1);
      photos.splice(to.photoIdx, 0, moved);
      await Promise.all(photos.map((p, i) =>
        supabase.from('property_images').update({ sort_order: i + 1 }).eq('id', p.id)
      ));
    }

    dragPhotoRef.current = null;
    dragOverPhotoRef.current = null;
  };

  // ── Features ──────────────────────────────────────────────────────────────
  const [newFeature, setNewFeature] = useState<Record<string, string>>({});

  const addFeature = async (sectionId: string) => {
    const text = (newFeature[sectionId] ?? '').trim();
    if (!text) return;
    const sec = sections.find(s => s.id === sectionId)!;
    const maxOrder = sec.features.length > 0 ? Math.max(...sec.features.map(f => f.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('photo_section_features')
      .insert({ section_id: sectionId, feature: text, sort_order: maxOrder })
      .select()
      .maybeSingle();
    if (!error && data) {
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, features: [...s.features, { id: data.id, feature: data.feature, sort_order: data.sort_order }] }
          : s
      ));
      setNewFeature(prev => ({ ...prev, [sectionId]: '' }));
    }
  };

  const deleteFeature = async (sectionId: string, featureId: string) => {
    await supabase.from('photo_section_features').delete().eq('id', featureId);
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, features: s.features.filter(f => f.id !== featureId) } : s
    ));
  };

  const toggleCollapse = (sectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s));
  };

  if (loading) return <div className="py-8 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Hidden file input — shared for all upload triggers */}
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Photos</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage main page and photo tour photos. Drag to reorder.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {errMsg && <span className="text-sm text-red-600 font-medium">{errMsg}</span>}
          {msg && !errMsg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          {showNewAreaInput ? (
            <form
              className="flex items-center gap-2"
              onSubmit={e => { e.preventDefault(); commitAddSection(); }}
            >
              <input
                ref={newAreaInputRef}
                type="text"
                autoFocus
                placeholder="Area name (e.g. Hot Tub)"
                value={newAreaTitle}
                onChange={e => setNewAreaTitle(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && (setShowNewAreaInput(false), setNewAreaTitle(''))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400 w-52"
              />
              <button
                type="submit"
                className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setShowNewAreaInput(false); setNewAreaTitle(''); }}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-lg border border-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setShowNewAreaInput(true); setTimeout(() => newAreaInputRef.current?.focus(), 0); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Area
            </button>
          )}
        </div>
      </div>

      {/* ── Main Page section ─────────────────────────────────────────────── */}
      <div className="bg-white border-2 border-gray-900 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700">
          <div className="p-1 text-gray-400">
            <ImageIcon className="w-4 h-4 text-white" />
          </div>

          <div className="flex-1">
            <span className="font-semibold text-white text-sm">Main Page</span>
            <span className="ml-2 text-xs text-gray-400">Hero gallery shown on the property page</span>
          </div>

          <span className="text-xs text-gray-400 font-mono">
            {mainPhotos.length} photo{mainPhotos.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={() => setMainCollapsed(c => !c)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors rounded"
          >
            {mainCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!mainCollapsed && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos</span>
              <PhotoActions
                onUpload={() => triggerUpload(null)}
                onAddUrl={() => { setAddMainPhotoVisible(true); setTimeout(() => addPhotoInputRef.current?.focus(), 0); }}
                uploading={uploadingSection === null}
              />
            </div>

            <p className="text-xs text-gray-400 mb-2">Upload JPG, PNG, or WebP images up to 10MB.</p>

            {addMainPhotoVisible && (
              <form
                className="flex items-center gap-2 mb-3"
                onSubmit={e => { e.preventDefault(); addMainPhoto(addMainPhotoUrl); }}
              >
                <input
                  ref={addPhotoInputRef}
                  type="url"
                  autoFocus
                  placeholder="https://…"
                  value={addMainPhotoUrl}
                  onChange={e => setAddMainPhotoUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && (setAddMainPhotoVisible(false), setAddMainPhotoUrl(''))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400"
                />
                <button type="submit" className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setAddMainPhotoVisible(false); setAddMainPhotoUrl(''); }}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-lg border border-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            <PhotoGrid
              photos={mainPhotos}
              sectionId={null}
              onAdd={() => triggerUpload(null)}
              onDelete={deleteMainPhoto}
              onDragStart={onMainPhotoDragStart}
              onDragOver={onMainPhotoDragOver}
              onDrop={onMainPhotoDrop}
            />

            <p className="mt-3 text-xs text-gray-400">
              These photos appear in the hero gallery on the main property page. The first photo is used as the cover image.
            </p>
          </div>
        )}
      </div>

      {/* ── Photo tour areas ─────────────────────────────────────────────── */}
      <div className="pt-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Photo Tour Areas</h4>
        <div className="space-y-3">
          {sections.map((section, sIdx) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => onSectionDragStart(sIdx)}
              onDragOver={e => onSectionDragOver(e, sIdx)}
              onDrop={onSectionDrop}
              className="bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
            >
              {/* Section header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
                <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                  <GripVertical className="w-5 h-5" />
                </div>

                <input
                  type="text"
                  value={section.title}
                  onChange={e => renameSection(section.id, e.target.value)}
                  onBlur={() => saveTitle(section)}
                  onKeyDown={e => e.key === 'Enter' && saveTitle(section)}
                  className="flex-1 bg-transparent font-semibold text-gray-900 outline-none focus:bg-white focus:px-2 focus:py-0.5 focus:rounded focus:ring-2 focus:ring-pink-400 transition-all text-sm"
                />

                <span className="text-xs text-gray-400 font-mono">
                  {section.photos.length} photo{section.photos.length !== 1 ? 's' : ''}
                </span>

                <button
                  onClick={() => deleteSection(section.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                  title="Delete area"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleCollapse(section.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded"
                >
                  {section.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>

              {!section.collapsed && (
                <div className="p-4 space-y-5">
                  {/* Photos grid */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos</span>
                      <PhotoActions
                        onUpload={() => triggerUpload(section.id)}
                        onAddUrl={() => { setAddPhotoSectionId(section.id); setAddPhotoUrl(''); setTimeout(() => addPhotoInputRef.current?.focus(), 0); }}
                        uploading={uploadingSection === section.id}
                      />
                    </div>

                    <p className="text-xs text-gray-400 mb-2">Upload JPG, PNG, or WebP images up to 10MB.</p>

                    {addPhotoSectionId === section.id && (
                      <form
                        className="flex items-center gap-2 mb-3"
                        onSubmit={e => { e.preventDefault(); commitAddPhoto(section.id, addPhotoUrl); }}
                      >
                        <input
                          ref={addPhotoInputRef}
                          type="url"
                          autoFocus
                          placeholder="https://…"
                          value={addPhotoUrl}
                          onChange={e => setAddPhotoUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Escape' && (setAddPhotoSectionId(null), setAddPhotoUrl(''))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400"
                        />
                        <button type="submit" className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddPhotoSectionId(null); setAddPhotoUrl(''); }}
                          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg border border-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    )}

                    <PhotoGrid
                      photos={section.photos}
                      sectionId={section.id}
                      onAdd={() => triggerUpload(section.id)}
                      onDelete={photoId => deletePhoto(section.id, photoId)}
                      onDragStart={pIdx => onPhotoDragStart(section.id, pIdx)}
                      onDragOver={(e, pIdx) => onPhotoDragOver(e, section.id, pIdx)}
                      onDrop={() => onPhotoDrop(section.id)}
                    />
                  </div>

                  {/* Features */}
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Features / Amenities</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {section.features.map(feat => (
                        <span
                          key={feat.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                        >
                          {feat.feature}
                          <button
                            onClick={() => deleteFeature(section.id, feat.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      <form
                        onSubmit={e => { e.preventDefault(); addFeature(section.id); }}
                        className="inline-flex items-center gap-1"
                      >
                        <input
                          type="text"
                          placeholder="Add feature…"
                          value={newFeature[section.id] ?? ''}
                          onChange={e => setNewFeature(prev => ({ ...prev, [section.id]: e.target.value }))}
                          className="px-3 py-1 border border-dashed border-gray-300 rounded-full text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 bg-white w-36"
                        />
                        <button
                          type="submit"
                          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sections.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-xl">
              No photo tour areas yet. Click "Add Area" to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
