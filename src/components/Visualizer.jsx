import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { 
  X, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Music, 
  Heart, 
  ListMusic, 
  ChevronLeft,
  ChevronRight,
  Disc
} from 'lucide-react';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://${encodeURIComponent(path)}`;
};

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};



export default function Visualizer() {
  const { 
    activeTrack, 
    activeView, 
    setActiveView,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    muted,
    setMuted,
    queue,
    activePlaylistId,
    customAlbums,
    playTrack,
    toggleFavorite,
    songs: storeSongs
  } = usePlayerStore();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const dominantColorRef = useRef({ h: 0, s: 0, l: 100 });
  const currentCanvasColorRef = useRef({ h: 0, s: 0, l: 100 });

  const visualizerMode = 'bars';
  
  const timeTextRef = useRef(null);
  const progressBarFillRef = useRef(null);

  const [duration, setDuration] = useState(() => {
    const audio = window.aetherAudioElement;
    return audio ? (audio.duration || activeTrack?.duration || 0) : 0;
  });

  const [isSeeking, setIsSeeking] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);

  const isActive = activeView === 'visualizer';

  // Determine current scope songs (scope of playlist vs queue vs all songs)
  let scopeSongs = queue && queue.length > 0 ? queue : storeSongs;
  let playlistName = "Queue";
  
  if (activePlaylistId) {
    const playlist = customAlbums.find(a => a.id === activePlaylistId);
    if (playlist) {
      scopeSongs = playlist.songs || [];
      playlistName = playlist.name;
    }
  }

  // Active track index in current scope
  let activeIndex = scopeSongs.findIndex(s => s.id === activeTrack?.id);
  if (activeIndex === -1 && activeTrack) {
    // Safety fallback: if activeTrack is not in scopeSongs, force it into scope
    scopeSongs = [activeTrack];
    activeIndex = 0;
  }

  // Extract dominant color of the active track's cover art
  useEffect(() => {
    if (!activeTrack || !activeTrack.has_artwork || !activeTrack.artwork_path) {
      dominantColorRef.current = { h: 0, s: 0, l: 100 };
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
          
          // Clamp lightness to be between 65% and 85% so it's always bright and visible
          const lPct = Math.max(65, Math.min(85, Math.round(l * 100)));
          // Clamp saturation to be at least 50% so it has some color, unless it was originally very grey/white
          const sFinal = sPct < 8 ? 0 : Math.max(55, sPct);

          dominantColorRef.current = { h: hDeg, s: sFinal, l: lPct };
        } else {
          dominantColorRef.current = { h: 0, s: 0, l: 100 };
        }
      } catch (err) {
        console.error('Failed to extract dominant color:', err);
        dominantColorRef.current = { h: 0, s: 0, l: 100 };
      }
    };

    img.onerror = () => {
      dominantColorRef.current = { h: 0, s: 0, l: 100 };
    };
  }, [activeTrack]);

  // Hook up event listeners to sync time & seek details from global audio element
  useEffect(() => {
    const audio = window.aetherAudioElement;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeeking && timeTextRef.current && progressBarFillRef.current && duration > 0) {
        timeTextRef.current.innerText = formatTime(audio.currentTime);
        progressBarFillRef.current.style.width = `${(audio.currentTime / duration) * 100}%`;
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || activeTrack?.duration || 0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleDurationChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
    };
  }, [activeTrack, isSeeking, duration]);

  // Canvas Realtime frequencies visualizer loop
  useEffect(() => {
    if (activeView !== 'visualizer' || !window.aetherAudioElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const pixelRatio = Math.min(1.2, window.devicePixelRatio || 1);
      canvas.width = (rect?.width || 800) * pixelRatio;
      canvas.height = (rect?.height || 500) * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize Web Audio API Analyser once
    let data = window.aetherVisualizerData;
    if (!data && window.ensureAetherAudioContext) {
      data = window.ensureAetherAudioContext();
    }

    if (!data) {
      console.warn('Failed to obtain aetherVisualizerData');
      return;
    }

    const analyser = data.analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCaps = new Array(bufferLength).fill(0);

    const draw = () => {
      if (!canvasRef.current) return;
      const currentPixelRatio = Math.min(1.2, window.devicePixelRatio || 1);
      const w = canvas.width / currentPixelRatio;
      const h = canvas.height / currentPixelRatio;

      animationRef.current = requestAnimationFrame(draw);

      if (visualizerMode === 'bars') {
        analyser.getByteFrequencyData(dataArray);

        // Blends canvas drawing with liquid glass base colors
        ctx.fillStyle = 'rgba(7, 5, 13, 0.18)';
        ctx.fillRect(0, 0, w, h);

        const numBars = Math.floor(bufferLength / 2);
        const barWidth = w / (numBars * 2);
        const centerX = w / 2;

        const color = dominantColorRef.current || { h: 0, s: 0, l: 100 };

        // Precompute master gradient for performance (avoids recreating 7600 gradients/sec)
        const masterGrad = ctx.createLinearGradient(0, h, 0, h - (h * 0.75));
        masterGrad.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.2)`);
        masterGrad.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.75)`);
        masterGrad.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 1.0)`);

        for (let i = 0; i < numBars; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * (h * 0.75);

          const xRight = centerX + i * barWidth;
          const xLeft = centerX - (i + 1) * barWidth;
          
          ctx.fillStyle = masterGrad;
          ctx.fillRect(xRight, h - barHeight, barWidth - 3, barHeight);
          ctx.fillRect(xLeft, h - barHeight, barWidth - 3, barHeight);

          if (dataArray[i] > barCaps[i]) {
            barCaps[i] = dataArray[i];
          } else {
            barCaps[i] = Math.max(0, barCaps[i] - 1.5);
          }

          const capY = h - (barCaps[i] / 255) * (h * 0.75) - 6;
          
          ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 1.0)`;
          
          // Note: shadowBlur removed for performance optimization
          ctx.fillRect(xRight, Math.max(0, capY), barWidth - 3, 3);
          ctx.fillRect(xLeft, Math.max(0, capY), barWidth - 3, 3);
        }
      } 
      else if (visualizerMode === 'wave') {
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(7, 5, 13, 0.22)';
        ctx.fillRect(0, 0, w, h);

        const color = dominantColorRef.current || { h: 0, s: 0, l: 100 };

        ctx.lineWidth = 3;
        ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 1.0)`;
        ctx.beginPath();

        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(w, h / 2);
        ctx.stroke();

        const targetColor = dominantColorRef.current || { h: 0, s: 0, l: 100 };
        const curr = currentCanvasColorRef.current;
        
        // Smooth color interpolation
        curr.h += (targetColor.h - curr.h) * 0.03;
        curr.s += (targetColor.s - curr.s) * 0.03;
        curr.l += (targetColor.l - curr.l) * 0.03;

        // Thin glow line
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2 + 6;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } 
      else if (visualizerMode === 'pulsar') {
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = 'rgba(7, 5, 13, 0.25)';
        ctx.fillRect(0, 0, w, h);

        const centerX = w / 2;
        const centerY = h / 2;
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const pulseRadius = 70 + (avg / 255) * 45;

        const targetColor = dominantColorRef.current || { h: 0, s: 0, l: 100 };
        const curr = currentCanvasColorRef.current;
        
        // Smooth color interpolation
        curr.h += (targetColor.h - curr.h) * 0.03;
        curr.s += (targetColor.s - curr.s) * 0.03;
        curr.l += (targetColor.l - curr.l) * 0.03;

        const color = curr;

        // Radial glowing aura
        const radGrad = ctx.createRadialGradient(centerX, centerY, pulseRadius * 0.2, centerX, centerY, pulseRadius);
        radGrad.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.6)`);
        radGrad.addColorStop(0.6, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.15)`);
        radGrad.addColorStop(1, 'rgba(7, 5, 13, 0)');
        
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        const numRays = bufferLength;

        for (let i = 0; i < numRays; i++) {
          const angle = (i / numRays) * Math.PI * 2;
          const percent = dataArray[i] / 255;
          const rayLen = percent * 130;

          const startX = centerX + Math.cos(angle) * pulseRadius;
          const startY = centerY + Math.sin(angle) * pulseRadius;
          const endX = centerX + Math.cos(angle) * (pulseRadius + rayLen);
          const endY = centerY + Math.sin(angle) * (pulseRadius + rayLen);

          ctx.strokeStyle = i % 2 === 0 ? `hsla(${color.h}, ${color.s}%, ${color.l}%, 1.0)` : '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [activeView, visualizerMode]);

  // Handle Close
  const handleClose = () => {
    setActiveView('songs');
  };

  // Resume AudioContext
  const resumeAudioContext = () => {
    if (window.ensureAetherAudioContext) {
      window.ensureAetherAudioContext();
    }
  };

  // Click card handler (seek to card song, play, or toggle)
  const handleCardClick = (song, offset) => {
    if (window.ensureAetherAudioContext) {
      window.ensureAetherAudioContext();
    }
    if (offset === 0) {
      togglePlay();
    } else {
      playTrack(song, scopeSongs, activePlaylistId);
    }
  };

  // Drag-to-Seek Calculations
  const updateSeek = (clientX) => {
    const audio = window.aetherAudioElement;
    if (!audio || !duration || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    if (timeTextRef.current) timeTextRef.current.innerText = formatTime(newTime);
    if (progressBarFillRef.current) progressBarFillRef.current.style.width = `${percentage * 100}%`;
    audio.currentTime = newTime;
  };

  const handleSeekMouseDown = (e) => {
    e.preventDefault();
    setIsSeeking(true);
    updateSeek(e.clientX);

    const handleMouseMove = (moveEvent) => {
      updateSeek(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsSeeking(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag-to-Volume Calculations
  const updateVolume = (clientX) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(percentage);
    if (muted) setMuted(false);
  };

  const handleVolumeMouseDown = (e) => {
    e.preventDefault();
    updateVolume(e.clientX);

    const handleMouseMove = (moveEvent) => {
      updateVolume(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Render SELECT PLAYLIST landing state if there's no track playing or scope is empty
  if (!activeTrack || scopeSongs.length === 0) {
    return (
      <div 
        onClick={resumeAudioContext} 
        className={`absolute inset-0 bg-[#07050d] z-50 flex flex-col justify-between select-none overflow-hidden font-sans transition-all duration-500 ease-in-out ${
          isActive 
            ? 'opacity-100 pointer-events-auto scale-100' 
            : 'opacity-0 pointer-events-none scale-98'
        }`}
      >
        
        {/* Liquid Glass Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-purple-700/10 blur-[130px] animate-liquid-1" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-700/8 blur-[150px] animate-liquid-2" />
          <div className="absolute top-[25%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-indigo-700/10 blur-[140px] animate-liquid-3" />
          <div className="absolute bottom-[-10%] left-[10%] w-[55vw] h-[55vw] rounded-full bg-purple-700/8 blur-[160px] animate-liquid-1" style={{ animationDelay: '-12s' }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(7,5,13,0.7)_90%)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-end p-6 pr-[160px] z-10 flex-shrink-0">
          <button 
            onClick={handleClose} 
            className="text-gray-300 border border-white/10 hover:border-white/20 hover:text-white px-4 py-1.5 rounded-full text-xs bg-white/5 flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <X size={14} />
            <span>Close</span>
          </button>
        </div>

        {/* Playlist Selector Grid */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 z-10 max-w-4xl mx-auto w-full relative">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">No active song</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">Please choose a playlist to begin playing and visualize its tracks in 3D.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 w-full max-h-[55vh] overflow-y-auto pr-2 pb-6">
            {customAlbums && customAlbums.length > 0 ? (
              customAlbums.map(playlist => (
                <div 
                  key={playlist.id}
                  onClick={() => {
                    if (window.ensureAetherAudioContext) window.ensureAetherAudioContext();
                    if (playlist.songs && playlist.songs.length > 0) {
                      playTrack(playlist.songs[0], playlist.songs, playlist.id);
                    }
                  }}
                  className="bg-white/3 border border-white/10 hover:border-white/25 hover:bg-white/8 backdrop-blur-xl rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-lg group relative"
                >
                  <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center mb-4 overflow-hidden border border-white/5 relative">
                    {playlist.cover_path ? (
                      <img src={getMediaUrl(playlist.cover_path)} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : playlist.songs && playlist.songs[0]?.has_artwork ? (
                      <img src={getMediaUrl(playlist.songs[0].artwork_path)} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music size={32} className="text-white/20" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play size={24} className="text-white fill-white" />
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-white tracking-wide truncate max-w-full">{playlist.name}</h4>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1.5 block">
                    {(playlist.songs || []).length} track{(playlist.songs || []).length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))
            ) : (
              // Library fallbacks
              <div 
                onClick={() => {
                  if (window.ensureAetherAudioContext) window.ensureAetherAudioContext();
                  if (storeSongs && storeSongs.length > 0) {
                    playTrack(storeSongs[0], storeSongs, null);
                  }
                }}
                className="col-span-full bg-white/3 border border-white/10 hover:border-white/25 hover:bg-white/8 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-300 shadow-lg group"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4">
                  <Play size={24} fill="currentColor" className="ml-1" />
                </div>
                <h4 className="text-sm font-bold text-white tracking-wide mb-1">Play All Songs</h4>
                <p className="text-gray-400 text-xs max-w-xs">Play your entire library of {storeSongs.length} songs in the visualizer.</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar Spacing */}
        <div className="h-20" />
      </div>
    );
  }

  const audio = window.aetherAudioElement;
  const progressPercent = audio && duration > 0 ? (audio.currentTime / duration) * 100 : 0;

  return (
    <div 
      onClick={resumeAudioContext} 
      className={`absolute inset-0 bg-[#07050d] z-50 flex flex-col justify-between select-none overflow-hidden font-sans transition-all duration-500 ease-in-out ${
        isActive 
          ? 'opacity-100 pointer-events-auto scale-100' 
          : 'opacity-0 pointer-events-none scale-98'
      }`}
    >
      
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-purple-700/10 blur-[130px] animate-liquid-1" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-700/8 blur-[150px] animate-liquid-2" />
        <div className="absolute top-[25%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-indigo-700/10 blur-[140px] animate-liquid-3" />
        <div className="absolute bottom-[-10%] left-[10%] w-[55vw] h-[55vw] rounded-full bg-purple-700/8 blur-[160px] animate-liquid-1" style={{ animationDelay: '-12s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(7,5,13,0.7)_90%)]" />
      </div>

      {/* Realtime Canvas visualizer behind cards */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none z-1 flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full opacity-[0.4] blur-[1px] mix-blend-screen drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
      </div>

      {/* Header controls */}
      <div className="flex items-center justify-end p-6 pr-[160px] z-10 flex-shrink-0 relative">
        <button 
          onClick={handleClose} 
          className="text-gray-300 border border-white/10 hover:border-white/20 hover:text-white px-4 py-1.5 rounded-full text-xs bg-white/5 flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          title="Minimize Visualizer"
        >
          <X size={14} />
          <span>Exit Fullscreen</span>
        </button>
      </div>

      {/* Main Cover Flow Viewport */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full z-10 select-none">
        
        {/* Nav Arrow Left */}
        {scopeSongs.length > 1 && (
          <button 
            onClick={prevTrack}
            className="absolute left-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 hover:scale-105 text-white flex items-center justify-center transition-all z-20 backdrop-blur-md active:scale-90 shadow-2xl cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* 3D Cards container */}
        <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d', perspective: '1200px' }}>
          {scopeSongs.map((song, i) => {
            const offset = i - activeIndex;
            const absOffset = Math.abs(offset);

            // Hide cards further than 3 items away
            if (absOffset > 3) return null;

            // Transformations calculations
            const rotateY = offset * -26; // rotate towards center
            const translate3dX = offset * 180 - (offset ? (offset > 0 ? 30 : -30) : 0);
            const translate3dZ = absOffset * -160;
            const scale = 1 - absOffset * 0.12;
            const opacity = offset === 0 ? 1 : 0.42;
            const zIndex = 100 - absOffset;
            const isCenter = offset === 0;

            return (
              <div
                key={song.id}
                onClick={() => handleCardClick(song, offset)}
                className={`absolute w-[270px] h-[350px] md:w-[310px] md:h-[390px] rounded-3xl overflow-hidden cursor-pointer transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] select-none flex flex-col ${
                  isCenter 
                    ? 'shadow-[0_25px_60px_-10px_rgba(168,85,247,0.3),0_0_35px_rgba(6,182,212,0.15)] border border-white/25' 
                    : 'border border-white/10 hover:border-white/20'
                }`}
                style={{
                  transform: `translateX(${translate3dX}px) translateZ(${translate3dZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  zIndex,
                  opacity,
                  transformStyle: 'preserve-3d',
                  background: isCenter ? '#1c1830' : '#110e20'
                }}
              >
                {/* Sheen effect */}
                <div className="absolute inset-0 glass-shine pointer-events-none z-10" />

                {/* Artwork */}
                <div className="w-full flex-1 relative overflow-hidden bg-black/20 rounded-t-3xl">
                  {song.has_artwork && song.artwork_path ? (
                    <img 
                      src={getMediaUrl(song.artwork_path)} 
                      alt={song.title} 
                      className="w-full h-full object-cover transition-transform duration-700 select-none group-hover:scale-105 rounded-t-3xl shadow-sm"
                      style={{ imageRendering: 'high-quality', filter: 'contrast(1.05) saturate(1.1)' }}
                      draggable="false"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/15 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 gap-3 rounded-t-3xl">
                      <Music size={54} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">No Cover Art</span>
                    </div>
                  )}
                </div>

                {/* Card footer details */}
                <div 
                  className={`p-5 flex flex-col justify-end transition-all duration-500 text-left rounded-b-3xl ${
                    isCenter ? 'bg-black/40 border-t border-white/10 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'
                  }`}
                >
                  <h3 className="font-sans text-base font-black text-white truncate drop-shadow-md select-text">{song.title}</h3>
                  <p className="text-[11px] font-bold text-cyan-400 mt-1 tracking-wider uppercase truncate select-text">{song.artist}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nav Arrow Right */}
        {scopeSongs.length > 1 && (
          <button 
            onClick={nextTrack}
            className="absolute right-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 hover:scale-105 text-white flex items-center justify-center transition-all z-20 backdrop-blur-md active:scale-90 shadow-2xl cursor-pointer"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Floating Glassmorphic Pill Player Controls */}
      <div className="w-full pb-8 flex justify-center z-20 flex-shrink-0 relative">
        <div className="w-[90%] max-w-4xl bg-white/8 backdrop-blur-3xl border border-white/15 rounded-full py-3.5 px-6 md:px-8 flex items-center justify-between gap-6 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
          
          {/* Left section: playback buttons */}
          <div className="flex items-center gap-3 w-1/4 justify-start">
            <button 
              onClick={prevTrack} 
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white transition-all active:scale-90"
              title="Previous"
            >
              <SkipBack size={15} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlay} 
              className="w-10 h-10 rounded-full bg-white text-[#0e0602] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
            </button>
            <button 
              onClick={nextTrack} 
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white transition-all active:scale-90"
              title="Next"
            >
              <SkipForward size={15} fill="currentColor" />
            </button>
          </div>

          {/* Center section: Song info + timeline pill */}
          <div className="flex-1 max-w-md bg-black/35 border border-white/8 rounded-2xl px-4 py-2.5 flex items-center gap-4.5 relative overflow-hidden h-[58px]">
            {/* Tiny rotating artwork */}
            <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 relative ${isPlaying ? 'animate-spin-slow' : ''}`}>
              {activeTrack?.has_artwork && activeTrack?.artwork_path ? (
                <img src={getMediaUrl(activeTrack.artwork_path)} alt={activeTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40"><Disc size={16} /></div>
              )}
            </div>

            {/* Song title and artist */}
            <div className="flex flex-col text-left min-w-0 pr-4 pb-1">
              <span className="text-[11px] font-bold text-white truncate max-w-[130px] md:max-w-[200px] leading-tight">{activeTrack?.title}</span>
              <span className="text-[9px] text-gray-400 font-semibold truncate max-w-[130px] md:max-w-[200px] mt-0.5">{activeTrack?.artist}</span>
            </div>

            {/* Micro indicators */}
            <div className="ml-auto flex items-center gap-2 pr-1.5 pb-1">
              <span ref={timeTextRef} className="font-display text-[8px] text-gray-500 font-bold">{formatTime(audio?.currentTime || 0)}</span>
              <span className="text-[8px] text-gray-500">/</span>
              <span className="font-display text-[8px] text-gray-500 font-bold">{formatTime(duration)}</span>
            </div>

            {/* Interactive Progress Line at very bottom */}
            <div 
              ref={progressBarRef}
              onMouseDown={handleSeekMouseDown}
              onTouchStart={handleSeekMouseDown}
              className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 hover:bg-white/20 transition-colors cursor-pointer group/progress"
              title="Seek track position"
            >
              <div 
                ref={progressBarFillRef}
                className="h-full bg-cyan-400 group-hover/progress:bg-cyan-300 transition-colors"
              />
            </div>
          </div>

          {/* Right section: visualizer settings + sidebar toggles */}
          <div className="w-1/4 flex items-center justify-end gap-3 flex-shrink-0">
            {/* Favorite toggle */}
            <button
              onClick={() => activeTrack && toggleFavorite(activeTrack.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all ${
                activeTrack?.favorite ? 'text-white fill-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Favorite"
            >
              <Heart size={14} fill={activeTrack?.favorite ? 'currentColor' : 'none'} />
            </button>

            {/* Queue List drawer toggle */}
            <button 
              onClick={() => { setShowQueueDrawer(!showQueueDrawer); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all ${
                showQueueDrawer ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white'
              }`}
              title="View Playlist Scope"
            >
              <ListMusic size={14} />
            </button>

            {/* Volume slide-out container */}
            <div className="flex items-center gap-1 group/vol h-8">
              <button 
                onClick={() => setMuted(!muted)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white transition-all active:scale-95 flex-shrink-0"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <div 
                ref={volumeBarRef}
                onMouseDown={handleVolumeMouseDown}
                onTouchStart={handleVolumeMouseDown}
                className="w-0 overflow-hidden group-hover/vol:w-16 h-8 flex items-center cursor-pointer transition-all duration-300 ease-in-out flex-shrink-0"
              >
                <div className="w-16 h-1 bg-white/20 rounded-full relative flex items-center">
                  <div 
                    className="h-full bg-white rounded-full absolute top-0 left-0"
                    style={{ width: `${muted ? 0 : volume * 100}%` }}
                  />
                  <div 
                    className="w-2.5 h-2.5 rounded-full bg-white shadow-md absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${muted ? 0 : volume * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>



      {/* Slide-out Glass Playlist Scope (Queue) Drawer */}
      {showQueueDrawer && (
        <div className="absolute top-20 bottom-36 right-6 w-80 bg-black/45 border border-white/10 backdrop-blur-3xl p-6 z-30 flex flex-col justify-between shadow-2xl animate-fade-in rounded-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">PLAYLIST SCOPE</span>
              <h4 className="text-white text-xs font-bold truncate max-w-[180px] mt-0.5">{playlistName}</h4>
            </div>
            <button onClick={() => setShowQueueDrawer(false)} className="text-gray-400 hover:text-white transition-colors"><X size={15} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 pr-1 flex flex-col gap-1">
            {scopeSongs.map((song, idx) => {
              const isCurrent = song.id === activeTrack?.id;
              return (
                <div 
                  key={song.id}
                  onClick={() => playTrack(song, scopeSongs, activePlaylistId)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer border ${
                    isCurrent ? 'bg-white/5 border-white/25' : 'border-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-bold w-4 text-center ${isCurrent ? 'text-white animate-pulse' : 'text-gray-500'}`}>
                    {idx + 1}
                  </span>
                  
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {song.has_artwork && song.artwork_path ? (
                      <img src={getMediaUrl(song.artwork_path)} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music size={12} className="text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col min-w-0 text-left">
                    <span className={`text-xs font-bold truncate ${isCurrent ? 'text-white font-extrabold' : 'text-white/80'}`}>{song.title}</span>
                    <span className="text-[9px] text-gray-500 truncate mt-0.5">{song.artist}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 text-center border-t border-white/8 flex-shrink-0">
            <span className="text-[9px] font-bold text-white/55">{scopeSongs.length} songs in visualizer scope</span>
          </div>
        </div>
      )}

    </div>
  );
}
