'use strict';
// Fetch page details to auto-fill a bookmark (SCN-001). On any failure the caller
// keeps the bookmark and marks fetch_failed (SCN-010) — this never throws fatally
// for the save flow; it returns { ok:false } instead.
const { withScheme, isPdfUrl } = require('./urls');

const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 8000);
const UA = 'Mozilla/5.0 (compatible; BookmarksApp/1.0; +personal)';

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return '';
}

function absolute(base, ref) {
  try { return new URL(ref, base).href; } catch (e) { return null; }
}

async function fetchMetadata(rawUrl) {
  const url = withScheme(rawUrl);
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./i, ''); } catch (e) { host = rawUrl; }
  const faviconFallback = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const isPdf = ctype.includes('application/pdf') || isPdfUrl(url);
    if (isPdf) {
      return { ok: true, host, isPdf: true, title: decodeURIComponent(url.split('/').pop() || host) || host,
        description: '', image: null, favicon: faviconFallback, contentType: ctype };
    }
    if (!res.ok) return { ok: false, host, isPdf: false, favicon: faviconFallback };
    const buf = await res.arrayBuffer();
    const html = Buffer.from(buf).toString('utf8').slice(0, 500000);
    const ogTitle = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]);
    const titleTag = metaContent(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
    const description = metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ]);
    const ogImage = metaContent(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);
    let iconHref = metaContent(html, [
      /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i,
    ]);
    // Ignore empty/placeholder data: icons — fall back to the favicon service.
    if (iconHref && /^data:/i.test(iconHref) && iconHref.length < 32) iconHref = '';
    const finalUrl = res.url || url;
    return {
      ok: true, host, isPdf: false,
      title: ogTitle || titleTag || host,
      description: description || '',
      image: ogImage ? absolute(finalUrl, ogImage) : null,
      favicon: iconHref ? (absolute(finalUrl, iconHref) || faviconFallback) : faviconFallback,
      contentType: ctype,
    };
  } catch (e) {
    return { ok: false, host, isPdf: isPdfUrl(url), favicon: faviconFallback, error: String(e && e.message || e) };
  }
}

module.exports = { fetchMetadata };
