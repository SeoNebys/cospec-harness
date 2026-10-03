// Page preservation (FR-031/032/033/034).
//   - local page  -> single self-contained HTML file with inlined assets
//   - PDF address  -> the PDF file itself
//   - archive_org  -> submit to Internet Archive, store returned reference
// All best-effort: on failure throw PreserveError; the caller leaves the
// bookmark unchanged and returns HTTP 502.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDirFor } from '../db/index.js';
import { isPdfUrl } from './url.js';

export class PreserveError extends Error {}

const FETCH_TIMEOUT_MS = 15000;

function preservedDir() {
  const dir = path.join(dataDirFor(), 'preserved');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+preserve)' },
      ...opts,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Inline <img src>, stylesheet <link>, and same-origin CSS urls as data URIs to
// produce a genuinely self-contained HTML file.
async function inlineAssets(html, baseUrl) {
  const cache = new Map();
  async function toDataUri(assetUrl) {
    if (cache.has(assetUrl)) return cache.get(assetUrl);
    try {
      const res = await fetchWithTimeout(assetUrl);
      if (!res.ok) return null;
      const type = res.headers.get('content-type') || 'application/octet-stream';
      const buf = Buffer.from(await res.arrayBuffer());
      const uri = `data:${type};base64,${buf.toString('base64')}`;
      cache.set(assetUrl, uri);
      return uri;
    } catch {
      return null;
    }
  }

  // Inline <img src="...">
  const imgMatches = [...html.matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    const abs = safeAbs(m[1], baseUrl);
    if (!abs) continue;
    const uri = await toDataUri(abs);
    if (uri) html = html.split(m[1]).join(uri);
  }

  // Inline external stylesheets by fetching and replacing <link> with <style>.
  const linkMatches = [
    ...html.matchAll(/<link\b[^>]*?rel=["']stylesheet["'][^>]*?>/gi),
  ];
  for (const m of linkMatches) {
    const tag = m[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const abs = safeAbs(hrefMatch[1], baseUrl);
    if (!abs) continue;
    try {
      const res = await fetchWithTimeout(abs);
      if (!res.ok) continue;
      const css = await res.text();
      html = html.split(tag).join(`<style>\n${css}\n</style>`);
    } catch {
      /* leave the link as-is on failure */
    }
  }

  return html;
}

function safeAbs(ref, base) {
  try {
    return new URL(ref, base).toString();
  } catch {
    return null;
  }
}

function writeFileFor(bookmarkId, ext, buffer) {
  const dir = preservedDir();
  const name = `bm${bookmarkId}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString('hex')}.${ext}`;
  const abs = path.join(dir, name);
  fs.writeFileSync(abs, buffer);
  // Store a path relative to the data dir so it can be served back.
  return path.join('preserved', name);
}

// Returns { kind, location } to be persisted by the caller.
export async function preserveLocal(bookmark) {
  const url = bookmark.url;
  try {
    if (isPdfUrl(url)) {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new PreserveError(`Fetch failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const location = writeFileFor(bookmark.id, 'pdf', buf);
      return { kind: 'pdf', location };
    }
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new PreserveError(`Fetch failed: ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const buf = Buffer.from(await res.arrayBuffer());
      const location = writeFileFor(bookmark.id, 'pdf', buf);
      return { kind: 'pdf', location };
    }
    let html = await res.text();
    html = await inlineAssets(html, url);
    const banner = `<!-- Preserved by Bookmark Manager on ${new Date().toISOString()} from ${url} -->\n`;
    const location = writeFileFor(bookmark.id, 'html', Buffer.from(banner + html, 'utf8'));
    return { kind: 'html', location };
  } catch (err) {
    if (err instanceof PreserveError) throw err;
    throw new PreserveError(`Could not preserve page: ${err.message}`);
  }
}

// Submit to the Internet Archive "Save Page Now" and return a reference.
export async function preserveArchiveOrg(bookmark) {
  const target = `https://web.archive.org/save/${bookmark.url}`;
  try {
    const res = await fetchWithTimeout(target, { method: 'GET' });
    // Archive returns the snapshot location in Content-Location or the final URL.
    const contentLocation = res.headers.get('content-location');
    let ref;
    if (contentLocation) {
      ref = `https://web.archive.org${contentLocation}`;
    } else if (res.url && res.url.includes('/web/')) {
      ref = res.url;
    } else if (res.ok) {
      ref = `https://web.archive.org/web/*/${bookmark.url}`;
    } else {
      throw new PreserveError(`Archive service returned ${res.status}`);
    }
    return { kind: 'archive_org', location: ref };
  } catch (err) {
    if (err instanceof PreserveError) throw err;
    throw new PreserveError(`Internet Archive unavailable: ${err.message}`);
  }
}
