import { useState, useEffect, useRef } from 'react';
import { X, Upload, Music, Check, Loader2, Search, CheckSquare, Square } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

export default function CreateAlbumModal({ onClose }) {
  const { songs, createCustomAlbum } = usePlayerStore();

  const [name, setName] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [songSearch, setSongSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handlePickImage = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      if (window.electron) {
        const newPath = await window.electron.selectImageFile();
        if (newPath) { setCoverPath(newPath); setPreviewUrl(getMediaUrl(newPath)); }
      } else {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0];
          if (file) { setPreviewUrl(URL.createObjectURL(file)); setCoverPath(file.name); }
        };
        input.click();
      }
    } finally { setPickingImage(false); }
  };

  const toggleSong = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredSongs = songs.filter(s => {
    const q = songSearch.toLowerCase();
    return !q || (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter a playlist name.'); return; }
    if (selectedIds.size === 0) { setError('Please select at least one song.'); return; }
    setError('');
    setSaving(true);
    await createCustomAlbum(name.trim(), coverPath, [...selectedIds]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg mx-4 bg-[#141416]/95 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.75)] flex flex-col max-h-[90vh] animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-base font-bold text-white tracking-wide">Create Playlist</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto flex-1">

          {/* Cover + Name */}
          <div className="flex gap-4 items-start">
            {/* Artwork picker */}
            <button
              onClick={handlePickImage}
              disabled={pickingImage}
              className="relative w-24 h-24 rounded-2xl border border-white/15 bg-white/5 flex-shrink-0 overflow-hidden group/art hover:border-white/30 transition-all active:scale-95 cursor-pointer"
            >
              {previewUrl
                ? <img src={previewUrl} alt="Cover" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-1.5"><Upload size={20} /><span className="text-[9px] font-bold uppercase tracking-wider">Cover</span></div>
              }
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                {pickingImage ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                <span className="text-[9px] font-bold uppercase tracking-wider">{pickingImage ? 'Opening…' : 'Change'}</span>
              </div>
            </button>

            {/* Name */}
            <div className="flex-1 flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Playlist Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="e.g. Late Night Vibes"
                  className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-gray-500">
                {selectedIds.size === 0 ? 'No songs selected yet' : `${selectedIds.size} song${selectedIds.size !== 1 ? 's' : ''} selected`}
              </p>
            </div>
          </div>

          {/* Song selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Select Songs</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-white/25 transition-colors">
              <Search size={12} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Filter songs…"
                className="bg-transparent border-none outline-none w-full text-xs text-white placeholder-gray-600"
              />
            </div>

            <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-xl border border-white/8 bg-white/2">
              {filteredSongs.length === 0
                ? <p className="text-center py-6 text-xs text-gray-500">No songs found</p>
                : filteredSongs.map(song => {
                  const checked = selectedIds.has(song.id);
                  return (
                    <button
                      key={song.id}
                      onClick={() => toggleSong(song.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left ${checked ? 'bg-white/4' : ''}`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'text-white' : 'text-gray-600'}`}>
                        {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </div>
                      <div className="w-7 h-7 rounded-md bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {song.has_artwork && song.artwork_path
                          ? <img src={getMediaUrl(song.artwork_path)} alt={song.title} className="w-full h-full object-cover" />
                          : <Music size={11} className="text-gray-500" />
                        }
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold truncate ${checked ? 'text-white' : 'text-gray-300'}`}>{song.title}</span>
                        <span className="text-[10px] text-gray-500 truncate">{song.artist}</span>
                      </div>
                    </button>
                  );
                })
              }
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium -mt-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-white/8 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-full text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || saved}
            className={`px-6 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
              saved ? 'bg-white/10 border border-white/20 text-white backdrop-blur-md' 
                : 'bg-white text-[#141416] hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saved && <Check size={12} />}
            {saved ? 'Created!' : saving ? 'Creating…' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
