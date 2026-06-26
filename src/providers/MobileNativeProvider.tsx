import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../core';
import { Audio } from 'expo-av';
import YTMusic from 'ytmusic-api';
import Constants from 'expo-constants';

let ytApiInstance: any = null;

// ─────────────────────────────────────────────────────────────
// Global seek hook — lets the player UI seek without needing
// to pass refs through props.
// ─────────────────────────────────────────────────────────────
type SeekFn = (positionSeconds: number) => void;
let __globalSeekTo: SeekFn | null = null;
export function seekTo(positionSeconds: number) {
  __globalSeekTo?.(positionSeconds);
}

// ─────────────────────────────────────────────────────────────
// Hermes-compatible fetch with timeout
// (AbortSignal.timeout is NOT available on React Native Hermes)
// ─────────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ─────────────────────────────────────────────────────────────
// MASTER STREAM RESOLVER
// Priority order:
//   1. YouTube Internal API (Android client) — cipher-free, direct
//   2. JioSaavn — for Indian/Bollywood songs only (with strict matching)
//   3. Piped proxy — fallback
// ─────────────────────────────────────────────────────────────
async function resolveAudioUrl(
  videoId: string,
  title: string,
  artist: string
): Promise<string | null> {
  console.log(`[StreamResolver] Resolving "${title}" by "${artist}" (id: ${videoId})`);

  // ── Priority 1: Local PC Stream Server ───────────────────────
  // Since React Native Hermes cannot decrypt YouTube ciphers natively,
  // we route through a local Node.js proxy running alongside Expo.
  try {
    let hostIp = '127.0.0.1';
    
    // Get the packager IP address from Expo dynamically
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.packagerOpts?.hostType;
    
    if (hostUri) {
      hostIp = hostUri.split(':')[0];
    } else if (Constants.experienceUrl) {
      const match = Constants.experienceUrl.match(/\/\/([0-9.]+):/);
      if (match) hostIp = match[1];
    }

    const localStreamUrl = `http://${hostIp}:3001/stream?id=${videoId}`;
    console.log(`[StreamResolver] Requesting local server: ${localStreamUrl}`);
    
    const res = await fetchWithTimeout(localStreamUrl, {}, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        console.log(`[StreamResolver] ✅ Local Node Server SUCCESS! (Bitrate: ${data.bitrate})`);
        return data.url;
      }
    } else {
       console.log(`[StreamResolver] Local Server returned: ${res.status}`);
    }
  } catch (err: any) {
    console.log(`[StreamResolver] Local Server failed: ${err.message}. Is 'npm run stream' running?`);
  }

  console.log('[StreamResolver] Local server failed. Trying JioSaavn...');


  // ── Priority 2: JioSaavn CDN (Indian + Bollywood, also some English hits) ──
  const titleLower  = title.toLowerCase();
  const artistLower = (artist || '').toLowerCase();
  const query       = `${title} ${artist || ''}`.trim();

  const extractSaavnUrl = (r: any): string | null => {
    if (r.url) return r.url;
    if (r.downloadUrl) {
      const urls = Array.isArray(r.downloadUrl) ? r.downloadUrl : [r.downloadUrl];
      const best = urls.find((u: any) => u.quality === '320kbps') || urls[urls.length - 1];
      return best?.link || best?.url || (typeof best === 'string' ? best : null);
    }
    return null;
  };

  // Relaxed matching: title OR artist must partially match (not both required)
  const isSaavnMatch = (r: any): boolean => {
    const rt = (r.title || r.name || '').toLowerCase();
    const ra = (r.artists || r.subtitle || r.artist || '').toLowerCase();
    const junk = ['karaoke', 'cover', 'remix', 'tribute', 'instrumental'];
    if (junk.some(w => rt.includes(w) && !titleLower.includes(w))) return false;
    // At least title must have a meaningful substring overlap
    const words = titleLower.split(' ').filter(w => w.length > 2);
    return words.length > 0 && words.some(w => rt.includes(w));
  };

  for (const base of ['https://saavn-api.vercel.app', 'https://jiosaavn-api-ts.vercel.app']) {
    try {
      console.log(`[StreamResolver] Trying JioSaavn: ${base}`);
      const res = await fetchWithTimeout(`${base}/search/songs?query=${encodeURIComponent(query)}`, {}, 7000);
      if (!res.ok) continue;
      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : (data?.data?.results || data?.results || []);
      const match = results.find(isSaavnMatch);
      if (match) {
        const url = extractSaavnUrl(match);
        if (url) {
          console.log(`[StreamResolver] ✅ JioSaavn match: "${match.title || match.name}"`);
          return url;
        }
      }
    } catch (e: any) {
      console.log(`[StreamResolver] JioSaavn ${base}: ${e.message}`);
    }
  }

  // ── Priority 3: Piped API ─────────────────────────────────────
  for (const instance of [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.syncpundit.io',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.drgns.space',
  ]) {
    try {
      console.log(`[StreamResolver] Trying Piped: ${instance}`);
      const res = await fetchWithTimeout(`${instance}/streams/${videoId}`, {}, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.audioStreams?.length > 0) {
        data.audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        console.log(`[StreamResolver] ✅ Piped: ${instance}`);
        return data.audioStreams[0].url;
      }
    } catch (e: any) {
      console.log(`[StreamResolver] Piped ${instance}: ${e.message}`);
    }
  }

  console.error('[StreamResolver] ❌ All sources exhausted.');
  return null;
}


