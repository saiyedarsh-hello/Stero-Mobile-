const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

async function test() {
  console.log('Downloading with ffmpeg at:', ffmpeg);
  const res = await youtubedl('https://www.youtube.com/watch?v=2NiyrtYegso', {
    extractAudio: true,
    audioFormat: 'mp3',
    output: 'test_audio.mp3',
    ffmpegLocation: ffmpeg,
    noCheckCertificates: true,
    noWarnings: true,
    addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36']
  });
  console.log(res);
}
test().catch(console.error);
