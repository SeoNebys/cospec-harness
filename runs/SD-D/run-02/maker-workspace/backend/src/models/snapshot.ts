/**
 * Snapshot model. One snapshot per bookmark; the payload (readable HTML or the
 * original PDF) lives on disk under data/snapshots/, referenced by stored_path.
 */
import type Database from 'better-sqlite3';

export interface Snapshot {
  id: number;
  bookmark_id: number;
  kind: 'readable_page' | 'pdf';
  status: 'available' | 'unavailable';
  stored_path: string | null;
  captured_at: string;
  archive_url: string | null;
}

export function upsert(
  db: Database.Database,
  s: Omit<Snapshot, 'id'>
): void {
  db.prepare(
    `INSERT INTO snapshots (bookmark_id, kind, status, stored_path, captured_at, archive_url)
     VALUES (@bookmark_id, @kind, @status, @stored_path, @captured_at, @archive_url)
     ON CONFLICT(bookmark_id) DO UPDATE SET
       kind = excluded.kind, status = excluded.status,
       stored_path = excluded.stored_path, captured_at = excluded.captured_at,
       archive_url = COALESCE(excluded.archive_url, snapshots.archive_url)`
  ).run(s);
}

export function get(db: Database.Database, bookmarkId: number): Snapshot | null {
  const row = db.prepare(`SELECT * FROM snapshots WHERE bookmark_id = ?`).get(bookmarkId) as
    | Snapshot
    | undefined;
  return row ?? null;
}

export function setArchiveUrl(db: Database.Database, bookmarkId: number, url: string): void {
  db.prepare(`UPDATE snapshots SET archive_url = ? WHERE bookmark_id = ?`).run(url, bookmarkId);
}
