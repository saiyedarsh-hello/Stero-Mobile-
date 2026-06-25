const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const packagesCoreDir = path.join(rootDir, 'packages', 'core', 'src');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isFile()) {
      fs.copyFileSync(fromPath, toPath);
    } else {
      copyFolderSync(fromPath, toPath);
    }
  });
}

// 1. Move core package to mobile src
const mobileCoreDir = path.join(mobileDir, 'src', 'core');
console.log('Copying @stero/core to mobile/src/core...');
copyFolderSync(packagesCoreDir, mobileCoreDir);

// Create index.js in core so imports resolve properly
const coreIndexContent = `export * from "./store/usePlayerStore.js";\nexport * from "./constants/heroBackgrounds.js";\n`;
fs.writeFileSync(path.join(mobileCoreDir, 'index.js'), coreIndexContent);

// 2. Prepare to move mobile app to root
// First we merge dependencies from mobile/package.json to root/package.json
const mobilePkg = require(path.join(mobileDir, 'package.json'));

// Modify mobile package.json for root context
mobilePkg.name = "stero";
delete mobilePkg.dependencies["@stero/core"];
mobilePkg.dependencies["zustand"] = "^5.0.14";

console.log('Updating mobile files to root...');

// Write it to root
fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify(mobilePkg, null, 2));

// Move other configs from mobile to root
const filesToMove = ['app.json', 'tsconfig.json', 'babel.config.js'];
for (const file of filesToMove) {
  const src = path.join(mobileDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(rootDir, file));
  }
}

// Move src and assets folders
copyFolderSync(path.join(mobileDir, 'src'), path.join(rootDir, 'src'));
const assetsDir = path.join(mobileDir, 'assets');
if (fs.existsSync(assetsDir)) {
  copyFolderSync(assetsDir, path.join(rootDir, 'assets'));
}

// Replace imports in all TS/TSX files
function replaceImports(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fp = path.join(dir, file);
    if (fs.lstatSync(fp).isDirectory()) {
      replaceImports(fp);
    } else if (fp.endsWith('.ts') || fp.endsWith('.tsx') || fp.endsWith('.js') || fp.endsWith('.jsx')) {
      let content = fs.readFileSync(fp, 'utf8');
      if (content.includes('@stero/core')) {
        // Calculate relative path from this file to src/core
        const relativeToSrc = path.relative(path.dirname(fp), path.join(rootDir, 'src', 'core', 'store', 'usePlayerStore.js'));
        // We actually just need to point to the store directly
        let importPath = path.relative(path.dirname(fp), path.join(rootDir, 'src', 'core'));
        if (!importPath.startsWith('.')) importPath = './' + importPath;
        importPath = importPath.replace(/\\/g, '/');
        
        content = content.replace(/@stero\/core/g, importPath);
        fs.writeFileSync(fp, content);
      }
    }
  });
}
replaceImports(path.join(rootDir, 'src'));

// 3. Purge monorepo files
console.log('Cleaning up Monorepo artifacts...');
const rmDir = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

rmDir(path.join(rootDir, 'apps'));
rmDir(path.join(rootDir, 'packages'));
rmDir(path.join(rootDir, 'node_modules'));

const filesToDelete = ['turbo.json', 'setup.cjs', 'move-packages.cjs', 'package-lock.json', '.gitattributes'];
for (const file of filesToDelete) {
  const fp = path.join(rootDir, file);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

console.log('Migration complete! Ready for clean install.');
