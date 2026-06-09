const path = require('path');
// Ensure youtube-dl-exec and ffmpeg run from the unpacked ASAR directory in production
const defaultBinDir = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin');
process.env.YOUTUBE_DL_DIR = defaultBinDir.replace('app.asar', 'app.asar.unpacked');

const YTMusic = require('ytmusic-api');
const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const fs = require('fs');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { app } = require('electron');

const streamCache = new Map(); // videoId => { url, timestamp }
const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

class Downloader {
  constructor(db) {
    this.db = db;
    this.ytmusic = new YTMusic();
    this.ytmusicInitialized = false;
    
    this.queue = [];
    this.activeDownloads = new Map();
    this.maxConcurrent = 2; // Limit concurrent downloads
    this.completed = [];
    
    // Will be set when a renderer connects to receive progress
    this.webContents = null;
  }

  setWebContents(contents) {
    this.webContents = contents;
  }

  async initYTMusic() {
    if (!this.ytmusicInitialized) {
      await this.ytmusic.initialize();
      this.ytmusicInitialized = true;
    }
  }

  async initYoutubeMusicApi() {
    if (!this.youtubeMusicApiPromise) {
      this.youtubeMusicApiPromise = (async () => {
        const YoutubeMusicApi = require('youtube-music-api');
        this.youtubeMusicApi = new YoutubeMusicApi();
        await this.youtubeMusicApi.initalize();
        return this.youtubeMusicApi;
      })();
    }
    return await this.youtubeMusicApiPromise;
  }

  async search(query) {
    try {
      await this.initYTMusic();
      const res = await this.ytmusic.searchSongs(query);
      const items = res ? res.slice(0, 20) : [];
      
      const mapped = items.filter(r => r.videoId).map(r => {
        // duration is in seconds from ytmusic-api
        const totalSeconds = Math.floor(r.duration || 0);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        let thumb = null;
        if (r.thumbnails && r.thumbnails.length > 0) {
           thumb = r.thumbnails[r.thumbnails.length - 1].url;
        }

        return {
          videoId: r.videoId,
          title: r.name,
          artist: r.artist ? r.artist.name : 'Unknown Artist',
          album: r.album ? r.album.name : 'YouTube Music',
          duration: durationStr,
          thumbnail: thumb
        };
      });
      return mapped;
    } catch (err) {
      console.error('ytmusic-api error:', err);
      return [];
    }
  }

  async searchTrending(query, type) {
    try {
      const api = await this.initYoutubeMusicApi();
      
      if (type === 'song') {
        const [res1, res2, res3] = await Promise.all([
          api.search(`${query} top 50`, 'song'),
          api.search(`${query} billboard`, 'song'),
          api.search(`${query} global`, 'song')
        ]);
        
        const allItems = [...(res1.content||[]), ...(res2.content||[]), ...(res3.content||[])];
        
        // Strictly filter to ensure no albums or podcasts (pure songs only)
        const validSongs = allItems.filter(r => {
          const hasArtist = Array.isArray(r.artist) ? r.artist.length > 0 : !!r.artist;
          const isSongLength = r.duration > 0 && r.duration < 600000; // less than 10 mins
          const isSong = r.type === 'song' || r.type === 'video';
          return r.videoId && isSong && hasArtist && isSongLength;
        });
        const uniqueItems = Array.from(new Map(validSongs.map(r => [r.videoId, r])).values());
        
        // Take exactly top 30 as requested
        const items = uniqueItems.slice(0, 30);
        
        return items.map(r => {
          return {
            id: r.videoId,
            videoId: r.videoId,
            title: r.name,
            artist: Array.isArray(r.artist) ? r.artist.map(a => a.name).join(', ') : (r.artist?.name || 'Unknown'),
            coverUrl: Array.isArray(r.thumbnails) && r.thumbnails.length > 0 
                      ? r.thumbnails[r.thumbnails.length - 1].url 
                      : null,
            duration: r.duration || 0,
            album: r.album?.name || 'Single',
          };
        });
      }
      
      if (type === 'artist') {
        const [res1, res2, res3] = await Promise.all([
          api.search(`${query}`, 'artist'),
          api.search(`billboard ${query}`, 'artist'),
          api.search(`global ${query}`, 'artist')
        ]);
        
        const allItems = [...(res1?.content || []), ...(res2?.content || []), ...(res3?.content || [])];
        const validArtists = allItems.filter(r => r.name);
        const uniqueItems = Array.from(new Map(validArtists.map(r => [r.browseId || r.name, r])).values());
        
        return uniqueItems.map(r => {
          let thumb = null;
          if (r.thumbnails && r.thumbnails.length > 0) {
             thumb = r.thumbnails[r.thumbnails.length - 1].url;
          }
          return {
            id: r.browseId || r.name,
            name: r.name,
            imageUrl: thumb
          };
        });
      }
      
      const res = await api.search(query, type);
      const items = res.content ? res.content.slice(0, 50) : [];
      
      return items.filter(r => r.videoId).map(r => {
        const totalSeconds = Math.floor((r.duration || 0) / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        let thumb = null;
        if (r.thumbnails && r.thumbnails.length > 0) {
           thumb = r.thumbnails[r.thumbnails.length - 1].url;
        }

        return {
          videoId: r.videoId,
          title: r.name,
          artist: r.artist ? (Array.isArray(r.artist) ? r.artist.map(a => a.name).join(', ') : r.artist.name) : 'Unknown Artist',
          album: r.album ? r.album.name : 'YouTube Music',
          duration: durationStr,
          thumbnail: thumb,
          coverUrl: thumb
        };
      });
    } catch (err) {
      console.error('searchTrending error:', err);
      return [];
    }
  }



  async getStreamUrl(videoId) {
    const cached = streamCache.get(videoId);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`[Stream Cache] Hit for: ${videoId}`);
      return { success: true, url: cached.url };
    }

