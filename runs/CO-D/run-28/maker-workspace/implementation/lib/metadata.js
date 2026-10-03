/*
 * External page-detail collection and preservation (SCN-009, SCN-018, SCN-021).
 * All network work degrades honestly: on failure the caller keeps a safe fallback
 * and the failure reason is surfaced — never masked as success.
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');
const { normalizeUrl } = require('./normalize');

const FETCH_TIMEOUT = 8000;

function isPdf(url) { return /\.pdf(\?|#|$)/i.test(url); }

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || FETCH_TIMEOUT);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'BookmarksApp/1.0' } });
  } finally { clearTimeout(t); }
}

// Collect title/description/favicon/preview. Returns {ok, title, description, favicon, preview} or {ok:false, reason}.
async function collectMetadata(rawUrl) {
  const u = normalizeUrl(rawUrl);
  if (!u) return { ok: false, reason: 'invalid address' };
  const host = u.hostname.replace(/^www\./, '');
  const faviconGuess = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  if (isPdf(u.href)) {
    return { ok: true, title: decodeURIComponent((u.pathname.split('/').pop() || host)), description: '', favicon: faviconGuess, preview: null };
  }
  try {
    const res = await fetchWithTimeout(u.href);
    if (!res.ok) return { ok: false, reason: `the page returned ${res.status}` };
    const html = await res.text();
    const doc = parse(html);
    const pick = (sel, attr) => { const el = doc.querySelector(sel); return el ? (el.getAttribute(attr) || '').trim() : ''; };
    const title = (pick('meta[property="og:title"]', 'content') || (doc.querySelector('title') ? doc.querySelector('title').text.trim() : '') || host);
    const description = pick('meta[property="og:description"]', 'content') || pick('meta[name="description"]', 'content') || '';
    let preview = pick('meta[property="og:image"]', 'content') || pick('meta[name="twitter:image"]', 'content') || null;
    if (preview) { try { preview = new URL(preview, u.href).href; } catch (e) { preview = null; } }
    let favicon = pick('link[rel~="icon"]', 'href');
    favicon = favicon ? (() => { try { return new URL(favicon, u.href).href; } catch (e) { return faviconGuess; } })() : faviconGuess;
    return { ok: true, title, description, favicon, preview };
  } catch (e) {
    return { ok: false, reason: reasonFor(e, u.href), fallback: { title: host, favicon: faviconGuess } };
  }
}

function reasonFor(e, url) {
  if (/login|signin|account/i.test(url)) return 'the page requires signing in';
  if (e && e.name === 'AbortError') return 'the page took too long to respond';
  return "the page couldn't be reached";
}

// Save a local copy: PDF bytes for PDFs, otherwise the page HTML. Returns
// {ok, kind, at, file} or {ok:false, reason}. Bookmark is untouched by caller on failure.
async function saveSnapshot(rawUrl, dir, id) {
  const u = normalizeUrl(rawUrl);
  if (!u) return { ok: false, reason: 'invalid address' };
  const pdf = isPdf(u.href);
  try {
    const res = await fetchWithTimeout(u.href);
    if (!res.ok) return { ok: false, reason: `the page returned ${res.status}` };
    fs.mkdirSync(dir, { recursive: true });
    if (pdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(dir, `${id}.pdf`);
      fs.writeFileSync(file, buf);
      return { ok: true, kind: 'pdf', at: Date.now(), file: path.basename(file) };
    }
    const html = await res.text();
    const file = path.join(dir, `${id}.html`);
    // best-effort self-contained: annotate with a base href so relative assets resolve
    const banner = `<!-- Local copy captured ${new Date().toISOString()} from ${u.href} -->\n<base href="${u.href}">\n`;
    fs.writeFileSync(file, banner + html);
    return { ok: true, kind: 'page', at: Date.now(), file: path.basename(file) };
  } catch (e) {
    return { ok: false, reason: reasonFor(e, u.href) };
  }
}

// Create an Internet Archive (Wayback) snapshot. Public — caller must have the
// user's explicit confirmation before calling this (SCN-018).
async function createArchive(rawUrl) {
  const u = normalizeUrl(rawUrl);
  if (!u) return { ok: false, reason: 'invalid address' };
  try {
    const res = await fetchWithTimeout('https://web.archive.org/save/' + u.href, { timeout: 20000 });
    // Wayback returns the archived location; fall back to the wayback query URL.
    const loc = res.headers.get('content-location') || res.headers.get('location');
    const archiveUrl = loc ? ('https://web.archive.org' + loc) : ('https://web.archive.org/web/*/' + u.href);
    if (!res.ok && !loc) return { ok: false, reason: `archive.org returned ${res.status}` };
    return { ok: true, archiveUrl };
  } catch (e) {
    return { ok: false, reason: "archive.org couldn't be reached" };
  }
}

module.exports = { collectMetadata, saveSnapshot, createArchive, isPdf };
