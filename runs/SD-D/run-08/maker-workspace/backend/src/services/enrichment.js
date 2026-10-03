import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { SNAPSHOT_DIR } from '../db/index.js';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) BookmarkManager/1.0';
const FETCH_TIMEOUT_MS = 15000;

function bookmarkDir(id) {
  const dir = path.join(SNAPSHOT_DIR, String(id));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, headers: { 'user-agent': UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(timer);
  }
}

function extractMeta($, baseUrl) {
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = $(sel).first();
      const val = el.attr('content') || el.text();
      if (val && val.trim()) return val.trim();
    }
    return '';
  };

  const title = pick([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'title',
  ]);
  const description = pick([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);
  const previewSrc = pick(['meta[property="og:image"]', 'meta[name="twitter:image"]']);

  // Favicon: <link rel="icon"> variants, else /favicon.ico
  let faviconSrc = '';
  $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((_, el) => {
    if (!faviconSrc) faviconSrc = $(el).attr('href') || '';
  });

  const resolve = (src) => {
    if (!src) return '';
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return '';
    }
  };

  return {
    title,
    description,
    previewUrl: resolve(previewSrc),
    faviconUrl: resolve(faviconSrc) || resolve('/favicon.ico'),
  };
}

async function download(url, destDir, baseName) {
  if (!url) return null;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const ext =
      (contentType.includes('png') && '.png') ||
      (contentType.includes('jpeg') && '.jpg') ||
      (contentType.includes('svg') && '.svg') ||
      (contentType.includes('gif') && '.gif') ||
      (contentType.includes('x-icon') && '.ico') ||
      (contentType.includes('vnd.microsoft.icon') && '.ico') ||
      path.extname(new URL(url).pathname) ||
      '.img';
    const fileName = `${baseName}${ext}`;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    fs.writeFileSync(path.join(destDir, fileName), buf);
    return fileName;
  } catch {
    return null;
  }
}

/**
 * Collect title/description/favicon/preview for a page (FR-003).
 * Falls back gracefully field-by-field; never throws (FR-005).
 * Returns { title, description, faviconPath, previewPath }.
 */
export async function enrich(id, url) {
  const dir = bookmarkDir(id);
  let meta = { title: '', description: '', previewUrl: '', faviconUrl: '' };

  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const html = await res.text();
      meta = extractMeta(cheerio.load(html), url);
    }
  } catch {
    // network/HTML fetch failed — try the browser fallback below
  }

  // Browser fallback for JS-rendered pages when the fast path found no title.
  if (!meta.title) {
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ userAgent: UA });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT_MS });
        const html = await page.content();
        meta = extractMeta(cheerio.load(html), url);
      } finally {
        await browser.close();
      }
    } catch {
      // browser fallback unavailable/failed — keep whatever we have
    }
  }

  const faviconPath = await download(meta.faviconUrl, dir, 'favicon');
  const previewPath = await download(meta.previewUrl, dir, 'preview');

  return {
    title: meta.title,
    description: meta.description,
    faviconPath,
    previewPath,
  };
}
