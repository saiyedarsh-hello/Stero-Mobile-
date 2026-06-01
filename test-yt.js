const YTMusic = require('ytmusic-api');
console.log(YTMusic);
async function test() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  const songs = await ytmusic.searchSongs('avicii wake me up');
  console.log(JSON.stringify(songs.slice(0, 2), null, 2));
}
test().catch(console.error);
