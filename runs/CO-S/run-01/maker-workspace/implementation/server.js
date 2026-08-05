// Entry point: start the local bookmarks server.
//   node server.js            (defaults to port 3000, data in ./data/bookmarks.json)
//   PORT=8080 node server.js
const http = require('http');
const path = require('path');
const { Store } = require('./src/store');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'bookmarks.json');

const store = new Store(DATA_FILE);
const server = http.createServer(createApp(store));

server.listen(PORT, () => {
  console.log(`Bookmarks app running at http://localhost:${PORT}`);
  console.log(`Data stored in ${DATA_FILE}`);
});
