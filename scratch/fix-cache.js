const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\saiye\\AppData\\Local\\electron-builder\\Cache\\winCodeSign\\095719407';
const destDir1 = 'C:\\Users\\saiye\\AppData\\Local\\electron-builder\\Cache\\winCodeSign\\winCodeSign-2.6.0';
const destDir2 = 'C:\\Users\\saiye\\AppData\\Local\\electron-builder\\Cache\\winCodeSign\\2.6.0';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        console.error(`Failed to copy ${srcPath}:`, err.message);
      }
    }
  }
}

console.log('Copying to winCodeSign-2.6.0...');
copyDirRecursive(srcDir, destDir1);
console.log('Copying to 2.6.0...');
copyDirRecursive(srcDir, destDir2);
console.log('Done!');
