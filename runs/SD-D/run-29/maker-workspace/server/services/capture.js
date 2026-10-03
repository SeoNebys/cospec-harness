// Automatic offline copy, attempted after a bookmark is confirmed/saved.
// - PDF targets: download the bytes and store as <id>.pdf.
// - Everything else: render in the shared Chromium and capture a single-file
//   MHTML snapshot via CDP Page.captureSnapshot, stored as <id>.mhtml.
// Best-effort: never throws to the caller; returns a status the route persists.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SNAPSHOT_DIR } from '../db.js';

const NAV_TIMEOUT_MS = 20000;

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

async function looksLikePdf(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct = head.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) return true;
  } catch { /* fall through to extension check */ }
  return /\.pdf(?:[?#]|$)/i.test(url);
}

async function capturePdf(id, url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const rel = `${id}.pdf`;
  await writeFile(join(SNAPSHOT_DIR, rel), buf);
  return { offline_status: 'available', offline_kind: 'pdf', offline_path: rel };
}

async function captureMhtml(id, url) {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    const client = await context.newCDPSession(page);
    const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' });
    const rel = `${id}.mhtml`;
    await writeFile(join(SNAPSHOT_DIR, rel), data);
    return { offline_status: 'available', offline_kind: 'mhtml', offline_path: rel };
  } finally {
    await context.close().catch(() => {});
  }
}

// Returns a result object; on failure returns { offline_status: 'unavailable' }.
export async function captureOffline(id, url) {
  try {
    if (await looksLikePdf(url)) {
      return await capturePdf(id, url);
    }
    return await captureMhtml(id, url);
  } catch {
    return { offline_status: 'unavailable', offline_kind: null, offline_path: null };
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    try { const b = await browserPromise; await b.close(); } catch { /* ignore */ }
    browserPromise = null;
  }
}
