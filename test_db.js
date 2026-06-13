const Database = require('better-sqlite3');
const db = new Database('c:/Users/saiye/AppData/Roaming/stero/library.db');
const songs = db.prepare('SELECT title, duration, play_count FROM songs LIMIT 10').all();
console.log(songs);
