import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import Lenis from 'lenis';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Menu, FolderSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://${encodeURIComponent(path)}`;
};

const Visualizer = lazy(() => import('./components/Visualizer'));
const SongList = lazy(() => import('./components/SongList'));
const AlbumGrid = lazy(() => import('./components/AlbumGrid'));
const DownloadsView = lazy(() => import('./components/DownloadsView'));
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
    playTrack,
    initDownloadListener
  } = usePlayerStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const scrollWrapperRef = useRef(null);
  const scrollContentRef = useRef(null);

  // Global dominant color extraction
  useEffect(() => {
    if (!activeTrack || !activeTrack.has_artwork || !activeTrack.artwork_path) {
      setDominantColor({ h: 260, s: 40, l: 8 });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getMediaUrl(activeTrack.artwork_path);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const imageData = ctx.getImageData(0, 0, 1, 1).data;
          const r = imageData[0];
          const g = imageData[1];
          const b = imageData[2];

          let rNorm = r / 255;
          let gNorm = g / 255;
          let bNorm = b / 255;
          const max = Math.max(rNorm, gNorm, bNorm);
          const min = Math.min(rNorm, gNorm, bNorm);
          let h = 0, s = 0, l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
              case gNorm: h = (bNorm - rNorm) / d + 2; break;
              case bNorm: h = (rNorm - gNorm) / d + 4; break;
            }
            h /= 6;
          }

          const hDeg = Math.round(h * 360);
          const sPct = Math.round(s * 100);

          // Clamp lightness and saturation for a nice dark background glow
          const lPct = Math.max(5, Math.min(25, Math.round(l * 100)));
          const sFinal = sPct < 8 ? 0 : Math.max(30, sPct);

          setDominantColor({ h: hDeg, s: sFinal, l: lPct });
        } else {
          setDominantColor({ h: 260, s: 40, l: 8 });
        }
      } catch (err) {
        console.error('Failed to extract dominant color:', err);
        setDominantColor({ h: 260, s: 40, l: 8 });
      }
    };

    img.onerror = () => {
      setDominantColor({ h: 260, s: 40, l: 8 });
    };
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

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
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

  // Determine active component in main view panel
  const renderActiveView = () => {
    switch (activeView) {
      case 'songs':
      case 'favorites':
      case 'playlist-detail':
      case 'album-detail':
        return <SongList />;
      case 'albums':
        return <AlbumGrid />;
      case 'downloads':
        return <DownloadsView />;
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
    backgroundColor: dominantColor ? `hsl(${dominantColor.h}, ${dominantColor.s}%, ${Math.max(2, dominantColor.l - 5)}%)` : '#000',
    backgroundImage: dominantColor ? `radial-gradient(circle at 50% 0%, hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l + 10}%, 0.4) 0%, transparent 60%)` : 'none'
  };

  return (
    <div className="h-screen w-screen text-white flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-1000 ease-in-out" style={appBgStyle}>
      {/* Absolute top drag region for window dragging (bypasses header click issues) */}
      <div className="fixed top-0 left-0 right-[160px] h-6 window-drag z-50 pointer-events-auto" />

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
                    placeholder={getSearchPlaceholder()}
                    className="select-text bg-transparent border-none outline-none w-full text-white placeholder-white/30 text-sm tracking-wide"
                  />
                </div>
              )}
            </div>

            {/* Right aligned: Resync button */}
            <div className="flex justify-end gap-3">
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
            </div>
          </header>

          {/* Scrollable Main Content */}
          <main ref={scrollWrapperRef} className="flex-1 overflow-y-auto px-8 py-6 pb-36 relative z-10">
            <div ref={scrollContentRef} className="w-full min-h-full relative">
              <Suspense fallback={<div className="flex items-center justify-center w-full h-full min-h-[50vh] text-white/30 text-sm tracking-widest uppercase font-bold animate-pulse">Loading View...</div>}>
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
      <Suspense fallback={null}>
        <Visualizer />
      </Suspense>

      {/* Bottom Gradient Mask to fill space behind the floating player */}
      <div
        className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none z-40 transition-colors duration-1000 ease-in-out"
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
