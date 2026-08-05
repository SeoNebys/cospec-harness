/**
 * One-step launcher (FR-035, SC-008). Starts the local service and opens the app
 * in the default browser, with clear "it's running" feedback — no multi-step ritual.
 */
import { exec } from 'node:child_process';
import { start } from './server.js';

const PORT = Number(process.env.PORT ?? 4321);
const URL = `http://127.0.0.1:${PORT}`;

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32' ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, () => { /* if it can't auto-open, the printed URL is the fallback */ });
}

start()
  .then(() => {
    console.log('\n  📚 Bookmark Manager is running.');
    console.log(`  Open it here: ${URL}`);
    console.log('  (Leave this window open while you use the app. Close it to stop.)\n');
    openBrowser(URL);
  })
  .catch((err) => {
    console.error('Could not start Bookmark Manager:', err);
    process.exit(1);
  });
