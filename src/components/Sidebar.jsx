import { usePlayerStore } from '../store/usePlayerStore';
import {  
  FolderHeart,
  Music, 
  Heart, 
  ChevronLeft,
  CloudDownload,
  X
} from 'lucide-react';

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
  const {
    activeView,
    setActiveView,
    downloadState,
    cancelDownload
  } = usePlayerStore();

  const menuItems = [
    { id: 'songs', label: 'Songs', icon: Music },
    { id: 'albums', label: 'Playlists', icon: FolderHeart },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'downloads', label: 'Download', icon: CloudDownload },
  ];

  return (
    <aside 
      className={`bg-gradient-to-b from-white/[0.04] to-white/[0.02] backdrop-blur-xl flex flex-col justify-between select-none relative z-30 transition-all overflow-hidden shadow-[15px_15px_40px_rgba(0,0,0,0.3)] rounded-2xl will-change-[width,margin,opacity] ${
        isCollapsed ? 'w-0 opacity-0 border-transparent my-4 mx-0 pointer-events-none' : 'w-48 opacity-100 border border-white/8 my-4 ml-4 mr-2'
      }`}
    >
      {/* Container wrapper to prevent squishing text during collapse animation, with smooth slide-fade */}
      <div 
        className={`w-48 h-full flex flex-col justify-start p-4 pb-4 flex-shrink-0 transition-all will-change-[transform,opacity] ${
          isCollapsed ? 'opacity-0 -translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'
        }`}
      >
        
        {/* Top: Header Controls & Logo */}
        <div>
          {/* Sidebar Collapse Trigger */}
          <div className="flex justify-end mb-4">
            <button 
              onClick={onToggleCollapse}
              className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-300 active:scale-95 flex items-center justify-center group/collapse"
              title="Hide Sidebar"
            >
              <ChevronLeft size={16} className="transition-transform duration-300 group-hover/collapse:-translate-x-0.5" />
            </button>
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
                        ? 'text-white bg-white/5 border-white/10 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_20px_rgba(255,255,255,0.04)] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-5 before:bg-white before:rounded-r-md before:shadow-[0_0_8px_rgba(255,255,255,0.4)]' 
                        : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`} />
                      <span className="tracking-wide">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

        </div>

        {/* Download Manager UI */}
        {downloadState?.active?.length > 0 && (
          <div className="mt-auto pt-4 border-t border-white/5 animate-fade-in flex-shrink-0">
            <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-bold block mb-2 px-3">Downloading</span>
            <div className="flex flex-col gap-2">
              {downloadState.active.map(job => (
                <div key={job.videoId} className="bg-white/5 border border-white/10 rounded-xl p-3 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-1.5">
                    {job.thumbnail ? (
                      <img src={job.thumbnail} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                        <CloudDownload size={12} className="text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{job.title}</p>
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
                </div>
              ))}
              {downloadState.queue?.length > 0 && (
                <div className="text-center text-[10px] text-gray-500 mt-1">
                  +{downloadState.queue.length} in queue
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
}
