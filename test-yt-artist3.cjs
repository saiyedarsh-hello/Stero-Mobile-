const YTMusic = require('ytmusic-api');

async function test() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  const results = await ytmusic.searchSongs('a');
  console.log('Result type of artist:', Array.isArray(results[0].artist) ? 'Array' : typeof results[0].artist);
  if (Array.isArray(results[0].artist)) {
    console.log(results[0].artist);
  }
}

test();
