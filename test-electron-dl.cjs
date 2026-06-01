const { app } = require('electron');
const db = require('./electron/db.cjs');
const Downloader = require('./electron/downloader.cjs');

app.whenReady().then(async () => {
  try {
    const downloader = new Downloader(db);
    downloader.setWebContents({
      send: (channel, data) => console.log('IPC send:', channel, data)
    });

    console.log('Searching...');
    const results = await downloader.search('Never gonna give you up');
    console.log('Found:', results[0].title, results[0].videoId);

    console.log('Downloading...');
    const res = await downloader.addDownload(results[0]);
    console.log('addDownload result:', res);
    
    downloader.broadcastState = () => {
      const state = downloader.getQueueState();
      console.log('State updated. Active:', state.active.length, 'Completed:', state.completed.length);
      if (state.active.length > 0) {
        console.log('Progress:', state.active[0].progress, '%', 'Status:', state.active[0].status);
      }
    };

    // wait for completion
    let checks = 0;
    while (downloader.activeDownloads.size > 0 || downloader.queue.length > 0) {
      await new Promise(r => setTimeout(r, 1000));
      checks++;
      if (checks > 60) break;
    }
    
    console.log('Finished. Songs in DB:', db.getAllSongs().map(s => s.filepath));
  } catch(e) {
    console.error(e);
  }
  app.quit();
});
