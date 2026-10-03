import path from 'node:path';
import { SNAPSHOT_DIR } from './db.js';
import { ensureProtocol } from './url.js';

// Use the browser binaries baked into the shared image.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/playwright-browsers';
}

// Capture a full-page screenshot and the rendered HTML of a URL.
// Returns { image_file, html_file, title } with filenames relative to SNAPSHOT_DIR.
export async function capturePage(rawUrl, bookmarkId) {
  const { chromium } = await import('playwright');
  const url = ensureProtocol(rawUrl);
  const stamp = Date.now();
  const imageName = `bm${bookmarkId}-${stamp}.png`;
  const htmlName = `bm${bookmarkId}-${stamp}.html`;

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      // Fall back to a laxer wait condition for slow/streaming pages.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    const title = await page.title().catch(() => '');
    await page.screenshot({ path: path.join(SNAPSHOT_DIR, imageName), fullPage: true });
    const html = await page.content();
    const fs = await import('node:fs/promises');
    await fs.writeFile(path.join(SNAPSHOT_DIR, htmlName), html, 'utf8');
    return { image_file: imageName, html_file: htmlName, title };
  } finally {
    await browser.close();
  }
}
