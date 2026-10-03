import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getById, updateBookmark, listPendingSnapshots } from './bookmarks.js';
import { enqueue } from './jobQueue.js';

const SNAP_DIR = resolve(process.env.SNAPSHOT_DIR || 'data/snapshots');

function ensureDir() {
  mkdirSync(SNAP_DIR, { recursive: true });
}

// Detect whether the target is a PDF, using a GET and its content-type / URL.
async function detectPdf(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow' });
    const ct = res.headers.get?.('content-type') || '';
    if (ct.includes('application/pdf')) return { isPdf: true, res };
    if (/\.pdf($|\?)/i.test(url) && ct === '') return { isPdf: true, res };
    return { isPdf: false, res };
  } catch {
    return { isPdf: false, res: null };
  }
}

// Capture a snapshot. Returns one of:
//   { snapshotType:'html'|'pdf', snapshotPath, snapshotStatus:'available' }
//   { snapshotStatus:'unavailable' }
// `renderSingleFileHtml` and `fetchImpl` are injectable for tests.
export async function captureSnapshot(
  bookmark,
  { fetchImpl = globalThis.fetch, renderSingleFileHtml = defaultRenderSingleFileHtml } = {}
) {
  ensureDir();
  try {
    const { isPdf, res } = await detectPdf(bookmark.url, fetchImpl);
    if (isPdf && res) {
      const buf = Buffer.from(await res.arrayBuffer());
      const path = resolve(SNAP_DIR, `${bookmark.id}.pdf`);
      writeFileSync(path, buf);
      return { snapshotType: 'pdf', snapshotPath: path, snapshotStatus: 'available' };
    }
    const html = await renderSingleFileHtml(bookmark.url);
    if (!html) return { snapshotStatus: 'unavailable' };
    const path = resolve(SNAP_DIR, `${bookmark.id}.html`);
    writeFileSync(path, html, 'utf8');
    return { snapshotType: 'html', snapshotPath: path, snapshotStatus: 'available' };
  } catch {
    return { snapshotStatus: 'unavailable' };
  }
}

// The background job handler. CRITICAL: it writes ONLY snapshot fields (and
// favicon/preview if still empty) and NEVER title/description (Decision 11).
export async function runSnapshotJob({ bookmarkId }, deps = {}) {
  const bookmark = getById(bookmarkId);
  if (!bookmark) return;
  const result = await captureSnapshot(bookmark, deps);

  const fields = {
    snapshotStatus: result.snapshotStatus,
  };
  if (result.snapshotType) fields.snapshotType = result.snapshotType;
  if (result.snapshotPath) fields.snapshotPath = result.snapshotPath;

  // Fill favicon/preview only if still empty — never overwrite.
  if (!bookmark.faviconPath && result.faviconPath) fields.faviconPath = result.faviconPath;
  if (!bookmark.previewImagePath && result.previewImagePath) {
    fields.previewImagePath = result.previewImagePath;
  }

  // touch:false so a background capture never reorders "last updated".
  updateBookmark(bookmarkId, fields, { touch: false });
}

// Default renderer: Playwright + the shared Chromium, producing a mostly
// self-contained single HTML file (inlined stylesheets and images). Best-effort.
async function defaultRenderSingleFileHtml(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    // Inline stylesheets and images to data URIs for a self-contained file.
    await page.evaluate(async () => {
      async function toDataUri(href) {
        try {
          const r = await fetch(href);
          const blob = await r.blob();
          return await new Promise((resolveP) => {
            const reader = new FileReader();
            reader.onloadend = () => resolveP(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      }
      for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
        try {
          const r = await fetch(link.href);
          const css = await r.text();
          const style = document.createElement('style');
          style.textContent = css;
          link.replaceWith(style);
        } catch {
          /* skip */
        }
      }
      for (const img of Array.from(document.querySelectorAll('img'))) {
        if (img.src && !img.src.startsWith('data:')) {
          const data = await toDataUri(img.src);
          if (data) img.src = data;
        }
      }
    });
    const html = await page.content();
    return `<!-- Snapshot of ${url} captured ${new Date().toISOString()} -->\n${html}`;
  } finally {
    await browser.close();
  }
}

// Restart recovery (T057): re-enqueue every bookmark whose snapshot was left
// pending when the app stopped, so captures resume/retry instead of hanging.
export function recoverPendingSnapshots() {
  const pending = listPendingSnapshots();
  for (const bm of pending) {
    enqueue('snapshot', { bookmarkId: bm.id });
  }
  return pending.length;
}

export { SNAP_DIR };
