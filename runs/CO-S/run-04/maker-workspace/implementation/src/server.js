'use strict';

const http = require('http');
const path = require('path');
const { Store } = require('./store');
const { fetchTitle } = require('./titleFetcher');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.BOOKMARKS_FILE || path.join(__dirname, '..', 'data', 'bookmarks.json');

const store = new Store(DATA_FILE);
const app = createApp({ store, fetchTitle });

const server = http.createServer(app);
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmarks app running at http://localhost:${PORT}`);
  console.log(`Saving your links to ${DATA_FILE}`);
});

module.exports = { server };
