'use strict';
// Network-facing helpers. Every call is time-limited and never throws to the
// caller; failures return a status so saving is never blocked (SCN-007/013/017).
const path = require('node:path');
const fs = require('node:fs');
const { coerceUrl, siteOf, looksLikePdf } = require('./normalize');
const { snapshot } = require('./snapshot');

async function withTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function titleFromUrl(url) {
  const u = coerceUrl(url);
  if (!u) return url;
  const seg = u.pathname.split('/').filter(Boolean).pop();
  if (!seg) return siteOf(url);
  return seg.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extract(html, base) {
  const pick = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  let image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)
    || pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i);
  const decode = (s) => s ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : s;
  const abs = (u) => { try { return new URL(u, base).toString(); } catch { return null; } };
  let favicon = pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']*)["']/i);
  return {
    title: decode(title),
    description: decode(desc),
    preview_image: image ? abs(image) : null,
    favicon: favicon ? abs(favicon) : (base ? abs('/favicon.ico') : null)
  };
}

// Returns { ok, isPdf, title, description, preview_image, favicon, site }
async function fetchMetadata(url) {
  const site = siteOf(url);
  const fallback = { ok: false, isPdf: looksLikePdf(url), title: titleFromUrl(url), description: '', preview_image: null, favicon: null, site };
  try {
    const res = await withTimeout(url, { headers: { 'User-Agent': 'BookmarksApp/1.0' } });
    if (!res.ok) return fallback;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('application/pdf') || looksLikePdf(url)) {
      return { ok: true, isPdf: true, title: titleFromUrl(url), description: '', preview_image: null, favicon: null, site };
    }
    const html = await res.text();
    const meta = extract(html, res.url || url);
    return {
      ok: true, isPdf: false, site,
      title: meta.title || titleFromUrl(url),
      description: meta.description || '',
      preview_image: meta.preview_image || null,
      favicon: meta.favicon || null
    };
  } catch {
    return fallback;
  }
}

// Capture a preserved local copy. Normal page -> self-contained-ish .html with a
// <base> so it renders as saved; PDF -> the original .pdf bytes (SCN-013).
async function captureCopy(url, id, dir) {
  try {
    const res = await withTimeout(url, { headers: { 'User-Agent': 'BookmarksApp/1.0' } }, 15000);
    if (!res.ok) return { status: 'failed' };
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const isPdf = ctype.includes('application/pdf') || looksLikePdf(url);
    if (isPdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(dir, `${id}.pdf`);
      fs.writeFileSync(file, buf);
      return { status: 'saved', kind: 'pdf', path: file, size: buf.length, saved_at: Date.now() };
    }
    const html = await res.text();
    const baseHref = res.url || url;
    // Build a genuinely self-contained copy: inline CSS, images and fonts so the
    // saved page renders as it was even if the origin later disappears (SCN-013).
    let inlined;
    try {
      inlined = await snapshot(html, baseHref);
    } catch {
      inlined = html; // extremely defensive; still better than failing the copy
    }
    const banner = `<!-- Preserved self-contained copy saved by Bookmarks on ${new Date().toISOString()} from ${baseHref} -->\n`;
    const out = banner + inlined;
    const file = path.join(dir, `${id}.html`);
    fs.writeFileSync(file, out);
    return { status: 'saved', kind: 'page', path: file, size: Buffer.byteLength(out), saved_at: Date.now() };
  } catch {
    return { status: 'failed' };
  }
}

// Submit to the Internet Archive (opt-in). Returns { status, url } (SCN-013).
async function submitInternetArchive(url) {
  try {
    const res = await withTimeout('https://web.archive.org/save/' + url, { method: 'GET', headers: { 'User-Agent': 'BookmarksApp/1.0' } }, 20000);
    if (!res.ok && res.status !== 302) return { status: 'failed' };
    const loc = res.headers.get('content-location') || res.headers.get('location');
    const archiveUrl = loc
      ? (loc.startsWith('http') ? loc : 'https://web.archive.org' + loc)
      : 'https://web.archive.org/web/*/' + url;
    return { status: 'saved', url: archiveUrl, saved_at: Date.now() };
  } catch {
    return { status: 'failed' };
  }
}

module.exports = { fetchMetadata, captureCopy, submitInternetArchive, titleFromUrl };
