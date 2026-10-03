// Preserved page copies (FR-021) + shared cleanup helper (T052).
// HTML pages -> self-contained single HTML file with inlined resources.
// PDF URLs  -> stored as-is.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { PAGECOPY_DIR } from '../db/index.js';

const FETCH_TIMEOUT = 20000;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

async function fetchBuffer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (BookmarkManager)' },
    });
    const contentType = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, contentType, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

async function toDataUri(assetUrl) {
  try {
    const { buf, contentType } = await fetchBuffer(assetUrl);
    if (buf.length > MAX_ASSET_BYTES) return null;
    const mime = (contentType.split(';')[0] || 'application/octet-stream').trim();
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function buildSelfContainedHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const abs = (u) => { try { return new URL(u, baseUrl).toString(); } catch { return null; } };

  // Inline stylesheets.
  const links = $('link[rel="stylesheet"]').toArray();
  for (const el of links) {
    const href = abs($(el).attr('href'));
    if (!href) continue;
    try {
      const { buf } = await fetchBuffer(href);
      $(el).replaceWith(`<style>${buf.toString('utf8')}</style>`);
    } catch { /* drop broken stylesheet */ }
  }

  // Inline images as data URIs.
  const imgs = $('img[src]').toArray();
  for (const el of imgs) {
    const src = abs($(el).attr('src'));
    if (!src) continue;
    const dataUri = await toDataUri(src);
    if (dataUri) $(el).attr('src', dataUri);
  }

  // Remove scripts (offline-readable, not interactive) per approved scope.
  $('script').remove();

  // Add a <base> so any remaining relative links resolve.
  if ($('base').length === 0) $('head').prepend(`<base href="${baseUrl}">`);

  return $.html();
}

// Create a preserved copy; returns { path, kind }. Throws on failure so the
// route can report it without mutating the bookmark.
export async function createPageCopy(bookmarkId, url) {
  const { buf, contentType, finalUrl } = await fetchBuffer(url);
  const isPdf = contentType.includes('application/pdf') ||
    url.toLowerCase().split('?')[0].endsWith('.pdf');

  fs.mkdirSync(PAGECOPY_DIR, { recursive: true });

  if (isPdf) {
    const filePath = path.join(PAGECOPY_DIR, `${bookmarkId}.pdf`);
    fs.writeFileSync(filePath, buf);
    return { path: filePath, kind: 'pdf' };
  }

  const html = buf.toString('utf8');
  const selfContained = await buildSelfContainedHtml(html, finalUrl);
  const filePath = path.join(PAGECOPY_DIR, `${bookmarkId}.html`);
  fs.writeFileSync(filePath, selfContained, 'utf8');
  return { path: filePath, kind: 'html' };
}

// Shared cleanup helper used by single and bulk delete (T052/T038).
export function deletePageCopyFile(pageCopyPath) {
  if (!pageCopyPath) return;
  try {
    if (fs.existsSync(pageCopyPath)) fs.unlinkSync(pageCopyPath);
  } catch { /* best-effort */ }
}
