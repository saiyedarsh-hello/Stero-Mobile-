import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import Lenis from 'lenis';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import WindowControls from './components/WindowControls';
import MusicSection from './components/MusicSection';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Menu, FolderSearch, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import ColorWorker from './workers/colorWorker.js?worker&inline';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

const Visualizer = lazy(() => import('./components/Visualizer'));
const SongList = lazy(() => import('./components/SongList'));
const AlbumGrid = lazy(() => import('./components/AlbumGrid'));
const EditTrackModal = lazy(() => import('./components/EditTrackModal'));
const EditPlaylistModal = lazy(() => import('./components/EditPlaylistModal'));
// Global helper to initialize/resume the audio context inside user gestures
if (typeof window !== 'undefined') {
  window.ensureAetherAudioContext = () => {
    const audio = window.aetherAudioElement;
    if (!audio) {
      console.warn('ensureAetherAudioContext: window.aetherAudioElement not found');
      return null;
    }

    if (!window.aetherVisualizerData) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        window.aetherVisualizerData = {
          audioCtx,
          analyser
        };
        console.log('ensureAetherAudioContext: Created and connected AudioContext successfully.');
      } catch (err) {
        console.error('ensureAetherAudioContext: Failed to initialize AudioContext:', err);
      }
    }

    if (window.aetherVisualizerData && window.aetherVisualizerData.audioCtx) {
      const audioCtx = window.aetherVisualizerData.audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
          .then(() => console.log('ensureAetherAudioContext: Resumed AudioContext successfully.'))
          .catch((err) => console.warn('ensureAetherAudioContext: Failed to resume AudioContext:', err));
      }
    }

    return window.aetherVisualizerData;
  };
}

