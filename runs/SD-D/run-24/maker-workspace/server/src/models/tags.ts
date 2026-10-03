import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';

export function ensureTag(name: string, db: Database.Database = getDb()): number {
  const clean = name.trim();
  if (!clean) throw new Error('Tag name cannot be empty');
  const existing = db
    .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
    .get(clean) as { id: number } | undefined;
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(clean);
  return Number(info.lastInsertRowid);
}

export function getBookmarkTags(bookmarkId: number, db: Database.Database = getDb()): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId) as { name: string }[];
  return rows.map((r) => r.name);
}

/** Replace the full tag set on a bookmark. */
export function setBookmarkTags(
  bookmarkId: number,
  names: string[],
  db: Database.Database = getDb()
): void {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  for (const name of unique) {
    link.run(bookmarkId, ensureTag(name, db));
  }
}

export function addTagsToBookmark(
  bookmarkId: number,
  names: string[],
  db: Database.Database = getDb()
): void {
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    link.run(bookmarkId, ensureTag(name, db));
  }
}

export function removeTagsFromBookmark(
  bookmarkId: number,
  names: string[],
  db: Database.Database = getDb()
): void {
  const del = db.prepare(
    `DELETE FROM bookmark_tags
     WHERE bookmark_id = ?
       AND tag_id IN (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)`
  );
  for (const name of names) del.run(bookmarkId, name.trim());
}

export function suggestTags(query: string, db: Database.Database = getDb()): string[] {
  const like = '%' + query.trim().toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m) + '%';
  const rows = db
    .prepare(
      `SELECT name FROM tags
       WHERE LOWER(name) LIKE ? ESCAPE '\\'
       ORDER BY name COLLATE NOCASE LIMIT 20`
    )
    .all(like) as { name: string }[];
  return rows.map((r) => r.name);
}

export function listAllTags(db: Database.Database = getDb()): { id: number; name: string }[] {
  return db
    .prepare('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE')
    .all() as { id: number; name: string }[];
}

export function deleteTag(id: number, db: Database.Database = getDb()): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function tagNamesForIds(ids: number[], db: Database.Database = getDb()): string[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT name FROM tags WHERE id IN (${placeholders}) ORDER BY name COLLATE NOCASE`)
    .all(...ids) as { name: string }[];
  return rows.map((r) => r.name);
}
