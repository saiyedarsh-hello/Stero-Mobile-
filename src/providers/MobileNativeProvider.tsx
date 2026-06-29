import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../core';
import { Audio } from 'expo-av';
import YTMusic from 'ytmusic-api';
import Constants from 'expo-constants';

let ytApiInstance: any = null;

// ─────────────────────────────────────────────────────────────
// Global seek hook
// ─────────────────────────────────────────────────────────────
type SeekFn = (positionSeconds: number) => void;
let __globalSeekTo: SeekFn | null = null;
export function seekTo(positionSeconds: number) {
  __globalSeekTo?.(positionSeconds);
}

// ─────────────────────────────────────────────────────────────
// Fetch with timeout (Hermes-compatible — no AbortSignal.timeout)
// ─────────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ─────────────────────────────────────────────────────────────
// Expo host URI helpers
// ─────────────────────────────────────────────────────────────
function getExpoHost(): { ip: string; expoPort: string } | null {
  const raw =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (!raw) return null;
  const [ip, port] = raw.split(':');
  return { ip, expoPort: port || '8081' };
}

// ─────────────────────────────────────────────────────────────
// Boot the standalone audio server (port 3001)
// Called once on app mount. The API route starts a real Node.js
// HTTP server alongside Metro — no extra command needed.
// ─────────────────────────────────────────────────────────────
const AUDIO_PORT = 3001;
let audioServerBooted = false;

