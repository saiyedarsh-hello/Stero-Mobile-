import { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ChevronLeft, ChevronRight, Play, Heart, Disc, Plus, Check } from 'lucide-react';
import LanguageModal from './LanguageModal';
import RetryImage from './RetryImage';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `media://local/?path=${encodeURIComponent(path)}`;
};

const getHighResUrl = (url) => {
  if (!url) return '';
  // Match the width and height part (e.g. =w120-h120 or =w60-h60) and replace it
  // This preserves other flags like -p-l90-rj which might be required for some Google user content URLs.
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    if (url.includes('=')) {
      return url.replace(/=w\d+-h\d+/i, '=w512-h512');
    }
  }
  return url.replace(/=w\d+-h\d+/i, '=w512-h512');
};

export default function MusicSection() {
  const { 
    appSettings, 
    activeTrack,
    fetchTrendingSongs, 
    fetchTrendingArtists, 
    streamTrack, 
    playTrack,
    preloadTrack,
    viewHistory,
    activeView,
    trendingArtists: artists,
    trendingSongs,
    ytSearchResults,
    ytArtistSearchResults,
    setTrendingData,
    toggleFavorite,
    playHistory,
    songs: allSongs, // Need this to check if a stream is already in the DB favorites
    followedArtists,
    followedArtistSongs,
    toggleFollowArtist
  } = usePlayerStore();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  // Hardcoded to english only for now
  const [languageString, setLanguageString] = useState('english');
  const [loading, setLoading] = useState(false);

  const artistScrollRef = useRef(null);
  const songScrollRef = useRef(null);
  const recentScrollRef = useRef(null);
  const followedScrollRef = useRef(null);

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
  const baseArtists = ytArtistSearchResults || artists;
  const displayArtists = [...followedArtists];
  baseArtists.forEach(artist => {
    if (!displayArtists.some(a => (a.id || a.browseId) === (artist.id || artist.browseId))) {
      displayArtists.push(artist);
    }
  });

  return (
    <div className="flex flex-col gap-10 select-none animate-fade-in pb-10">
      
      {/* 1. Popular Artist Row */}
      <section className="order-1">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {ytArtistSearchResults ? 'Search Results (Artists)' : 'Popular Artist'}
          </h2>
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
          {displayArtists.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`artist-skel-${i}`} className="flex flex-col items-center gap-3 flex-shrink-0 snap-start">
                <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
                <div className="w-16 h-3 bg-white/5 rounded animate-pulse" />
              </div>
            ))
          ) : (
            displayArtists.map((artist) => (
            <div 
              key={artist.id} 
              className="flex flex-col items-center gap-3 cursor-pointer group flex-shrink-0 snap-start relative"
              onClick={async () => {
                if (activeTrack && activeTrack.artist && activeTrack.artist.toLowerCase().includes(artist.name.toLowerCase())) {
                  return;
                }
                try {
                  const results = await window.electron.ytSearch(`${artist.name} songs`);
                  if (results && results.length > 0) {
                    streamTrack(results[0], results);
                  }
                } catch (err) {
                  console.error('Failed to play artist songs:', err);
                }
              }}
            >
              <div className="w-24 h-24 rounded-full overflow-hidden border border-white/5 shadow-lg group-hover:scale-105 group-active:scale-95 transition-all duration-300 relative">
                {artist.imageUrl || artist.thumbnail ? (
                  <RetryImage src={getHighResUrl(artist.imageUrl || artist.thumbnail)} alt={artist.name} loading="lazy" className="w-full h-full object-cover" />
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
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollowArtist(artist);
                }}
                className={`absolute bottom-7 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 z-10 border border-white/10 backdrop-blur-md ${
                  followedArtists.some(a => (a.id || a.browseId) === (artist.id || artist.browseId))
                    ? 'bg-white/40 text-white scale-100'
                    : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white opacity-0 group-hover:opacity-100'
                }`}
                title={followedArtists.some(a => (a.id || a.browseId) === (artist.id || artist.browseId)) ? "Unfollow artist" : "Follow artist"}
              >
                {followedArtists.some(a => (a.id || a.browseId) === (artist.id || artist.browseId)) ? (
                  <Check size={14} className="animate-in zoom-in duration-200" strokeWidth={3} />
                ) : (
                  <Plus size={14} className="animate-in zoom-in duration-200" />
                )}
              </button>

              <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{artist.name}</span>
            </div>
          )))}
        </div>
      </section>

      {/* 1.5 Your Songs Row (Only visible if followed artists exist) */}
      {followedArtistSongs && followedArtistSongs.length > 0 && (
        <section className={ytSearchResults ? 'order-3' : 'order-2'}>
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Your Songs</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollContainer(followedScrollRef, 'left')} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scrollContainer(followedScrollRef, 'right')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div ref={followedScrollRef} className="flex overflow-x-auto gap-6 pb-4 px-2 snap-x hide-scrollbar">
            {followedArtistSongs.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`song-skel-${i}`} className="flex flex-col gap-3 flex-shrink-0 w-44 snap-start">
                  <div className="w-44 h-56 rounded-2xl bg-white/5 animate-pulse" />
                  <div className="flex flex-col gap-2 px-1">
                    <div className="w-3/4 h-4 bg-white/5 rounded animate-pulse" />
                    <div className="w-1/2 h-3 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              followedArtistSongs.map((song, i) => (
              <div 
                key={song.videoId + '-' + i} 
                onClick={() => streamTrack(song, followedArtistSongs)}
                onMouseEnter={() => preloadTrack(song)}
                className="flex flex-col gap-3 flex-shrink-0 w-44 cursor-pointer group snap-start"
              >
                <div className="w-44 h-56 rounded-2xl overflow-hidden border border-white/10 shadow-xl relative transition-transform duration-300 group-hover:-translate-y-2 group-active:scale-95">
                  {(song.coverUrl || song.thumbnail) ? (
                    <RetryImage src={getHighResUrl(song.coverUrl || song.thumbnail)} fallbackSrc={song.coverUrl || song.thumbnail} alt={song.title} loading="lazy" className="w-full h-full object-cover" />
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
                          toggleFavorite(dbSong?.id || song.videoId, isFav ? 0 : 1, song);
                        }}
                        className={`mt-0.5 text-white/50 hover:text-white hover:scale-110 active:scale-90 transition-all ${isFav ? 'text-white' : ''}`}
                      >
                        <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                      </button>
                    );
                  })()}
                </div>
              </div>
            )))}
          </div>
        </section>
      )}

      {/* 2. Trendy Songs Row */}
      <section className={ytSearchResults ? 'order-2' : 'order-3'}>
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
          {(!ytSearchResults && trendingSongs.length === 0) ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`trend-skel-${i}`} className="flex flex-col gap-3 flex-shrink-0 w-44 snap-start">
                <div className="w-44 h-56 rounded-2xl bg-white/5 animate-pulse" />
                <div className="flex flex-col gap-2 px-1">
                  <div className="w-3/4 h-4 bg-white/5 rounded animate-pulse" />
                  <div className="w-1/2 h-3 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : (
            (ytSearchResults || trendingSongs).map((song) => (
            <div 
              key={song.videoId} 
              onClick={() => streamTrack(song, ytSearchResults || trendingSongs)}
              onMouseEnter={() => preloadTrack(song)}
              className="flex flex-col gap-3 flex-shrink-0 w-44 cursor-pointer group snap-start"
            >
              <div className="w-44 h-56 rounded-2xl overflow-hidden border border-white/10 shadow-xl relative transition-transform duration-300 group-hover:-translate-y-2 group-active:scale-95">
                {(song.coverUrl || song.thumbnail) ? (
                  <RetryImage src={getHighResUrl(song.coverUrl || song.thumbnail)} fallbackSrc={song.coverUrl || song.thumbnail} alt={song.title} loading="lazy" className="w-full h-full object-cover" />
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
          )))}
        </div>
      </section>

      {/* 3. Recently Played */}
      <section className="order-4">
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
