import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['electron/main.cjs', 'electron/preload.cjs'],
  outDir: 'dist-electron',
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  clean: true,
  external: ['electron', 'better-sqlite3', 'ffmpeg-static', 'youtube-dl-exec'],
});
