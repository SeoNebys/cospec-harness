import { getDb } from '../db/connection';
import { getRawById } from '../models/bookmarks';
import { upsertCopy } from '../models/preservedCopies';
import { fetchMetadata, downloadImage } from './metadata';
import { capturePage } from './capture';
import { findSnapshot } from './archiveorg';

/**
 * Best-effort background enrichment after a bookmark is created: download the
 * site icon and preview image, preserve a full-page local copy (or original
 * PDF), and look up an Internet Archive snapshot. Never throws; failures leave
 * fields null and the copy marked unavailable.
 */
export async function enrichBookmark(bookmarkId: number, url: string): Promise<void> {
  const db = getDb();
  try {
    const meta = await fetchMetadata(url);

    // Store icon / preview images locally.
    const row = getRawById(bookmarkId, db);
    if (!row) return;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (!row.icon_path && meta.iconRemoteUrl) {
      const iconPath = await downloadImage(meta.iconRemoteUrl, `icon-${bookmarkId}`);
      if (iconPath) {
        updates.push('icon_path = ?');
        params.push(iconPath);
      }
    }
    if (!row.preview_image_path && meta.previewRemoteUrl) {
      const previewPath = await downloadImage(meta.previewRemoteUrl, `preview-${bookmarkId}`);
      if (previewPath) {
        updates.push('preview_image_path = ?');
        params.push(previewPath);
      }
    }
    if (updates.length) {
      db.prepare(`UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ?`).run(...params, bookmarkId);
    }

    // Preserve a local copy.
    const capture = await capturePage(url, bookmarkId, meta.isPdf);
    if (capture) {
      upsertCopy(
        bookmarkId,
        {
          type: capture.type,
          file_path: capture.file_path,
          status: 'available',
          byte_size: capture.byte_size,
          captured_at: new Date().toISOString(),
        },
        db
      );
    } else {
      upsertCopy(bookmarkId, { status: 'unavailable' }, db);
    }

    // Internet Archive snapshot (best-effort).
    const snap = await findSnapshot(url);
    if (snap.wayback_url) {
      upsertCopy(bookmarkId, { wayback_url: snap.wayback_url }, db);
    }
  } catch {
    upsertCopy(bookmarkId, { status: 'unavailable' }, db);
  }
}
