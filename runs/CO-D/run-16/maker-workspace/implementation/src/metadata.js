// Page metadata fetch, preserved-copy capture, and Internet Archive submission.
// These depend on real network access; every function degrades gracefully when
// a page cannot be fetched or the service is unavailable.
// Basis: SCN-001 (auto-fill), SCN-011 (recover on failure), SCN-020 (preserve
//        copy by real content type), SCN-021 (Internet Archive, on demand).
import fs from 'fs';
import path from 'path';
import { absoluteUrl, domainOf, detectFileKind } from './urls.js';

const UA = 'BookmarksApp/1.0 (+local)';

const DEFAULT_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT_MS || '8000', 10);

async function fetchWithTimeout(url, opts = {}, ms = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(timer);
  }
}

// When set, all network operations short-circuit to their degraded result.
// Used for deterministic tests in a sandbox without outbound network.
const OFFLINE = process.env.BOOKMARKS_OFFLINE === '1';

function pick(re, html) { const m = html.match(re); return m ? m[1].trim() : ''; }

// Extract title, description, and preview image from page HTML. Basis: SCN-001.
export function parseMeta(html, baseUrl) {
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, html) ||
    pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description =
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i, html) ||
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html);
  let image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html);
  if (image && !/^https?:\/\//i.test(image)) {
    try { image = new URL(image, baseUrl).href; } catch { image = ''; }
  }
  return {
    title: decode(title),
    description: decode(description),
    image,
  };
}
function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// Attempt to fetch metadata. Returns { ok, kind, title, description, image, favicon }.
export async function fetchMetadata(url) {
  const abs = absoluteUrl(url);
  const dom = domainOf(url);
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=64`;
  if (OFFLINE) return { ok: false, favicon };
  try {
    const res = await fetchWithTimeout(abs);
    if (!res.ok) return { ok: false, favicon };
    const ct = res.headers.get('content-type') || '';
    const kind = detectFileKind(ct, url);
    if (kind === 'pdf') {
      return { ok: true, kind: 'pdf', title: '', description: '', image: '', favicon };
    }
    const html = await res.text();
    const meta = parseMeta(html, abs);
    return { ok: true, kind: 'page', favicon, ...meta };
  } catch {
    return { ok: false, favicon };
  }
}

// Capture a preserved copy. For a PDF, store the file itself; for a page, store a
// self-contained snapshot (fetched HTML with a <base> so references resolve, plus
// a provenance header). Returns { snapType, snapAt, snapFile } or snapAt:null on failure.
export async function captureSnapshot(url, id, dataDir) {
  const abs = absoluteUrl(url);
  const dir = path.join(dataDir, 'snapshots');
  if (OFFLINE) return { snapType: detectFileKind('', url), snapAt: null, snapFile: '' };
  try {
    const res = await fetchWithTimeout(abs, {}, DEFAULT_TIMEOUT);
    if (!res.ok) return { snapType: detectFileKind('', url), snapAt: null, snapFile: '' };
    const ct = res.headers.get('content-type') || '';
    const kind = detectFileKind(ct, url);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (kind === 'pdf') {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join('snapshots', `${id}.pdf`);
      fs.writeFileSync(path.join(dataDir, file), buf);
      return { snapType: 'pdf', snapAt: Date.now(), snapFile: file };
    }
    const html = await res.text();
    const header = `<!-- Preserved by BookmarksApp on ${new Date().toISOString()} from ${abs} -->\n` +
      `<base href="${abs}">\n`;
    const file = path.join('snapshots', `${id}.html`);
    fs.writeFileSync(path.join(dataDir, file), header + html);
    return { snapType: 'page', snapAt: Date.now(), snapFile: file };
  } catch {
    return { snapType: detectFileKind('', url), snapAt: null, snapFile: '' };
  }
}

// Submit a page to the Internet Archive Wayback Machine (on demand).
// Returns the archived URL, or throws if the service is unavailable.
export async function sendToArchive(url) {
  const abs = absoluteUrl(url);
  const res = await fetchWithTimeout(`https://web.archive.org/save/${abs}`, { method: 'GET', redirect: 'manual' }, 20000);
  const loc = res.headers.get('content-location') || res.headers.get('location');
  if (loc) return loc.startsWith('http') ? loc : `https://web.archive.org${loc}`;
  // Fallback to the canonical latest-snapshot address.
  return `https://web.archive.org/web/${abs}`;
}