async function bootAudioServer(ip: string, expoPort: string): Promise<void> {
  if (audioServerBooted) return;
  try {
    const res = await fetchWithTimeout(`http://${ip}:${expoPort}/api/stream`, {}, 5000);
    if (res.ok) {
      audioServerBooted = true;
      console.log('[AudioBoot] ✅ Audio server ready on port', AUDIO_PORT);
    }
  } catch (e: any) {
    console.log('[AudioBoot] Could not reach Expo API:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// STREAM RESOLVER
//
// Tier 1 — Standalone Node.js audio server (port 3001)
//   Auto-started by the Expo API route when app mounts.
//   Uses @distube/ytdl-core in real Node.js — no Hermes limits.
//   Streams directly via http.pipe() — no ReadableStream conversion.
//   Phone talks to http://PC_IP:3001/?id=VIDEO_ID
//
// Tier 2 — JioSaavn (no server needed, Indian/English hits)
//   Multiple API variants for resilience.
//
// Tier 3 — Piped API (no server needed, YouTube public proxies)
//   Parallel race across 10 instances.
// ─────────────────────────────────────────────────────────────
async function resolveAudioUrl(
  videoId: string,
  title: string,
  artist: string
): Promise<string | null> {
  console.log(`[Resolver] "${title}" (${videoId})`);

  // ── Tier 1: Node.js audio server on port 3001 ──────────────
  const host = getExpoHost();
  if (host) {
    const streamUrl = `http://${host.ip}:${AUDIO_PORT}/?id=${videoId}`;
    try {
      // HEAD preflight: warms the cache AND verifies ytdl resolved the video.
      // If ytdl fails, HEAD returns 5xx and we fall through cleanly.
      const head = await fetchWithTimeout(streamUrl, { method: 'HEAD' }, 15000);
      if (head.ok) {
        console.log(`[Resolver] ✅ T1 audio server → ${streamUrl}`);
        return streamUrl;
      }
      console.log(`[Resolver] T1 HEAD ${head.status} — falling through`);
    } catch (e: any) {
      console.log(`[Resolver] T1 error: ${e.message}`);
    }
  } else {
    console.log('[Resolver] T1 skipped — no Expo host (production build)');
  }

  // ── Tier 2: JioSaavn ────────────────────────────────────────
  const query = `${title} ${artist || ''}`.trim();
  const tl = title.toLowerCase();

  const saavnExtractUrl = (r: any): string | null => {
    for (const c of [r.url, r.media_url, r.downloadUrl, r.download_url]) {
      if (!c) continue;
      if (typeof c === 'string' && c.startsWith('http')) return c;
      if (Array.isArray(c)) {
        const best = c.find((u: any) => u.quality === '320kbps') ?? c[c.length - 1];
        const link = best?.link ?? best?.url;
        if (typeof link === 'string') return link;
      }
    }
    return null;
  };

  const saavnMatch = (r: any): boolean => {
    const rt = (r.title ?? r.name ?? r.song ?? '').toLowerCase();
    const junk = ['karaoke', 'cover', 'remix', 'tribute', 'instrumental'];
    if (junk.some(w => rt.includes(w) && !tl.includes(w))) return false;
    return tl.split(' ').filter(w => w.length > 2).some(w => rt.includes(w));
  };

  const saavnEndpoints = [
    `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=5`,
    `https://saavn-api.vercel.app/search/songs?query=${encodeURIComponent(query)}`,
    `https://jiosaavn-api-ts.vercel.app/search/songs?query=${encodeURIComponent(query)}`,
  ];

  for (const ep of saavnEndpoints) {
    try {
      console.log(`[Resolver] T2 JioSaavn: ${ep.split('?')[0]}`);
      const res = await fetchWithTimeout(ep, {}, 7000);
      if (!res.ok) continue;
      const data = await res.json();
      const results: any[] = Array.isArray(data)
        ? data
        : data?.data?.results ?? data?.results ?? data?.data ?? [];
      const match = results.find(saavnMatch);
      if (match) {
        const url = saavnExtractUrl(match);
        if (url) {
          console.log(`[Resolver] ✅ T2 JioSaavn: "${match.title ?? match.name}"`);
          return url;
        }
      }
    } catch (e: any) {
      console.log(`[Resolver] T2 JioSaavn error: ${e.message}`);
    }
  }

  // ── Tier 3: Piped API (race + serial) ────────────────────────
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.adminforge.de',
    'https://piped-api.garudalinux.org',
    'https://pipedapi.syncpundit.io',
    'https://pipedapi.drgns.space',
    'https://pa.il.sbs',
    'https://pipedapi.tokhmi.xyz',
    'https://watchapi.whatever.social',
    'https://api.piped.yt',
  ];

  const pipedBest = (streams: any[]): string | null => {
    if (!streams?.length) return null;
    return [...streams].sort((a, b) => {
      const am = (a.mimeType ?? '').includes('mp4') ? 1 : 0;
      const bm = (b.mimeType ?? '').includes('mp4') ? 1 : 0;
      return am !== bm ? bm - am : (b.bitrate ?? 0) - (a.bitrate ?? 0);
    })[0]?.url ?? null;
  };

  // Race first 3 in parallel
  console.log('[Resolver] T3 Piped race...');
  const raceResult = await new Promise<string | null>(resolve => {
    let done = 0;
    pipedInstances.slice(0, 3).forEach(async inst => {
      try {
        const r = await fetchWithTimeout(`${inst}/streams/${videoId}`, {}, 5000);
        if (r.ok) {
          const d = await r.json();
          const url = pipedBest(d?.audioStreams);
          if (url) { console.log(`[Resolver] ✅ T3 Piped race: ${inst}`); resolve(url); return; }
        }
      } catch { /* ignore */ }
      if (++done === 3) resolve(null);
    });
  });
  if (raceResult) return raceResult;

  // Serial fallback
  for (const inst of pipedInstances.slice(3)) {
    try {
      const r = await fetchWithTimeout(`${inst}/streams/${videoId}`, {}, 5000);
      if (!r.ok) continue;
      const d = await r.json();
      const url = pipedBest(d?.audioStreams);
      if (url) { console.log(`[Resolver] ✅ T3 Piped: ${inst}`); return url; }
    } catch { /* ignore */ }
  }

  console.error(`[Resolver] ❌ All tiers failed for: "${title}"`);
  return null;
}

// ─────────────────────────────────────────────────────────────
// Polyfill window.electron for the Zustand store
// ─────────────────────────────────────────────────────────────
// @ts-ignore
if (typeof window !== 'undefined' && !window.electron) {
  // @ts-ignore
  window.electron = {
    ytGetStreamUrl: async (_id: string) => ({ success: false, error: 'mobile-noop' }),
    incrementPlayCount: (_id: string) => {},
    ytSearch: async (query: string) => {
      if (!ytApiInstance) {
        const api = new YTMusic();
        await api.initialize();
        ytApiInstance = api;
      }
      try {
        const results = await ytApiInstance.search(query, 'SONG');
        const ql = query.toLowerCase();
        const bad = ['karaoke', 'cover', 'tribute', 'remix', 'instrumental', 'sped up', 'slowed', 'reverb', 'bass boosted', 'type beat', '8d'];
        return results
          .filter((r: any) => !bad.some(w => r.name.toLowerCase().includes(w) && !ql.includes(w)))
          .map((r: any) => ({
            id: r.videoId, videoId: r.videoId, title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: r.thumbnails?.at(-1)?.url ?? null,
            duration: r.duration || 0, isStream: true,
          }));
      } catch { return []; }
    },
    ytSearchTrending: async (query: string, type: string) => {
      if (!ytApiInstance) {
        const api = new YTMusic();
        await api.initialize();
        ytApiInstance = api;
      }
      try {
        let q = query;
        if (type === 'artist' && query.includes('top 10')) {
          q = query.replace('top 10 monthly ', '').replace(' artist', '') + ' popular artists';
        }
        const results = await ytApiInstance.search(q, type === 'artist' ? 'ARTIST' : 'SONG');
        const bad = ['karaoke', 'cover', 'tribute', 'remix', 'instrumental', 'sped up', 'slowed', 'reverb', 'bass boosted', 'type beat', '8d'];
        if (type === 'artist') {
          return results
            .filter((r: any) => !bad.some(w => r.name.toLowerCase().includes(w)))
            .map((r: any) => ({ id: r.browseId || r.name, name: r.name, thumbnails: r.thumbnails || [] }));
        }
        return results
          .filter((r: any) => !bad.some(w => r.name.toLowerCase().includes(w)))
          .map((r: any) => ({
            id: r.videoId, videoId: r.videoId, title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map((a: any) => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            has_artwork: true,
            artwork_path: r.thumbnails?.at(-1)?.url ?? null,
            duration: r.duration || 0, isStream: true,
          }));
      } catch { return []; }
    },
    getSongs: async () => [],
    getPlaylists: async () => [],
    getCustomAlbums: async () => [],
    getSettings: async () => ({}),
    addStreamSongToDb: async (track: any) => track,
  };
}

// ─────────────────────────────────────────────────────────────
// MobileNativeProvider
// ─────────────────────────────────────────────────────────────
export default function MobileNativeProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const activeTrack = usePlayerStore(state => state.activeTrack);
  const isPlaying   = usePlayerStore(state => state.isPlaying);
  const volume      = usePlayerStore(state => state.volume);

  // 1. Setup audio mode + boot the audio server
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(err => console.warn('[MobileNative] audio mode:', err));

    __globalSeekTo = (s: number) => {
      soundRef.current?.setPositionAsync(s * 1000).catch(() => {});
    };

    // Boot the standalone audio server (auto-starts via Expo API route)
    const host = getExpoHost();
    if (host) {
      bootAudioServer(host.ip, host.expoPort);
    }

    // Init YTMusic search API
    if (!ytApiInstance) {
      new YTMusic().initialize()
        .then(api => { ytApiInstance = api; })
        .catch(() => {});
    }

    usePlayerStore.getState().fetchLibrary();

    return () => { __globalSeekTo = null; };
  }, []);

  // 2. Load + play audio when activeTrack changes
  useEffect(() => {
    const loadAndPlay = async () => {
      if (!activeTrack) {
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        return;
      }

      let url: string | null = activeTrack.filepath ?? activeTrack.url ?? null;
      if (!url && activeTrack.videoId) url = `yt-stream://${activeTrack.videoId}`;
      if (!url) { console.warn('[MobileNative] no URL for:', activeTrack.title); return; }

      if (url.startsWith('yt-stream://')) {
        const videoId = url.replace('yt-stream://', '');
        const resolved = await resolveAudioUrl(videoId, activeTrack.title ?? '', activeTrack.artist ?? '');
        if (!resolved) {
          console.error('[MobileNative] stream resolve failed for:', activeTrack.title);
          return;
        }
        url = resolved;
      }

      try {
        await soundRef.current?.unloadAsync();
        soundRef.current = null;

        const shouldPlay = usePlayerStore.getState().isPlaying;
        const vol = usePlayerStore.getState().volume;

        console.log('[MobileNative] Loading:', url.slice(0, 80));

        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay, volume: vol }
        );
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            usePlayerStore.setState({
              progress: status.positionMillis / 1000,
              duration: status.durationMillis ? status.durationMillis / 1000 : 0,
            });
            if (status.didJustFinish) usePlayerStore.getState().nextTrack();
          } else if (status.error) {
            console.error('[MobileNative] playback error:', status.error);
          }
        });
      } catch (e) {
        console.error('[MobileNative] createAsync error:', e);
      }
    };

    loadAndPlay();
    return () => { soundRef.current?.unloadAsync(); };
  }, [activeTrack]);

  // 3. Play / Pause
  useEffect(() => {
    if (!soundRef.current) return;
    isPlaying ? soundRef.current.playAsync().catch(() => {}) : soundRef.current.pauseAsync().catch(() => {});
  }, [isPlaying]);

  // 4. Volume
  useEffect(() => {
    soundRef.current?.setVolumeAsync(volume).catch(() => {});
  }, [volume]);

  return <>{children}</>;
}
