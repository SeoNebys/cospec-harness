import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  workers: 1,
  use: { baseURL:'http://127.0.0.1:4000', headless:true },
  webServer: {
    command:'node server.js',
    port:4000,
    reuseExistingServer:false,
    env:{ PORT:'4000', BOOKMARK_DATA_FILE:'/tmp/keeplist-playwright-bookmarks.json' }
  }
});
