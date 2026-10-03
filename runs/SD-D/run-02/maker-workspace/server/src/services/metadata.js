// Metadata capture service (FR-003/005, R5, R13).
// Fetches a page, extracts title/description/favicon/preview, caches favicon and
// preview locally (best-effort), and writes results back with the delayed-metadata
// safeguard (applyFetchedMetadata only fills fields the user has not customized).
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../db/connection.js';
import { applyFetchedMetadata, setMetadataStatus } from '../models/bookmark.js';

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_DIR = join(DATA_DIR, 'cache');

async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

// Extract metadata fields from HTML. Exported for potential unit reuse.
export function extractMetadata(html, baseUrl) {
  const $ = cheerio.load(html);
  const pick = (sel, attr = 'content') => {
    const el = $(sel).first();
    const v = el.attr(attr);
    return v ? v.trim() : null;
  };
  const title =
    pick('meta[property="og:title"]') ||
    pick('meta[name="twitter:title"]') ||
    ($('title').first().text() || '').trim() ||
    null;
  const description =
    pick('meta[property="og:description"]') ||
    pick('meta[name="twitter:description"]') ||
    pick('meta[name="description"]') ||
    null;
  const previewUrl =
    absolutize(pick('meta[property="og:image"]'), baseUrl) ||
    absolutize(pick('meta[name="twitter:image"]'), baseUrl);
  let iconHref =
    pick('link[rel="icon"]', 'href') ||
    pick('link[rel="shortcut icon"]', 'href') ||
    pick('link[rel="apple-touch-icon"]', 'href');
  let faviconUrl = absolutize(iconHref, baseUrl);
  if (!faviconUrl) {
    try {
      faviconUrl = new URL('/favicon.ico', baseUrl).toString();
    } catch {
      faviconUrl = null;
    }
  }
  return { title, description, previewUrl, faviconUrl };
}

function absolutize(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function cacheImage(url, prefix) {
  if (!url) return null;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5_000_000) return null;
    mkdirSync(CACHE_DIR, { recursive: true });
    const ext = extForType(type);
    const name = `${prefix}-${createHash('sha1').update(url).digest('hex').slice(0, 16)}${ext}`;
    const filePath = join(CACHE_DIR, name);
    writeFileSync(filePath, buf);
    return filePath;
  } catch {
    return null;
  }
}

function extForType(type) {
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  if (type.includes('gif')) return '.gif';
  if (type.includes('svg')) return '.svg';
  if (type.includes('webp')) return '.webp';
  if (type.includes('ico') || type.includes('icon')) return '.ico';
  return '.img';
}

// Run the capture for a bookmark id + url. Never throws; records status.
export async function captureMetadata(db, id, url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+local)' },
    });
    if (!res.ok) {
      setMetadataStatus(db, id, 'failed');
      return;
    }
    const type = res.headers.get('content-type') || '';
    let meta = { title: null, description: null, previewUrl: null, faviconUrl: null };
    if (type.includes('html')) {
      const html = await res.text();
      meta = extractMetadata(html, url);
    } else {
      // Non-HTML (e.g. PDF): best-effort favicon only.
      try {
        meta.faviconUrl = new URL('/favicon.ico', url).toString();
      } catch {
        /* ignore */
      }
    }
    const faviconPath = await cacheImage(meta.faviconUrl, 'favicon');
    const previewPath = await cacheImage(meta.previewUrl, 'preview');
    applyFetchedMetadata(db, id, {
      title: meta.title,
      description: meta.description,
      faviconPath,
      faviconUrl: meta.faviconUrl,
      previewPath,
      previewUrl: meta.previewUrl,
      status: 'complete',
    });
  } catch {
    setMetadataStatus(db, id, 'failed');
  }
}
