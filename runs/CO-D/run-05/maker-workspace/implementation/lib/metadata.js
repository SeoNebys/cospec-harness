/*
 * Genuine page-metadata fetching (SCN-001, SCN-015).
 * Fetches a URL and extracts title, description, preview image (og:image) and
 * favicon. Detects PDFs. On failure returns { ok:false } so the caller can fall
 * back to manual entry (SCN-002) without being blocked.
 */
const cheerio = require('cheerio');

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}
function isPdfUrl(url) { return /\.pdf($|\?|#)/i.test(url); }

function abs(base, ref) {
  if (!ref) return null;
  try { return new URL(ref, base).href; } catch (e) { return null; }
}

async function fetchMetadata(url, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const site = hostOf(url);
  const letter = (site[0] || '?').toUpperCase();
  const faviconGuess = site ? abs(url, '/favicon.ico') : null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'BookmarksApp/1.0' } });
    const type = (res.headers.get('content-type') || '').toLowerCase();

    if (isPdfUrl(url) || type.includes('application/pdf')) {
      let name = 'Document';
      try { name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'Document'); } catch (e) {}
      return { ok: true, site, letter, title: name || 'PDF document', desc: '', image: null, favicon: faviconGuess, isPdf: true };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const pick = (sel, attr) => { const el = $(sel).first(); return el.length ? (el.attr(attr) || '').trim() : ''; };

    const title = pick('meta[property="og:title"]', 'content')
      || pick('meta[name="twitter:title"]', 'content')
      || ($('title').first().text() || '').trim()
      || site;
    const desc = pick('meta[property="og:description"]', 'content')
      || pick('meta[name="twitter:description"]', 'content')
      || pick('meta[name="description"]', 'content')
      || '';
    const image = abs(url, pick('meta[property="og:image"]', 'content')
      || pick('meta[name="twitter:image"]', 'content')) || null;

    // favicon: prefer declared <link rel="icon">, else /favicon.ico
    let iconHref = '';
    $('link[rel]').each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase();
      if (!iconHref && /\bicon\b/.test(rel)) iconHref = $(el).attr('href') || '';
    });
    const favicon = abs(url, iconHref) || faviconGuess;

    return { ok: true, site, letter, title, desc, image, favicon, isPdf: false };
  } catch (e) {
    return { ok: false, site, letter, favicon: faviconGuess, isPdf: isPdfUrl(url), reason: e.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchMetadata, hostOf, isPdfUrl };
