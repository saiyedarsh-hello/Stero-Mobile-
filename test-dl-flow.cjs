const db = require('./electron/db.cjs');
const Downloader = require('./electron/downloader.cjs');

async function run() {
  const downloader = new Downloader(db);
  downloader.setWebContents({
    send: (channel, data) => console.log('IPC send:', channel, data)
  });

  console.log('Searching...');
  const results = await downloader.search('Never gonna give you up');
  console.log('Found:', results[0].title);

  console.log('Downloading...');
  const res = await downloader.addDownload(results[0]);
  console.log('addDownload result:', res);
  
  // processQueue runs asynchronously, wait a bit
  await new Promise(resolve => setTimeout(resolve, 30000));
}

run();