    try {
      const youtubedl = require('youtube-dl-exec');
      const ytDlpPath = path.join(process.env.YOUTUBE_DL_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const streamUrl = await youtubedl(url, {
        getUrl: true,
        format: '140/251/ba/best',
        noWarnings: true,
        noCheckCertificates: true,
        noPlaylist: true,
        noCheckFormats: true,
        youtubeSkipDashManifest: true,
        youtubeSkipHlsManifest: true,
        extractorArgs: 'youtube:player-client=android,web'
      }, { execPath: ytDlpPath });
      
      const resolvedUrl = streamUrl.trim();
      streamCache.set(videoId, { url: resolvedUrl, timestamp: Date.now() });
      return { success: true, url: resolvedUrl };
    } catch (err) {
      console.error('getStreamUrl error:', err);
      return { success: false, error: err.message };
    }
  }

  async addDownload(songMeta) {
    // Check if already in queue or downloading
    if (this.queue.find(q => q.videoId === songMeta.videoId) || this.activeDownloads.has(songMeta.videoId)) {
      return { success: false, message: 'Already in queue' };
    }

    const job = {
      ...songMeta,
      status: 'queued',
      progress: 0,
      addedAt: Date.now()
    };
    
    this.queue.push(job);
    this.broadcastState();
    this.processQueue();
    
    return { success: true, jobId: job.videoId };
  }

