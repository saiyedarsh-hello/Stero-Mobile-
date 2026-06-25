const fs = require('fs');
const path = require('path');

const coreSrc = path.join('packages', 'core', 'src');
const uiSrc = path.join('packages', 'ui', 'src');

if (!fs.existsSync(coreSrc)) fs.mkdirSync(coreSrc, { recursive: true });
if (!fs.existsSync(uiSrc)) fs.mkdirSync(uiSrc, { recursive: true });

const storePath = path.join('apps', 'desktop', 'src', 'store');
if (fs.existsSync(storePath)) {
  fs.renameSync(storePath, path.join(coreSrc, 'store'));
  console.log('Moved store to packages/core/src/store');
}

const componentsPath = path.join('apps', 'desktop', 'src', 'components');
if (fs.existsSync(componentsPath)) {
  fs.renameSync(componentsPath, path.join(uiSrc, 'components'));
  console.log('Moved components to packages/ui/src/components');
}

const constantsPath = path.join('apps', 'desktop', 'src', 'constants');
if (fs.existsSync(constantsPath)) {
  fs.renameSync(constantsPath, path.join(coreSrc, 'constants'));
  console.log('Moved constants to packages/core/src/constants');
}

// Generate exports for UI
let uiExports = '';
const uiFiles = fs.readdirSync(path.join(uiSrc, 'components'));
uiFiles.forEach(file => {
  if (file.endsWith('.jsx')) {
    const name = file.replace('.jsx', '');
    uiExports += `export { default as ${name} } from './src/components/${file}';\n`;
    
    // Patch imports in components
    const compPath = path.join(uiSrc, 'components', file);
    let code = fs.readFileSync(compPath, 'utf8');
    code = code.replace(/import { usePlayerStore } from '\.\.\/store\/usePlayerStore';/g, "import { usePlayerStore } from '@stero/core';");
    code = code.replace(/import { usePlayerStore } from '\.\/store\/usePlayerStore';/g, "import { usePlayerStore } from '@stero/core';");
    code = code.replace(/from '\.\.\/constants\/([^']+)'/g, "from '@stero/core'");
    fs.writeFileSync(compPath, code);
  }
});
fs.writeFileSync(path.join('packages', 'ui', 'index.js'), uiExports);

// Generate exports for Core
let coreExports = 'export * from "./src/store/usePlayerStore.js";\n';
if (fs.existsSync(path.join(coreSrc, 'constants'))) {
  const constantsFiles = fs.readdirSync(path.join(coreSrc, 'constants'));
  constantsFiles.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      coreExports += `export * from "./src/constants/${file}";\n`;
    }
  });
}
fs.writeFileSync(path.join('packages', 'core', 'index.js'), coreExports);

// Patch App.jsx
const appPath = path.join('apps', 'desktop', 'src', 'App.jsx');
if (fs.existsSync(appPath)) {
  let appCode = fs.readFileSync(appPath, 'utf8');
  appCode = appCode.replace(/import { usePlayerStore } from '\.\/store\/usePlayerStore';/g, "import { usePlayerStore } from '@stero/core';");
  appCode = appCode.replace(/import Sidebar from '\.\/components\/Sidebar';/g, '');
  appCode = appCode.replace(/import PlayerBar from '\.\/components\/PlayerBar';/g, '');
  appCode = appCode.replace(/import WindowControls from '\.\/components\/WindowControls';/g, '');
  appCode = appCode.replace(/import MusicSection from '\.\/components\/MusicSection';/g, '');
  appCode = appCode.replace(/const Visualizer = lazy\(\(\) => import\('\.\/components\/Visualizer'\)\);/g, "import { Visualizer } from '@stero/ui';");
  appCode = appCode.replace(/const SongList = lazy\(\(\) => import\('\.\/components\/SongList'\)\);/g, "import { SongList } from '@stero/ui';");
  appCode = appCode.replace(/const AlbumGrid = lazy\(\(\) => import\('\.\/components\/AlbumGrid'\)\);/g, "import { AlbumGrid } from '@stero/ui';");
  appCode = appCode.replace(/const EditTrackModal = lazy\(\(\) => import\('\.\/components\/EditTrackModal'\)\);/g, "import { EditTrackModal } from '@stero/ui';");
  appCode = appCode.replace(/const EditPlaylistModal = lazy\(\(\) => import\('\.\/components\/EditPlaylistModal'\)\);/g, "import { EditPlaylistModal } from '@stero/ui';");
  
  // Add named imports at the top
  const newImports = `import { Sidebar, PlayerBar, WindowControls, MusicSection } from '@stero/ui';\n`;
  appCode = appCode.replace("import Lenis from 'lenis';", "import Lenis from 'lenis';\n" + newImports);
  
  fs.writeFileSync(appPath, appCode);
  console.log('Patched App.jsx imports.');
}

console.log('Done moving packages.');