// ─────────────────────────────────────────────────────────────
// Polyfill window.electron so the Zustand store doesn't crash
// ─────────────────────────────────────────────────────────────
// @ts-ignore
if (typeof window !== 'undefined' && !window.electron) {
  // @ts-ignore
  window.electron = {
    ytGetStreamUrl: async (id: string) => ({ success: false, error: 'mobile-noop' }),
    incrementPlayCount: (_id: string) => {},
    ytSearch: async (query: string) => {
      if (!ytApiInstance) {
        const api = new YTMusic();
        await api.initialize();
        ytApiInstance = api;
      }
      try {
        const results = await ytApiInstance.search(query, 'SONG');
        const queryLower = query.toLowerCase();
        const badWords = ['karaoke', 'cover', 'tribute', 'remix', 'instrumental', 'sped up', 'slowed', 'reverb', 'bass boosted', 'type beat', '8d'];
        return results
          .filter((r: any) => {
            const t = r.name.toLowerCase();
            return !badWords.some(w => t.includes(w) && !queryLower.includes(w));
          })
          .map((r: any) => ({
            id: r.videoId, videoId: r.videoId, title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: Array.isArray(r.thumbnails) && r.thumbnails.length > 0 ? r.thumbnails[r.thumbnails.length - 1].url : null,
            duration: r.duration || 0, isStream: true,
          }));
      } catch (e) { return []; }
    },
    ytSearchTrending: async (query: string, type: string) => {
      if (!ytApiInstance) {
        const api = new YTMusic();
        await api.initialize();
        ytApiInstance = api;
      }
      try {
        let cleanQuery = query;
        if (type === 'artist' && query.includes('top 10')) {
          cleanQuery = query.replace('top 10 monthly ', '').replace(' artist', '') + ' popular artists';
        }
        const results = await ytApiInstance.search(cleanQuery, type === 'artist' ? 'ARTIST' : 'SONG');
        if (type === 'artist') {
          const fakeKw = ['karaoke','cover','tribute','remix','instrumental','sped up','slowed','reverb','bass boosted','type beat','8d','lofi','relaxing','sleep music','bgm','hits','compilation'];
          return results
            .filter((r: any) => !fakeKw.some(w => r.name.toLowerCase().includes(w)))
            .map((r: any) => ({ id: r.browseId || r.name, name: r.name, thumbnails: r.thumbnails || [] }));
        }
        const bad = ['karaoke','cover','tribute','remix','instrumental','sped up','slowed','reverb','bass boosted','type beat','8d','lofi','relaxing','bgm'];
        return results
          .filter((r: any) => {
            const t = r.name.toLowerCase();
            const a = (Array.isArray(r.artist) ? r.artist.map((x: any) => x.name).join(' ') : (r.artist?.name || '')).toLowerCase();
            return !bad.some(w => t.includes(w) || a.includes(w));
          })
          .map((r: any) => ({
            id: r.videoId, videoId: r.videoId, title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: Array.isArray(r.thumbnails) && r.thumbnails.length > 0 ? r.thumbnails[r.thumbnails.length - 1].url : null,
            duration: r.duration || 0, isStream: true,
          }));
      } catch (e) { return []; }
    },
    getSongs: async () => [],
    getPlaylists: async () => [],
    getCustomAlbums: async () => [],
    getSettings: async () => ({}),
    addStreamSongToDb: async (track: any) => track,
  };
}

