import { usePlayerStore } from '../store/usePlayerStore';
import { useState } from 'react';
import {  
  Radio,
  Library,
  ListMusic,
  Heart,
  ChevronLeft,
  CloudDownload,
  ArrowDownToLine,
  X,
  Disc
} from 'lucide-react';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const {
    activeView,
    setActiveView,
    downloadState,
    cancelDownload,
    dominantColor
  } = usePlayerStore();

  const menuItems = [
    { id: 'music', label: 'Discover', icon: Radio },
    { id: 'songs', label: 'My Library', icon: Library },
    { id: 'albums', label: 'Playlists', icon: ListMusic },
    { id: 'favorites', label: 'Favorites', icon: Heart }
  ];

  return (
    <aside 
      className={`bg-transparent flex flex-col justify-between select-none relative z-30 transition-all overflow-hidden will-change-[width,opacity] ${
        isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-48 opacity-100'
      }`}
    >
      {/* Custom right border */}
      <div 
        className={`absolute right-0 top-0 bottom-0 w-[1px] bg-white/8 transition-opacity duration-300 z-10 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`} 
      />

      {/* Container wrapper to prevent squishing text during collapse animation, with smooth slide-fade */}
      <div 
        className={`w-48 h-full flex flex-col justify-start p-4 pt-8 pb-4 flex-shrink-0 transition-all will-change-[transform,opacity] ${
          isCollapsed ? 'opacity-0 -translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'
        }`}
      >
        
        {/* Top: Header Controls & Logo */}
        <div>
          {/* Sidebar Header Controls */}
          <div className="flex justify-between items-center mb-4 px-1">
            <button 
              onClick={() => setIsDownloadsOpen(!isDownloadsOpen)}
              className={`relative text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 border transition-all duration-300 flex items-center justify-center ${isDownloadsOpen ? 'border-white/10 bg-white/5 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-transparent'}`}
              title="Downloads"
            >
              <ArrowDownToLine size={16} className={`transition-transform duration-300 ${isDownloadsOpen ? 'scale-110' : ''}`} />
              {downloadState?.active?.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border border-[#141416] shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></span>
              )}
            </button>
            <button 
              onClick={onToggleCollapse}
              className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-300 active:scale-95 flex items-center justify-center group/collapse"
              title="Hide Sidebar"
            >
              <ChevronLeft size={16} className="transition-transform duration-300 group-hover/collapse:-translate-x-0.5" />
            </button>
          </div>

          {/* Download Section (Toggleable) */}
          <div 
            className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden will-change-[max-height,opacity,margin] ${
              isDownloadsOpen ? 'max-h-[400px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0 pointer-events-none'
            }`}
          >
            <div className={`bg-white/[0.05] border border-white/10 rounded-xl p-3 shadow-2xl relative z-50 backdrop-blur-2xl transition-transform duration-500 ${isDownloadsOpen ? 'translate-y-0 scale-100' : '-translate-y-4 scale-95'}`}>
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-bold block mb-2 px-1">Downloads</span>
              {downloadState?.active?.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {downloadState.active.map(job => {
                    const coverImg = job.thumbnail || job.coverUrl || job.artwork_path;
                    return (
                    <div key={job.videoId} className="flex items-center gap-2 mb-1.5 bg-black/20 p-2 rounded-lg border border-white/5">
                      {coverImg ? (
                        <img src={getMediaUrl(coverImg)} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                          <CloudDownload size={14} className="text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-white truncate">{job.title}</p>
                        <p className="text-[9px] text-gray-400 truncate">{job.artist}</p>
                      </div>
                      <button 
                        onClick={() => cancelDownload(job.videoId)}
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                        title="Cancel Download"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )})}
                  {downloadState.queue?.length > 0 && (
                    <div className="text-center text-[10px] text-gray-500 mt-1 font-medium">
                      +{downloadState.queue.length} in queue
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-[10px] text-gray-500 py-4 font-medium">
                  No active downloads
                </div>
              )}
            </div>
          </div>

          {/* Section: Menu */}
          <div className="mb-4">
            <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-bold block mb-2 px-3">Menu</span>
            <nav className="flex flex-col gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id || 
                  (item.id === 'dashboard' && activeView === 'visualizer') ||
                  (item.id === 'albums' && (activeView === 'album-detail' || activeView === 'playlist-detail'));
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 relative border group ${
                      isActive 
                        ? 'border-transparent shadow-none' 
                        : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:translate-x-1'
                    }`}
                    style={isActive ? {
                      color: dominantColor ? `hsl(${dominantColor.h}, ${dominantColor.s}%, ${Math.max(60, dominantColor.l)}%)` : '#FF4F6E',
                      backgroundColor: dominantColor ? `hsla(${dominantColor.h}, ${dominantColor.s}%, ${Math.max(60, dominantColor.l)}%, 0.1)` : 'rgba(255, 79, 110, 0.1)'
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-transform duration-300 group-hover:scale-110 ${isActive ? 'bg-white/10 shadow-sm' : 'bg-transparent group-hover:bg-white/5'}`}>
                        <Icon size={14} strokeWidth={2.5} className={!isActive ? 'text-gray-400 group-hover:text-gray-200' : ''} style={isActive ? { color: dominantColor ? `hsl(${dominantColor.h}, ${dominantColor.s}%, ${Math.max(60, dominantColor.l)}%)` : '#FF4F6E' } : {}} />
                      </div>
                      <span className="tracking-wide font-semibold">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

        </div>

      </div>
    </aside>
  );
}
