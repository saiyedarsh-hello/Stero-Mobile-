const fs = require('fs');
const path = require('path');

const dirs = [
  'apps',
  'apps/desktop',
  'packages',
  'packages/ui',
  'packages/core'
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
    console.log(`Created ${d}`);
  }
});

const filesToMove = [
  'assets',
  'electron',
  'src',
  'public',
  'index.html',
  'vite.config.js',
  'tsup.config.js',
  'eslint.config.js',
  'package.json'
];

filesToMove.forEach(f => {
  if (fs.existsSync(f)) {
    fs.renameSync(f, path.join('apps', 'desktop', f));
    console.log(`Moved ${f} to apps/desktop/${f}`);
  }
});

if (fs.existsSync('root-package.json')) {
  fs.renameSync('root-package.json', 'package.json');
  console.log('Renamed root-package.json to package.json');
}

console.log('Restructuring complete!');