// ─────────────────────────────────────────────────────────────
// MobileNativeProvider Component
// ─────────────────────────────────────────────────────────────
export default function MobileNativeProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const activeTrack = usePlayerStore(state => state.activeTrack);
  const isPlaying   = usePlayerStore(state => state.isPlaying);
  const volume      = usePlayerStore(state => state.volume);

  // 1. Setup audio mode + init API on mount
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(err => console.warn('[MobileNative] audio mode error:', err));

    // Register the global seek handler
    __globalSeekTo = (positionSeconds: number) => {
      soundRef.current?.setPositionAsync(positionSeconds * 1000).catch(() => {});
    };

    // Init YTMusic in background
    if (!ytApiInstance) {
      new YTMusic().initialize().then(api => {
        ytApiInstance = api;
      }).catch(() => {});
    }

    usePlayerStore.getState().fetchLibrary();

    return () => { __globalSeekTo = null; };
  }, []);

  // 2. Load + play audio whenever activeTrack changes
  useEffect(() => {
    const loadAndPlayAudio = async () => {
      if (!activeTrack) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        return;
      }

      let audioUrl: string | null = activeTrack.filepath || activeTrack.url || null;

      if (!audioUrl && activeTrack.videoId) {
        audioUrl = `yt-stream://${activeTrack.videoId}`;
      }

      if (!audioUrl) {
        console.warn('[MobileNative] Track has no playable URL:', activeTrack.title);
        return;
      }

      if (audioUrl.startsWith('yt-stream://')) {
        const videoId = audioUrl.replace('yt-stream://', '');
        const resolved = await resolveAudioUrl(
          videoId,
          activeTrack.title || '',
          activeTrack.artist || ''
        );
        if (!resolved) {
          console.error('[MobileNative] Could not resolve stream for:', activeTrack.title);
          return;
        }
        audioUrl = resolved;
      }

      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const shouldPlay = usePlayerStore.getState().isPlaying;
        const vol = usePlayerStore.getState().volume;

        console.log('[MobileNative] Loading:', audioUrl.slice(0, 70) + '...');

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay, volume: vol }
        );
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            usePlayerStore.setState({
              progress: status.positionMillis / 1000,
              duration: status.durationMillis ? status.durationMillis / 1000 : 0,
            });
            if (status.didJustFinish) {
              usePlayerStore.getState().nextTrack();
            }
          } else if (status.error) {
            console.error('[MobileNative] ExoPlayer error:', status.error);
          }
        });

      } catch (e) {
        console.error('[MobileNative] createAsync error:', e);
      }
    };

    loadAndPlayAudio();

    return () => {
      soundRef.current?.unloadAsync();
    };
  }, [activeTrack]);

  // 3. Play / Pause toggle
  useEffect(() => {
    if (!soundRef.current) return;
    if (isPlaying) {
      soundRef.current.playAsync().catch(() => {});
    } else {
      soundRef.current.pauseAsync().catch(() => {});
    }
  }, [isPlaying]);

  // 4. Volume
  useEffect(() => {
    soundRef.current?.setVolumeAsync(volume).catch(() => {});
  }, [volume]);

  return <>{children}</>;
}
