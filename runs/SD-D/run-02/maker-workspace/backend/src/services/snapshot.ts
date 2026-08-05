/**
 * Snapshot capture (FR-026/027). For a web page, store the readable main content
 * as a standalone HTML file. For a PDF, store the original file as-is. If nothing
 * can be captured, record the snapshot as unavailable without blocking the save.
 */
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { SNAPSHOTS_DIR } from '../db/init.js';
import { looksLikePdf } from './url.js';
import * as Snapshots from '../models/snapshot.js';

const FETCH_TIMEOUT_MS = 20_000;

export async function captureSnapshot(
  db: Database.Database,
  bookmarkId: number,
  url: string,
  now: string
): Promise<void> {
  try {
    const res = await fetchWithTimeout(url);
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const isPdf = contentType.includes('application/pdf') || looksLikePdf(url);

    if (isPdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      const path = resolve(SNAPSHOTS_DIR, `${bookmarkId}.pdf`);
      await writeFile(path, buf);
      Snapshots.upsert(db, {
        bookmark_id: bookmarkId,
        kind: 'pdf',
        status: 'available',
        stored_path: path,
        captured_at: now,
        archive_url: null,
      });
      return;
    }

    if (!res.ok || !contentType.includes('text/html')) {
      return markUnavailable(db, bookmarkId, now);
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article || !article.content) return markUnavailable(db, bookmarkId, now);

    const doc = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(article.title ?? '')}</title></head>
<body><h1>${escapeHtml(article.title ?? '')}</h1>${article.content}</body></html>`;
    const path = resolve(SNAPSHOTS_DIR, `${bookmarkId}.html`);
    await writeFile(path, doc, 'utf-8');
    Snapshots.upsert(db, {
      bookmark_id: bookmarkId,
      kind: 'readable_page',
      status: 'available',
      stored_path: path,
      captured_at: now,
      archive_url: null,
    });
  } catch {
    markUnavailable(db, bookmarkId, now);
  }
}

function markUnavailable(db: Database.Database, bookmarkId: number, now: string): void {
  Snapshots.upsert(db, {
    bookmark_id: bookmarkId,
    kind: 'readable_page',
    status: 'unavailable',
    stored_path: null,
    captured_at: now,
    archive_url: null,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
  } finally {
    clearTimeout(timer);
  }
}
