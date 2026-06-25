import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../core';
import { Audio } from 'expo-av';
import ytdl from 'react-native-ytdl';
import YTMusic from 'ytmusic-api';

export default function MobileNativeProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const ytApiRef = useRef<any>(null);
  
  // Subscribe to store state
  const activeTrack = usePlayerStore(state => state.activeTrack);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const volume = usePlayerStore(state => state.volume);

  // 1. Polyfill window.electron for the core store
  useEffect(() => {
    // Initialize YTMusic API
    const initApi = async () => {
      const api = new YTMusic();
      await api.initialize();
      ytApiRef.current = api;
      console.log('[MobileNative] YTMusic API initialized');
    };
    initApi();

    // @ts-ignore
    window.electron = {
      ytGetStreamUrl: async (id: string) => {
        try {
          console.log('[MobileNative] Fetching stream for:', id);
          const urls = await ytdl(id, { quality: 'highestaudio' });
          return { success: true, url: urls[0].url };
        } catch (e: any) {
          console.error('[MobileNative] ytGetStreamUrl error:', e);
          return { success: false, error: e.message };
        }
      },
      incrementPlayCount: (id: string) => {
        console.log('[MobileNative] Incremented play count for:', id);
      },
      ytSearch: async (query: string) => {
        console.log('[MobileNative] Searching for:', query);
        if (!ytApiRef.current) return [];
        try {
          const results = await ytApiRef.current.search(query, 'SONG');
          return results.map((r: any) => ({
            id: r.videoId,
            videoId: r.videoId,
            title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: Array.isArray(r.thumbnails) && r.thumbnails.length > 0 ? r.thumbnails[r.thumbnails.length - 1].url : null,
            duration: r.duration || 0,
            isStream: true
          }));
        } catch (e) {
          console.error('[MobileNative] ytSearch error:', e);
          return [];
        }
      },
      ytSearchTrending: async (query: string, type: string) => {
        console.log(`[MobileNative] Trending for: ${query} (${type})`);
        if (!ytApiRef.current) return [];
        try {
          // YTMusic API searches
          const results = await ytApiRef.current.search(query, type === 'artist' ? 'ARTIST' : 'SONG');
          
          if (type === 'artist') {
            return results.map((r: any) => ({
              id: r.browseId || r.name,
              name: r.name,
              thumbnails: r.thumbnails || []
            }));
          }

          return results.map((r: any) => ({
            id: r.videoId,
            videoId: r.videoId,
            title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: Array.isArray(r.thumbnails) && r.thumbnails.length > 0 ? r.thumbnails[r.thumbnails.length - 1].url : null,
            duration: r.duration || 0,
            isStream: true
          }));
        } catch (e) {
          console.error('[MobileNative] ytSearchTrending error:', e);
          return [];
        }
      },
      // Mock SQLite methods for now until expo-sqlite is implemented
      getSongs: async () => [],
      getPlaylists: async () => [],
      getCustomAlbums: async () => [],
      getSettings: async () => ({}),
    };
    
    // Set up Audio Session
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Trigger a library fetch now that the polyfill is injected
    usePlayerStore.getState().fetchLibrary();
  }, []);

  // 2. Audio Playback Engine for Mobile
  useEffect(() => {
    const loadAndPlayAudio = async () => {
      if (!activeTrack) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        return;
      }

      const audioUrl = activeTrack.filepath || activeTrack.url; // Use url directly if filepath is missing
      if (!audioUrl) return;

      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        console.log('[MobileNative] Loading audio:', audioUrl);
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: isPlaying, volume: volume }
        );
        
        soundRef.current = sound;
        
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            usePlayerStore.setState({ 
              progress: status.positionMillis / 1000,
              duration: status.durationMillis ? status.durationMillis / 1000 : 0
            });
            
            if (status.didJustFinish) {
              usePlayerStore.getState().nextTrack();
            }
          }
        });

      } catch (e) {
        console.error('[MobileNative] Audio playback error:', e);
      }
    };

    loadAndPlayAudio();
    
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [activeTrack?.filepath, activeTrack?.url]);

  // 3. Handle Play/Pause
  useEffect(() => {
    if (soundRef.current) {
      if (isPlaying) {
        soundRef.current.playAsync();
      } else {
        soundRef.current.pauseAsync();
      }
    }
  }, [isPlaying]);

  // 4. Handle Volume
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(volume);
    }
  }, [volume]);

  return <>{children}</>;
}
