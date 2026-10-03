const { defineConfig } = require('@playwright/test');
const os = require('os');
const path = require('path');

const DATA_DIR = path.join(os.tmpdir(), 'bm-accept-' + process.pid);
const PORT = 4100;

module.exports = defineConfig({
  testDir: './test/acceptance',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `node server.js`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), BM_DATA_DIR: DATA_DIR }
  }
});
