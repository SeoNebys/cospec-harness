'use strict';

const path = require('path');
const fs = require('fs');
const { SNAP_DIR } = require('./db');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/playwright-browsers';
}

// Capture a full-page screenshot + rendered HTML for long-term reference.
// Returns { image_file, html_file, title } (basenames relative to SNAP_DIR).
async function capture(url, bookmarkId) {
  const { chromium } = require('playwright');
  const stamp = Date.now();
  const base = `bm${bookmarkId}-${stamp}`;
  const imageName = `${base}.png`;
  const htmlName = `${base}.html`;

  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (compatible; BookmarkManager/1.0; +http://localhost)'
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      // networkidle can hang on streaming pages; fall back to domcontentloaded
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    const title = await page.title().catch(() => '');
    const html = await page.content();
    fs.writeFileSync(path.join(SNAP_DIR, htmlName), html, 'utf8');
    await page.screenshot({
      path: path.join(SNAP_DIR, imageName),
      fullPage: true
    });
    return { image_file: imageName, html_file: htmlName, title };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { capture };
