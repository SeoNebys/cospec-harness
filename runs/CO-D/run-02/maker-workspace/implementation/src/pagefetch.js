'use strict';
// Page metadata, in-app snapshot copies, and Internet Archive submission
// (SCN-001 auto-collect; SCN-018 copies). All network calls degrade gracefully:
// if the network is unavailable the caller still gets a usable result and the
// copy is marked failed so the client can retry.
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');
const { SNAP_DIR } = require('./store');
const { isPdf, guessTitle, hostOf } = require('./urlutil');

const UA = 'CalmBookmarks/1.0 (+bookmarks app)';

async function timedFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    return await fetch(url, Object.assign({ signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA } }, opts || {}));
  } finally { clearTimeout(t); }
}

function absolute(base, ref) {
  try { return new URL(ref, base).href; } catch (e) { return null; }
}

// Best-effort metadata. Never throws; falls back to URL-derived values.
async function fetchMetadata(rawUrl) {
  const u = new URL(rawUrl);
  const fallback = { title: guessTitle(u), description: '', previewImage: '', favicon: '', ok: false };
  if (isPdf(rawUrl)) { fallback.title = guessTitle(u); return fallback; }
  try {
    const res = await timedFetch(rawUrl, {}, 8000);
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok || !/text\/html/i.test(ctype)) return fallback;
    const html = await res.text();
    const doc = parse(html);
    const pick = sel => { const n = doc.querySelector(sel); return n ? (n.getAttribute('content') || '').trim() : ''; };
    const title = (doc.querySelector('title') && doc.querySelector('title').text.trim()) ||
      pick('meta[property="og:title"]') || guessTitle(u);
    const description = pick('meta[name="description"]') || pick('meta[property="og:description"]');
    let image = pick('meta[property="og:image"]') || pick('meta[name="twitter:image"]');
    if (image) image = absolute(rawUrl, image) || '';
    let favicon = '';
    const iconLink = doc.querySelector('link[rel~="icon"]') || doc.querySelector('link[rel="shortcut icon"]');
    if (iconLink && iconLink.getAttribute('href')) favicon = absolute(rawUrl, iconLink.getAttribute('href')) || '';
    if (!favicon) favicon = u.origin + '/favicon.ico';
    return { title: title || guessTitle(u), description, previewImage: image || '', favicon, ok: true };
  } catch (e) {
    return fallback;
  }
}

// Store an in-app copy: the PDF for PDFs, otherwise a self-contained-ish HTML
// snapshot (with a <base> so relative links still resolve). Returns copy meta.
async function makeSnapshot(rawUrl, id) {
  const u = new URL(rawUrl);
  try {
    const res = await timedFetch(rawUrl, {}, 12000);
    if (!res.ok) return { status: 'failed', when: Date.now() };
    const ctype = res.headers.get('content-type') || '';
    const wantPdf = isPdf(rawUrl) || /application\/pdf/i.test(ctype);
    if (wantPdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = 'snap-' + id + '.pdf';
      fs.writeFileSync(path.join(SNAP_DIR, file), buf);
      return { status: 'ok', kind: 'pdf', file, when: Date.now() };
    }
    let html = await res.text();
    if (!/<base\s/i.test(html)) {
      const baseTag = '<base href="' + u.href.replace(/"/g, '&quot;') + '">';
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + baseTag) : baseTag + html;
    }
    const banner = '<div style="position:sticky;top:0;background:#4a6b57;color:#fff;padding:8px 14px;font:13px sans-serif;z-index:99999">' +
      'Saved copy from ' + hostOf(u) + ' — kept in your bookmarks</div>';
    html = html.replace(/<body[^>]*>/i, m => m + banner);
    const file = 'snap-' + id + '.html';
    fs.writeFileSync(path.join(SNAP_DIR, file), html);
    return { status: 'ok', kind: 'page', file, when: Date.now() };
  } catch (e) {
    return { status: 'failed', when: Date.now() };
  }
}

// Manual Internet Archive submission. Returns { ok, url } or { ok:false }.
async function submitInternetArchive(rawUrl) {
  try {
    const res = await timedFetch('https://web.archive.org/save/' + rawUrl, { method: 'GET' }, 20000);
    // The Save Page Now endpoint redirects to the archived snapshot URL.
    const archived = res.url && /web\.archive\.org\/web\//.test(res.url)
      ? res.url
      : 'https://web.archive.org/web/' + tstamp() + '/' + rawUrl;
    if (!res.ok && !/web\.archive\.org\/web\//.test(res.url || '')) return { ok: false };
    return { ok: true, url: archived, when: Date.now() };
  } catch (e) {
    return { ok: false };
  }
}

function tstamp() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
}

module.exports = { fetchMetadata, makeSnapshot, submitInternetArchive };
