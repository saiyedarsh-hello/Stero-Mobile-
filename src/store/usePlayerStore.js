import { create } from 'zustand';

// Mock data fallback for browser testing
const MOCK_SONGS = [
  {
    id: 1001,
    filepath: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Neon Horizon',
    artist: 'Lazerhawk',
    album: 'Redline',
    duration: 372,
    genre: 'Synthwave',
    year: 2010,
    track_number: 1,
    has_artwork: 1,
    artwork_path: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&q=80',
    added_at: Date.now() - 86400000 * 2,
    play_count: 14,
    favorite: 1
  },
  {
    id: 1002,
    filepath: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    title: 'Stardust Drive',
    artist: 'Miami Nights 1984',
    album: 'Turbulence',
    duration: 425,
    genre: 'Synthwave',
    year: 2012,
    track_number: 3,
    has_artwork: 1,
    artwork_path: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&q=80',
    added_at: Date.now() - 86400000 * 5,
    play_count: 28,
    favorite: 1
  },
  {
    id: 1003,
    filepath: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    title: 'Aether Wave',
    artist: 'Antigravity',
    album: 'Deep Mind Resonance',
    duration: 344,
    genre: 'Ambient',
    year: 2026,
    track_number: 2,
    has_artwork: 1,
    artwork_path: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=150&q=80',
    added_at: Date.now() - 86400000,
    play_count: 5,
    favorite: 0
  },
  {
    id: 1004,
    filepath: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    title: 'Resonance',
    artist: 'Home',
    album: 'Odyssey',
    duration: 302,
    genre: 'Chillwave',
    year: 2014,
    track_number: 5,
    has_artwork: 1,
    artwork_path: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150&q=80',
    added_at: Date.now() - 86400000 * 10,
    play_count: 42,
    favorite: 1
  }
];

const MOCK_PLAYLISTS = [
  { id: 101, name: 'Late Night Drives', created_at: Date.now(), songIds: [1001, 1002] },
  { id: 102, name: 'Coding Focus', created_at: Date.now(), songIds: [1003, 1004] }
];

