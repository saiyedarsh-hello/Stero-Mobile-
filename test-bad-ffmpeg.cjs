const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

async function test() {
  const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // short test video
  const outputPath = path.join(__dirname, 'test-no-ffmpeg.mp3');
  
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  try {
    const subprocess = youtubedl.exec(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: outputPath,
      ffmpegLocation: 'C:\\fake_path_to_ffmpeg.exe',
      noCheckCertificates: true,
      noWarnings: true
    });
    
    await subprocess;
    console.log('Success!');
    console.log('File exists?', fs.existsSync(outputPath));
  } catch (e) {
    console.error('Failed with error:', e.message);
  }
}

test();
