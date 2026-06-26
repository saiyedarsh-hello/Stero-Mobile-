/**
 * Stero Local Stream Server
 * 
 * Run this alongside Expo: `npm run stream`
 * 
 * This server runs on port 3001 on your local machine.
 * Your phone (on the same WiFi) calls it at http://<PC_IP>:3001/stream?id=VIDEO_ID
 * 
 * Why Node.js? Because @distube/ytdl-core handles YouTube's cipher decryption
 * in full Node.js — something React Native's Hermes JS engine cannot do.
 */

const http = require('http');
const url  = require('url');

let ytdl;
try {
  ytdl = require('@distube/ytdl-core');
} catch (e) {
  console.error('[Stero] @distube/ytdl-core not found. Run: npm install @distube/ytdl-core');
  process.exit(1);
}

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // CORS — allow requests from any origin (the phone)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);

  // Health check
  if (parsed.pathname === '/ping') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, server: 'Stero Stream Server' }));
    return;
  }

  // Stream URL resolver: GET /stream?id=VIDEO_ID
  if (parsed.pathname === '/stream') {
    const videoId = parsed.query.id;
    if (!videoId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing ?id= parameter' }));
      return;
    }

    try {
      console.log(`[Stero] Resolving stream for: ${videoId}`);
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      
      // Get audio-only formats, prefer m4a then webm, highest quality
      const formats = ytdl.filterFormats(info.formats, 'audioonly');
      
      if (formats.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'No audio formats found' }));
        return;
      }

      // Sort: m4a first, then by audioBitrate descending
      formats.sort((a, b) => {
        const am = (a.container === 'mp4' || a.mimeType?.includes('mp4')) ? 1 : 0;
        const bm = (b.container === 'mp4' || b.mimeType?.includes('mp4')) ? 1 : 0;
        if (am !== bm) return bm - am;
        return (b.audioBitrate || 0) - (a.audioBitrate || 0);
      });

      const best = formats[0];
      console.log(`[Stero] ✅ Resolved: ${best.mimeType} @ ${best.audioBitrate}kbps`);

      res.writeHead(200);
      res.end(JSON.stringify({
        url: best.url,
        mimeType: best.mimeType,
        bitrate: best.audioBitrate,
        videoId,
      }));

    } catch (err) {
      console.error(`[Stero] Error for ${videoId}:`, err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  // Print the local IP addresses so the user can see what the phone will call
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const localIPs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIPs.push(net.address);
      }
    }
  }
  
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║       Stero Stream Server  •  Port ' + PORT + '        ║');
  console.log('╠═══════════════════════════════════════════════╣');
  localIPs.forEach(ip => {
    console.log(`║  http://${ip}:${PORT}/stream?id=VIDEO_ID  ║`);
  });
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log('Keep this running while using the Stero app!\n');
});
