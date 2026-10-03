/*
 * Full-page copy preservation (SCN-019).
 * Saves a self-contained file that keeps layout and images:
 *  - HTML pages: inline stylesheets and images as data URIs into one .html file.
 *  - PDFs: store the original PDF bytes unchanged (.pdf).
 * On failure returns { ok:false } so the caller can report it and leave the
 * bookmark intact (retryable).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('./store');

const TIMEOUT = 10000;
const RES_TIMEOUT = 6000;
const MAX_RES = 40;
const MAX_RES_BYTES = 3 * 1024 * 1024;

async function fetchBuf(url) {
  const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(RES_TIMEOUT), headers: { 'user-agent': 'BookmarksApp/1.0' } });
  if (!resp.ok) throw new Error('http-' + resp.status);
  const ct = resp.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await resp.arrayBuffer());
  return { ct, buf };
}
function toDataUri(ct, buf) { return 'data:' + ct.split(';')[0] + ';base64,' + buf.toString('base64'); }

async function inlineResources(html, baseUrl) {
  // stylesheets -> <style>
  const linkRe = /<link\b[^>]*rel=["\']stylesheet["\'][^>]*>/gi;
  const links = html.match(linkRe) || [];
  for (const tag of links) {
    const href = (tag.match(/href=["\']([^"\']+)["\']/i) || [])[1];
    if (!href) continue;
    try {
      const u = new URL(href, baseUrl).href;
      const { buf } = await fetchBuf(u);
      html = html.replace(tag, '<style>\n' + buf.toString('utf8') + '\n</style>');
    } catch (e) { /* leave link as-is */ }
  }
  // images -> data URIs (bounded)
  const imgRe = /<img\b[^>]*>/gi;
  const imgs = html.match(imgRe) || [];
  let count = 0;
  for (const tag of imgs) {
    if (count >= MAX_RES) break;
    const src = (tag.match(/\bsrc=["\']([^"\']+)["\']/i) || [])[1];
    if (!src || src.startsWith('data:')) continue;
    try {
      const u = new URL(src, baseUrl).href;
      const { ct, buf } = await fetchBuf(u);
      if (buf.length > MAX_RES_BYTES) continue;
      const replaced = tag.replace(/\bsrc=["\'][^"\']+["\']/i, 'src="' + toDataUri(ct, buf) + '"');
      html = html.replace(tag, replaced);
      count++;
    } catch (e) { /* skip */ }
  }
  return html;
}

// Returns { ok, kind:'page'|'pdf', file, savedAt } or { ok:false, reason }
async function captureSnapshot(id, url) {
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), headers: { 'user-agent': 'BookmarksApp/1.0' } });
    if (!resp.ok) return { ok: false, reason: 'http-' + resp.status };
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const finalUrl = resp.url || url;
    const ts = Date.now();
    if (ct.includes('application/pdf') || /\.pdf($|\?)/i.test(finalUrl)) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const file = id + '-' + ts + '.pdf';
      fs.writeFileSync(path.join(store.SNAP_DIR, file), buf);
      return { ok: true, kind: 'pdf', file, savedAt: ts };
    }
    let html = await resp.text();
    html = await inlineResources(html, finalUrl);
    // record provenance without altering visible content materially
    html = html.replace(/<head([^>]*)>/i, '<head$1><!-- Preserved copy of ' + finalUrl.replace(/--/g, '- -') + ' -->');
    const file = id + '-' + ts + '.html';
    fs.writeFileSync(path.join(store.SNAP_DIR, file), html);
    return { ok: true, kind: 'page', file, savedAt: ts };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'timeout' : (e.message || 'failed') };
  }
}

module.exports = { captureSnapshot };
