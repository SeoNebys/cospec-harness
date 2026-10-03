import { chromium } from 'playwright';
import { deriveTitle, parseHttpUrl } from '../lib/url.js';

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
 * Fetch page metadata. Always resolves; on failure returns a derived title and
 * metadataUnavailable=true (fail-soft, FR-004).
 */
export async function fetchMetadata(url) {
  const u = parseHttpUrl(url);
  const fallback = {
    title: deriveTitle(url), description: null, faviconUrl: null,
    previewImageUrl: null, metadataUnavailable: true,
  };

  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({ userAgent: 'BookmarkManager/1.0' });
    const page = await context.newPage();
    const resp = await page.goto(u.href, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const ctype = (resp && resp.headers()['content-type']) || '';
    if (ctype.includes('application/pdf') || u.pathname.toLowerCase().endsWith('.pdf')) {
      return { title: deriveTitle(url), description: null, faviconUrl: null, previewImageUrl: null, metadataUnavailable: false };
    }

    const data = await page.evaluate(() => {
      const meta = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) || null;
      const favicon = document.querySelector('link[rel~="icon"]')?.getAttribute('href') || '/favicon.ico';
      return {
        title: document.title || meta('meta[property="og:title"]') || null,
        description: meta('meta[name="description"]') || meta('meta[property="og:description"]') || null,
        favicon,
        preview: meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || null,
      };
    });

    const resolve = (href) => { try { return href ? new URL(href, u.href).href : null; } catch { return null; } };
    return {
      title: (data.title && data.title.trim()) || deriveTitle(url),
      description: data.description,
      faviconUrl: resolve(data.favicon),
      previewImageUrl: resolve(data.preview),
      metadataUnavailable: false,
    };
  } catch {
    return fallback;
  } finally {
    if (context) { try { await context.close(); } catch { /* ignore */ } }
  }
}
