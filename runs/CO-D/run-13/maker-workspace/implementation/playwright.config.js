'use strict';
const { defineConfig } = require('@playwright/test');
const path = require('path');
const os = require('os');

const PORT = process.env.E2E_PORT || '4050';
const DATA = path.join(os.tmpdir(), 'bm-e2e-' + process.pid + '.json');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:' + PORT },
  webServer: {
    command: 'node src/server.js',
    env: { PORT: PORT, DATA_FILE: DATA },
    port: Number(PORT),
    reuseExistingServer: false,
    timeout: 20000,
  },
});
