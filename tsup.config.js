const { defineConfig } = require('tsup');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

module.exports = defineConfig({
  entry: ['electron/main.cjs', 'electron/preload.cjs'],
  outDir: 'dist-electron',
  format: ['cjs'],
  outExtension({ format }) {
    return {
      js: '.cjs'
    }
  },
  target: 'node18', // Electron 25+ uses Node 18+
  minify: true,
  clean: true,
  // We need to keep some Node/Electron built-ins external so they aren't bundled
  external: [
    'electron',
    'path',
    'fs',
    'crypto',
    'url',
    'better-sqlite3',
    'music-metadata',
    'youtube-dl-exec',
    'ytmusic-api',
    'ffmpeg-static'
  ],
  onSuccess: async () => {
    // Obfuscate the bundled output
    console.log('Obfuscating backend code...');
    const outPaths = ['dist-electron/main.cjs', 'dist-electron/preload.cjs'];
    for (const outPath of outPaths) {
      if (fs.existsSync(outPath)) {
        const code = fs.readFileSync(outPath, 'utf8');
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          debugProtectionInterval: 0,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 10,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.5,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 2,
          stringArrayWrappersType: 'variable',
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false
        });
        fs.writeFileSync(outPath, obfuscationResult.getObfuscatedCode());
        console.log(`Backend obfuscation complete for ${outPath}.`);
      }
    }
  }
});
