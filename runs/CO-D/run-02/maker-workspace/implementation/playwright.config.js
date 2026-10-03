const path = require('path');
const DATA_DIR = '/tmp/bm-acceptance-data';
// Fresh data for each acceptance run.
try { require('fs').rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}

module.exports = {
  testDir: path.join(__dirname, 'tests', 'acceptance'),
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4099',
    trace: 'off'
  },
  webServer: {
    command: 'node src/server.js',
    url: 'http://127.0.0.1:4099/api/state',
    reuseExistingServer: false,
    timeout: 20000,
    env: { PORT: '4099', HOST: '127.0.0.1', DATA_DIR }
  }
};