export const usePlayerStore = create((set, get) => ({
  // Library Data
  songs: [],
  playlists: [],
  customAlbums: [],
  currentPlaylistSongs: [],
  
  // App Settings
  // App Settings
  appSettings: {},
  
  // Theming
  dominantColor: { h: 0, s: 0, l: 100 },
  setDominantColor: (color) => set({ dominantColor: color }),

  // Cached trending data so it only fetches once per session
  trendingArtists: [],
  trendingSongs: [],
  setTrendingData: (artists, songs) => set({ trendingArtists: artists, trendingSongs: songs }),
  
  ytSearchResults: null,
  setYtSearchResults: (results) => set({ ytSearchResults: results }),
  
  ytArtistSearchResults: null,
  setYtArtistSearchResults: (results) => set({ ytArtistSearchResults: results }),
  
  // Followed Artists
  followedArtists: [],
  followedArtistSongs: [],
  
  // Navigation & View
  activeView: 'music', // 'songs', 'favorites', 'playlist-detail', 'album-detail', 'downloads'
  selectedPlaylistId: null,
  selectedAlbumName: null,
  selectedAlbumId: null,
  searchQuery: '',

  viewHistory: [{
    activeView: 'dashboard',
    selectedPlaylistId: null,
    selectedAlbumName: null,
    selectedAlbumId: null,
  }],
  historyIndex: 0,

  // Playback State
  activeTrack: null,
  isPlaying: false,
  volume: 1,
  progress: 0,
  duration: 0,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: 'none', // none, all, one
  playHistory: [], // True history of played trackss as a loop counter
  repeatMode: 0, // functions as a loop counter
  cycleRepeatMode: () => set(state => ({ repeatMode: (state.repeatMode + 1) % 5 })),
  decrementRepeatMode: () => set(state => ({ repeatMode: Math.max(0, state.repeatMode - 1) })),
  activePlaylistId: null,

  // Session restore — position to seek to when audio is ready
  savedPosition: 0,
  clearSavedPosition: () => set({ savedPosition: 0 }),

  // Scanning Progress
  scanStatus: {
    current: 0,
    total: 0,
    status: 'idle', // idle, started, scanning, completed
  },

  // Track being edited (global modal trigger)
  editingSong: null,
  setEditingSong: (song) => set({ editingSong: song }),

  // Playlist being edited (global modal trigger)
  editingPlaylist: null,
  setEditingPlaylist: (playlist) => set({ editingPlaylist: playlist }),

  // Downloads State
  downloadState: {
    active: [],
    queue: [],
    completed: []
  },
  
  initDownloadListener: () => {
    if (!window.electron) return;
    
    // Initial fetch
    window.electron.ytGetQueue().then(state => {
      set({ downloadState: state });
    });

    // Subscribe to progress
    window.electron.onDownloadProgress((state) => {
      set({ downloadState: state });
    });

    // Refresh library when a download successfully completes and inserts into DB
    window.electron.onDownloadCompleted(() => {
      get().fetchLibrary();
    });
  },

  startDownload: async (songMeta) => {
    if (!window.electron) return { success: false, message: 'Electron not available' };
    
    // Downloader expects videoId, but sometimes it is only under `id` for stream tracks
    const trackForDownload = { ...songMeta, videoId: songMeta.videoId || songMeta.id };

    let savedFolder = await window.electron.getSavedFolder();
    if (!savedFolder) {
      const folderPath = await window.electron.selectFolder();
      if (!folderPath) {
        return { success: false, message: 'Download cancelled. No folder selected.' };
      }
      // Save and set the folder
      await window.electron.scanFolder(folderPath);
    }

    return await window.electron.ytDownload(trackForDownload);
  },

  cancelDownload: async (videoId) => {
    if (!window.electron) return { success: false, message: 'Electron not available' };
    return await window.electron.ytCancelDownload(videoId);
  },

  deleteSong: async (songId) => {
    if (!window.electron) return;
    await window.electron.deleteSong(songId);
    get().fetchLibrary();
  },

  // Actions
  fetchTrendingSongs: async (language) => {
    if (!window.electron) return [];
    return await window.electron.ytSearchTrending(`top ${language} songs`, 'song');
  },

  fetchTrendingArtists: async (language) => {
    if (!window.electron) return [];
    const results = await window.electron.ytSearchTrending(`top 10 monthly ${language} artist`, 'artist');
    // Ensure we only return top 10
    return results.slice(0, 10);
  },

  fetchFollowedArtistsSongs: async (artists) => {
    if (!window.electron || !artists || artists.length === 0) {
      set({ followedArtistSongs: [] });
      return;
    }
    
    try {
      const promises = artists.map(artist => window.electron.ytSearch(`${artist.name} songs`));
      const results = await Promise.all(promises);
      
      let combined = [];
      results.forEach(res => {
         if (res && res.length > 0) {
            combined = combined.concat(res.slice(0, 10));
         }
      });
      
      combined.sort(() => Math.random() - 0.5);
      set({ followedArtistSongs: combined });
    } catch (err) {
      console.error("Failed to fetch followed artist songs", err);
    }
  },

  toggleFollowArtist: (artist) => {
    const { followedArtists } = get();
    const isFollowed = followedArtists.some(a => (a.id || a.browseId) === (artist.id || artist.browseId));
    let newFollowed;
    
    if (isFollowed) {
      newFollowed = followedArtists.filter(a => (a.id || a.browseId) !== (artist.id || artist.browseId));
    } else {
      newFollowed = [...followedArtists, artist];
    }
    
    set({ followedArtists: newFollowed });
    localStorage.setItem('stero-followed-artists', JSON.stringify(newFollowed));
    
    get().fetchFollowedArtistsSongs(newFollowed);
  },

  fetchLibrary: async () => {
    if (!window.electron) {
      console.warn('window.electron is undefined. Running in mock/browser mode.');
      set({ songs: MOCK_SONGS, playlists: MOCK_PLAYLISTS, customAlbums: [] });
      return;
    }

    let loadedSongs = [];
    try {
      loadedSongs = await window.electron.getSongs() || [];
      set(state => {
        const activeExists = loadedSongs.some(s => s.id === state.activeTrack?.id);
        const filteredQueue = state.queue.filter(qSong => loadedSongs.some(s => s.id === qSong.id));
        const newQueueIndex = state.activeTrack && activeExists 
          ? filteredQueue.findIndex(s => s.id === state.activeTrack.id) 
          : -1;

        return { 
          songs: loadedSongs,
          queue: filteredQueue,
          queueIndex: newQueueIndex,
          activeTrack: activeExists ? state.activeTrack : null,
          isPlaying: activeExists ? state.isPlaying : false
        };
      });
    } catch (err) {
      console.error('Failed to fetch songs:', err);
    }

    try {
      const playlists = await window.electron.getPlaylists() || [];
      set({ playlists });
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    }

    try {
      const customAlbums = await window.electron.getCustomAlbums() || [];
      set({ customAlbums });
    } catch (err) {
      console.error('Failed to fetch custom albums:', err);
    }

    try {
      const appSettings = await window.electron.getSettings() || {};
      set({ appSettings });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }

    // Restore last session after songs are loaded
    get().restoreSession(loadedSongs || []);
  },

  updateAppSetting: async (key, value) => {
    if (!window.electron) {
      set(state => ({
        appSettings: { ...state.appSettings, [key]: value }
      }));
      return;
    }
    try {
      const newSettings = await window.electron.updateSetting(key, value);
      set({ appSettings: newSettings });
    } catch (err) {
      console.error('Failed to update setting', err);
    }
  },

  restoreSession: (songs) => {
    try {
      const followed = localStorage.getItem('stero-followed-artists');
      if (followed) {
        const parsed = JSON.parse(followed);
        set({ followedArtists: parsed });
        get().fetchFollowedArtistsSongs(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore followed artists:', e);
    }

    const sessionData = localStorage.getItem('stero-player-session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (session) {
          // Restore track from songs DB or fallback to serialized track object (for ephemeral streams)
          const trackToPlay = songs.find(s => s.id === session.trackId) || session.track;
          if (trackToPlay) {
            set({
              activeTrack: trackToPlay,
              isPlaying: session.isPlaying ?? false, // Restore isPlaying state!
              volume: session.volume ?? 0.8,
              muted: session.muted ?? false,
              shuffle: session.shuffle ?? false,
              repeatMode: session.repeatMode ?? 0,
              currentRepeatCount: 0,
              savedPosition: session.currentTime ?? 0,
              queue: songs,
              queueIndex: songs.findIndex(s => s.id === trackToPlay.id),
              activePlaylistId: session.activePlaylistId ?? null,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to restore player session:', e);
      }
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setActiveView: (view, extra = {}) => {
    const newState = {
      activeView: view,
      selectedPlaylistId: extra.playlistId || null,
      selectedAlbumName: extra.albumName || null,
      selectedAlbumId: extra.albumId || null,
    };

    set(state => {
      // Don't add duplicate of current view to history
      const current = state.viewHistory[state.historyIndex];
      if (
        current &&
        current.activeView === newState.activeView &&
        current.selectedPlaylistId === newState.selectedPlaylistId &&
        current.selectedAlbumName === newState.selectedAlbumName &&
        current.selectedAlbumId === newState.selectedAlbumId
      ) {
        return newState;
      }

      const newHistory = state.viewHistory.slice(0, state.historyIndex + 1);
      newHistory.push(newState);
      
      if (newHistory.length > 50) newHistory.shift();

      return {
        ...newState,
        viewHistory: newHistory,
        historyIndex: newHistory.length - 1
      };
    });
    
    if (view === 'playlist-detail' && extra.playlistId) {
      get().fetchPlaylistSongs(extra.playlistId);
    }
  },

  goBackView: () => {
    set(state => {
      if (state.historyIndex > 0) {
        const prevIndex = state.historyIndex - 1;
        const prevState = state.viewHistory[prevIndex];
        return {
          ...prevState,
          historyIndex: prevIndex
        };
      }
      return {};
    });
  },

  goForwardView: () => {
    set(state => {
      if (state.historyIndex < state.viewHistory.length - 1) {
        const nextIndex = state.historyIndex + 1;
        const nextState = state.viewHistory[nextIndex];
        return {
          ...nextState,
          historyIndex: nextIndex
        };
      }
      return {};
    });
  },


  // Custom Album Actions
  fetchCustomAlbums: async () => {
    if (!window.electron) return;
    try {
      const customAlbums = await window.electron.getCustomAlbums();
      set({ customAlbums });
    } catch (err) {
      console.error('Failed to fetch custom albums:', err);
    }
  },

  createCustomAlbum: async (name, coverPath, songIds) => {
    try {
      let newAlbum;
      if (window.electron) {
        newAlbum = await window.electron.createCustomAlbum(name, coverPath, songIds);
      } else {
        // mock mode
        newAlbum = { id: Date.now(), name, cover_path: coverPath, created_at: Date.now(), songs: [] };
      }
      if (!newAlbum) return;
      // Patch songs in store to show new album name
      const patchSong = (s) => songIds.includes(s.id) ? { ...s, album: name } : s;
      set(state => ({
        customAlbums: [...state.customAlbums, { ...newAlbum, songs: state.songs.filter(s => songIds.includes(s.id)) }],
        songs: state.songs.map(patchSong),
        queue: state.queue.map(patchSong),
        currentPlaylistSongs: state.currentPlaylistSongs.map(patchSong),
        activeTrack: state.activeTrack && songIds.includes(state.activeTrack.id)
          ? { ...state.activeTrack, album: name }
          : state.activeTrack
      }));
      return newAlbum;
    } catch (err) {
      console.error('Failed to create custom album:', err);
    }
  },

  updateCustomAlbum: async (albumId, name, coverPath, songIds) => {
    try {
      if (songIds.length === 0) {
        await get().deleteCustomAlbum(albumId);
        return null;
      }

      let updatedAlbum;
      if (window.electron && window.electron.updateCustomAlbum) {
        updatedAlbum = await window.electron.updateCustomAlbum(albumId, name, coverPath, songIds);
      } else {
        updatedAlbum = { id: albumId, name, cover_path: coverPath };
      }

      set(state => {
        const oldAlbum = state.customAlbums.find(a => a.id === albumId);
        const oldName = oldAlbum ? oldAlbum.name : name;

        const updatedCustomAlbums = state.customAlbums.map(album => {
          if (album.id === albumId) {
            return {
              ...album,
              name,
              cover_path: coverPath,
              songs: state.songs.filter(s => songIds.includes(s.id))
            };
          }
          return album;
        });

        const patchSong = (s) => {
          if (songIds.includes(s.id)) return { ...s, album: name };
          if (s.album === oldName) return { ...s, album: 'Unknown' };
          return s;
        };

        return {
          customAlbums: updatedCustomAlbums,
          songs: state.songs.map(patchSong),
          queue: state.queue.map(patchSong),
          currentPlaylistSongs: state.currentPlaylistSongs.map(patchSong),
          activeTrack: state.activeTrack ? patchSong(state.activeTrack) : null,
          selectedAlbumName: state.selectedAlbumId === albumId ? name : state.selectedAlbumName
        };
      });

      return updatedAlbum;
    } catch (err) {
      console.error('Failed to update custom album:', err);
    } finally {
      if (window.electron) {
        get().fetchLibrary();
      }
    }
  },

  deleteCustomAlbum: async (albumId) => {
    try {
      const deletedAlbum = get().customAlbums.find(a => a.id === albumId);
      const deletedName = deletedAlbum ? deletedAlbum.name : '';

      if (window.electron) {
        await window.electron.deleteCustomAlbum(albumId);
      }
      set(state => {
        const cleanSong = (s) => s.album === deletedName ? { ...s, album: 'Unknown' } : s;
        return {
          customAlbums: state.customAlbums.filter(a => a.id !== albumId),
          songs: state.songs.map(cleanSong),
          queue: state.queue.map(cleanSong),
          activeTrack: state.activeTrack && state.activeTrack.album === deletedName
            ? { ...state.activeTrack, album: 'Unknown' }
            : state.activeTrack,
          activeView: state.activeView === 'album-detail' && state.selectedAlbumId === albumId
            ? 'albums' : state.activeView
        };
      });
    } catch (err) {
      console.error('Failed to delete album:', err);
    }
  },

  // Scanning Folder (first time — opens picker, saves the path)
  scanFolder: async () => {
    try {
      if (!window.electron) {
        alert('Scanning requires running inside the Stero Electron application.');
        return;
      }
      set({ scanStatus: { current: 0, total: 0, status: 'started' } });
      const folderPath = await window.electron.selectFolder();
      if (!folderPath) {
        set({ scanStatus: { current: 0, total: 0, status: 'idle' } });
        return;
      }
      
      const songs = await window.electron.scanFolder(folderPath);
      set({ songs });
    } catch (err) {
      console.error('Error scanning folder:', err);
      set({ scanStatus: { current: 0, total: 0, status: 'idle' } });
    }
  },

  // Resync — reuse previously saved folder path (no picker dialog)
  resyncFolder: async () => {
    try {
      if (!window.electron) return;

      const savedFolder = await window.electron.getSavedFolder();
      if (!savedFolder) {
        // No folder saved yet — fall back to folder picker
        await get().scanFolder();
        return;
      }
      
      set({ scanStatus: { current: 0, total: 0, status: 'started' } });
      const songs = await window.electron.scanFolder(savedFolder);
      set({ songs });
    } catch (err) {
      console.error('Error resyncing folder:', err);
      set({ scanStatus: { current: 0, total: 0, status: 'idle' } });
    }
  },

  setScanStatus: (status) => set({ scanStatus: status }),

  updateSongMeta: async (songId, meta) => {
    // Optimistic update — apply immediately from form data so UI reflects change at once
    const applyPatch = (data) => {
      const patch = (s) => s.id === songId ? { ...s, ...data } : s;
      set(state => ({
        songs: state.songs.map(patch),
        queue: state.queue.map(patch),
        currentPlaylistSongs: state.currentPlaylistSongs.map(patch),
        customAlbums: state.customAlbums.map(album => ({
          ...album,
          songs: (album.songs || []).map(patch)
        })),
        activeTrack: state.activeTrack?.id === songId
          ? { ...state.activeTrack, ...data }
          : state.activeTrack,
        // Keep editingSong in sync so the modal shows fresh data
        editingSong: state.editingSong?.id === songId
          ? { ...state.editingSong, ...data }
          : state.editingSong
      }));
    };

    // Apply optimistic patch right away
    applyPatch(meta);

    // Persist to DB (Electron) and re-patch with canonical DB row if returned
    if (window.electron) {
      try {
        const dbRow = await window.electron.updateSong(songId, meta);
        if (dbRow) {
          applyPatch(dbRow);
          // Reload the library so custom playlist mappings (customAlbums) are refreshed from SQLite
          await get().fetchLibrary();
        }
      } catch (err) {
        console.error('Failed to persist song meta to DB:', err);
      }
    }
  },

  // Playback Actions
  streamTrack: async (songMeta, trackList = []) => {
    if (!window.electron) return;
    
    // Map the incoming youtube track list to standard track objects so the queue and visualizer work perfectly
    const mappedList = trackList.map(t => ({
      id: t.videoId || t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork_path: t.coverUrl || t.thumbnail || t.artwork_path,
      has_artwork: !!(t.coverUrl || t.thumbnail || t.artwork_path),
      isStream: true,
      filepath: t.filepath || '',
      duration: t.duration || 0
    }));

    // Find the current track in the mapped list, or fallback to standalone
    const tempTrack = mappedList.find(t => t.id === (songMeta.videoId || songMeta.id)) || {
      id: songMeta.videoId || songMeta.id,
      title: songMeta.title,
      artist: songMeta.artist,
      album: songMeta.album,
      artwork_path: songMeta.coverUrl || songMeta.thumbnail || songMeta.artwork_path,
      has_artwork: !!(songMeta.coverUrl || songMeta.thumbnail || songMeta.artwork_path),
      isStream: true,
      filepath: songMeta.filepath || '',
      duration: songMeta.duration || 0
    };
    
    get().addToHistory(tempTrack);

    // Play immediately to show UI (will be silent/buffering until URL is fetched)
    get().playTrack(tempTrack, mappedList.length > 0 ? mappedList : [tempTrack]);
    
    // Fetch direct stream URL if not already resolved
    if (tempTrack.filepath && tempTrack.filepath.startsWith('http')) {
      setTimeout(() => {
        get().preloadNextTrack();
      }, 1000);
      return;
    }

    const result = await window.electron.ytGetStreamUrl(tempTrack.id);
    if (result && result.success && result.url) {
      set(state => ({
        activeTrack: state.activeTrack?.id === tempTrack.id 
          ? { ...state.activeTrack, filepath: result.url } 
          : state.activeTrack
      }));
      setTimeout(() => {
        get().preloadNextTrack();
      }, 1000);
    } else {
      console.error("Failed to fetch stream URL", result);
    }
  },

  addToHistory: (track) => {
    set((state) => {
      // Remove duplicate if it exists, then prepend to top
      const filtered = state.playHistory.filter(t => (t.videoId || t.id) !== (track.videoId || track.id));
      const newHistory = [track, ...filtered].slice(0, 20); // Keep last 20
      return { playHistory: newHistory };
    });
  },

  playTrack: (track, trackList = [], playlistId = undefined) => {
    get().addToHistory(track);
    // Unify routing: If the track is a saved stream pointer in the DB, redirect it directly into the streaming pipeline!
    if (track.filepath && track.filepath.startsWith('yt-stream://')) {
      const videoId = track.filepath.replace('yt-stream://', '');
      get().streamTrack({ ...track, videoId }, trackList);
      return;
    }

    const list = trackList.length > 0 ? trackList : [track];
    const index = list.findIndex(t => t.id === track.id);
    
    let resolvedPlaylistId = null;
    if (playlistId !== undefined) {
      resolvedPlaylistId = playlistId;
    } else {
      const state = get();
      if (state.activeView === 'album-detail' || state.activeView === 'playlist-detail') {
        resolvedPlaylistId = state.selectedAlbumId || state.selectedPlaylistId;
      }
    }

    set({
      activeTrack: track,
      queue: list,
      queueIndex: index !== -1 ? index : 0,
      isPlaying: true,
      activePlaylistId: resolvedPlaylistId,
      currentRepeatCount: 0,
      savedPosition: 0
    });

    // Increment play count in DB and update state
    if (window.electron) {
      window.electron.incrementPlayCount(track.id);
    }
    set(state => ({
      songs: state.songs.map(s => s.id === track.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s)
    }));

    setTimeout(() => {
      get().preloadNextTrack();
    }, 1000);
  },

  preloadNextTrack: async () => {
    const { queue, queueIndex, shuffle } = get();
    if (queue.length <= 1) return;

    let nextIndex;
    if (shuffle) {
      nextIndex = (queueIndex + 1) % queue.length;
    } else {
      nextIndex = queueIndex + 1;
    }

    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      if (nextTrack && nextTrack.isStream && !nextTrack.filepath && window.electron) {
        console.log(`[Preload] Resolving stream URL in background for next track: ${nextTrack.title}`);
        window.electron.ytGetStreamUrl(nextTrack.id).then(result => {
          if (result && result.success && result.url) {
            set(state => {
              const updatedQueue = state.queue.map((t, idx) => 
                idx === nextIndex ? { ...t, filepath: result.url } : t
              );
              return { 
                queue: updatedQueue,
                activeTrack: state.activeTrack?.id === nextTrack.id && !state.activeTrack.filepath
                  ? { ...state.activeTrack, filepath: result.url }
                  : state.activeTrack
              };
            });
            console.log(`[Preload] Successfully preloaded stream URL for: ${nextTrack.title}`);
          }
        }).catch(err => console.warn('[Preload] Failed to preload:', err));
      }
    }
  },

  preloadTrack: async (track) => {
    if (!track || !window.electron) return;
    const videoId = track.videoId || track.id;
    if (typeof videoId !== 'string' || videoId.length !== 11) return;
    
    if (track.filepath && track.filepath.startsWith('http')) return;

    window.electron.ytGetStreamUrl(videoId).then(result => {
      if (result && result.success && result.url) {
        console.log(`[Preload] Pre-resolved successfully for hover: ${track.title}`);
        set(state => {
          const updateSong = (s) => (s.videoId === videoId || s.id === videoId) ? { ...s, filepath: result.url } : s;
          return {
            songs: state.songs.map(updateSong),
            queue: state.queue.map(updateSong),
            ytSearchResults: state.ytSearchResults ? state.ytSearchResults.map(updateSong) : null,
            trendingSongs: state.trendingSongs.map(updateSong)
          };
        });
      }
    }).catch(err => console.warn('[Preload] Hover preload failed:', err));
  },

  togglePlay: () => {
    const { activeTrack, songs } = get();
    if (!activeTrack && songs.length > 0) {
      // Play first song in list if nothing is active
      get().playTrack(songs[0], songs);
      return;
    }
    set(state => ({ isPlaying: !state.isPlaying }));
  },

  nextTrack: () => {
    const { queue, queueIndex, shuffle } = get();
    if (queue.length === 0) return;

    let nextIndex;
    
    if (shuffle) {
      if (queue.length > 1) {
        // Find a random index different from current index
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === queueIndex);
      } else {
        nextIndex = 0;
      }
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        // End of queue and no repeat-all
        set({ isPlaying: false });
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      set({ activeTrack: nextTrack, queueIndex: nextIndex, isPlaying: true, currentRepeatCount: 0 });
      if (window.electron) {
        window.electron.incrementPlayCount(nextTrack.id);
      }
      set(state => ({
        songs: state.songs.map(s => s.id === nextTrack.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s)
      }));

      if (nextTrack.isStream && !nextTrack.filepath && window.electron) {
        window.electron.ytGetStreamUrl(nextTrack.id).then(result => {
           if (result && result.success && result.url) {
             set(state => ({
               activeTrack: state.activeTrack?.id === nextTrack.id 
                 ? { ...state.activeTrack, filepath: result.url } 
                 : state.activeTrack
             }));
           }
        }).catch(err => console.error("Failed to fetch stream for next track:", err));
      }

      setTimeout(() => {
        get().preloadNextTrack();
      }, 1000);
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, shuffle } = get();
    if (queue.length === 0) return;

    let prevIndex;

    if (shuffle) {
      if (queue.length > 1) {
        do {
          prevIndex = Math.floor(Math.random() * queue.length);
        } while (prevIndex === queueIndex);
      } else {
        prevIndex = 0;
      }
    } else {
      prevIndex = queueIndex - 1;
      if (prevIndex < 0) {
        // Stay at the first song
        prevIndex = 0;
      }
    }

    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      set({ activeTrack: prevTrack, queueIndex: prevIndex, isPlaying: true, currentRepeatCount: 0 });

      if (prevTrack.isStream && !prevTrack.filepath && window.electron) {
        window.electron.ytGetStreamUrl(prevTrack.id).then(result => {
           if (result && result.success && result.url) {
             set(state => ({
               activeTrack: state.activeTrack?.id === prevTrack.id 
                 ? { ...state.activeTrack, filepath: result.url } 
                 : state.activeTrack
             }));
           }
        }).catch(err => console.error("Failed to fetch stream for prev track:", err));
      }

      setTimeout(() => {
        get().preloadNextTrack();
      }, 1000);
    }
  },

  setVolume: (vol) => set({ volume: vol }),
  setMuted: (isMuted) => set({ muted: isMuted }),
  setShuffle: (shuf) => set({ shuffle: shuf }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  incrementRepeatCount: () => set(state => ({ currentRepeatCount: state.currentRepeatCount + 1 })),
  resetRepeatCount: () => set({ currentRepeatCount: 0 }),

  // Favorites Operations
  toggleFavorite: async (songId, favoriteStatus, trackObj = null) => {
    if (!window.electron) return;

    // Handle ephemeral streaming tracks that aren't in the DB yet
    if (typeof songId === 'string') {
      const trackMeta = trackObj || (get().activeTrack?.id === songId ? get().activeTrack : null);
      if (!trackMeta) return;

      try {
        const newDbSong = await window.electron.addStreamSongToDb(trackMeta);
        await window.electron.toggleFavorite(newDbSong.id, favoriteStatus);
        
        // Update active track with its new real integer ID if it's currently playing
        if (get().activeTrack?.id === songId || get().activeTrack?.videoId === songId) {
          set(state => ({ 
            activeTrack: { ...state.activeTrack, id: newDbSong.id, filepath: newDbSong.filepath, favorite: favoriteStatus }
          }));
        }
        
        await get().fetchLibrary();
      } catch (err) {
        console.error("Failed to favorite stream track:", err);
      }
      return;
    }

    try {
      await window.electron.toggleFavorite(songId, favoriteStatus);
      
      // Update local state arrays
      const updateSong = (s) => s.id === songId ? { ...s, favorite: favoriteStatus } : s;
      
      set(state => ({
        songs: state.songs.map(updateSong),
        queue: state.queue.map(updateSong),
        currentPlaylistSongs: state.currentPlaylistSongs.map(updateSong),
        activeTrack: state.activeTrack && state.activeTrack.id === songId 
          ? { ...state.activeTrack, favorite: favoriteStatus } 
          : state.activeTrack
      }));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  },

  // Playlists Operations
  createPlaylist: async (name) => {
    if (!name.trim()) return;
    try {
      if (window.electron) {
        const newPlaylist = await window.electron.createPlaylist(name);
        if (newPlaylist) {
          const playlists = await window.electron.getPlaylists();
          set({ playlists });
        }
      } else {
        const newId = MOCK_PLAYLISTS.length + 101;
        MOCK_PLAYLISTS.push({ id: newId, name, created_at: Date.now(), songIds: [] });
        set({ playlists: [...MOCK_PLAYLISTS] });
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  },

  deletePlaylist: async (playlistId) => {
    try {
      if (window.electron) {
        const updatedPlaylists = await window.electron.deletePlaylist(playlistId);
        set({ playlists: updatedPlaylists });
      } else {
        const idx = MOCK_PLAYLISTS.findIndex(p => p.id === playlistId);
        if (idx !== -1) MOCK_PLAYLISTS.splice(idx, 1);
        set({ playlists: [...MOCK_PLAYLISTS] });
      }
      
      // If we are currently viewing the deleted playlist, redirect to dashboard
      const { activeView, selectedPlaylistId } = get();
      if (activeView === 'playlist-detail' && selectedPlaylistId === playlistId) {
        set({ activeView: 'dashboard', selectedPlaylistId: null });
      }
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    try {
      if (window.electron) {
        const updatedSongs = await window.electron.addSongToPlaylist(playlistId, songId);
        
        // If we are currently viewing this playlist, update the songs list
        const { activeView, selectedPlaylistId } = get();
        if (activeView === 'playlist-detail' && selectedPlaylistId === playlistId) {
          set({ currentPlaylistSongs: updatedSongs });
        }
      } else {
        const playlist = MOCK_PLAYLISTS.find(p => p.id === playlistId);
        if (playlist && !playlist.songIds.includes(songId)) {
          playlist.songIds.push(songId);
          get().fetchPlaylistSongs(playlistId);
        }
      }
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    try {
      if (window.electron) {
        const updatedSongs = await window.electron.removeSongFromPlaylist(playlistId, songId);
        
        if (updatedSongs && updatedSongs.length === 0) {
          await get().deletePlaylist(playlistId);
        } else {
          // If we are currently viewing this playlist, update the songs list
          const { activeView, selectedPlaylistId } = get();
          if (activeView === 'playlist-detail' && selectedPlaylistId === playlistId) {
            set({ currentPlaylistSongs: updatedSongs });
          }
        }
      } else {
        const playlist = MOCK_PLAYLISTS.find(p => p.id === playlistId);
        if (playlist) {
          playlist.songIds = playlist.songIds.filter(id => id !== songId);
          if (playlist.songIds.length === 0) {
            get().deletePlaylist(playlistId);
          } else {
            get().fetchPlaylistSongs(playlistId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to remove song from playlist:', err);
    }
  },

  fetchPlaylistSongs: async (playlistId) => {
    try {
      if (window.electron) {
        const songs = await window.electron.getPlaylistSongs(playlistId);
        set({ currentPlaylistSongs: songs });
      } else {
        const playlist = MOCK_PLAYLISTS.find(p => p.id === playlistId);
        if (playlist) {
          const list = playlist.songIds
            .map(id => MOCK_SONGS.find(s => s.id === id))
            .filter(Boolean);
          set({ currentPlaylistSongs: list });
        } else {
          set({ currentPlaylistSongs: [] });
        }
      }
    } catch (err) {
      console.error('Failed to fetch playlist songs:', err);
    }
  }
}));
