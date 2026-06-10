const Jimp = require('jimp');

async function fixIcon() {
  try {
    const image = await Jimp.read('public/icon.png');
    // Ensure square size for icon
    await image.resize(256, 256).writeAsync('public/icon-fixed.png');
    console.log('Fixed icon created');
  } catch (err) {
    console.error('Error fixing icon:', err);
  }
}

fixIcon();
