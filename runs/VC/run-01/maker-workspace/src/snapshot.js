'use strict';

const path = require('path');
const fs = require('fs');
const { SNAP_DIR } = require('./db');

// Use the shared browser binaries provided by the image.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/playwright-browsers';
}

let chromiumPromise = null;
function getChromium() {
  if (!chromiumPromise) {
    chromiumPromise = (async () => {
      const { chromium } = require('playwright');
      return chromium;
    })();
  }
  return chromiumPromise;
}

// Capture a local copy of the page: a self-contained-ish HTML file and a PDF.
// Returns { html, pdf } as filenames relative to the snapshot dir for the id,
// or throws on failure. Graceful handling is left to the caller.
async function captureSnapshot(id, url) {
  const dir = path.join(SNAP_DIR, String(id));
  fs.mkdirSync(dir, { recursive: true });

  const chromium = await getChromium();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; BookmarkManager/1.0)' });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });

    const out = { html: '', pdf: '' };
    const ct = (response && response.headers()['content-type']) || '';

    if (/pdf/i.test(ct)) {
      // The page itself is a PDF: save the raw bytes.
      const body = await response.body();
      fs.writeFileSync(path.join(dir, 'page.pdf'), body);
      out.pdf = 'page.pdf';
    } else {
      const html = await page.content();
      fs.writeFileSync(path.join(dir, 'page.html'), html, 'utf8');
      out.html = 'page.html';
      try {
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: path.join(dir, 'page.pdf'), format: 'A4', printBackground: true });
        out.pdf = 'page.pdf';
      } catch { /* PDF generation is best-effort */ }
    }
    await context.close();
    return out;
  } finally {
    await browser.close();
  }
}

module.exports = { captureSnapshot };
