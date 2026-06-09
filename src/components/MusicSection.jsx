import { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ChevronLeft, ChevronRight, Play, Heart, Disc } from 'lucide-react';
import LanguageModal from './LanguageModal';
import RetryImage from './RetryImage';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

const getHighResUrl = (url) => {
  if (!url) return '';
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    if (url.includes('=')) {
      return url.split('=')[0] + '=w512-h512-l90-rj';
    }
  }
  return url.replace(/=w\d+-h\d+.*$/i, '=w512-h512-l90-rj');
};

export default function MusicSection() {
  const { 
    appSettings, 
    fetchTrendingSongs, 
    fetchTrendingArtists, 
    streamTrack, 
    playTrack,
    viewHistory,
    activeView,
    trendingArtists: artists,
    trendingSongs,
    ytSearchResults,
    setTrendingData,
    toggleFavorite,
    playHistory,
    songs: allSongs // Need this to check if a stream is already in the DB favorites
  } = usePlayerStore();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  // Hardcoded to english only for now
  const [languageString, setLanguageString] = useState('english');
  const [loading, setLoading] = useState(false);

  const artistScrollRef = useRef(null);
  const songScrollRef = useRef(null);
  const recentScrollRef = useRef(null);

  const scrollContainer = (ref, direction) => {
    if (ref.current) {
      const amount = direction === 'left' ? -400 : 400;
      ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Derive "Recently Played" from the view history or just local songs
  // For the sake of the layout, we'll grab some recent unique tracks from the store queue/history
  const recentlyPlayed = playHistory.slice(0, 4);

  useEffect(() => {
    let isMounted = true;
    if (languageString) {
      const fetchAll = async () => {
        setLoading(true);
        try {
          const [newArtists, newSongs] = await Promise.all([
            fetchTrendingArtists(languageString),
            fetchTrendingSongs(languageString)
          ]);
          
          if (isMounted) {
            setTrendingData(newArtists || [], newSongs || []);
          }
        } catch (err) {
          console.error("Failed to fetch trending music:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      
      if (activeView === 'music' && trendingSongs.length === 0 && artists.length === 0) {
        fetchAll();
      }
    }
    return () => { isMounted = false; };
  }, [languageString, fetchTrendingArtists, fetchTrendingSongs, activeView, trendingSongs.length, artists.length, setTrendingData]);
  
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [newArtists, newSongs] = await Promise.all([
        fetchTrendingArtists(languageString),
        fetchTrendingSongs(languageString)
      ]);
      setTrendingData(newArtists || [], newSongs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Disc size={40} className="text-white/20 animate-spin-slow" />
          <span className="text-sm font-bold text-white/40 tracking-widest uppercase">Fetching Music...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 select-none animate-fade-in pb-10">
      
      {/* 1. Popular Artist Row */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Popular Artist</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => scrollContainer(artistScrollRef, 'left')} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scrollContainer(artistScrollRef, 'right')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div ref={artistScrollRef} className="flex overflow-x-auto gap-6 pb-4 px-2 snap-x hide-scrollbar">
          {artists.map((artist) => (
            <div key={artist.id} className="flex flex-col items-center gap-3 cursor-pointer group flex-shrink-0 snap-start">
              <div className="w-24 h-24 rounded-full overflow-hidden border border-white/5 shadow-lg group-hover:scale-105 group-active:scale-95 transition-all duration-300 relative">
                {artist.imageUrl ? (
                  <RetryImage src={getHighResUrl(artist.imageUrl)} alt={artist.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Disc size={30} className="text-white/40" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                   <Play size={24} className="text-white ml-1" fill="currentColor" />
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{artist.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Trendy Songs Row */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {ytSearchResults ? 'Search Results' : 'Trendy Songs'}
          </h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleRefresh}
              className="px-3 py-1 text-xs font-semibold rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 flex items-center gap-2"
            >
              <Disc size={12} className={loading ? "animate-spin" : ""} />
              Refresh Weekly
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollContainer(songScrollRef, 'left')} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scrollContainer(songScrollRef, 'right')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
        <div ref={songScrollRef} className="flex overflow-x-auto gap-6 pb-4 px-2 snap-x hide-scrollbar">
          {(ytSearchResults || trendingSongs).map((song) => (
            <div 
              key={song.videoId} 
              onClick={() => streamTrack(song, ytSearchResults || trendingSongs)}
              className="flex flex-col gap-3 flex-shrink-0 w-44 cursor-pointer group snap-start"
            >
              <div className="w-44 h-56 rounded-2xl overflow-hidden border border-white/10 shadow-xl relative transition-transform duration-300 group-hover:-translate-y-2 group-active:scale-95">
                {song.coverUrl ? (
                  <RetryImage src={getHighResUrl(song.coverUrl)} fallbackSrc={song.coverUrl} alt={song.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center">
                    <Disc size={40} className="text-white/20" />
                  </div>
                )}
                {/* Hover Overlay Play Button */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Play size={20} className="text-black ml-1" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2 px-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">{song.title}</span>
                  <span className="text-xs text-gray-400 truncate">{song.artist}</span>
                </div>
                {(() => {
                  const dbSong = allSongs?.find(s => s.filepath === `yt-stream://${song.videoId}`);
                  const isFav = dbSong?.favorite === 1;
                  return (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(dbSong ? dbSong.id : song.videoId, !isFav, song);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 active:scale-90"
                    >
                      <Heart size={14} className={isFav ? 'text-red-500' : ''} fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Recently Played */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Recently Played</h2>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        
        {recentlyPlayed.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-6 px-2">
            {/* Main Featured Card */}
            <div 
              onClick={() => playTrack(recentlyPlayed[0], recentlyPlayed)}
              className="flex-shrink-0 w-full md:w-64 h-64 rounded-3xl overflow-hidden relative group cursor-pointer border border-white/10 shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
            >
               <RetryImage src={recentlyPlayed[0].isStream ? getHighResUrl(recentlyPlayed[0].artwork_path || recentlyPlayed[0].coverUrl) : getMediaUrl(recentlyPlayed[0].artwork_path)} fallbackSrc={recentlyPlayed[0].artwork_path || recentlyPlayed[0].coverUrl} alt={recentlyPlayed[0].title} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                 <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
                   <Play size={20} className="ml-1" fill="currentColor" />
                 </div>
                 <span className="text-lg font-bold text-white truncate">{recentlyPlayed[0].title}</span>
                 <span className="text-sm text-gray-300 truncate">{recentlyPlayed[0].artist}</span>
               </div>
            </div>

            {/* List Cards */}
            <div className="flex-1 flex flex-col gap-3">
              {recentlyPlayed.slice(1, 4).map((song) => (
                <div 
                  key={song.id || song.videoId} 
                  onClick={() => playTrack(song, recentlyPlayed)}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-3 flex items-center gap-4 transition-colors cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 relative">
                    <RetryImage src={song.isStream ? getHighResUrl(song.artwork_path || song.coverUrl) : getMediaUrl(song.artwork_path)} fallbackSrc={song.artwork_path || song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play size={16} className="text-white ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs text-gray-400 truncate">{song.artist}</span>
                    <span className="text-sm font-bold text-white truncate">{song.title}</span>
                  </div>
                  <button className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors transform active:scale-95 ml-4">
                    <Play size={20} className="ml-0.5" fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 px-2">No recently played tracks found.</div>
        )}
      </section>

    </div>
  );
}
