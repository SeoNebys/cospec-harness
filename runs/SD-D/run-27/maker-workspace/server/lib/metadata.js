// Fetch page metadata: title, description, preview image, favicon (spec US1, FR-003).
// Uses Playwright/Chromium when available; falls back to a plain HTTP fetch + parse.
import { parse as parseHtml } from 'node-html-parser';

let chromiumPromise = null;
async function getBrowser() {
  if (!chromiumPromise) {
    chromiumPromise = (async () => {
      try {
        const { chromium } = await import('playwright');
        return await chromium.launch({ headless: true });
      } catch {
        return null;
      }
    })();
  }
  return chromiumPromise;
}

function absolute(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return null;
  }
}

function extractFromHtml(html, url) {
  const root = parseHtml(html);
  const getMeta = (sel, attr = 'content') => {
    const el = root.querySelector(sel);
    return el ? el.getAttribute(attr) : null;
  };
  const title =
    getMeta('meta[property="og:title"]') ||
    (root.querySelector('title')?.text?.trim() || null);
  const description =
    getMeta('meta[property="og:description"]') ||
    getMeta('meta[name="description"]');
  const image = getMeta('meta[property="og:image"]');
  let icon =
    root.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    '/favicon.ico';
  return {
    title: title || null,
    description: description || null,
    preview_image_url: absolute(url, image),
    icon_url: absolute(url, icon)
  };
}

export async function fetchMetadata(url) {
  // Try Playwright first for JS-rendered pages.
  const browser = await getBrowser();
  if (browser) {
    let context;
    try {
      context = await browser.newContext();
      const page = await context.newPage();
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const ct = resp?.headers()?.['content-type'] || '';
      if (ct.includes('application/pdf')) {
        await context.close();
        return { status: 'ok', title: null, description: null, preview_image_url: null, icon_url: null, contentType: 'pdf' };
      }
      const html = await page.content();
      const meta = extractFromHtml(html, url);
      await context.close();
      const status = meta.title || meta.description ? 'ok' : 'partial';
      return { status, ...meta };
    } catch {
      if (context) { try { await context.close(); } catch {} }
      // fall through to HTTP fallback
    }
  }
  // Fallback: plain fetch.
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) {
      return { status: 'ok', title: null, description: null, preview_image_url: null, icon_url: null, contentType: 'pdf' };
    }
    const html = await resp.text();
    const meta = extractFromHtml(html, url);
    const status = meta.title || meta.description ? 'ok' : 'partial';
    return { status, ...meta };
  } catch {
    return { status: 'failed', title: null, description: null, preview_image_url: null, icon_url: null };
  }
}

export async function closeBrowser() {
  if (chromiumPromise) {
    const b = await chromiumPromise;
    if (b) { try { await b.close(); } catch {} }
    chromiumPromise = null;
  }
}