export default function App() {
  const {
    activeView,
    activeTrack,
    dominantColor,
    setDominantColor,
    searchQuery,
    setSearchQuery,
    fetchLibrary,
    setScanStatus,
    resyncFolder,
    scanFolder,
    scanStatus,
    editingSong,
    setEditingSong,
    editingPlaylist,
    setEditingPlaylist,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    muted,
    setMuted,
    togglePlay,
    historyIndex,
    viewHistory,
    goBackView,
    goForwardView,
    initDownloadListener
  } = usePlayerStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const scrollWrapperRef = useRef(null);
  const scrollContentRef = useRef(null);

  // Global dominant color extraction via Web Worker to prevent UI blocking
  const colorWorkerRef = useRef(null);
  

  useEffect(() => {
    try {
      colorWorkerRef.current = new ColorWorker();
    } catch (e) {
      console.warn('Failed to initialize inline ColorWorker, falling back to standard worker:', e);
      try {
        colorWorkerRef.current = new Worker(new URL('./workers/colorWorker.js', import.meta.url), { type: 'module' });
      } catch (err) {
        console.error('Failed to initialize standard ColorWorker:', err);
      }
    }
    return () => {
      colorWorkerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    const activeCover = activeTrack?.artwork_path || activeTrack?.coverUrl || activeTrack?.thumbnail;
    if (!activeTrack || !activeCover) {
      setDominantColor({ h: 260, s: 40, l: 8 });
      return;
    }

    const url = getMediaUrl(activeCover);
    if (colorWorkerRef.current) {
      colorWorkerRef.current.onmessage = (e) => {
        if (e.data.error) {
          console.error('Failed to extract dominant color in worker:', e.data.error);
          setDominantColor({ h: 260, s: 40, l: 8 });
        } else {
          setDominantColor(e.data);
        }
      };
      colorWorkerRef.current.postMessage({ url });
    }
  }, [activeTrack, setDominantColor]);

  // Initialize Lenis for premium smooth momentum scrolling
  useEffect(() => {
    if (!scrollWrapperRef.current || !scrollContentRef.current) return;

    const lenis = new Lenis({
      wrapper: scrollWrapperRef.current,
      content: scrollContentRef.current,
      lerp: 0.08,
      duration: 1.2,
      smoothWheel: true,
      wheelMultiplier: 1.2,
    });

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Global keyboard shortcuts for playback and volume controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent shortcut conflicts when focus is on text inputs/textareas
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevTrack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
        if (muted) setMuted(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
        if (muted) setMuted(false);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextTrack, prevTrack, volume, muted, setVolume, setMuted, togglePlay]);

  useEffect(() => {
    // Initial fetch of library data (songs and playlists)
    fetchLibrary();
    initDownloadListener();

    // Auto-resync the saved music folder on every app launch
    resyncFolder();

    if (!window.electron) return;

    // Register electron IPC listener for directory scans
    const unsubscribe = window.electron.onScanProgress((progress) => {
      setScanStatus(progress);

      // If completed, fetch the fresh list of songs
      if (progress.status === 'completed') {
        fetchLibrary();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchLibrary, setScanStatus, resyncFolder]);

  // Clear search query when changing views
  useEffect(() => {
    setSearchQuery('');
  }, [activeView, setSearchQuery]);

  // Determine active component in main view panel
  const renderActiveView = () => {
    switch (activeView) {
      case 'music':
        return <MusicSection />;
      case 'songs':
      case 'favorites':
      case 'playlist-detail':
      case 'album-detail':
        return <SongList />;
      case 'albums':
        return <AlbumGrid />;
      case 'visualizer':
        return <SongList />;
      default:
        return <SongList />;
    }
  };

  const getSearchPlaceholder = () => {
    if (activeView === 'albums') return 'Search playlists...';
    return 'Search songs, playlists...';
  };

  const appBgStyle = {
    backgroundColor: '#0B0D14', // Deep dark navy matching the design
  };

  // Live Search for YouTube Music View
  useEffect(() => {
    if (activeView !== 'music') return;
    
    if (!searchQuery.trim()) {
      usePlayerStore.getState().setYtSearchResults(null);
      usePlayerStore.getState().setYtArtistSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!window.electron) return;
        
        const [results, artistResults] = await Promise.all([
          window.electron.ytSearch(searchQuery),
          window.electron.ytSearchTrending(searchQuery, 'artist')
        ]);

        if (results && results.length > 0) {
          const mappedResults = results.map(r => ({
            videoId: r.videoId,
            title: r.title,
            artist: r.artist,
            album: r.album,
            coverUrl: r.thumbnail,
            duration: r.duration?.seconds || r.duration || r.length || 0
          }));
          usePlayerStore.getState().setYtSearchResults(mappedResults);
        } else {
          usePlayerStore.getState().setYtSearchResults([]);
        }

        if (artistResults && artistResults.length > 0) {
          usePlayerStore.getState().setYtArtistSearchResults(artistResults);
        } else {
          usePlayerStore.getState().setYtArtistSearchResults([]);
        }
      } catch (err) {
        console.error('Live search failed:', err);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, activeView]);

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter' && activeView === 'music') {
      const results = usePlayerStore.getState().ytSearchResults;
      if (results && results.length > 0) {
        usePlayerStore.getState().streamTrack(results[0], results);
      }
    }
  };

  return (
    <div className="h-screen w-screen text-white flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-1000 ease-in-out transform-gpu rounded-none border-none" style={appBgStyle}>
      {activeView !== 'visualizer' && (
        <>

          {/* Custom Window Controls */}
          <WindowControls />
        </>
      )}

      {/* Blurred Album Art Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out pointer-events-none opacity-40"
        style={{
          backgroundImage: (activeTrack?.artwork_path || activeTrack?.coverUrl || activeTrack?.thumbnail) ? `url("${getMediaUrl(activeTrack.artwork_path || activeTrack.coverUrl || activeTrack.thumbnail)}")` : 'none',
          filter: 'blur(120px) saturate(150%)',
          transform: 'scale(1.2)',
          zIndex: 0
        }}
      />

      {/* Upper Workspace Panel */}
      <div className="flex flex-1 w-full overflow-hidden relative z-10">

        {/* Collapsible Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
        />

        {/* Center Workspace */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-white/[0.02] backdrop-blur-[12px] transition-all duration-500`}>

          {/* Header Bar */}
          <header className="grid grid-cols-3 items-center pt-8 pb-4 pl-8 pr-[160px] border-b border-white/5 select-none flex-shrink-0 relative z-40">
            {/* Thin drag strip at the very top of the header for window dragging */}
            <div className="absolute top-0 left-0 right-0 h-6 window-drag" />
            {/* Left aligned: navigation controls */}
            <div className="flex items-center gap-6 justify-start">
              {/* Sidebar Expand Button (visible only when collapsed) */}
              {isSidebarCollapsed && (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 animate-fade-in"
                  title="Expand Sidebar"
                >
                  <Menu size={20} />
                </button>
              )}

              {/* Chevrons Navigation Indicators */}
              <div className="flex gap-1.5">
                <button
                  onClick={goBackView}
                  disabled={historyIndex <= 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${historyIndex > 0
                    ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer'
                    : 'bg-transparent text-gray-600 cursor-not-allowed'
                    }`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={goForwardView}
                  disabled={!viewHistory || historyIndex >= viewHistory.length - 1}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${viewHistory && historyIndex < viewHistory.length - 1
                    ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer'
                    : 'bg-transparent text-gray-600 cursor-not-allowed'
                    }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Center aligned: Search field */}
            <div className="flex justify-center">
              {activeView !== 'visualizer' && (
                <div className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-full px-6 py-2.5 w-[300px] xl:w-[400px] focus-within:!w-[550px] focus-within:border-white/30 focus-within:bg-white/[0.08] focus-within:shadow-[0_0_35px_rgba(168,85,247,0.15),0_0_15px_rgba(255,255,255,0.05)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-blur-xl">
                  <Search size={18} className="text-gray-400 group-focus-within:text-white transition-colors duration-300" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={getSearchPlaceholder()}
                    className="select-text bg-transparent border-none outline-none w-full text-white placeholder-white/30 text-sm tracking-wide"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right aligned: Resync button */}
            <div className="flex justify-end gap-3">
              {activeView === 'songs' && (
                <>
                  <button
                    onClick={scanFolder}
                    disabled={scanStatus.status === 'scanning' || scanStatus.status === 'started'}
                    title="Change Music Folder"
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 active:scale-95 ${scanStatus.status === 'scanning' || scanStatus.status === 'started'
                      ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25 hover:text-white shadow-sm'
                      }`}
                  >
                    <FolderSearch size={16} />
                  </button>

                  <button
                    id="resync-library-btn"
                    onClick={resyncFolder}
                    disabled={scanStatus.status === 'scanning' || scanStatus.status === 'started'}
                    title="Resync music library — scan folder for new files"
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 active:scale-95 ${scanStatus.status === 'scanning' || scanStatus.status === 'started'
                      ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25 hover:text-white shadow-sm'
                      }`}
                  >
                    <RefreshCw
                      size={16}
                      className={scanStatus.status === 'scanning' || scanStatus.status === 'started' ? 'animate-spin' : ''}
                    />
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Scrollable Main Content */}
          <main ref={scrollWrapperRef} className="flex-1 overflow-y-auto px-8 py-6 pb-36 relative z-10">
            <div ref={scrollContentRef} className="w-full min-h-full relative">
              <Suspense fallback={
                <div className="flex flex-col gap-10 w-full min-h-[50vh] animate-fade-in p-4 pt-2">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-48 h-6 bg-white/5 rounded animate-pulse" />
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
                        <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex gap-6 overflow-hidden">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={`skel-1-${i}`} className="flex flex-col gap-3 flex-shrink-0 w-44">
                          <div className="w-44 h-56 rounded-2xl bg-white/5 animate-pulse" />
                          <div className="flex flex-col gap-2 px-1">
                            <div className="w-3/4 h-4 bg-white/5 rounded animate-pulse" />
                            <div className="w-1/2 h-3 bg-white/5 rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <div className="flex items-center justify-between mb-4 mt-4">
                      <div className="w-32 h-6 bg-white/5 rounded animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`skel-2-${i}`} className="w-full h-16 bg-white/5 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  </section>
                </div>
              }>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full min-h-full"
                  >
                    {renderActiveView()}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </div>
          </main>
        </div>

      </div>

      {/* Canvas Realtime Visualizer Screen Overlay */}
      {activeView === 'visualizer' && (
        <Suspense fallback={null}>
          <Visualizer />
        </Suspense>
      )}

      {/* Bottom Gradient Mask to fill space behind the floating player */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-40 transition-colors duration-1000 ease-in-out"
        style={{
          background: dominantColor
            ? `linear-gradient(to top, hsl(${dominantColor.h}, ${dominantColor.s}%, ${Math.max(2, dominantColor.l - 8)}%) 0%, transparent 100%)`
            : 'linear-gradient(to top, #000 0%, transparent 100%)'
        }}
      />

      {/* Floating Capsule Player Controls */}
      <PlayerBar />

      {/* Global Edit Track Modal */}
      {editingSong && (
        <Suspense fallback={null}>
          <EditTrackModal
            song={editingSong}
            onClose={() => setEditingSong(null)}
          />
        </Suspense>
      )}

      {/* Global Edit Playlist Modal */}
      {editingPlaylist && (
        <Suspense fallback={null}>
          <EditPlaylistModal
            playlist={editingPlaylist}
            onClose={() => setEditingPlaylist(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
