import * as cheerio from 'cheerio';

// Fetch + parse page metadata (research §4/§5).

const TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024; // cap downloaded HTML
const USER_AGENT =
  'Mozilla/5.0 (compatible; BookmarkManager/1.0; +https://example.local/bot)';

/**
 * Derive a human-ish default title from a URL (used before enrichment and on
 * failure — FR-004b). E.g. https://example.com/foo/bar → "example.com/foo/bar".
 */
export function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return `${u.hostname}${path}`;
  } catch {
    return url;
  }
}

/**
 * Fetch the target page and extract { title, description, faviconUrl,
 * previewImageUrl }. Throws on timeout, non-2xx, or non-HTML content so the
 * caller can mark enrichment failed.
 */
export async function fetchMetadata(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  const html = await readCapped(res, MAX_BYTES);
  const finalUrl = res.url || url;
  return parseMetadata(html, finalUrl);
}

async function readCapped(res, maxBytes) {
  // Prefer streaming so we can stop early; fall back to text() if unavailable.
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    return text.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parse metadata from raw HTML with a known page URL for resolving relative
 * links. Exported for offline unit tests.
 */
export function parseMetadata(html, pageUrl) {
  const $ = cheerio.load(html);

  const meta = (selector, attr = 'content') => {
    const el = $(selector).first();
    const val = el.attr(attr);
    return val ? val.trim() : '';
  };

  // Title: og:title -> <title> -> URL-derived.
  const title =
    meta('meta[property="og:title"]') ||
    $('title').first().text().trim() ||
    titleFromUrl(pageUrl);

  // Description: og:description -> meta description -> empty.
  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="description"]') ||
    '';

  // Preview image: og:image -> twitter:image.
  const rawImage =
    meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
  const previewImageUrl = rawImage ? resolveUrl(rawImage, pageUrl) : null;

  // Favicon: <link rel=icon|shortcut icon> -> /favicon.ico.
  const iconHref =
    $('link[rel="icon"]').first().attr('href') ||
    $('link[rel="shortcut icon"]').first().attr('href') ||
    $('link[rel="apple-touch-icon"]').first().attr('href');
  let faviconUrl = null;
  if (iconHref) {
    faviconUrl = resolveUrl(iconHref, pageUrl);
  } else {
    try {
      faviconUrl = new URL('/favicon.ico', pageUrl).href;
    } catch {
      faviconUrl = null;
    }
  }

  return { title, description, faviconUrl, previewImageUrl };
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}
