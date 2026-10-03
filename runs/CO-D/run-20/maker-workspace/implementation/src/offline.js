// Offline copy capture (SCN-016). A normal page is kept as a single self-contained
// HTML file; a PDF link keeps the PDF itself. One copy per bookmark. On a fetch
// failure the capture reports an error (the caller surfaces it); nothing fake is
// stored.

import fs from 'fs';
import path from 'path';
import { isPdf, normalizeUrl } from './urls.js';

export async function capture(bookmark, offlineDir, { timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  const url = normalizeUrl(bookmark.url);
  const pdf = isPdf(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('Could not fetch the page (HTTP ' + res.status + ').');

  if (pdf) {
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(offlineDir, bookmark.id + '.pdf');
    fs.writeFileSync(file, buf);
    return { type: 'pdf', file: path.basename(file), contentType: 'application/pdf', at: Date.now() };
  }
  // Single-file page snapshot: the fetched HTML with a header noting capture time
  // and original address (a self-contained record of the page).
  const html = await res.text();
  const stamp = `<!-- Offline copy saved ${new Date().toISOString()} from ${url} -->\n`;
  const file = path.join(offlineDir, bookmark.id + '.html');
  fs.writeFileSync(file, stamp + html);
  return { type: 'page', file: path.basename(file), contentType: 'text/html; charset=utf-8', at: Date.now() };
}

export function removeCapture(bookmark, offlineDir) {
  if (bookmark.offline && bookmark.offline.file) {
    try { fs.unlinkSync(path.join(offlineDir, bookmark.offline.file)); } catch { /* already gone */ }
  }
}
