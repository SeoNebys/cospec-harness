import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';
import { CopyStatus, CopyType } from '../types';

export interface PreservedCopyRow {
  bookmark_id: number;
  type: CopyType | null;
  file_path: string | null;
  status: CopyStatus;
  byte_size: number | null;
  wayback_url: string | null;
  captured_at: string | null;
}

export function getCopy(bookmarkId: number, db: Database.Database = getDb()): PreservedCopyRow | undefined {
  return db.prepare('SELECT * FROM preserved_copies WHERE bookmark_id = ?').get(bookmarkId) as
    | PreservedCopyRow
    | undefined;
}

export function upsertCopy(
  bookmarkId: number,
  patch: Partial<Omit<PreservedCopyRow, 'bookmark_id'>>,
  db: Database.Database = getDb()
): void {
  const existing = getCopy(bookmarkId, db);
  if (!existing) {
    db.prepare(
      `INSERT INTO preserved_copies (bookmark_id, type, file_path, status, byte_size, wayback_url, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookmarkId,
      patch.type ?? null,
      patch.file_path ?? null,
      patch.status ?? 'pending',
      patch.byte_size ?? null,
      patch.wayback_url ?? null,
      patch.captured_at ?? null
    );
    return;
  }
  const merged = { ...existing, ...patch };
  db.prepare(
    `UPDATE preserved_copies
     SET type = ?, file_path = ?, status = ?, byte_size = ?, wayback_url = ?, captured_at = ?
     WHERE bookmark_id = ?`
  ).run(
    merged.type,
    merged.file_path,
    merged.status,
    merged.byte_size,
    merged.wayback_url,
    merged.captured_at,
    bookmarkId
  );
}
