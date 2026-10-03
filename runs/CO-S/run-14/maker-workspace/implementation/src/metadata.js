/*
 * Automatic detail gathering (SCN-001, SCN-010).
 * Fetches a URL and extracts title, description, preview image, site name and
 * a site icon. Detects PDFs. On any failure returns { ok:false } so the caller
 * can still save the bookmark and let the user fill details in (SCN-010).
 */
'use strict';

const FETCH_TIMEOUT = 8000;
const MAX_HTML = 1.5 * 1024 * 1024; // cap parsed HTML

function normalizeUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  const withProto = /:\/\//.test(s) ? s : 'https://' + s;
  try {
    const u = new URL(withProto);
    if (!u.hostname || u.hostname.indexOf('.') === -1) return null; // not a real link
    return u;
  } catch (e) { return null; }
}

function abs(base, ref) {
  try { return new URL(ref, base).href; } catch (e) { return null; }
}

function pick(html, res) {
  const meta = (prop) => {
    const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*>', 'i');
    const tag = html.match(re);
    if (!tag) return null;
    const c = tag[0].match(/content=["\']([\s\S]*?)["\']/i);
    return c ? decode(c[1].trim()) : null;
  };
  res.title = meta('og:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ? decode(RegExp.$1.trim()) : null);
  res.description = meta('og:description') || meta('description') || null;
  res.site = meta('og:site_name') || res.site;
  const img = meta('og:image') || meta('twitter:image');
  if (img) res.image = abs(res.url, img);
  // icon
  const iconTag = html.match(/<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]*>/i);
  if (iconTag) {
    const href = iconTag[0].match(/href=["\']([\s\S]*?)["\']/i);
    if (href) res.icon = abs(res.url, href[1].trim());
  }
}

function decode(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'");
}

async function fetchMetadata(rawUrl) {
  const u = normalizeUrl(rawUrl);
  if (!u) return { ok: false, reason: 'invalid-url' };
  const res = { ok: true, url: u.href, site: u.hostname.replace(/^www\./, ''), title: null, description: null, image: null, icon: u.origin + '/favicon.ico', isPdf: false };
  try {
    const resp = await fetch(u.href, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT), headers: { 'user-agent': 'BookmarksApp/1.0' } });
    if (!resp.ok) return { ok: false, reason: 'http-' + resp.status };
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    res.url = resp.url || u.href;
    if (ct.includes('application/pdf') || /\.pdf($|\?)/i.test(res.url)) {
      res.isPdf = true;
      const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
      res.title = seg || u.hostname;
      return res;
    }
    if (!ct.includes('html') && ct) {
      // non-HTML, non-PDF: keep a minimal record
      res.title = res.title || u.href;
      return res;
    }
    let html = '';
    const reader = resp.body && resp.body.getReader ? resp.body.getReader() : null;
    if (reader) {
      const dec = new TextDecoder();
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        html += dec.decode(value, { stream: true });
        if (size > MAX_HTML) { try { reader.cancel(); } catch (e) {} break; }
      }
    } else {
      html = await resp.text();
    }
    pick(html, res);
    if (!res.title) res.title = u.href;
    return res;
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'timeout' : (e.message || 'fetch-failed') };
  }
}

module.exports = { fetchMetadata, normalizeUrl };
