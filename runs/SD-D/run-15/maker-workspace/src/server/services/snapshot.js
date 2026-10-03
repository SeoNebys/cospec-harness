// T053 [US11]: saved local copy of a page. Self-contained HTML for web pages
// (stylesheets + images inlined) or the PDF file itself for PDF links.
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SNAPSHOT_DIR } from '../db/connection.js';

const TIMEOUT_MS = Number(process.env.BM_FETCH_TIMEOUT_MS) || 8000;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 25;

async function fetchWithTimeout(url, fetchImpl, asBuffer = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (asBuffer) {
      const buf = Buffer.from(await res.arrayBuffer());
      return { buf, contentType };
    }
    return { text: await res.text(), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create a saved copy for a bookmark.
 * @returns {Promise<{kind:'html_snapshot'|'pdf', filename:string, path:string}>}
 * @throws if the page cannot be retrieved.
 */
export async function createSnapshot(bookmark, { fetchImpl = fetch } = {}) {
  const url = bookmark.url;
  const head = await fetchWithTimeout(url, fetchImpl, true);
  if (!head) throw new Error('Could not retrieve the page to save a copy.');

  const isPdf =
    head.contentType.includes('application/pdf') || /\.pdf($|\?)/i.test(url);

  if (isPdf) {
    const filename = `${bookmark.id}-${Date.now()}.pdf`;
    writeFileSync(join(SNAPSHOT_DIR, filename), head.buf);
    return { kind: 'pdf', filename, path: join(SNAPSHOT_DIR, filename) };
  }

  const html = head.buf.toString('utf8');
  const inlined = await inlineHtml(html, url, fetchImpl);
  const filename = `${bookmark.id}-${Date.now()}.html`;
  writeFileSync(join(SNAPSHOT_DIR, filename), inlined, 'utf8');
  return { kind: 'html_snapshot', filename, path: join(SNAPSHOT_DIR, filename) };
}

/** Produce a self-contained HTML document by inlining CSS and images. */
async function inlineHtml(html, baseUrl, fetchImpl) {
  const $ = cheerio.load(html);
  $('script').remove();

  // Inline stylesheets.
  const links = $('link[rel="stylesheet"]').toArray();
  for (const el of links) {
    const href = $(el).attr('href');
    const abs = absolute(href, baseUrl);
    if (!abs) continue;
    const css = await fetchWithTimeout(abs, fetchImpl);
    if (css && css.text) $(el).replaceWith(`<style>${css.text}</style>`);
    else $(el).remove();
  }

  // Inline images as data URIs (bounded).
  const imgs = $('img[src]').toArray().slice(0, MAX_IMAGES);
  for (const el of imgs) {
    const src = $(el).attr('src');
    if (src && src.startsWith('data:')) continue;
    const abs = absolute(src, baseUrl);
    if (!abs) continue;
    const asset = await fetchWithTimeout(abs, fetchImpl, true);
    if (asset && asset.buf && asset.buf.length <= MAX_ASSET_BYTES) {
      const type = asset.contentType || 'image/png';
      $(el).attr('src', `data:${type};base64,${asset.buf.toString('base64')}`);
    } else {
      $(el).removeAttr('src');
    }
  }

  // Record provenance.
  $('head').prepend(
    `<meta charset="utf-8"><meta name="bm-snapshot-source" content="${escapeAttr(baseUrl)}">`
  );
  return $.html();
}

function absolute(ref, base) {
  if (!ref) return '';
  try {
    return new URL(ref, base).toString();
  } catch {
    return '';
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
