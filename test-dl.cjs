const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const outputPath = path.join(__dirname, 'test artist - test title.mp3');

const subprocess = youtubedl.exec(url, {
  extractAudio: true,
  audioFormat: 'mp3',
  output: outputPath,
  ffmpegLocation: ffmpeg,
  noCheckCertificates: true,
  noWarnings: true,
  addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
});

subprocess.stdout.on('data', (data) => console.log('stdout:', data.toString()));
subprocess.stderr.on('data', (data) => console.error('stderr:', data.toString()));
subprocess.on('close', (code) => console.log('closed with code', code));

subprocess.catch(err => console.error('err', err));
