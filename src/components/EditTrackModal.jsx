import { useState, useEffect, useRef } from 'react';
import { X, Upload, Music, Check, Loader2 } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

export default function EditTrackModal({ song, onClose }) {
  const { updateSongMeta } = usePlayerStore();

  const [title, setTitle] = useState(song?.title || '');
  const [album, setAlbum] = useState(song?.album || '');
  const [artworkPath, setArtworkPath] = useState(song?.artwork_path || '');
  const [hasArtwork, setHasArtwork] = useState(!!song?.has_artwork);
  const [previewUrl, setPreviewUrl] = useState(
    song?.has_artwork && song?.artwork_path ? getMediaUrl(song.artwork_path) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const overlayRef = useRef(null);

  // Close on backdrop click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePickImage = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      if (window.electron) {
        const newPath = await window.electron.selectImageFile();
        if (newPath) {
          setArtworkPath(newPath);
          setHasArtwork(true);
          setPreviewUrl(getMediaUrl(newPath));
        }
      } else {
        // Browser fallback: use a file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0];
          if (file) {
            setPreviewUrl(URL.createObjectURL(file));
            setArtworkPath(file.name);
            setHasArtwork(true);
          }
        };
        input.click();
      }
    } finally {
      setPickingImage(false);
    }
  };

  const handleSave = async () => {
    if (!song || saving) return;
    setSaving(true);
    await updateSongMeta(song.id, {
      title: title.trim() || song.title,
      album: album.trim() || song.album,
      artwork_path: artworkPath,
      has_artwork: hasArtwork ? 1 : 0
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!song) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md mx-4 bg-[#141416]/90 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-6 flex flex-col gap-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-wide">Edit Track</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
          >
            <X size={14} />
          </button>
        </div>

        {/* Artwork picker */}
        <div className="flex gap-4 items-start">
          <button
            onClick={handlePickImage}
            disabled={pickingImage}
            className="relative w-24 h-24 rounded-2xl border border-white/15 bg-white/5 flex-shrink-0 overflow-hidden group/art hover:border-white/30 transition-all active:scale-95 cursor-pointer"
            title="Click to change cover art"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <Music size={28} />
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
              {pickingImage
                ? <Loader2 size={18} className="animate-spin" />
                : <Upload size={18} />
              }
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {pickingImage ? 'Opening…' : 'Change'}
              </span>
            </div>
          </button>

          {/* Fields */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                placeholder="Track title"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Playlist</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                placeholder="Playlist name"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`px-6 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
              saved 
                ? 'bg-white/10 border border-white/20 text-white backdrop-blur-md' 
                : 'bg-white text-[#141416] hover:bg-white/95 disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saved && <Check size={12} />}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
