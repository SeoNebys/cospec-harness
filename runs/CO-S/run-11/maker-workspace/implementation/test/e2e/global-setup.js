'use strict';
const fs = require('fs');
const path = require('path');

// Start each e2e run from a clean database.
module.exports = async () => {
  const dir = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['e2e.db', 'e2e.db-wal', 'e2e.db-shm']) {
    try { fs.unlinkSync(path.join(dir, f)); } catch {}
  }
};
