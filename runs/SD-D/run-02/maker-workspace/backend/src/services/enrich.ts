/**
 * Background enrichment for a newly saved bookmark: fetch page metadata, fill in
 * any details the user didn't provide, capture a snapshot, and (if opted in)
 * submit to a public archive. None of this blocks the save response (SC-001).
 */
import type Database from 'better-sqlite3';
import { fetchMetadata } from './metadata.js';
import { captureSnapshot } from './snapshot.js';
import { submitToArchive } from './archive.js';
import * as Bookmarks from '../models/bookmark.js';

export interface EnrichOptions {
  /** Fields the user explicitly supplied should not be overwritten by fetched data. */
  userProvided: { title?: boolean; description?: boolean };
  archiveOptin: boolean;
}

export async function enrichBookmark(
  db: Database.Database,
  bookmarkId: number,
  url: string,
  opts: EnrichOptions
): Promise<void> {
  const now = () => new Date().toISOString();

  // 1) Metadata — fill only the gaps the user left (FR-002/003).
  try {
    const meta = await fetchMetadata(url);
    const fields: Bookmarks.UpdateFields = {};
    if (!opts.userProvided.title && meta.title) fields.title = meta.title;
    if (!opts.userProvided.description && meta.description) fields.description = meta.description;
    if (meta.iconUrl) fields.icon_ref = meta.iconUrl;
    if (meta.previewImage) fields.preview_ref = meta.previewImage;
    if (Object.keys(fields).length) Bookmarks.update(db, bookmarkId, fields, now());
  } catch {
    // Keep the fallback title (FR-004).
  }

  // 2) Snapshot — readable page or original PDF (FR-026/027).
  await captureSnapshot(db, bookmarkId, url, now());

  // 3) Optional public archive (FR-027a).
  if (opts.archiveOptin) await submitToArchive(db, bookmarkId, url);
}
