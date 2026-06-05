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
  
  // Navigation & View
  activeView: 'songs', // 'songs', 'favorites', 'playlist-detail', 'album-detail', 'downloads'
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
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  muted: false,
  shuffle: false,
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
    return await window.electron.ytDownload(songMeta);
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
    if (loadedSongs && loadedSongs.length > 0) {
      get().restoreSession(loadedSongs);
    }
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
      const raw = localStorage.getItem('stero-player-session');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || !session.trackId) return;
      // Find the track in the freshly loaded library
      const track = songs.find(s => s.id === session.trackId);
      if (!track) return;
      set({
        activeTrack: track,
        isPlaying: session.isPlaying ?? false, // Restore isPlaying state!
        volume: session.volume ?? 0.8,
        muted: session.muted ?? false,
        shuffle: session.shuffle ?? false,
        repeatMode: session.repeatMode ?? 0,
        currentRepeatCount: 0,
        savedPosition: session.currentTime ?? 0,
        queue: songs,
        queueIndex: songs.findIndex(s => s.id === track.id),
        activePlaylistId: session.activePlaylistId ?? null,
      });
    } catch (e) {
      console.warn('Failed to restore player session:', e);
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

  // Settings Actions
  updateAppSetting: async (key, value) => {
    try {
      if (window.electron) {
        const updatedSettings = await window.electron.updateSetting(key, value);
        set({ appSettings: updatedSettings });
      } else {
        set(state => ({ appSettings: { ...state.appSettings, [key]: value } }));
      }
    } catch (err) {
      console.error('Failed to update app setting:', err);
    }
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
  playTrack: (track, trackList = [], playlistId = undefined) => {
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
      currentRepeatCount: 0
    });

    // Increment play count in DB and update state
    if (window.electron) {
      window.electron.incrementPlayCount(track.id);
    }
    set(state => ({
      songs: state.songs.map(s => s.id === track.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s)
    }));
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
    }
  },

  setVolume: (vol) => set({ volume: vol }),
  setMuted: (isMuted) => set({ muted: isMuted }),
  setShuffle: (shuf) => set({ shuffle: shuf }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  incrementRepeatCount: () => set(state => ({ currentRepeatCount: state.currentRepeatCount + 1 })),
  resetRepeatCount: () => set({ currentRepeatCount: 0 }),

  // Favorites Operations
  toggleFavorite: async (songId) => {
    const { songs } = get();
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const newFavoriteStatus = song.favorite ? 0 : 1;
    
    try {
      if (window.electron) {
        await window.electron.toggleFavorite(songId, newFavoriteStatus);
      } else {
        const mockSong = MOCK_SONGS.find(s => s.id === songId);
        if (mockSong) mockSong.favorite = newFavoriteStatus;
      }
      
      // Update local state arrays
      const updateSong = (s) => s.id === songId ? { ...s, favorite: newFavoriteStatus } : s;
      
      set(state => ({
        songs: state.songs.map(updateSong),
        queue: state.queue.map(updateSong),
        currentPlaylistSongs: state.currentPlaylistSongs.map(updateSong),
        activeTrack: state.activeTrack && state.activeTrack.id === songId 
          ? { ...state.activeTrack, favorite: newFavoriteStatus } 
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
