import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import HoldToDeleteButton from './HoldToDeleteButton';
import { usePlayerStore } from '../store/usePlayerStore';
import { 
  Play, 
  Pause,
  Heart, 
  MoreVertical, 
  Trash2, 
  Music,
  Clock,
  ChevronUp,
  ChevronDown,
  Pencil,
  Image as ImageIcon
} from 'lucide-react';
import EditHeroModal from './EditHeroModal';
import { HERO_BACKGROUNDS } from '../constants/heroBackgrounds';

const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://${encodeURIComponent(path)}`;
};

export default function SongList() {
  const {
    songs,
    customAlbums,
    activeView,
    selectedAlbumName,
    selectedAlbumId,
    selectedArtistName,
    searchQuery,
    activeTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleFavorite,
    setActiveView,
    setEditingSong,
    setEditingPlaylist,
    deleteSong,
    appSettings
  } = usePlayerStore();

  const [activeMenuSongId, setActiveMenuSongId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [isEditingHero, setIsEditingHero] = useState(false);
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveMenuSongId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  let rawSongsList = [];
  let viewTitle = 'All Songs';
  let viewSubtitle = 'Library';
  let viewArtwork = null;

  if (activeView === 'songs') {
    rawSongsList = songs;
    viewTitle = appSettings?.dashboard_title || 'Lets Start a ride';
    viewSubtitle = 'Library';
  } else if (activeView === 'favorites') {
    rawSongsList = songs.filter(s => s.favorite === 1);
    viewTitle = 'Favorites';
    viewSubtitle = 'Collection';
  } else if (activeView === 'album-detail') {
    const albumMatch = customAlbums.find(a => a.id === selectedAlbumId);
    if (albumMatch) {
      rawSongsList = albumMatch.songs || [];
      viewTitle = albumMatch.name;
    } else {
      rawSongsList = songs.filter(s => s.album === selectedAlbumName);
      viewTitle = selectedAlbumName || 'Unknown Playlist';
    }
    viewSubtitle = 'Playlist';
  }

  const firstWithArt = rawSongsList.find(s => s.has_artwork && s.artwork_path);
  // For album-detail, prefer the custom album's cover image
  const customAlbum = activeView === 'album-detail' && selectedAlbumId
    ? customAlbums.find(a => a.id === selectedAlbumId)
    : null;
    
  if (activeView === 'songs' && appSettings?.dashboard_cover_path) {
    viewArtwork = getMediaUrl(appSettings.dashboard_cover_path);
  } else if (customAlbum && customAlbum.cover_path) {
    viewArtwork = getMediaUrl(customAlbum.cover_path);
  } else if (firstWithArt) {
    viewArtwork = getMediaUrl(firstWithArt.artwork_path);
  }

  const totalPlaylistDuration = useMemo(() => rawSongsList.reduce((sum, s) => sum + (s.duration || 0), 0), [rawSongsList]);
  const totalMins = Math.floor(totalPlaylistDuration / 60);
  const totalSecs = Math.floor(totalPlaylistDuration % 60);
  const playlistStatsStr = `${rawSongsList.length} track${rawSongsList.length !== 1 ? 's' : ''} • ${totalMins}m ${totalSecs}s`;

  const filtered = useMemo(() => rawSongsList.filter(song => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (song.title || '').toLowerCase().includes(query) ||
      (song.artist || '').toLowerCase().includes(query) ||
      (song.album || '').toLowerCase().includes(query)
    );
  }), [rawSongsList, searchQuery]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedSongs = useMemo(() => [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      valA = valA || 0;
      valB = valB || 0;
      return sortAsc ? valA - valB : valB - valA;
    }
  }), [filtered, sortField, sortAsc]);

  const handleRowClick = (song) => {
    if (activeTrack && activeTrack.id === song.id) {
      togglePlay();
    } else {
      playTrack(song, rawSongsList, activeView === 'album-detail' ? selectedAlbumId : undefined);
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp size={12} className="inline ml-1 text-white" />
    ) : (
      <ChevronDown size={12} className="inline ml-1 text-white" />
    );
  };

  const isCurrentViewPlaying = isPlaying && activeTrack && rawSongsList.some(s => s.id === activeTrack.id);

  const handlePlayList = () => {
    if (rawSongsList.length === 0) return;
    if (isCurrentViewPlaying) {
      togglePlay();
    } else {
      const resumeTrack = activeTrack && rawSongsList.find(s => s.id === activeTrack.id);
      playTrack(resumeTrack || rawSongsList[0], rawSongsList, activeView === 'album-detail' ? selectedAlbumId : undefined);
    }
  };

  // Determine active background styles for Dashboard Hero
  let heroBgClass = 'bg-[#1c1a26]/40';
  let showHeroGlow = true;
  if (activeView === 'songs' && appSettings?.dashboard_bg_id) {
    const matchedBg = HERO_BACKGROUNDS.find(bg => bg.id === appSettings.dashboard_bg_id);
    if (matchedBg) {
      heroBgClass = matchedBg.classes;
      showHeroGlow = matchedBg.showGlow;
    }
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in relative">
      {/* Merged Header Info Panel */}
      <div className={`relative w-full overflow-hidden rounded-3xl ${heroBgClass} backdrop-blur-2xl border border-white/10 shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-6 group transition-all duration-500`}>
        
        {/* Glow ambient background elements for 'songs' view */}
        {activeView === 'songs' && showHeroGlow && (
          <>
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none animate-pulse" />
          </>
        )}

        <div 
          onClick={handlePlayList}
          className="relative z-10 w-32 h-32 md:w-44 md:h-44 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden flex-shrink-0 group/art cursor-pointer"
        >
          {viewArtwork ? (
            <img src={viewArtwork} alt={viewTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover/art:scale-105" />
          ) : (
            <Music size={54} className="text-white" />
          )}
          {rawSongsList.length > 0 && (
            <div className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300 ${
              isCurrentViewPlaying ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'
            }`}>
              <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95">
                {isCurrentViewPlaying ? (
                  <Pause size={20} fill="currentColor" className="text-[#141416]" />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-1 text-[#141416]" />
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="relative z-10 flex flex-col justify-end text-left w-full md:w-auto mb-1">
          <span className="text-[10px] uppercase font-medium tracking-widest text-white/60">{viewSubtitle}</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight mt-1 mb-2 leading-tight line-clamp-2 break-words">{viewTitle}</h2>
          
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-gray-400 font-medium">{playlistStatsStr}</span>
            {rawSongsList.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handlePlayList}
                  className="flex items-center gap-2 bg-white text-[#141416] hover:bg-white/95 px-6 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  {isCurrentViewPlaying ? (
                    <>
                      <Pause size={12} fill="currentColor" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                {activeView === 'songs' && (
                  <button
                    onClick={() => setIsEditingHero(true)}
                    className="flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold border border-white/10 shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ImageIcon size={12} />
                    <span>Edit Banner</span>
                  </button>
                )}
                {activeView === 'album-detail' && selectedAlbumId && (
                  <button
                    onClick={() => setEditingPlaylist(customAlbum)}
                    className="flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold border border-white/10 shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <Pencil size={12} />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track List Table */}
      <div className="rounded-2xl border border-white/10 bg-white/2 backdrop-blur-md overflow-hidden">
        {sortedSongs.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500 font-medium">
            {activeView === 'favorites' && !searchQuery
              ? 'You have not liked any songs'
              : 'No tracks match your search filter.'}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm text-gray-400">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase font-medium tracking-widest text-gray-500">
                <th className="py-3.5 px-4 w-12 text-center"></th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('title')}>
                  Title {renderSortIndicator('title')}
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('artist')}>
                  Artist {renderSortIndicator('artist')}
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('album')}>
                  Playlist {renderSortIndicator('album')}
                </th>
                <th className="py-3.5 px-4 w-20 text-center cursor-pointer hover:text-white" onClick={() => handleSort('play_count')}>
                  Plays {renderSortIndicator('play_count')}
                </th>
                <th className="py-3.5 px-4 w-20 text-center cursor-pointer hover:text-white" onClick={() => handleSort('duration')}>
                  <Clock size={12} className="inline mr-1" />
                  {renderSortIndicator('duration')}
                </th>
                <th className="py-3.5 px-4 w-20 text-right"></th>
              </tr>
            </thead>
            <motion.tbody
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.03 } }
              }}
            >
              {sortedSongs.map((song, index) => {
                const isCurrent = activeTrack && activeTrack.id === song.id;
                const isCurrentPlaying = isCurrent && isPlaying;
                
                return (
                  <motion.tr 
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    key={song.id}
                    onDoubleClick={() => handleRowClick(song)}
                    className={`border-b border-white/2 hover:bg-white/5 transition-all cursor-pointer group ${
                      isCurrent ? 'bg-white/5 text-white' : ''
                    }`}
                  >
                    {/* Index or visualizer waves */}
                    <td className="py-3 px-4 font-display text-xs text-center text-gray-500 group-hover:text-white" onClick={(e) => { e.stopPropagation(); handleRowClick(song); }}>
                      {isCurrentPlaying ? (
                        <div className="flex gap-[2px] justify-center items-end h-3 w-4 mx-auto">
                          <span className="w-[2px] h-full bg-white animate-float"></span>
                          <span className="w-[2px] h-[60%] bg-white/80 animate-float [animation-delay:0.2s]"></span>
                          <span className="w-[2px] h-[80%] bg-white/60 animate-float [animation-delay:0.4s]"></span>
                        </div>
                      ) : (
                        <div className="relative w-4 h-4 mx-auto flex items-center justify-center">
                          {isCurrent ? (
                            <Play size={10} fill="currentColor" className="mx-auto" />
                          ) : (
                            <Play size={10} fill="currentColor" className="opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300 text-white mx-auto" />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {song.has_artwork && song.artwork_path ? (
                            <img 
                              src={getMediaUrl(song.artwork_path)}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music size={14} className="text-gray-500" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-white truncate max-w-[120px] md:max-w-[200px]">{song.title}</span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[120px] mt-0.5">{song.artist}</span>
                        </div>
                      </div>
                    </td>

                    {/* Artist */}
                    <td className="py-3 px-4 text-xs font-medium truncate max-w-[100px] md:max-w-[150px]">
                      {song.artist}
                    </td>

                    {/* Playlist */}
                    <td className="py-3 px-4 text-xs font-normal text-gray-300 truncate max-w-[100px] md:max-w-[150px]">
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveView('album-detail', { albumName: song.album });
                        }}
                        className="hover:underline hover:text-white"
                      >
                        {song.album}
                      </span>
                    </td>

                    {/* Plays */}
                    <td className="py-3 px-4 font-display text-xs text-center font-medium text-gray-400">
                      {song.play_count || 0}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-display text-xs text-center font-medium text-gray-400">
                      {formatDuration(song.duration)}
                    </td>

                    {/* Favorite & Context action dropdown */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        {activeView === 'favorites' && (
                          <button
                            onClick={() => handleRowClick(song)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                            title="Play"
                          >
                            {isCurrentPlaying ? <Music size={11} className="animate-pulse" /> : <Play size={11} fill="currentColor" />}
                          </button>
                        )}
                        <button 
                          onClick={() => toggleFavorite(song.id)}
                          className={`hover:scale-105 active:scale-95 transition-all ${
                            song.favorite ? 'text-white' : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          <Heart size={14} fill={song.favorite ? 'currentColor' : 'none'} />
                        </button>
                        
                        <HoldToDeleteButton onComplete={() => deleteSong(song.id)} />
                        
                        <div className="relative">
                          <button 
                            onClick={() => setActiveMenuSongId(activeMenuSongId === song.id ? null : song.id)}
                            className="text-gray-500 hover:text-white p-0.5 rounded-md hover:bg-white/5 transition-all"
                          >
                            <MoreVertical size={14} />
                          </button>
                          
                          {activeMenuSongId === song.id && (
                            <div 
                              ref={dropdownRef}
                              className="absolute right-0 bottom-full mb-1 bg-[#1a1a1f]/95 backdrop-blur-xl border border-white/15 rounded-2xl w-44 py-2 z-[300] shadow-2xl flex flex-col items-stretch text-left animate-fade-in"
                            >
                              {/* Edit track */}
                              <button
                                onClick={() => {
                                  setEditingSong(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="px-3.5 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-all text-left flex items-center gap-2"
                              >
                                <Pencil size={11} />
                                <span>Edit track info</span>
                              </button>

                              {/* Playlist option removed in favor of unified custom playlists */}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        )}
      </div>

      {isEditingHero && (
        <EditHeroModal onClose={() => setIsEditingHero(false)} />
      )}
    </div>
  );
}
