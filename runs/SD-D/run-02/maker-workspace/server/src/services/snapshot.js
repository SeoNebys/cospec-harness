// Snapshot service (FR-032, R6).
// - PDF (or non-HTML binary) target -> store the original file as-is.
// - HTML page -> render with Playwright/Chromium and inline sub-resources into a
//   single self-contained HTML file that reopens offline.
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../db/connection.js';

const SNAP_DIR = join(DATA_DIR, 'snapshots');
const MAX_RESOURCE_BYTES = 3_000_000;

export class SnapshotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SnapshotError';
    this.code = 'snapshot_failed';
  }
}

async function fetchBuf(url, ms = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, type };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function captureSnapshot(url, bookmarkId) {
  mkdirSync(SNAP_DIR, { recursive: true });

  // Probe content type first so PDFs stay PDFs.
  const head = await fetchBuf(url);
  const isPdf =
    (head && head.type.includes('application/pdf')) || /\.pdf(?:$|[?#])/i.test(url);

  if (isPdf) {
    if (!head) throw new SnapshotError('Could not download the PDF.');
    const file = join(SNAP_DIR, `bookmark-${bookmarkId}.pdf`);
    writeFileSync(file, head.buf);
    return { kind: 'pdf', file_path: file, byte_size: head.buf.length };
  }

  // HTML page: render + inline.
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    });
    const baseUrl = page.url();
    const rawHtml = await page.content();
    const html = await inlineResources(rawHtml, baseUrl);
    const file = join(SNAP_DIR, `bookmark-${bookmarkId}.html`);
    writeFileSync(file, html, 'utf8');
    const byte_size = statSync(file).size;
    return { kind: 'html', file_path: file, byte_size };
  } catch (err) {
    throw new SnapshotError(`Could not snapshot the page: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function inlineResources(html, baseUrl) {
  const $ = cheerio.load(html);

  // Drop scripts — snapshots are static and offline.
  $('script').remove();

  // Inline stylesheets as <style>.
  const links = $('link[rel="stylesheet"]').toArray();
  for (const el of links) {
    const href = $(el).attr('href');
    const abs = absolutize(href, baseUrl);
    if (!abs) continue;
    const r = await fetchBuf(abs, 8000);
    if (r && r.buf.length <= MAX_RESOURCE_BYTES) {
      $(el).replaceWith(`<style>${r.buf.toString('utf8')}</style>`);
    }
  }

  // Inline images as data URIs.
  const imgs = $('img[src]').toArray();
  for (const el of imgs) {
    const src = $(el).attr('src');
    if (src && src.startsWith('data:')) continue;
    const abs = absolutize(src, baseUrl);
    if (!abs) continue;
    const r = await fetchBuf(abs, 8000);
    if (r && r.buf.length <= MAX_RESOURCE_BYTES && r.type.startsWith('image/')) {
      $(el).attr('src', `data:${r.type};base64,${r.buf.toString('base64')}`);
    }
  }

  // Record where it came from.
  $('head').prepend(
    `<meta name="x-snapshot-source" content="${escapeAttr(baseUrl)}">`
  );
  return $.html();
}

function absolutize(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