  async processQueue() {
    if (this.queue.length === 0 || this.activeDownloads.size >= this.maxConcurrent) {
      return;
    }

    const job = this.queue.shift();
    job.status = 'downloading';
    this.activeDownloads.set(job.videoId, job);
    this.broadcastState();

    let musicFolder = this.db.getSavedFolderPath();
    
    // Ensure the folder exists if it was retrieved from DB
    if (musicFolder && !fs.existsSync(musicFolder)) {
      try {
        fs.mkdirSync(musicFolder, { recursive: true });
      } catch (err) {
        console.warn('Failed to create saved music folder, falling back to default', err);
        musicFolder = null;
      }
    }

    if (!musicFolder) {
      try {
        musicFolder = app.getPath('music');
      } catch (e) {
        musicFolder = path.join(os.homedir(), 'Music');
      }
      
      // If still fails or doesn't exist, use Downloads
      if (!fs.existsSync(musicFolder)) {
        try {
          fs.mkdirSync(musicFolder, { recursive: true });
        } catch(e) {
          musicFolder = path.join(os.homedir(), 'Downloads');
        }
      }
    }

    // Clean title for filename
    const safeTitle = job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeArtist = job.artist.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputFilename = `${safeArtist} - ${safeTitle}.mp3`;
    const outputPath = path.join(musicFolder, outputFilename);

    const { spawn } = require('child_process');
    const ytDlpPath = path.join(process.env.YOUTUBE_DL_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

    const url = `https://www.youtube.com/watch?v=${job.videoId}`;

    try {
      const args = [
        url,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--output', outputPath,
        '--ffmpeg-location', ffmpeg,
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-args', 'youtube:player-client=android,web',
        '--add-header', 'referer:youtube.com',
        '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ];

      const subprocess = spawn(ytDlpPath, args, { windowsHide: true });
      job.subprocess = subprocess;

      // Simple progress tracking by parsing stdout
      subprocess.stdout.on('data', (data) => {
        const text = data.toString();
        
        // Progress parsing
        const progressMatch = text.match(/\[download\]\s+(\d+\.\d+)%/);
        if (progressMatch && progressMatch[1]) {
          job.progress = parseFloat(progressMatch[1]);
          // Cap it at 99% during download, 100% is set when ffmpeg finishes
          if (job.progress > 99) job.progress = 99;
          this.broadcastState();
        } else if (text.includes('Destination:') && text.includes('.mp3')) {
          // This usually indicates ffmpeg audio extraction started
          job.progress = 99; 
          this.broadcastState();
        }
      });

      subprocess.stderr.on('data', (data) => {
        console.warn('yt-dlp stderr:', data.toString());
      });

      await new Promise((resolve, reject) => {
        subprocess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Download process exited with code ${code}`));
        });
        subprocess.on('error', (err) => reject(err));
      });

      job.status = 'completed';
      job.progress = 100;
      job.localPath = outputPath;
      
      // Auto-scan file into library manually
      try {
        let artworkPath = '';
        let hasArtwork = 0;
        
        if (job.thumbnail) {
          const hash = crypto.createHash('md5').update(job.videoId).digest('hex');
          const artworkFileName = `art-yt-${hash}.jpg`;
          const fullArtPath = path.join(this.db.getArtworkDir(), artworkFileName);
          
          await new Promise((resolve) => {
            https.get(job.thumbnail, (res) => {
              if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(fullArtPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                  fileStream.close();
                  hasArtwork = 1;
                  artworkPath = fullArtPath;
                  resolve();
                });
                fileStream.on('error', () => resolve());
              } else {
                resolve();
              }
            }).on('error', () => resolve());
          });
        }

        let parsedDuration = 0;
        if (typeof job.duration === 'number') {
          parsedDuration = job.duration;
        } else if (typeof job.duration === 'string') {
          const parts = job.duration.split(':').map(Number);
          if (parts.length === 2) {
            parsedDuration = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            parsedDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        const stats = fs.statSync(outputPath);
        const newSong = {
          filepath: outputPath,
          title: job.title.trim().replace(/^\d+[\s.\-_]*/, ''),
          artist: job.artist || 'Unknown Artist',
          album: 'Downloads',
          duration: parsedDuration,
          genre: 'YouTube',
          year: new Date().getFullYear(),
          track_number: null,
          has_artwork: hasArtwork,
          artwork_path: artworkPath,
          added_at: Math.floor(stats.mtimeMs)
        };
        
        this.db.insertSongs([newSong]);
        
        if (this.webContents) {
          // Tell frontend to refresh the library
          this.webContents.send('download-completed');
          this.webContents.send('download-queue-updated', this.getQueueState());
        }
      } catch (err) {
        console.error('Error auto-adding downloaded file to db:', err);
      }

    } catch (err) {
      console.error('Download failed:', err);
      job.status = 'error';
      job.error = err.message;
    }

    this.finishJob(job);
  }

  finishJob(job) {
    if (job.subprocess) {
      delete job.subprocess;
    }
    this.activeDownloads.delete(job.videoId);
    this.completed.unshift(job); // Add to front of completed list
    // Keep completed list from growing infinitely
    if (this.completed.length > 50) this.completed.pop();
    
    this.broadcastState();
    // Start next download if any
    this.processQueue();
  }

  cancelDownload(videoId) {
    if (this.activeDownloads.has(videoId)) {
      const job = this.activeDownloads.get(videoId);
      if (job.subprocess) {
        try {
          job.subprocess.kill('SIGTERM');
        } catch(e) {}
      }
      job.status = 'cancelled';
      job.progress = 0;
      this.finishJob(job);
    } else {
      const qIndex = this.queue.findIndex(q => q.videoId === videoId);
      if (qIndex !== -1) {
        const job = this.queue.splice(qIndex, 1)[0];
        job.status = 'cancelled';
        job.progress = 0;
        this.completed.unshift(job);
        if (this.completed.length > 50) this.completed.pop();
        this.broadcastState();
      }
    }
  }

  getQueueState() {
    const safeActive = Array.from(this.activeDownloads.values()).map(job => {
      const { subprocess, ...safeJob } = job;
      return safeJob;
    });
    return {
      active: safeActive,
      queue: this.queue,
      completed: this.completed
    };
  }

  broadcastState() {
    if (this.webContents) {
      this.webContents.send('download-queue-updated', this.getQueueState());
    }
  }
}

module.exports = Downloader;
