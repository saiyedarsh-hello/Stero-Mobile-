const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const db = require('./db.cjs');
const Downloader = require('./downloader.cjs');

// Initialize downloader
const downloader = new Downloader(db);

// Register media protocol before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      stream: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true
    }
  }
]);

let mainWindow = null;
let musicMetadata = null;

// Dynamically import music-metadata (which is ESM-only)
async function getMusicMetadata() {
  if (!musicMetadata) {
    musicMetadata = await import('music-metadata');
  }
  return musicMetadata;
}

function createWindow() {
  Menu.setApplicationMenu(null);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#a1a1aa',
      height: 48
    },
    autoHideMenuBar: true,
    title: 'Stero',
    transparent: false,
    backgroundColor: '#000000', // solid black window background
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true // Safe because we use the custom media:// protocol
    }
  });

  downloader.setWebContents(mainWindow.webContents);

  // If in development, load Vite Dev Server
  // Otherwise, load built React assets
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register media protocol handler to stream music files and cover art safely
app.whenReady().then(async () => {
  protocol.handle('media', (request) => {
    try {
      console.log('[Media Protocol] Incoming request URL:', request.url);
      // Decode the filepath from url
      const rawUrl = request.url.slice('media://'.length);
      const decodedPath = decodeURIComponent(rawUrl);
      
      // On Windows, fix paths starting with a slash, e.g. /C:/path -> C:/path
      let filePath = decodedPath;
      if (filePath.startsWith('/') && filePath[2] === ':') {
        filePath = filePath.slice(1);
      }
      console.log('[Media Protocol] Resolved file path:', filePath);
      
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        console.error('[Media Protocol] File not found or is directory:', filePath);
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = request.headers.get('range');

      let headers = new Headers();
      headers.set('Accept-Ranges', 'bytes');
      
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'audio/mpeg';
      if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.flac') mimeType = 'audio/flac';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.m4a' || ext === '.mp4') mimeType = 'audio/mp4';
      else if (ext === '.aac') mimeType = 'audio/aac';
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      headers.set('Content-Type', mimeType);

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        headers.set('Content-Length', chunksize);

        const fileStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', chunk => controller.enqueue(chunk));
            fileStream.on('end', () => controller.close());
            fileStream.on('error', err => controller.error(err));
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new Response(webStream, { status: 206, headers });
      } else {
        headers.set('Content-Length', fileSize);
        const fileStream = fs.createReadStream(filePath);
        
        const webStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', chunk => controller.enqueue(chunk));
            fileStream.on('end', () => controller.close());
            fileStream.on('error', err => controller.error(err));
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new Response(webStream, { status: 200, headers });
      }
    } catch (err) {
      console.error('Failed to handle media protocol request:', err);
      return new Response('Error loading resource', { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// 1. Select Folder Dialog
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// Recursive audio files search
function findAudioFiles(dirPath, filesList = []) {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const resPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        findAudioFiles(resPath, filesList);
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'].includes(ext)) {
          filesList.push(resPath);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning folder:', dirPath, err.message);
  }
  return filesList;
}

// 2. Scan folder for music files & extract metadata
ipcMain.handle('scan-folder', async (event, folderPath) => {
  console.log('Scanning folder:', folderPath);
  
  // Save the folder path so we can resync later without re-picking
  db.setSavedFolderPath(folderPath);
  
  const filePaths = findAudioFiles(folderPath);
  console.log(`Found ${filePaths.length} audio files. Starting metadata extraction...`);
  
  const total = filePaths.length;
  let processed = 0;
  const batchSize = 10;
  let currentBatch = [];
  
  const mm = await getMusicMetadata();
  const artworkFolder = db.getArtworkDir();

  // Inform renderer about scanning start
  event.sender.send('scan-progress', { current: 0, total, status: 'started' });

  for (const filePath of filePaths) {
    try {
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (e) {
        stats = { mtimeMs: Date.now() };
      }
      
      const metadata = await mm.parseFile(filePath).catch(() => null);
      
      let title = path.basename(filePath, path.extname(filePath));
      let artist = 'Unknown Artist';
      let album = 'Unknown Album';
      let duration = 0;
      let genre = 'Unknown Genre';
      let year = null;
      let trackNumber = null;
      let hasArtwork = 0;
      let artworkPath = '';

      if (metadata) {
        title = metadata.common.title || title;
        artist = metadata.common.artist || artist;
        album = metadata.common.album || album;
        duration = metadata.format.duration || 0;
        
        if (metadata.common.genre && metadata.common.genre.length > 0) {
          genre = metadata.common.genre.join(', ');
        }
        year = metadata.common.year || null;
        trackNumber = metadata.common.track?.no || null;
        
        // Handle artwork extraction
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const pic = metadata.common.picture[0];
          try {
            const hash = crypto.createHash('md5').update(pic.data).digest('hex');
            const artworkFileName = `art-${hash}.jpg`;
            const fullArtPath = path.join(artworkFolder, artworkFileName);
            
            if (!fs.existsSync(fullArtPath)) {
              fs.writeFileSync(fullArtPath, pic.data);
            }
            hasArtwork = 1;
            artworkPath = fullArtPath;
          } catch (artErr) {
            console.error('Error saving artwork for:', filePath, artErr.message);
          }
        }
      }

      // Clean title: remove leading track numbers or file prefixes (e.g., "01. Title" -> "Title")
      title = title.trim().replace(/^\d+[\s.\-_]*/, '');

      currentBatch.push({
        filepath: filePath,
        title,
        artist,
        album,
        duration,
        genre,
        year,
        track_number: trackNumber,
        has_artwork: hasArtwork,
        artwork_path: artworkPath,
        added_at: Math.floor(stats.mtimeMs)
      });
      
    } catch (err) {
      console.error('Failed to parse file:', filePath, err.message);
    }
    
    processed++;
    
    // Periodically save batch and notify renderer
    if (currentBatch.length >= batchSize || processed === total) {
      db.insertSongs(currentBatch);
      currentBatch = [];
      event.sender.send('scan-progress', { current: processed, total, status: 'scanning' });
    }
  }
  
  // Remove missing songs that are no longer present in the scanned directory
  db.removeMissingSongs(filePaths, folderPath);
  
  event.sender.send('scan-progress', { current: total, total, status: 'completed' });
  return db.getAllSongs();
});

// 2b. Get previously saved folder path (or derive from existing songs)
ipcMain.handle('get-saved-folder', () => {
  const saved = db.getSavedFolderPath();
  if (saved) return saved;

  // No saved folder — derive from existing songs in the DB
  const songs = db.getAllSongs();
  if (songs && songs.length > 0) {
    // Find the common parent directory of all songs
    const firstDir = path.dirname(songs[0].filepath);
    // Walk up to find the shallowest common ancestor
    let commonDir = firstDir;
    for (const song of songs) {
      const songDir = path.dirname(song.filepath);
      while (
        songDir.toLowerCase() !== commonDir.toLowerCase() &&
        !songDir.toLowerCase().startsWith(commonDir.toLowerCase() + path.sep)
      ) {
        commonDir = path.dirname(commonDir);
      }
    }
    // Save it for future use
    db.setSavedFolderPath(commonDir);
    return commonDir;
  }

  return null;
});

// 3. Database operations
ipcMain.handle('get-settings', () => {
  return db.getSettings();
});

ipcMain.handle('update-setting', (event, key, value) => {
  return db.updateSetting(key, value);
});

// Downloader IPCs
ipcMain.handle('yt-search', async (event, query) => {
  return await downloader.search(query);
});

ipcMain.handle('yt-download', async (event, songMeta) => {
  return await downloader.addDownload(songMeta);
});

ipcMain.handle('yt-get-queue', () => {
  return downloader.getQueueState();
});

ipcMain.handle('yt-cancel-download', (event, videoId) => {
  downloader.cancelDownload(videoId);
  return true;
});

ipcMain.handle('db-get-songs', () => {
  return db.getAllSongs();
});

ipcMain.handle('db-delete-song', (event, songId) => {
  db.deleteSong(songId);
  return db.getAllSongs();
});

ipcMain.handle('db-toggle-favorite', (event, songId, favoriteStatus) => {
  return db.toggleFavorite(songId, favoriteStatus);
});

ipcMain.handle('db-increment-play-count', (event, songId) => {
  db.incrementPlayCount(songId);
});

ipcMain.handle('db-get-playlists', () => {
  return db.getPlaylists();
});

ipcMain.handle('db-create-playlist', (event, name) => {
  return db.createPlaylist(name);
});

ipcMain.handle('db-delete-playlist', (event, playlistId) => {
  db.deletePlaylist(playlistId);
  return db.getPlaylists();
});

ipcMain.handle('db-add-song-to-playlist', (event, playlistId, songId) => {
  return db.addSongToPlaylist(playlistId, songId);
});

ipcMain.handle('db-remove-song-from-playlist', (event, playlistId, songId) => {
  return db.removeSongFromPlaylist(playlistId, songId);
});

ipcMain.handle('db-get-playlist-songs', (event, playlistId) => {
  return db.getPlaylistSongs(playlistId);
});

// Select image file dialog
ipcMain.handle('select-image-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  // Copy the chosen image into the artwork folder with a unique name
  const srcPath = result.filePaths[0];
  const artworkFolder = db.getArtworkDir();
  const ext = path.extname(srcPath).toLowerCase();
  const hash = crypto.createHash('md5').update(srcPath + Date.now()).digest('hex');
  const destName = `custom-art-${hash}${ext}`;
  const destPath = path.join(artworkFolder, destName);
  fs.copyFileSync(srcPath, destPath);
  return destPath;
});

// Update song metadata
ipcMain.handle('db-update-song', (event, songId, meta) => {
  return db.updateSongMeta(songId, meta);
});

// Custom Albums
ipcMain.handle('db-get-custom-albums', () => {
  return db.getCustomAlbums();
});

ipcMain.handle('db-create-custom-album', (event, name, coverPath, songIds) => {
  return db.createCustomAlbum(name, coverPath, songIds);
});

ipcMain.handle('db-update-custom-album', (event, albumId, name, coverPath, songIds) => {
  return db.updateCustomAlbum(albumId, name, coverPath, songIds);
});

ipcMain.handle('db-delete-custom-album', (event, albumId) => {
  db.deleteCustomAlbum(albumId);
  return db.getCustomAlbums();
});

ipcMain.handle('db-get-album-songs', (event, albumId) => {
  return db.getAlbumSongs(albumId);
});

