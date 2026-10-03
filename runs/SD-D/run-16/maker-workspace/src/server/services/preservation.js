// Page preservation: a single self-contained HTML offline copy (or the original
// PDF), plus optional Internet Archive snapshot link. Degrades gracefully (FR-037).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getDb } from '../db/connection.js';
import { config } from '../config.js';
import { getBookmark } from './bookmarks.js';

// Resolve the shared Chromium executable (do NOT download a second browser).
export function resolveChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers';
  try {
    const dir = fs.readdirSync(base).find((d) => d.startsWith('chromium-'));
    if (dir) {
      const candidate = path.join(base, dir, 'chrome-linux64', 'chrome');
      if (fs.existsSync(candidate)) return candidate;
      const alt = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(alt)) return alt;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function preserveError(message) {
  const e = new Error(message);
  e.status = 502;
  e.code = 'preserve_failed';
  return e;
}

async function isPdf(address) {
  if (/\.pdf(\?.*)?$/i.test(address)) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    const res = await fetch(address, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return (res.headers.get('content-type') || '').toLowerCase().includes('application/pdf');
  } catch {
    return false;
  }
}

async function savePdf(address, id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.preserveTimeoutMs);
  let res;
  try {
    res = await fetch(address, { signal: controller.signal, redirect: 'follow' });
  } catch {
    clearTimeout(timer);
    throw preserveError('Could not download the PDF (the page may be unreachable).');
  }
  clearTimeout(timer);
  if (!res.ok) throw preserveError(`Could not download the PDF (status ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filename = `${id}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(config.preservedDir, filename), buf);
  return { filename, kind: 'pdf' };
}

function saveHtml(address, id) {
  return new Promise((resolve, reject) => {
    const chromium = resolveChromium();
    if (!chromium) return reject(preserveError('No browser is available to preserve the page.'));
    const filename = `${id}-${Date.now()}.html`;
    const outPath = path.join(config.preservedDir, filename);
    const bin = path.join(config.repoRoot, 'node_modules', '.bin', 'single-file');
    const args = [
      address,
      outPath,
      `--browser-executable-path=${chromium}`,
      '--browser-arg=--no-sandbox',
      '--browser-arg=--disable-gpu',
      '--browser-arg=--disable-dev-shm-usage',
    ];
    const child = spawn(bin, args, { cwd: config.repoRoot });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(preserveError('Preserving the page timed out.'));
    }, config.preserveTimeoutMs);
    child.on('error', () => {
      clearTimeout(timer);
      reject(preserveError('Could not start the preservation process.'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
        resolve({ filename, kind: 'html' });
      } else {
        reject(preserveError(`Could not preserve the page${stderr ? `: ${stderr.trim().slice(0, 200)}` : '.'}`));
      }
    });
  });
}

export async function preserveOfflineCopy(id) {
  const bookmark = getBookmark(id);
  if (!bookmark) throw preserveError('Bookmark not found.');
  const result = (await isPdf(bookmark.address)) ? await savePdf(bookmark.address, id) : await saveHtml(bookmark.address, id);
  const db = getDb();
  db.prepare('UPDATE bookmarks SET preserved_copy_path = ?, preserved_copy_kind = ?, preserved_at = ? WHERE id = ?').run(
    result.filename,
    result.kind,
    new Date().toISOString(),
    id
  );
  return getBookmark(id);
}

export async function preserveToInternetArchive(id) {
  const bookmark = getBookmark(id);
  if (!bookmark) throw preserveError('Bookmark not found.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.preserveTimeoutMs);
  let res;
  try {
    res = await fetch(`https://web.archive.org/save/${bookmark.address}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
  } catch {
    clearTimeout(timer);
    throw preserveError('Could not reach the Internet Archive.');
  }
  clearTimeout(timer);
  // Snapshot URL from Content-Location header or the final resolved URL.
  const contentLocation = res.headers.get('content-location');
  let snapshotUrl = contentLocation ? `https://web.archive.org${contentLocation}` : null;
  if (!snapshotUrl && /\/web\/\d+\//.test(res.url || '')) snapshotUrl = res.url;
  if (!snapshotUrl) throw preserveError('The Internet Archive did not return a snapshot link.');

  const db = getDb();
  db.prepare('UPDATE bookmarks SET archive_org_url = ?, archive_org_at = ? WHERE id = ?').run(
    snapshotUrl,
    new Date().toISOString(),
    id
  );
  return getBookmark(id);
}

export function readPreservedFile(id) {
  const bookmark = getBookmark(id);
  if (!bookmark || !bookmark.preservedCopyPath) return null;
  const filePath = path.join(config.preservedDir, bookmark.preservedCopyPath);
  if (!fs.existsSync(filePath)) return null;
  return {
    path: filePath,
    contentType: bookmark.preservedCopyKind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8',
  };
}
