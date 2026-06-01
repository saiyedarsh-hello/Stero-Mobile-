import { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { CloudDownload, Search, Music, Loader2, CheckCircle2 } from 'lucide-react';

export default function DownloadsView() {
  const { searchQuery, startDownload, downloadState } = usePlayerStore();
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      const query = searchQuery?.trim() || "Global Top 50 Hits";
      setIsSearching(true);
      try {
        const res = await window.electron.ytSearch(query);
        setResults(res || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleDownload = async (song) => {
    await startDownload(song);
  };

  const isDownloading = (videoId) => {
    return downloadState?.active?.some(d => d.videoId === videoId);
  };

  const isQueued = (videoId) => {
    return downloadState?.queue?.some(d => d.videoId === videoId);
  };

  const isCompleted = (videoId) => {
    return downloadState?.completed?.some(d => d.videoId === videoId && d.status === 'completed');
  };

  const isError = (videoId) => {
    return downloadState?.completed?.some(d => d.videoId === videoId && d.status === 'error');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scroll-smooth custom-scrollbar p-6">
      <div className="mb-8 flex-shrink-0 animate-fade-in">
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <CloudDownload size={28} className="text-white" />
          </div>
          Music Archive
        </h2>
        <p className="text-gray-400 mt-3 text-sm ml-1 tracking-wide">Search the global archive and download high-quality audio directly to your library.</p>
      </div>

      {isSearching ? (
        <div className="flex-1 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-purple-400" size={32} />
            <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">Fetching Archive...</span>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-medium animate-fade-in">
          No matches found for "{searchQuery}"
        </div>
      ) : (
        <div className="space-y-2.5 pb-20 animate-fade-in">
          {!searchQuery?.trim() && (
            <div className="mb-4 text-xs font-bold text-white/60 uppercase tracking-widest">
              Trending Worldwide
            </div>
          )}
          {results.map((song, i) => {
            const downloading = isDownloading(song.videoId);
            const completed = isCompleted(song.videoId);
            const failed = isError(song.videoId);

            return (
              <div 
                key={song.videoId}
                className="group flex items-center gap-4 p-3 pr-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-purple-500/5"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-black/40 overflow-hidden flex-shrink-0 relative shadow-inner">
                  {song.thumbnail ? (
                    <img src={song.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Music size={20} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className="text-sm font-bold text-gray-200 group-hover:text-white truncate transition-colors">{song.title}</h4>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{song.artist} • {song.album}</p>
                </div>

                <div className="flex-shrink-0 pl-2">
                  {completed ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 border border-white/20 px-6 py-2.5 rounded-full backdrop-blur-md shadow-lg">
                      <CheckCircle2 size={14} className="text-white" />
                      <span>Saved</span>
                    </div>
                  ) : isQueued(song.videoId) ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300 bg-white/5 border border-white/10 px-6 py-2.5 rounded-full shadow-sm">
                      <Loader2 size={14} className="animate-spin opacity-50" />
                      <span>Queued</span>
                    </div>
                  ) : downloading ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 border border-white/20 px-6 py-2.5 rounded-full backdrop-blur-md shadow-lg">
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>Downloading...</span>
                    </div>
                  ) : failed ? (
                    <button
                      onClick={() => handleDownload(song)}
                      className="flex items-center gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                    >
                      <CloudDownload size={14} className="text-red-400" />
                      <span>Retry</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload(song)}
                      className="flex items-center gap-2 bg-white text-[#141416] hover:bg-white/95 px-6 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                    >
                      <CloudDownload size={14} className="text-[#141416]" />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          <div className="mt-12 mb-8 flex justify-center items-center animate-fade-in" style={{ animationDelay: `${results.length * 30}ms` }}>
            <p className="text-xs font-bold text-white/30 tracking-widest uppercase text-center px-4 py-2 border border-white/5 rounded-full bg-white/[0.02]">
              Every song is available just give it a search
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
