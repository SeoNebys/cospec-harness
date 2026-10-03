'use strict';

// Boots the real app for acceptance tests using a fresh temporary data file,
// so tests exercise production behaviour without touching real data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../../src/server');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-e2e-'));
const storeFile = path.join(dir, 'db.json');
const app = createApp({ storeFile });
app.listen(4010, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log('e2e server on 4010, store at', storeFile);
});
