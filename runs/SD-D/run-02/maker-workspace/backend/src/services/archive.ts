/**
 * Optional opt-in submission to a public web archive (FR-027a). This is a
 * best-effort second safety net: any failure is swallowed and never blocks
 * saving or the local snapshot. Deferrable by design.
 */
import type Database from 'better-sqlite3';
import * as Snapshots from '../models/snapshot.js';

const WAYBACK_SAVE = 'https://web.archive.org/save/';

export async function submitToArchive(
  db: Database.Database,
  bookmarkId: number,
  url: string
): Promise<void> {
  try {
    const res = await fetch(`${WAYBACK_SAVE}${url}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
    // Wayback returns the archived URL via Content-Location or the final URL.
    const archived = res.headers.get('content-location');
    const archiveUrl = archived
      ? `https://web.archive.org${archived}`
      : res.url && res.url.includes('/web/')
        ? res.url
        : null;
    if (archiveUrl) Snapshots.setArchiveUrl(db, bookmarkId, archiveUrl);
  } catch {
    // Intentionally ignored — never block on the archive safety net.
  }
}
