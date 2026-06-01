import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import Lenis from 'lenis';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Menu, FolderSearch } from 'lucide-react';

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

  return (
    <div className="h-screen w-screen bg-[#000000] text-white flex flex-col justify-between overflow-hidden relative select-none font-sans">
      {/* Absolute top drag region for window dragging (bypasses header click issues) */}
      <div className="fixed top-0 left-0 right-[160px] h-6 window-drag z-50 pointer-events-auto" />

      {/* Background Liquid Glass Glow Blobs */}
      {activeView !== 'visualizer' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-700/15 blur-[130px] animate-liquid-1" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-cyan-700/10 blur-[150px] animate-liquid-2" />
          <div className="absolute top-[20%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-[#ec2e49]/5 blur-[140px] animate-liquid-3" />
          <div className="absolute bottom-[-20%] left-[10%] w-[55vw] h-[55vw] rounded-full bg-indigo-700/15 blur-[160px] animate-liquid-1" style={{ animationDelay: '-12s' }} />
        </div>
      )}

      {/* Upper Workspace Panel */}
      <div className="flex flex-1 w-full overflow-hidden relative z-10">
        
        {/* Collapsible Sidebar */}
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => setIsSidebarCollapsed(true)} 
        />

        {/* Center Workspace */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-white/[0.02] backdrop-blur-[12px] border border-white/8 shadow-[15px_15px_40px_rgba(0,0,0,0.3)] rounded-2xl my-4 mr-4 transition-all duration-500 will-change-[margin] ${isSidebarCollapsed ? 'ml-4' : 'ml-2'}`}>
          
          {/* Header Bar */}
          <header className="grid grid-cols-3 items-center py-4 pl-8 pr-[160px] border-b border-white/5 select-none flex-shrink-0 relative z-40">
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    historyIndex > 0 
                      ? 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer' 
                      : 'bg-transparent text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={goForwardView}
                  disabled={!viewHistory || historyIndex >= viewHistory.length - 1}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    viewHistory && historyIndex < viewHistory.length - 1 
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
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 w-64 focus-within:w-80 focus-within:border-white/20 transition-all shadow-inner">
                  <Search size={13} className="text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={getSearchPlaceholder()}
                    className="select-text bg-transparent border-none outline-none w-full text-white placeholder-gray-500 text-xs"
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
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 active:scale-95 ${
                  scanStatus.status === 'scanning' || scanStatus.status === 'started'
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25 hover:text-white shadow-sm'
                }`}
              >
                <FolderSearch size={13} />
                <span>Change Folder</span>
              </button>

              <button
                id="resync-library-btn"
                onClick={resyncFolder}
                disabled={scanStatus.status === 'scanning' || scanStatus.status === 'started'}
                title="Resync music library — scan folder for new files"
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 active:scale-95 ${
                  scanStatus.status === 'scanning' || scanStatus.status === 'started'
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25 hover:text-white shadow-sm'
                }`}
              >
                <RefreshCw
                  size={13}
                  className={scanStatus.status === 'scanning' || scanStatus.status === 'started' ? 'animate-spin' : ''}
                />
                <span>{
                  scanStatus.status === 'scanning' || scanStatus.status === 'started'
                    ? `Syncing… ${scanStatus.total > 0 ? `${scanStatus.current}/${scanStatus.total}` : ''}`
                    : 'Resync'
                }</span>
              </button>
            </div>
          </header>

          {/* Scrollable Main Content */}
          <main ref={scrollWrapperRef} className="flex-1 overflow-y-auto px-8 py-6 pb-12">
            <div ref={scrollContentRef} className="w-full min-h-full">
              <Suspense fallback={<div className="flex items-center justify-center w-full h-full min-h-[50vh] text-white/30 text-sm tracking-widest uppercase font-bold animate-pulse">Loading View...</div>}>
                {renderActiveView()}
              </Suspense>
            </div>
          </main>
        </div>

      </div>

      {/* Canvas Realtime Visualizer Screen Overlay */}
      <Suspense fallback={null}>
        <Visualizer />
      </Suspense>

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
