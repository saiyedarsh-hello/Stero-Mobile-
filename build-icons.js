const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const sourceImage = 'C:\\Users\\saiye\\.gemini\\antigravity-ide\\brain\\673ebed9-a3ed-41dc-9f02-f68e3772b8a5\\media__1780369814417.png';
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const pngPath = path.join(publicDir, 'icon.png');
const icoPath = path.join(publicDir, 'icon.ico');

async function main() {
  console.log('Reading source image:', sourceImage);
  if (!fs.existsSync(sourceImage)) {
    console.error('Source image not found!');
    process.exit(1);
  }

  // Load image with Jimp
  const image = await Jimp.read(sourceImage);
  
  // Resize to 256x256 for icon
  console.log('Resizing to 256x256...');
  image.resize({ w: 256, h: 256 });
  
  // Save as PNG
  console.log('Saving PNG to:', pngPath);
  await image.write(pngPath);
  
  // Convert PNG to ICO using png-to-ico
  const pngToIco = require('png-to-ico').default;
  console.log('Converting PNG to ICO...');
  const icoBuffer = await pngToIco(pngPath);
  
  console.log('Saving ICO to:', icoPath);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Icons generated successfully!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
