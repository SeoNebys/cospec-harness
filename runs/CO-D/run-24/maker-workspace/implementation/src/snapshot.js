'use strict';
// Preserved-copy capture (SCN-014). Fetches and stores a copy of the page so it
// can be revisited even if the original changes/disappears. For a PDF link the
// actual PDF file is stored. Throws on failure so the caller records a retryable
// failed state; the bookmark itself is never at risk.
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('./db');
const { withScheme, isPdfUrl } = require('./urls');

const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
const TIMEOUT_MS = Number(process.env.SNAPSHOT_TIMEOUT_MS || 15000);
const UA = 'Mozilla/5.0 (compatible; BookmarksApp/1.0; +personal)';

function bannerHtml(url, at) {
  return `<div style="all:initial;display:block;font-family:sans-serif;background:#eaf7ee;` +
    `border-bottom:1px solid #b6e3c4;color:#1c7a3e;padding:8px 14px;font-size:13px;">` +
    `Preserved copy captured on ${new Date(at).toLocaleString()} — original: ` +
    `<a href="${url.replace(/"/g, '&quot;')}" style="color:#1c7a3e;">${url.replace(/</g, '&lt;')}</a></div>`;
}

async function captureSnapshot(bookmark) {
  const url = withScheme(bookmark.url);
  const at = Date.now();
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const isPdf = ctype.includes('application/pdf') || isPdfUrl(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(SNAP_DIR, { recursive: true });

  if (isPdf) {
    const file = `bm-${bookmark.id}.pdf`;
    fs.writeFileSync(path.join(SNAP_DIR, file), buf);
    return { file, isPdf: true, savedAt: at };
  }
  // Store the HTML with a <base> so relative assets resolve to the origin, plus a
  // capture banner. This is a lightweight single-file capture of the page markup.
  let html = buf.toString('utf8');
  const baseTag = `<base href="${url.replace(/"/g, '&quot;')}">`;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + baseTag);
  else html = baseTag + html;
  if (/<body[^>]*>/i.test(html)) html = html.replace(/<body[^>]*>/i, (m) => m + bannerHtml(url, at));
  else html = bannerHtml(url, at) + html;
  const file = `bm-${bookmark.id}.html`;
  fs.writeFileSync(path.join(SNAP_DIR, file), html, 'utf8');
  return { file, isPdf: false, savedAt: at };
}

function snapshotPath(file) {
  const p = path.join(SNAP_DIR, path.basename(file));
  return p;
}

module.exports = { captureSnapshot, snapshotPath, SNAP_DIR };
