import { useState, useEffect, useRef } from 'react';
import { X, Upload, Music, Check, Loader2, Search, Plus, Play } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

export default function CreateAlbumModal({ onClose }) {
  const { songs, createCustomAlbum, streamTrack } = usePlayerStore();

  const [name, setName] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [songSearch, setSongSearch] = useState('');
  const [ytResults, setYtResults] = useState([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
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

  useEffect(() => {
    if (!songSearch.trim()) {
      setYtResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingYt(true);
      try {
        if (window.electron && window.electron.ytSearch) {
          const results = await window.electron.ytSearch(`${songSearch} songs`);
          if (results) setYtResults(results);
        }
      } catch (err) {
        console.error("YT search failed", err);
      } finally {
        setIsSearchingYt(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [songSearch]);

  const localFiltered = songs.filter(s => {
    if (!songSearch.trim()) {
      return s.favorite === 1 || s.favorite === true;
    }
    const q = songSearch.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q);
  });

  const localIds = new Set(localFiltered.map(s => s.filepath?.replace('yt-stream://', '')).filter(Boolean));
  const uniqueYt = ytResults.filter(y => !localIds.has(y.videoId));
  const combinedSongs = [...localFiltered, ...uniqueYt];

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter a playlist name.'); return; }
    if (selectedIds.size === 0) { setError('Please select at least one song.'); return; }
    setError('');
    setSaving(true);
    
    const finalSongIds = [];
    for (const id of selectedIds) {
      if (typeof id === 'string') {
        const trackMeta = ytResults.find(y => y.videoId === id);
        if (trackMeta && window.electron) {
          try {
            const newDbSong = await window.electron.addStreamSongToDb(trackMeta);
            finalSongIds.push(newDbSong.id);
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        finalSongIds.push(id);
      }
    }

    await createCustomAlbum(name.trim(), coverPath, finalSongIds);
    if (usePlayerStore.getState().fetchLibrary) {
      usePlayerStore.getState().fetchLibrary();
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-xl animate-fade-in"
    >
      <div className="relative w-full max-w-lg mx-4 bg-[#1C1C1E] border border-white/10 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col max-h-[90vh] animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-base font-bold text-white tracking-wide">Create Playlist</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all active:scale-90">
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
              className="relative w-24 h-24 rounded-2xl border border-white/10 bg-white/5 flex-shrink-0 overflow-hidden group/art hover:border-white/20 transition-all active:scale-95 cursor-pointer"
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
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Playlist Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="e.g. Late Night Vibes"
                  className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-white/40">
                {selectedIds.size === 0 ? 'No songs selected yet' : `${selectedIds.size} song${selectedIds.size !== 1 ? 's' : ''} selected`}
              </p>
            </div>
          </div>

          {/* Song selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Select Songs</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-white/30 transition-colors">
              <Search size={12} className="text-white/40 flex-shrink-0" />
              <input
                type="text"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Filter songs…"
                className="bg-transparent border-none outline-none w-full text-xs text-white placeholder-white/40"
              />
            </div>

            <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
              {isSearchingYt ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Loader2 size={16} className="text-white/40 animate-spin" />
                  <p className="text-xs text-white/40">Searching...</p>
                </div>
              ) : combinedSongs.length === 0 ? (
                <p className="text-center py-6 text-xs text-white/40">{!songSearch.trim() ? 'No liked songs yet' : 'No songs found'}</p>
              ) : combinedSongs.map(song => {
                  const sId = song.id || song.videoId;
                  const checked = selectedIds.has(sId);
                  const coverImg = song.thumbnail || song.coverUrl || song.artwork_path;
                  return (
                    <button
                      key={sId}
                      onClick={() => toggleSong(sId)}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors text-left ${checked ? 'bg-white/10' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition-all duration-300 border border-white/10 backdrop-blur-md ${checked ? 'bg-white/40 text-white scale-100' : 'bg-white/10 text-white/30 hover:bg-white/20 hover:text-white scale-95'}`}>
                        {checked ? <Check size={12} strokeWidth={3} className="animate-in zoom-in duration-200" /> : <Plus size={12} className="animate-in zoom-in duration-200" />}
                      </div>
                      <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 relative group/cover">
                        {coverImg
                          ? <img src={getMediaUrl(coverImg)} alt={song.title} className="w-full h-full object-cover" />
                          : <Music size={11} className="text-white/40" />
                        }
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            streamTrack(song, combinedSongs);
                          }}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Play size={10} className="text-white ml-0.5" fill="currentColor" />
                        </button>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold truncate ${checked ? 'text-white' : 'text-white/70'}`}>{song.title}</span>
                        <span className="text-[10px] text-white/50 truncate">{song.artist}</span>
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
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-full text-xs font-bold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || saved}
            className={`px-6 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border ${
              saved ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' 
                : 'bg-white/10 border-white/10 text-white hover:bg-white/20 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Creating…' : saved ? 'Created!' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
