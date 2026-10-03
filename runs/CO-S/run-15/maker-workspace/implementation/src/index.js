'use strict';

const path = require('path');
const { createApp } = require('./server');
const { createStore } = require('./store');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DATA_FILE ||
  path.join(__dirname, '..', 'data', 'bookmarks.json');

const store = createStore(DATA_FILE);
const app = createApp({ store });

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmarks app listening on http://${HOST}:${PORT} (data: ${DATA_FILE})`);
});
