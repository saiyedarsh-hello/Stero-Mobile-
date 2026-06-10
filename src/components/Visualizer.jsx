import { useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { X } from 'lucide-react';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};



export default function Visualizer() {
  const { 
    activeTrack, 
    activeView, 
    setActiveView,
    isPlaying,
    queue,
    songs: storeSongs,
    playTrack,
    activePlaylistId,
    dominantColor
  } = usePlayerStore();

  const isActive = activeView === 'visualizer';

  // Handle Close
  const handleClose = () => {
    setActiveView('music');
  };

  // Keyboard escape
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleClose]);

  // Derive tracks to display on the right (up to 5)
  let upcomingTracks = [];
  if (queue && queue.length > 0) {
    const queueActiveIndex = queue.findIndex(t => t.id === activeTrack?.id);
    if (queue.length <= 5) {
      upcomingTracks = [...queue];
    } else {
      let start = queueActiveIndex !== -1 ? queueActiveIndex - 2 : 0;
      if (start < 0) start = 0;
      if (start + 5 > queue.length) {
        start = Math.max(0, queue.length - 5);
      }
      upcomingTracks = queue.slice(start, start + 5);
    }
  }
  if (upcomingTracks.length === 0 && storeSongs) {
    upcomingTracks = storeSongs.slice(0, 5);
  }

  // Formatting artist and title for big text
  const artistName = String(activeTrack?.artist || "UNKNOWN ARTIST");
  const title = String(activeTrack?.title || "NO TRACK");
  const trackIndex = ((queue || []).findIndex(t => t.id === activeTrack?.id) + 1).toString().padStart(2, '0');

  // Hardcode genres or extract if possible (usually not available in simple metadata, using placeholder matching aesthetic)
  const genresText = "PSYCHEDELIC POP, ROCK, DISCO, SYNTH-POP";

  return (
    <div 
      className={`absolute inset-0 z-50 flex items-center justify-center overflow-hidden font-sans transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isActive ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-98'
      }`}
      style={{ 
        backgroundColor: dominantColor 
          ? `hsl(${dominantColor.h}, ${dominantColor.s}%, 85%)` 
          : '#f4f4f2',
        backgroundImage: dominantColor 
          ? `radial-gradient(circle at -10% 50%, hsla(${dominantColor.h}, ${dominantColor.s}%, 70%, 0.8) 0%, transparent 80%)` 
          : 'none'
      }}
    >
      
      {/* Top Right Header Nav */}
      <div className="absolute top-10 right-12 flex items-center gap-8 z-20 text-[11px] font-bold tracking-[0.15em] text-[#111]">
        <button onClick={handleClose} className="ml-6 w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:bg-black/5 hover:scale-105 active:scale-95 transition-all text-[#111]">
          <X size={15} />
        </button>
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-10 left-12 z-20 text-sm font-black tracking-widest text-[#111] uppercase">
        S/M
      </div>

      {/* Main Grid Layout */}
      <div className="w-full h-full flex items-center justify-between pl-0 pr-12 lg:pr-32 relative">
        
        {/* Left Side: Massive Vinyl */}
        <div className="relative w-[55vw] h-[55vw] min-w-[700px] min-h-[700px] flex items-center justify-center -ml-[25vw] pointer-events-none">
          {/* Outer Thin Orbital Ring */}
          <div className="absolute inset-[-4%] rounded-full border-[1.5px] border-[#e6e6e6] flex items-center justify-end pr-[2%]">
             {/* Small Red Dot */}
             <div className="w-3 h-3 rounded-full bg-[#a33333] absolute right-[-6px] shadow-[0_0_0_4px_#f4f4f2,0_0_0_6px_#e5e5e5]" />
             {/* Tiny red orbital trail piece */}
             <svg className="absolute w-full h-full rotate-45 opacity-40" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="49" fill="none" stroke="#a33333" strokeWidth="0.3" strokeDasharray="10 100" />
             </svg>
          </div>

          {/* Vinyl Record */}
          <div className={`relative w-full h-full rounded-full shadow-[25px_0_70px_rgba(0,0,0,0.15)] bg-[#111] overflow-hidden ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '6s', animationTimingFunction: 'linear' }}>
            {/* Vinyl Grooves */}
            <div className="absolute inset-0 rounded-full" style={{
              background: 'repeating-radial-gradient(circle at center, #111, #111 2px, #181818 3px, #111 4px)'
            }} />
            {/* Light reflection sheen */}
            <div className="absolute inset-0 rounded-full opacity-30 mix-blend-screen" style={{
              background: 'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.4) 45deg, transparent 90deg, rgba(255,255,255,0.4) 135deg, transparent 180deg, rgba(255,255,255,0.4) 225deg, transparent 270deg, rgba(255,255,255,0.4) 315deg, transparent 360deg)'
            }} />
            
            {/* Center Label (Off-white) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] h-[35%] rounded-full bg-[#f4f4f2] shadow-[inset_0_0_25px_rgba(0,0,0,0.08)] flex items-center justify-center">
              {/* Spindle hole */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#f4f4f2] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border-[3px] border-[#e0e0e0]" />
              
              {/* Minimal Red Logo on left side of label */}
              <div className="absolute left-[15%] top-1/2 -translate-y-1/2 flex items-end gap-[3px]">
                <div className="w-[3px] h-4 bg-[#a33333]" />
                <div className="w-[3px] h-7 bg-[#a33333]" />
                <div className="w-[3px] h-5 bg-[#a33333]" />
                <div className="w-[3px] h-3 bg-[#a33333]" />
              </div>

              {/* Track Info on right side of label */}
              <div className="absolute right-[12%] top-1/2 -translate-y-1/2 text-right">
                <span className="text-[11px] font-bold tracking-[0.1em] text-[#111] uppercase block max-w-[140px] truncate">
                  {trackIndex}. {title}
                </span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Side: Typography and Queue */}
        <div className="flex-1 flex flex-col justify-center max-w-xl 2xl:max-w-2xl ml-16 mt-10">
          
          {/* Massive Artist Text */}
          <div className="flex flex-col mb-4">
            <h1 className="text-[7.5vw] 2xl:text-[8rem] font-black tracking-tighter text-[#111] uppercase leading-[0.85] break-words">
              {artistName.split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </h1>
          </div>

          {/* Genre / Subtitle */}
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#111] opacity-70 uppercase mb-16 pl-2">
            {genresText}
          </p>

          {/* "POPULAR" Section Title */}
          <h3 className="text-[#a33333] text-[12px] font-bold tracking-[0.15em] mb-6 pl-2">
            POPULAR
          </h3>

          {/* Track List */}
          <div className="flex flex-col gap-5 pl-2">
            {upcomingTracks.map((track) => {
              let tIndex = queue?.findIndex(t => t.id === track.id);
              if (tIndex === -1 || tIndex === undefined) tIndex = upcomingTracks.indexOf(track);
              const actualIndex = (tIndex + 1).toString().padStart(2, '0');
              const isPlayingThis = isPlaying && activeTrack?.id === track.id;
              
              return (
                <div 
                  key={track.id} 
                  className="flex items-center group cursor-pointer"
                  onClick={() => playTrack(track, queue, activePlaylistId)}
                >
                  <span className={`text-[11px] font-black w-8 transition-colors ${isPlayingThis ? 'text-[#a33333]' : 'text-[#111] group-hover:text-[#a33333]'}`}>{actualIndex}</span>
                  
                  <div className="w-[42px] h-[42px] bg-gray-200 ml-2 flex-shrink-0 overflow-hidden shadow-sm relative">
                    {track.has_artwork && track.artwork_path ? (
                      <img src={getMediaUrl(track.artwork_path)} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#111]" />
                    )}
                    <div className="absolute inset-0 bg-[#a33333] opacity-0 group-hover:opacity-30 transition-opacity mix-blend-multiply" />
                  </div>
                  
                  <div className="flex flex-col ml-5 flex-1 min-w-0 pt-0.5">
                    <span className={`text-[12px] font-black uppercase tracking-wide truncate transition-colors ${isPlayingThis ? 'text-[#a33333]' : 'text-[#111] group-hover:text-[#a33333]'}`}>{track.title}</span>
                  </div>
                  
                </div>
              );
            })}
          </div>

          {/* View More Link */}
          <div className="w-full text-right mt-16 pr-2">
            <button 
              onClick={handleClose}
              className="text-[11px] font-black tracking-[0.15em] text-[#111] uppercase border-b-2 border-[#111] pb-1 hover:text-[#a33333] hover:border-[#a33333] transition-colors"
            >
              VIEW MORE
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
