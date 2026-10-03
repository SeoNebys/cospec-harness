// Capture service: fetch page details, thumbnail, and snapshot at save time.
// Web pages -> single-file MHTML; PDFs -> original bytes (research.md #4/#5).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { SNAPSHOT_DIR, THUMBNAIL_DIR, FAVICON_DIR } from '../db.js';
import { extractMetadata } from './metadata.js';

const NAV_TIMEOUT = 20000;

function extFromContentType(ct, fallback) {
  if (!ct) return fallback;
  if (ct.includes('png')) return '.png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('svg')) return '.svg';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('x-icon') || ct.includes('vnd.microsoft.icon')) return '.ico';
  return fallback;
}

// Download a binary asset into `dir`; returns the stored filename or null.
async function downloadAsset(url, dir, defaultExt) {
  if (!url) return null;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(NAV_TIMEOUT) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const ext = extFromContentType(res.headers.get('content-type'), defaultExt);
    const name = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  } catch {
    return null;
  }
}

// Inspect the target's content type without committing to a full render.
async function detectContentType(address) {
  try {
    const res = await fetch(address, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(NAV_TIMEOUT) });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/pdf')) {
      const buf = Buffer.from(await res.arrayBuffer());
      return { type: 'pdf', buf };
    }
    // Not a PDF; drain is unnecessary, let it be GC'd.
    return { type: 'html' };
  } catch {
    // Fall back to extension hint.
    if (/\.pdf($|\?)/i.test(address)) return { type: 'pdf-unfetched' };
    return { type: 'html' };
  }
}

// Main entry: returns a details bundle for Bookmark.create().
// Never throws; missing pieces degrade to null/false (FR-005/FR-008).
export async function capturePage(address) {
  const details = {
    title: '',
    description: '',
    faviconPath: null,
    previewImagePath: null,
    snapshotPath: null,
    snapshotType: null,
    snapshotAvailable: false,
  };

  const detected = await detectContentType(address);

  // --- PDF branch: preserve original bytes as the snapshot (FR-007) ---
  if (detected.type === 'pdf' || detected.type === 'pdf-unfetched') {
    let buf = detected.buf;
    if (!buf && detected.type === 'pdf-unfetched') {
      try {
        const res = await fetch(address, { redirect: 'follow', signal: AbortSignal.timeout(NAV_TIMEOUT) });
        if (res.ok) buf = Buffer.from(await res.arrayBuffer());
      } catch {
        /* leave buf undefined */
      }
    }
    if (buf && buf.length > 0) {
      const name = `${crypto.randomUUID()}.pdf`;
      fs.writeFileSync(path.join(SNAPSHOT_DIR, name), buf);
      details.snapshotPath = name;
      details.snapshotType = 'pdf';
      details.snapshotAvailable = true;
    }
    details.faviconPath = await downloadAsset(new URL('/favicon.ico', address).toString(), FAVICON_DIR, '.ico');
    return details;
  }

  // --- Web page branch: render, extract metadata, snapshot MHTML, thumbnail ---
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(address, { waitUntil: 'load', timeout: NAV_TIMEOUT });

    const html = await page.content();
    const meta = extractMetadata(html, address);
    details.title = meta.title || '';
    details.description = meta.description || '';

    // Snapshot: single-file MHTML via CDP.
    try {
      const session = await context.newCDPSession(page);
      const { data } = await session.send('Page.captureSnapshot', { format: 'mhtml' });
      if (data) {
        const name = `${crypto.randomUUID()}.mhtml`;
        fs.writeFileSync(path.join(SNAPSHOT_DIR, name), data);
        details.snapshotPath = name;
        details.snapshotType = 'webpage';
        details.snapshotAvailable = true;
      }
    } catch {
      /* snapshot unavailable */
    }

    // Favicon.
    details.faviconPath = await downloadAsset(meta.favicon, FAVICON_DIR, '.ico');

    // Preview thumbnail: og:image if present, else a page screenshot.
    if (meta.previewImage) {
      details.previewImagePath = await downloadAsset(meta.previewImage, THUMBNAIL_DIR, '.png');
    }
    if (!details.previewImagePath) {
      try {
        const name = `${crypto.randomUUID()}.png`;
        await page.screenshot({ path: path.join(THUMBNAIL_DIR, name), fullPage: false });
        details.previewImagePath = name;
      } catch {
        /* thumbnail unavailable */
      }
    }
  } catch {
    // Page unreachable or render failed: keep whatever we have (FR-005).
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return details;
}
