'use strict';

// Auto-fill of a link's basic details (SCN-001). If the details cannot be
// fetched, the caller still allows saving with a manually typed title (SCN-009);
// this module simply reports what it could (or could not) find.

const { isValidUrl } = require('./url');

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractTitle(html) {
  let m = html.match(/<meta[^>]+property=["']og:title["'][^>]*>/i);
  if (m) {
    const c = m[0].match(/content=["']([^"']*)["']/i);
    if (c && c[1].trim()) return decodeEntities(c[1]);
  }
  m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1].trim()) return decodeEntities(m[1].replace(/\s+/g, ' '));
  return '';
}

function extractDescription(html) {
  for (const re of [
    /<meta[^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]*>/i,
  ]) {
    const m = html.match(re);
    if (m) {
      const c = m[0].match(/content=["']([^"']*)["']/i);
      if (c && c[1].trim()) return decodeEntities(c[1]);
    }
  }
  return '';
}

/**
 * Fetch a URL and extract {title, description}. Throws on any failure
 * (invalid URL, network error, timeout, non-OK status, non-HTML).
 */
async function fetchMetadata(rawUrl, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  if (!isValidUrl(rawUrl)) throw new Error('invalid url');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarksApp/1.0 (+metadata fetch)' },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const ct = res.headers.get('content-type') || '';
  if (ct && !/text\/html|application\/xhtml/i.test(ct)) {
    throw new Error('not html');
  }
  const html = (await res.text()).slice(0, 500000);
  return { title: extractTitle(html), description: extractDescription(html) };
}

module.exports = { fetchMetadata, extractTitle, extractDescription, decodeEntities };
