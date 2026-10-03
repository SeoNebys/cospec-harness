import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    use: {
        baseURL: 'http://127.0.0.1:4000',
        browserName: 'chromium',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm start',
        url: 'http://127.0.0.1:4000',
        reuseExistingServer: true,
    },
});
