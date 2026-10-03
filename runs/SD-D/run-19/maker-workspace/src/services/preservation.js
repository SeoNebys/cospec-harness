import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { parseHttpUrl } from '../lib/url.js';

const PRESERVED_DIR = process.env.PRESERVED_DIR || 'data/preserved';

let browserPromise;
async function getBrowser() {
  if (!browserPromise) {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright-browsers';
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) { const b = await browserPromise; await b.close(); browserPromise = undefined; }
}

/**
 * Preserve a bookmark's page. Returns { preservedHtmlPath } for HTML pages or
 * { preservedPdfPath } for PDF links. Throws on failure (caller keeps the
 * bookmark unaffected and reports failure).
 */
export async function preservePage(id, url) {
  const u = parseHttpUrl(url);
  mkdirSync(PRESERVED_DIR, { recursive: true });
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({ userAgent: 'BookmarkManager/1.0' });
    const page = await context.newPage();
    const resp = await page.goto(u.href, { waitUntil: 'networkidle', timeout: 20000 });
    const ctype = (resp && resp.headers()['content-type']) || '';

    if (ctype.includes('application/pdf') || u.pathname.toLowerCase().endsWith('.pdf')) {
      const buffer = await resp.body();
      const pdfPath = join(PRESERVED_DIR, `${id}.pdf`);
      writeFileSync(pdfPath, buffer);
      return { preservedPdfPath: pdfPath };
    }

    // Inline external CSS, images and fonts as data URIs → self-contained HTML.
    await inlineResources(page);
    let html = await page.content();
    html = sanitizeHtml(html, {
      allowedTags: false, // keep structure
      allowedAttributes: false,
      allowVulnerableTags: false,
      exclusiveFilter: (frame) => frame.tag === 'script',
    });
    const htmlPath = join(PRESERVED_DIR, `${id}.html`);
    writeFileSync(htmlPath, html, 'utf8');
    return { preservedHtmlPath: htmlPath };
  } finally {
    if (context) { try { await context.close(); } catch { /* ignore */ } }
  }
}

async function inlineResources(page) {
  await page.evaluate(async () => {
    const toDataUri = async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch { return null; }
    };
    // Inline stylesheets.
    for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
      try {
        const res = await fetch(link.href);
        const css = await res.text();
        const style = document.createElement('style');
        style.textContent = css;
        link.replaceWith(style);
      } catch { /* ignore */ }
    }
    // Inline images.
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (img.src && !img.src.startsWith('data:')) {
        const data = await toDataUri(img.src);
        if (data) img.src = data;
      }
    }
  });
}

/**
 * Submit a URL to the Internet Archive Save Page Now and return a snapshot URL.
 * Throws on failure.
 */
export async function submitToArchiveOrg(url) {
  const u = parseHttpUrl(url);
  const saveUrl = `https://web.archive.org/save/${u.href}`;
  const res = await fetch(saveUrl, { method: 'GET', redirect: 'follow' });
  if (!res.ok) throw new Error(`Internet Archive returned ${res.status}`);
  const contentLocation = res.headers.get('content-location');
  if (contentLocation) return `https://web.archive.org${contentLocation}`;
  return res.url || `https://web.archive.org/web/*/${u.href}`;
}
