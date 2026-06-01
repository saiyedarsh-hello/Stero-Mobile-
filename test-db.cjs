const db = require('./electron/db.cjs');

console.log('Saved Folder:', db.getSavedFolderPath());
console.log('Songs count:', db.getAllSongs().length);
