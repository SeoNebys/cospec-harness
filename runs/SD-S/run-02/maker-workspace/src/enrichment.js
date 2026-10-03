import { parse } from 'node-html-parser';

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap

/**
 * Best-effort enrichment: fetch the page and extract title, description,
 * favicon, and preview image (research.md Decision 3). Never throws — returns
 * whatever could be extracted plus an `ok` flag. Callers treat this as
 * non-blocking (FR-007, FR-008).
 *
 * @param {string} url
 * @param {object} [deps] - injectable fetch for testing
 * @returns {Promise<{ok: boolean, title?: string, description?: string, faviconUrl?: string, previewUrl?: string}>}
 */
export async function fetchMetadata(url, deps = {}) {
  const doFetch = deps.fetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    if (!res.ok) return { ok: false };
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return { ok: false };
    const html = await readCapped(res);
    return { ok: true, ...parseMetadata(html, url) };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res) {
  // Read the body but stop once we exceed the byte cap.
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
    if (total >= MAX_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

/**
 * Parse metadata out of an HTML string. Exported for unit tests against
 * fixtures. Resolves favicon/preview to absolute URLs against `baseUrl`.
 */
export function parseMetadata(html, baseUrl) {
  const root = parse(html);
  const result = {};

  const title =
    metaContent(root, 'property', 'og:title') ||
    textOf(root, 'title');
  if (title) result.title = title.trim();

  const description =
    metaContent(root, 'property', 'og:description') ||
    metaContent(root, 'name', 'description');
  if (description) result.description = description.trim();

  const image = metaContent(root, 'property', 'og:image');
  if (image) result.previewUrl = absolutize(image.trim(), baseUrl);

  const favicon = findFavicon(root);
  result.faviconUrl = absolutize(favicon || '/favicon.ico', baseUrl);

  return result;
}

function metaContent(root, attr, value) {
  const el = root.querySelector(`meta[${attr}="${value}"]`);
  return el ? el.getAttribute('content') || null : null;
}

function textOf(root, selector) {
  const el = root.querySelector(selector);
  return el ? el.text : null;
}

function findFavicon(root) {
  const links = root.querySelectorAll('link');
  for (const link of links) {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    if (rel.split(/\s+/).includes('icon')) {
      const href = link.getAttribute('href');
      if (href) return href.trim();
    }
  }
  return null;
}

function absolutize(maybeRelative, baseUrl) {
  try {
    return new URL(maybeRelative, baseUrl).href;
  } catch {
    return null;
  }
}
