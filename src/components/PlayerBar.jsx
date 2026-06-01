import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Heart,
  Maximize2,
  Disc,
  Pencil
} from 'lucide-react';

const formatTime = (seconds) => {
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

const getClientX = (e) => {
  if (e.clientX !== undefined) return e.clientX;
  if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
  return 0;
};

export default function PlayerBar() {
  const {
    activeTrack,
    isPlaying,
    volume,
    muted,
    shuffle,
    repeatMode,
    activeView,
    songs,
    savedPosition,
    clearSavedPosition,
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    setMuted,
    setShuffle,
    cycleRepeatMode,
    toggleFavorite,
    setActiveView,
    setEditingSong,
    activePlaylistId
  } = usePlayerStore();

  const currentSong = activeTrack || {
    title: 'Not Playing',
    artist: 'Select a track to start listening',
    has_artwork: false,
    artwork_path: ''
  };

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const dragTimeRef = useRef(0);
  const lastFilepathRef = useRef('');
  const lastSaveRef = useRef(0); // timestamp of last session save

  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // Refs for direct DOM updates to bypass React re-rendering
  const timeTextRef = useRef(null);
  const progressBarFillRef = useRef(null);
  const progressThumbRef = useRef(null);
  const rafRef = useRef(null);

  // Handle active track change and play/pause synchronization
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (activeTrack) {
      const trackSrc = getMediaUrl(activeTrack.filepath);
      // Only change src if the track has actually changed
      if (lastFilepathRef.current !== activeTrack.filepath) {
        audioRef.current.src = trackSrc;
        // Explicitly reset current time when switching to a new track
        // (If there's a saved session position, handleLoadedMetadata will seek to it shortly after)
        audioRef.current.currentTime = 0;
        if (timeTextRef.current) timeTextRef.current.innerText = '0:00';
        if (progressBarFillRef.current) progressBarFillRef.current.style.width = '0%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '0%';
        lastFilepathRef.current = activeTrack.filepath;
      }
      
      if (isPlaying) {
        audioRef.current.play().catch((err) => console.warn(err));
      } else {
        audioRef.current.pause();
      }
    } else {
      audioRef.current.src = '';
      lastFilepathRef.current = '';
      setTimeout(() => {
        setDuration(0);
        if (timeTextRef.current) timeTextRef.current.innerText = '0:00';
        if (progressBarFillRef.current) progressBarFillRef.current.style.width = '0%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '0%';
      }, 0);
    }
  }, [activeTrack, isPlaying]);

  // Sync volume and mute state
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);

  // Persist current session to localStorage
  const saveSession = useCallback((currentTimeSec) => {
    // If we are currently restoring a session, do not overwrite it with 0
    if (usePlayerStore.getState().savedPosition > 0) return;

    const track = usePlayerStore.getState().activeTrack;
    if (!track) return;
    try {
      localStorage.setItem('stero-player-session', JSON.stringify({
        trackId: track.id,
        currentTime: currentTimeSec ?? (audioRef.current?.currentTime ?? 0),
        volume,
        muted,
        shuffle,
        repeatMode,
        isPlaying,
        activePlaylistId
      }));
    } catch (e) { /* quota errors — silently ignore */ }
  }, [volume, muted, shuffle, repeatMode, isPlaying, activePlaylistId]);

  // Save session whenever key playback state changes
  useEffect(() => {
    saveSession(audioRef.current?.currentTime ?? 0);
  }, [activeTrack, isPlaying, saveSession]);

  // Save session on window close / reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveSession(audioRef.current?.currentTime ?? 0);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveSession]);

  // Expose audio ref globally
  useEffect(() => {
    if (audioRef.current) {
      window.aetherAudioElement = audioRef.current;
    }
  }, []);

  // Fast path animation loop for progress bar
  useEffect(() => {
    const updateProgress = () => {
      if (audioRef.current && !isSeeking) {
        const ct = audioRef.current.currentTime;
        const dur = duration || audioRef.current.duration || 0;
        
        if (timeTextRef.current) {
          timeTextRef.current.innerText = formatTime(ct);
        }
        
        if (progressBarFillRef.current && dur > 0) {
          const percent = (ct / dur) * 100;
          progressBarFillRef.current.style.width = `${percent}%`;
          if (progressThumbRef.current) {
            progressThumbRef.current.style.left = `${percent}%`;
          }
        }
        
        // Save session logic (throttled to 5 seconds)
        const now = Date.now();
        if (now - lastSaveRef.current > 5000 && activeTrack) {
          lastSaveRef.current = now;
          saveSession(ct);
        }
      }
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress);
    } else {
      // Run once when paused to sync
      updateProgress();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, isSeeking, duration, activeTrack, saveSession]);

  const handleTimeUpdate = () => {
    // Left empty, updates are handled by requestAnimationFrame now
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || activeTrack?.duration || 0);
      // Seek to saved position after restore
      if (savedPosition && savedPosition > 0) {
        audioRef.current.currentTime = savedPosition;
        clearSavedPosition();
      }
    }
  };

  const handleEnded = () => {
    const state = usePlayerStore.getState();
    const { repeatMode, decrementRepeatMode, nextTrack } = state;
    
    if (repeatMode > 0) {
      decrementRepeatMode();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.error(err));
      }
    } else {
      nextTrack();
    }
  };

  // --- Smooth Drag-to-Seek Logic ---
  const updateSeekPosition = (clientX, updateAudio = false) => {
    const dur = duration || audioRef.current?.duration || 0;
    if (!progressBarRef.current || !dur) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = percentage * dur;
    
    if (timeTextRef.current) timeTextRef.current.innerText = formatTime(newTime);
    if (progressBarFillRef.current) progressBarFillRef.current.style.width = `${percentage * 100}%`;
    if (progressThumbRef.current) progressThumbRef.current.style.left = `${percentage * 100}%`;
    
    dragTimeRef.current = newTime;
    
    if (updateAudio && audioRef.current && !isNaN(newTime)) {
      try {
        audioRef.current.currentTime = newTime;
      } catch (err) {
        console.warn('Seek error:', err);
      }
    }
  };

  const handleSeekMouseDown = (e) => {
    const dur = duration || audioRef.current?.duration || 0;
    if (!audioRef.current || !dur) return;
    e.preventDefault();
    setIsSeeking(true);
    
    const clientX = getClientX(e);
    updateSeekPosition(clientX, true); // Seek immediately on click

    const handleMouseMove = (moveEvent) => {
      updateSeekPosition(getClientX(moveEvent), true); // Continuous seek
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      
      try {
        if (audioRef.current && !isNaN(dragTimeRef.current)) {
          audioRef.current.currentTime = dragTimeRef.current;
        }
      } catch (err) {
        console.warn('Seek error on mouse up:', err);
      } finally {
        setIsSeeking(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: true });
    document.addEventListener('touchend', handleMouseUp, { passive: true });
  };

  // --- Smooth Drag-to-Volume Logic ---
  const updateVolumePosition = (clientX) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    const vol = Math.max(0, Math.min(1, clickX / width));
    setVolume(vol);
    if (muted) setMuted(false);
  };

  const handleVolumeMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    
    const clientX = getClientX(e);
    updateVolumePosition(clientX);

    const handleMouseMove = (moveEvent) => {
      updateVolumePosition(getClientX(moveEvent));
    };

    const handleMouseUp = () => {
      setIsDraggingVolume(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: true });
    document.addEventListener('touchend', handleMouseUp, { passive: true });
  };



  const toggleVisualizer = () => {
    if (activeView === 'visualizer') {
      setActiveView('dashboard');
    } else {
      setActiveView('visualizer');
      // Create/Resume AudioContext inside the user gesture stack
      if (window.ensureAetherAudioContext) {
        window.ensureAetherAudioContext();
      }
    }
  };

  const progressPercent = 0; // Updated exclusively by requestAnimationFrame

  return (
    <div className={`w-full bg-[#141416]/40 backdrop-blur-3xl border-t border-white/10 px-8 py-4.5 flex items-center justify-between gap-6 z-50 select-none relative flex-shrink-0 transition-all duration-500 ease-in-out ${
      activeView === 'visualizer' ? 'absolute -left-[9999px] top-0 w-1 h-1 opacity-10 pointer-events-none' : 'translate-y-0'
    }`}>
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Left section: Artwork + Song info + Favorite */}
      <div className="flex items-center gap-4 w-1/4 min-w-[220px]">
        <div 
          onClick={toggleVisualizer}
          className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex-shrink-0 cursor-pointer overflow-hidden relative group/art"
          title="Toggle Canvas Visualizer"
        >
          {currentSong.has_artwork && currentSong.artwork_path ? (
            <img 
              src={getMediaUrl(currentSong.artwork_path)}
              alt={currentSong.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/art:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <Disc size={20} />
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white truncate max-w-[150px]">{currentSong.title}</span>
          <span className="text-xs text-gray-400 truncate max-w-[150px] mt-0.5">{currentSong.artist}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 ml-2 flex-shrink-0">
          <button 
            onClick={() => activeTrack && toggleFavorite(activeTrack.id)}
            disabled={!activeTrack}
            className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 hover:scale-105 active:scale-95 transition-all ${
              activeTrack?.favorite ? 'text-white' : 'text-gray-400 hover:text-white'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Favorite"
          >
            <Heart size={15} fill={activeTrack?.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingSong(activeTrack); }}
            disabled={!activeTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Edit track info"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {/* Center section: Playback controls + Seek timeline */}
      <div className="flex-1 max-w-xl flex flex-col items-center gap-2">
        {/* Playback buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShuffle(!shuffle)}
            className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-all ${
              shuffle ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle size={14} />
          </button>

          <button
            onClick={prevTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-gray-300 hover:text-white transition-all active:scale-90"
            disabled={songs.length === 0}
            title="Previous"
          >
            <SkipBack size={16} fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white text-[#141416] hover:bg-gray-150 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-gray-300 hover:text-white transition-all active:scale-90"
            disabled={songs.length === 0}
            title="Next"
          >
            <SkipForward size={16} fill="currentColor" />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-all relative ${
              repeatMode > 0 ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Repeat"
          >
            <Repeat size={14} />
            {repeatMode > 0 && (
              <span className="absolute -bottom-1 -right-1 text-[8px] font-extrabold text-white bg-[#141416] rounded-full w-3 h-3 flex items-center justify-center border border-white/10">
                {repeatMode}
              </span>
            )}
          </button>
        </div>

        {/* Timeline Seek bar */}
        <div className="flex items-center gap-3 w-full">
          <span ref={timeTextRef} className="font-display text-[10px] text-gray-500 font-bold w-8 text-left">0:00</span>
          <div 
            ref={progressBarRef}
            onMouseDown={handleSeekMouseDown}
            onTouchStart={handleSeekMouseDown}
            className="flex-1 h-6 flex items-center cursor-pointer group/seek"
          >
            <div className="w-full h-1 bg-white/10 group-hover/seek:bg-white/20 transition-colors rounded-full relative">
              <div 
                ref={progressBarFillRef}
                className="h-full bg-white/85 rounded-full absolute top-0 left-0"
              />
              <div 
                ref={progressThumbRef}
                className={`w-2.5 h-2.5 rounded-full bg-white shadow-md absolute top-1/2 transition-all duration-150 ${
                  isSeeking ? 'opacity-100 scale-110' : 'opacity-0 group-hover/seek:opacity-100'
                }`}
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
          <span className="font-display text-[10px] text-gray-500 font-bold w-8 text-right">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right section: Volume + Visualizer Toggle */}
      <div className="w-1/4 min-w-[220px] flex items-center justify-end gap-4">
        <button 
          onClick={toggleVisualizer}
          className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 hover:scale-105 active:scale-95 transition-all ${
            activeView === 'visualizer' ? 'text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Canvas Visualizer"
        >
          <Maximize2 size={15} />
        </button>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setMuted(!muted)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <div 
            ref={volumeBarRef}
            onMouseDown={handleVolumeMouseDown}
            onTouchStart={handleVolumeMouseDown}
            className="w-20 h-6 flex items-center cursor-pointer group/vol"
          >
            <div className="w-full h-1 bg-white/10 group-hover/vol:bg-white/20 transition-colors rounded-full relative">
              <div 
                className="h-full bg-white/80 rounded-full absolute top-0 left-0"
                style={{ width: `${muted ? 0 : volume * 100}%` }}
              />
              <div 
                className={`w-2.5 h-2.5 rounded-full bg-white shadow-md absolute top-1/2 transition-all duration-150 ${
                  isDraggingVolume ? 'opacity-100 scale-110' : 'opacity-0 group-hover/vol:opacity-100'
                }`}
                style={{ left: `${muted ? 0 : volume * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
