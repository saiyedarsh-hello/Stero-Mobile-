/**
 * Audio Stream Server — Expo API Route Bootstrap
 *
 * When the mobile app calls GET /api/stream, this module:
 *   1. Starts a standalone Node.js HTTP server on port 3001 (once, idempotent)
 *   2. Returns { port: 3001 } so the app knows where to stream from
 *
 * The standalone server on port 3001:
 *   - Uses @distube/ytdl-core (Node.js, no Hermes limitations)
 *   - Pipes audio directly with node http (no ReadableStream conversion issues)
 *   - Supports Range requests (seeking works)
 *   - Caches resolved URLs for 5 hours (YouTube URLs valid 6 hours)
 *   - Retries automatically if a cached URL has expired
 *
 * The phone plays audio from: http://HOST_IP:3001/?id=VIDEO_ID
 *
 * This starts automatically when npx expo start runs — NO extra commands needed.
 */

import http from 'http';
import { URL as NodeURL } from 'url';

// @ts-ignore – runs in Node.js, not Hermes
const ytdl = require('@distube/ytdl-core');

const AUDIO_PORT = 3001;

interface AudioEntry { url: string; mime: string; expires: number }
const audioCache = new Map<string, AudioEntry>();

async function resolveAudio(videoId: string): Promise<AudioEntry> {
  const now = Date.now();
  const hit = audioCache.get(videoId);
  if (hit && hit.expires > now) {
    console.log(`[AudioSrv] cache hit: ${videoId}`);
    return hit;
  }

  console.log(`[AudioSrv] resolving: ${videoId}`);
  const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);

  // Prefer m4a (mp4 container) — best ExoPlayer / AVPlayer compatibility
  let formats: any[] = ytdl.filterFormats(info.formats, 'audioonly')
    .filter((f: any) => f.container === 'mp4' || (f.mimeType || '').includes('mp4'));

  if (!formats.length) {
    formats = ytdl.filterFormats(info.formats, 'audioonly');
  }
  if (!formats.length) throw new Error(`No audio formats for ${videoId}`);

  formats.sort((a: any, b: any) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
  const best = formats[0];

  const entry: AudioEntry = {
    url: best.url,
    mime: (best.mimeType || 'audio/mp4').split(';')[0],
    expires: now + 5 * 3600_000,
  };
  audioCache.set(videoId, entry);
  console.log(`[AudioSrv] resolved: ${entry.mime} @ ${best.audioBitrate}kbps`);
  return entry;
}

// ── YouTube-compatible request headers ──────────────────────────────
function makeYTHeaders(range?: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',  // keep raw bytes — no gzip
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com',
    'Sec-Fetch-Dest': 'audio',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  };
  if (range) h['Range'] = range;
  return h;
}

// ── Standalone HTTP server ──────────────────────────────────────────
let serverRunning = false;

function startAudioServer() {
  if (serverRunning) return;
  serverRunning = true;

  const server = http.createServer(async (req, res) => {
    // CORS — required for expo-av / ExoPlayer
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers',
      'Content-Type, Content-Length, Content-Range, Accept-Ranges');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const reqUrl = new NodeURL(req.url || '/', `http://localhost:${AUDIO_PORT}`);
    const videoId = reqUrl.searchParams.get('id');

    if (!videoId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing ?id=');
      return;
    }

    console.log(`[AudioSrv] ${req.method} id=${videoId}`);

    try {
      let audio = await resolveAudio(videoId);
      const range = req.headers.range;

      let ytRes = await fetch(audio.url, { headers: makeYTHeaders(range) });

      // YouTube URL expired (403) — re-resolve and retry once
      if (ytRes.status === 403) {
        console.warn(`[AudioSrv] 403, re-resolving ${videoId}...`);
        audioCache.delete(videoId);
        audio = await resolveAudio(videoId);
        ytRes = await fetch(audio.url, { headers: makeYTHeaders(range) });
      }

      if (!ytRes.ok && ytRes.status !== 206) {
        res.writeHead(ytRes.status, { 'Content-Type': 'text/plain' });
        res.end(`YouTube upstream: ${ytRes.status}`);
        return;
      }

      // Forward essential response headers
      const resHeaders: Record<string, string> = {
        'Content-Type': audio.mime,
        'Accept-Ranges': 'bytes',
      };
      for (const h of ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
        const v = ytRes.headers.get(h);
        if (v) resHeaders[h] = v;
      }

      res.writeHead(ytRes.status, resHeaders);
      console.log(`[AudioSrv] ✅ streaming ${videoId} (${ytRes.status}, ${audio.mime})`);

      if (!ytRes.body) { res.end(); return; }

      // Pipe using web ReadableStream reader → Node.js res (backpressure-aware)
      const reader = ytRes.body.getReader();
      const pump = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) { res.end(); break; }
            const ok = res.write(value as Uint8Array);
            if (!ok) await new Promise<void>(r => res.once('drain', r));
          }
        } catch {
          res.end();
        }
      };
      pump();

    } catch (err: any) {
      console.error(`[AudioSrv] error for ${videoId}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    }
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      // Already running (hot-reload) — that's fine
      console.log(`[AudioSrv] Port ${AUDIO_PORT} already in use — reusing`);
    } else {
      console.error('[AudioSrv] fatal error:', e);
      serverRunning = false;
    }
  });

  server.listen(AUDIO_PORT, '0.0.0.0', () => {
    console.log(`[AudioSrv] 🎵 Audio server ready → http://0.0.0.0:${AUDIO_PORT}`);
  });
}

// ── Expo Router GET handler ─────────────────────────────────────────
// Called by the phone on app mount to trigger server startup.
export async function GET() {
  if (!ytdl) {
    return Response.json({ error: '@distube/ytdl-core missing', port: null }, { status: 500 });
  }
  startAudioServer();
  return Response.json({ status: 'ok', port: AUDIO_PORT });
}
