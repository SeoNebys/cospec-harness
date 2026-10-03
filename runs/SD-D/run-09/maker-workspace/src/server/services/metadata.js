import * as cheerio from 'cheerio';
import { titleFromUrl } from './urlNormalize.js';

const FETCH_TIMEOUT_MS = Number(process.env.METADATA_TIMEOUT_MS || 8000);

// Fetch the target with a bounded timeout and parse title/description/favicon/
// preview. On any failure or timeout, return fallback details (FR-007).
// Returns { title, description, faviconPath, previewImagePath, metadataStatus }.
export async function collectMetadata(url, { fetchImpl = globalThis.fetch } = {}) {
  const fallback = {
    title: titleFromUrl(url),
    description: '',
    faviconPath: null,
    previewImagePath: null,
    metadataStatus: 'fallback',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    if (!res || !res.ok) return fallback;
    const contentType = res.headers.get?.('content-type') || '';
    if (contentType && !contentType.includes('html')) {
      // Non-HTML (e.g. PDF): keep a sensible title, no meta to parse.
      return { ...fallback, metadataStatus: 'collected' };
    }
    const html = await res.text();
    return parseMetadata(html, url);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export function parseMetadata(html, url) {
  const $ = cheerio.load(html);
  const pick = (sel, attr) => {
    const el = $(sel).first();
    if (!el || el.length === 0) return '';
    return (attr ? el.attr(attr) : el.text()) || '';
  };

  const title =
    pick('meta[property="og:title"]', 'content').trim() ||
    pick('title').trim() ||
    titleFromUrl(url);

  const description =
    pick('meta[property="og:description"]', 'content').trim() ||
    pick('meta[name="description"]', 'content').trim() ||
    '';

  const ogImage = pick('meta[property="og:image"]', 'content').trim();
  const previewImagePath = ogImage ? absoluteUrl(ogImage, url) : null;

  let favicon =
    pick('link[rel="icon"]', 'href').trim() ||
    pick('link[rel="shortcut icon"]', 'href').trim() ||
    pick('link[rel="apple-touch-icon"]', 'href').trim();
  const faviconPath = favicon ? absoluteUrl(favicon, url) : defaultFavicon(url);

  return {
    title,
    description,
    faviconPath,
    previewImagePath,
    metadataStatus: 'collected',
  };
}

function absoluteUrl(maybeRelative, base) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function defaultFavicon(base) {
  try {
    const u = new URL(base);
    return `${u.origin}/favicon.ico`;
  } catch {
    return null;
  }
}
