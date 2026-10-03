// T011: Fetch a page and extract title/description/icon/preview (FR-002, FR-006).
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = Number(process.env.BM_FETCH_TIMEOUT_MS) || 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap

/**
 * Best-effort page metadata. Never throws: on any failure returns an empty
 * result so the caller can fall back to an address-derived title (FR-006).
 * @returns {Promise<{title:string, description:string, icon_url:string, preview_image:string}>}
 */
export async function fetchMetadata(url, { fetchImpl = fetch } = {}) {
  const empty = { title: '', description: '', icon_url: '', preview_image: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
    if (!res.ok) return empty;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) return empty;

    const html = await readCapped(res, MAX_BYTES);
    return parseMetadata(html, url);
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res, maxBytes) {
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
    reader.cancel();
  } catch {
    /* ignore */
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

/** Parse metadata from an HTML string. Exported for unit testing (T015). */
export function parseMetadata(html, baseUrl) {
  const result = { title: '', description: '', icon_url: '', preview_image: '' };
  let $;
  try {
    $ = cheerio.load(html);
  } catch {
    return result;
  }
  const meta = (sel, attr = 'content') => {
    const v = $(sel).attr(attr);
    return v ? v.trim() : '';
  };

  result.title =
    meta('meta[property="og:title"]') ||
    ($('title').first().text() || '').trim() ||
    meta('meta[name="twitter:title"]');

  result.description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="description"]') ||
    meta('meta[name="twitter:description"]');

  const image =
    meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
  result.preview_image = absolutize(image, baseUrl);

  let icon =
    $('link[rel~="icon"]').first().attr('href') ||
    $('link[rel="shortcut icon"]').first().attr('href') ||
    '/favicon.ico';
  result.icon_url = absolutize(icon, baseUrl);

  return result;
}

function absolutize(ref, baseUrl) {
  if (!ref) return '';
  try {
    return new URL(ref, baseUrl).toString();
  } catch {
    return '';
  }
}
